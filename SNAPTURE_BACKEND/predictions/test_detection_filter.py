from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase
from PIL import Image

from . import scene_detector as detector
from . import test_scenes as scene_fixtures
from .models import PredictionRecord


def row(name='paper scrap', score=.8, box=None, **extra):
    return {'name':name, 'score':score, 'box':box or [.1,.1,.5,.5], 'material':'paper', **extra}


class DetectionPolicyTests(SimpleTestCase):
    def test_borderline_and_broad_textile_regions_abstain_even_above_general_cutoff(self):
        borderline, broad, compact, corrected = [detector.presentation([proposal])[0] for proposal in [
            row('towel',.302,[.01,.26,.765,1]),
            row('blanket',.9,[.1,.1,.9,.9]),
            row('pillow',.8,[.6,.1,.9,.4]),
            row('towel',.302,[.01,.26,.765,1],object_confirmed=True),
        ]]
        self.assertEqual(borderline['detection_status'],'review')
        self.assertIn('confirmation',borderline['detection_reason'])
        self.assertEqual(broad['detection_status'],'review')
        self.assertEqual(compact['detection_status'],'accepted')
        self.assertEqual(corrected['detection_status'],'accepted')

    def test_weak_matches_and_competing_queries_are_not_accepted(self):
        weak, conflict = detector.presentation([
            row(score=.17), row('towel', .7, [.6,.1,.9,.9], alternatives=[{'label':'disposable diaper','score':.68}]),
        ])
        self.assertEqual(weak['detection_status'], 'review')
        self.assertEqual(conflict['detection_status'], 'review')

    def test_near_identical_textile_queries_deduplicate_but_separate_items_survive(self):
        kept, _ = detector.clean_detections([
            row('blanket',.8), row('towel',.7,[.11,.11,.49,.49]), row('cloth or fabric scrap',.6,[.6,.1,.9,.5]),
        ])
        self.assertEqual(len(kept), 2)
        result = detector.presentation([row('blanket',alternatives=[{'label':'towel','score':.79}])])[0]
        self.assertEqual(result['detection_status'], 'accepted')

    def test_people_and_body_parts_are_excluded_and_overlapping_false_matches_need_review(self):
        for name in detector.HUMAN_NAMES:
            self.assertEqual(detector.presentation([row(name,.99)])[0]['detection_status'], 'excluded')
        body, false_match, foreground = detector.presentation([
            row('human foot',.8), row('food scraps or fruit peel',.65), row('plastic bottle',.7,[.7,.1,.9,.5]),
        ])
        self.assertEqual(body['detection_status'],'excluded')
        self.assertEqual(false_match['detection_status'],'review')
        self.assertEqual(foreground['detection_status'],'accepted')

    def test_background_is_review_only_without_hiding_small_foreground_objects(self):
        background, foreground = detector.presentation([
            row('computer keyboard',.8,[.1,.1,.9,.9]), row('plastic bottle',.7,[.2,.2,.3,.4]),
        ])
        self.assertEqual(background['detection_status'],'review')
        self.assertEqual(foreground['detection_status'],'accepted')

    def test_manual_confirmation_is_preserved_but_cannot_make_a_body_part_waste(self):
        self.assertEqual(detector.presentation([row(score=.1,object_confirmed=True)])[0]['detection_status'],'accepted')
        self.assertEqual(detector.presentation([row('human leg',object_confirmed=True)])[0]['detection_status'],'excluded')

    def test_default_inference_uses_one_full_photo_pass_without_downloads(self):
        import torch
        processor = Mock(return_value={})
        processor.post_process_grounded_object_detection.return_value = [{
            'boxes':torch.tensor([[100,100,300,300]]), 'scores':torch.tensor([.8]), 'labels':torch.tensor([0]),
        }]
        with patch.object(detector,'available',return_value=True), patch.object(detector,'_processor',processor), patch.object(detector,'_model',Mock()):
            result, _ = detector.detect(Image.new('RGB',(800,800),'white'))
        self.assertEqual(processor.call_count,1)
        self.assertEqual(result[0]['detection_status'],'accepted')


class FilterSceneTests(TestCase):
    setUp = scene_fixtures.SceneApiTests.setUp
    create = scene_fixtures.SceneApiTests.create
    upload = scene_fixtures.SceneApiTests.upload

    def test_towel_regression_keeps_raw_guess_but_only_exposes_generic_review_title(self):
        result = self.create(rows=[row('towel',.302,[.004,.258,.765,1],material='fabric_scraps')]).json()['scene']
        item = result['items'][0]
        self.assertEqual(item['name'],'towel')
        self.assertEqual(item['display_name'],'Possible fabric item')
        self.assertTrue(item['name_confirmation_required'])
        self.assertEqual(item['detection_status'],'review')
        self.assertFalse(item['display_box'])
        self.assertIs(item['automatic_route']['needs_review'],True)
        self.assertEqual(result['accepted_count'],0)
        self.assertNotIn('edge_item',{flag['code'] for flag in result['quality']['flags']})
        self.assertEqual(PredictionRecord.objects.get().model_class,'towel')

    def test_material_confirmation_alone_cannot_unlock_a_borderline_object_project(self):
        import json
        result = self.create(rows=[row('towel',.302,[.1,.1,.5,.5],material='fabric_scraps')]).json()['scene']
        item = result['items'][0]
        self.client.post(f"/api/scenes/{result['id']}/disposal-selection/",json.dumps({
            'item_ids':[item['id']], 'automatic_routing':True,
        }),content_type='application/json',**self.auth)
        checked = self.client.patch(f"/api/predictions/{item['prediction']['id']}/",json.dumps({
            'condition':'Clean and dry','answers':{'material_confirmation':'fabric_scraps'},
        }),content_type='application/json',**self.auth)
        self.assertEqual(checked.status_code,200)
        self.assertEqual(checked.json()['prediction']['upcycling_ideas'],[])
        rejected = self.client.post('/api/projects/',json.dumps({
            'prediction_id':item['prediction']['id'],'recommendation_id':'fabric_cleaning_cloth',
        }),content_type='application/json',**self.auth)
        self.assertEqual(rejected.status_code,400)
        # An explicit user object correction is retained as a report, not AI truth.
        corrected = self.client.post(f"/api/scenes/{result['id']}/disposal-selection/",json.dumps({
            'item_ids':[item['id']], 'automatic_routing':True, 'object_names':{str(item['id']):'blanket'},
        }),content_type='application/json',**self.auth).json()['scene']['items'][0]
        self.assertEqual(corrected['display_name'],'blanket')
        self.assertFalse(corrected['name_confirmation_required'])
        self.assertEqual(corrected['name'],'towel')
        self.assertTrue(corrected['action_advice']['projects'])

    def test_weak_proposals_do_not_generate_crowding_or_edge_warnings(self):
        rows = [row(score=.15,box=[index*.1,0,index*.1+.08,.1]) for index in range(9)]
        result = self.create(rows=rows).json()['scene']
        self.assertEqual(result['accepted_count'],0)
        self.assertEqual(result['review_count'],9)
        self.assertTrue(all(not item['display_box'] for item in result['items']))
        self.assertFalse({'edge_item','crowded','busy_background'} & {flag['code'] for flag in result['quality']['flags']})

    def test_body_queries_are_not_saved_as_waste_or_material_crops(self):
        result = self.create(rows=[row('human leg',.9)]).json()['scene']
        self.assertEqual(result['items'],[])
        self.assertEqual(PredictionRecord.objects.count(),0)
        self.assertEqual(result['quality']['detection_filter']['excluded_count'],1)

    def test_duplicate_regions_are_not_saved_as_extra_waste_items(self):
        result = self.create(rows=[row(),row(score=.7,box=[.11,.11,.49,.49])]).json()['scene']
        self.assertEqual(len(result['items']),1)
        self.assertEqual(result['accepted_count'],1)
        self.assertEqual(PredictionRecord.objects.count(),1)

    def test_historical_read_hides_weak_boxes_without_rewriting_records(self):
        result = self.create().json()['scene']
        before = list(PredictionRecord.objects.values('id','image_quality','assessment'))
        saved = self.client.get(f"/api/scenes/{result['id']}/?history=1",**self.auth).json()['scene']
        self.assertEqual(saved['accepted_count'],0)
        self.assertFalse(saved['items'][0]['display_box'])
        self.assertEqual(before,list(PredictionRecord.objects.values('id','image_quality','assessment')))
