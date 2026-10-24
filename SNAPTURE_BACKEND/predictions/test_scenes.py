import json
import tempfile
from io import BytesIO
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image, ImageFilter
import numpy as np

from core.auth import issue_token
from .image_quality import frame_bounds, oriented_image, quality_report
from .models import PredictionRecord, ScanScene
from .scene_detector import clean_detections
from .scene_views import routing


class QualityTests(TestCase):
    def test_darkness_only_when_flagged(self):
        self.assertIn('dark',[row['code'] for row in quality_report(Image.new('RGB',(100,100),'black'))['flags']])
        self.assertEqual(quality_report(Image.new('RGB',(100,100),'white'))['flags'],[])

    def test_softness_crowding_and_cutoff_are_conditional(self):
        rng = np.random.default_rng(42)
        image = Image.fromarray(rng.integers(0,255,(320,320,3),dtype=np.uint8))
        self.assertNotIn('blur',[row['code'] for row in quality_report(image)['flags']])
        # A heavily blurred high-contrast image triggers a possible-softness warning.
        block = Image.new('RGB',(320,320),'black'); block.paste('white',(160,0,320,320))
        self.assertIn('blur',[row['code'] for row in quality_report(block.filter(ImageFilter.GaussianBlur(12)))['flags']])
        codes = [row['code'] for row in quality_report(image,[[0,.1,.3,.4]]*9,single=True)['flags']]
        self.assertTrue({'edge_item','multiple_items','crowded'}.issubset(codes))

    def test_preview_cover_coordinates_and_invalid_frame(self):
        image = Image.new('RGB',(400,300))
        self.assertEqual(frame_bounds(image,{'aspect':1,'x':0,'y':0,'width':1,'height':1}),(50,0,350,300))
        for frame in ({'aspect':float('nan'),'x':0,'y':0,'width':1,'height':1}, {'aspect':1,'x':.5,'y':0,'width':1,'height':1},[]):
            with self.assertRaises(ValueError): frame_bounds(image,frame)

    def test_duplicate_boxes_and_invalid_scores_are_filtered(self):
        rows = [{'name':'paper','score':.6,'box':[.1,.1,.3,.3]}, {'name':'cardboard','score':.5,'box':[.1,.1,.3,.3]}, {'name':'x','score':float('nan'),'box':[0,0,1,1]}]
        kept,truncated = clean_detections(rows)
        self.assertEqual(len(kept),1); self.assertFalse(truncated)

    def test_nested_same_family_is_merged_without_growing_to_union(self):
        kept,_ = clean_detections([
            {'name':'plastic bottle','score':.7,'box':[.1,.1,.6,.6]},
            {'name':'plastic jug or container','score':.5,'box':[.15,.15,.55,.55]},
        ])
        self.assertEqual(len(kept),1)
        self.assertGreater(kept[0]['box'][0],.1)
        self.assertLess(kept[0]['box'][2],.6)

    def test_background_suppresses_duplicate_keyboard_region_not_foreground_item(self):
        kept,_ = clean_detections([
            {'name':'computer keyboard','score':.6,'box':[.1,.1,.8,.8]},
            {'name':'cloth or fabric scrap','score':.4,'box':[.11,.11,.79,.79]},
            {'name':'plastic bottle','score':.5,'box':[.2,.2,.3,.4]},
        ])
        self.assertEqual({row['name'] for row in kept},{'computer keyboard','plastic bottle'})


class SceneApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('scene-test')
        self.auth = {'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup)
        override = self.settings(MEDIA_ROOT=temp.name); override.enable(); self.addCleanup(override.disable)
        # Scene workflow tests use deterministic material evidence; classifier
        # integration is exercised separately with the real service boundary.
        def material(image, row):
            label=row.get('material','unknown_unsupported')
            if label=='unknown_unsupported':
                return {'label':label,'status':'not_applicable','basis':'outside test dataset scope'}
            return {'label':label,'raw_class':label,'confidence':row['score'],'threshold':.1,
                    'model_version':'dataset-candidate-unverified-test','status':'classified','basis':'test dataset model'}
        classifier=patch('predictions.scene_views.classify_detected_material',side_effect=material)
        classifier.start();self.addCleanup(classifier.stop)

    def upload(self, request_id='scene_request_123', frame=None):
        image = BytesIO(); Image.new('RGB',(200,100),'white').save(image,format='JPEG')
        fields = {'request_id':request_id,'image':SimpleUploadedFile('scene.jpg',image.getvalue(),content_type='image/jpeg')}
        if frame is not None: fields['frame'] = json.dumps(frame)
        return self.client.post('/api/scenes/',fields,**self.auth)

    def create(self, rows=None, request_id='scene_request_123', frame=None):
        if rows is None: rows = [{'name':'paper scrap','material':'paper','score':.22,'box':[.1,.1,.4,.8]}]
        with patch('predictions.scene_detector.available',return_value=True), patch('predictions.scene_detector.detect',return_value=(rows,False)):
            return self.upload(request_id,frame)

    def test_items_get_real_boxes_but_no_automatic_approval(self):
        response = self.create(); self.assertEqual(response.status_code,201)
        scene = response.json()['scene']; item = scene['items'][0]
        self.assertEqual(item['box'],[.1,.1,.4,.8]); self.assertEqual(item['route']['key'],'review')
        self.assertEqual(item['suggested_group'],'recyclable')
        self.assertTrue(item['prediction']['needs_verification'])
        self.assertEqual(item['prediction']['recommendation_choices'],[])
        self.assertEqual(item['prediction']['image_quality']['alternatives'],[])
        self.assertEqual(item['prediction']['image_quality']['material_prediction']['label'],'paper')
        self.assertTrue(item['display_box'])
        self.assertEqual(item['display_group'],'review')

    def test_no_detections_are_not_replaced_with_fake_boxes(self):
        result = self.create(rows=[]).json()['scene']
        self.assertEqual(result['items'],[]); self.assertEqual(PredictionRecord.objects.count(),0)

    def test_background_detections_stay_boxed_but_unconfirmed(self):
        result = self.create(rows=[{'name':'computer keyboard','material':'unknown_unsupported','score':.6,'box':[.1,.1,.8,.8]}]).json()['scene']
        self.assertEqual(len(result['items']),1)
        self.assertTrue(result['items'][0]['background'])
        self.assertEqual(result['items'][0]['display_group'],'special')
        self.assertEqual(result['background_objects'],[{'name':'computer keyboard','count':1}])
        self.assertEqual(PredictionRecord.objects.count(),1)

    def test_reported_chemical_contact_stays_in_special_handling_even_at_low_score(self):
        result = self.create().json()['scene']
        record = PredictionRecord.objects.get(pk=result['items'][0]['prediction']['id'])
        record.previous_contents = 'Chemical or cleaning product'
        record.save()
        refreshed = self.client.get(f"/api/scenes/{result['id']}/",**self.auth).json()['scene']
        self.assertEqual(refreshed['items'][0]['display_group'],'special')
        self.assertTrue(refreshed['items'][0]['display_box'])

    def test_request_retry_is_idempotent_and_reads_are_owner_only(self):
        first = self.create().json()['scene']
        again = self.upload().json()['scene']; self.assertEqual(first['id'],again['id'])
        self.assertEqual(ScanScene.objects.count(),1); self.assertEqual(PredictionRecord.objects.count(),1)
        other = User.objects.create_user('other-scene-test')
        response = self.client.get(f"/api/scenes/{first['id']}/",HTTP_AUTHORIZATION=f'Bearer {issue_token(other)}')
        self.assertEqual(response.status_code,404)
        self.assertEqual(self.client.get('/api/scenes/').status_code,401)

    def test_camera_frame_maps_boxes_back_to_full_image(self):
        scene = self.create(frame={'aspect':1,'x':0,'y':0,'width':1,'height':1}).json()['scene']
        self.assertEqual(scene['frame'],[.25,0,.75,1])
        self.assertAlmostEqual(scene['items'][0]['box'][0],.3)
        self.assertAlmostEqual(scene['items'][0]['box'][2],.45)

    def test_delete_removes_full_photo_and_crops(self):
        scene = self.create().json()['scene']; obj = ScanScene.objects.get(pk=scene['id'])
        photo = obj.image.path; crop = obj.items.first().prediction.image.path
        self.assertEqual(self.client.delete(f"/api/scenes/{obj.pk}/",**self.auth).status_code,200)
        from pathlib import Path
        self.assertFalse(Path(photo).exists()); self.assertFalse(Path(crop).exists())
        self.assertFalse(PredictionRecord.objects.exists())

    def test_detector_missing_and_bad_frame_return_actionable_errors(self):
        with patch('predictions.scene_detector.available',return_value=False), patch('predictions.scene_views.model_status',return_value={'loaded':False}):
            self.assertEqual(self.upload().status_code,503)
        self.assertEqual(self.create(frame={'aspect':1,'x':1,'y':1,'width':1,'height':1}).status_code,400)

    def test_dataset_model_can_classify_the_whole_photo_without_fabricating_a_detection_score(self):
        material={'label':'cardboard','raw_class':'cardboard','confidence':.93,'threshold':.8,
                  'model_version':'dataset-candidate-unverified-test','status':'classified','basis':'Model trained on SNAPTURE_ML/data'}
        with patch('predictions.scene_detector.available',return_value=False), patch('predictions.scene_views.model_status',return_value={'loaded':True}), patch('predictions.scene_views.classify_material',return_value=material):
            response=self.upload()
        self.assertEqual(response.status_code,201)
        item=response.json()['scene']['items'][0]
        self.assertEqual(item['prediction']['decision'],'cardboard')
        self.assertEqual(item['prediction']['confidence'],.93)
        self.assertIsNone(item['identification']['object_prediction']['confidence'])
        self.assertEqual(item['identification']['object_prediction']['source'],'whole_image_classifier')
        self.assertEqual(item['identification']['material_prediction']['confidence'],.93)
        self.assertFalse(item['display_box'])
        self.assertNotIn('edge_item',[flag['code'] for flag in response.json()['scene']['quality']['flags']])

    def test_scene_uses_crop_classifier_even_when_its_label_disagrees_with_the_detector(self):
        material={'label':'cardboard','raw_class':'cardboard','confidence':.93,'threshold':.8,
                  'model_version':'dataset-candidate-unverified-test','status':'classified','basis':'Model trained on SNAPTURE_ML/data'}
        with patch('predictions.scene_views.classify_detected_material',return_value=material):
            response=self.create()
        item=response.json()['scene']['items'][0]
        self.assertEqual(item['name'],'paper scrap')
        self.assertEqual(item['score'],.22)
        self.assertEqual(item['prediction']['decision'],'cardboard')
        self.assertEqual(item['identification']['material_prediction']['confidence'],.93)

    def test_negative_category_is_not_mistaken_for_recyclable(self):
        prediction = {'previous_contents':'','assessment':{'segregation':{'status':'available','category':'Non-recyclable'}}}
        self.assertEqual(routing(prediction)['key'],'review')

    def test_clearing_history_removes_scene_images_too(self):
        self.create()
        self.assertEqual(self.client.delete('/api/predictions/clear/',**self.auth).status_code,200)
        self.assertEqual(ScanScene.objects.count(),0)

    def select(self, scene, ids, names=None):
        return self.client.post(f"/api/scenes/{scene['id']}/disposal-selection/",
                                json.dumps({'item_ids':ids, 'object_names':names or {}}),
                                content_type='application/json', **self.auth)

    def test_phone_and_towel_are_selectable_without_overwriting_predictions(self):
        scene = self.create(rows=[
            {'name':'mobile phone','material':'unknown_unsupported','score':.7,'box':[.1,.1,.4,.6]},
            {'name':'towel','material':'fabric_scraps','score':.6,'box':[.08,.08,.8,.9]},
        ]).json()['scene']
        self.assertFalse(scene['disposal_selection']['confirmed'])
        self.assertFalse(any(item['identification']['selected_for_disposal'] for item in scene['items']))
        phone, towel = scene['items']
        result = self.select(scene, [phone['id'],towel['id']]).json()['scene']
        self.assertEqual([row['handling']['route'] for row in result['items']], ['special_handling','requires_information'])
        self.assertTrue(result['items'][0]['identification']['selected_for_disposal'])
        self.assertEqual(result['items'][0]['prediction']['raw_model_class'], 'mobile phone')
        self.assertEqual(result['items'][0]['score'], .7)
        self.assertIsNone(result['items'][0]['identification']['material_prediction']['confidence'])
        self.assertIsNone(result['items'][0]['identification']['ai_waste_category'])
        deselected = self.select(scene, [phone['id']]).json()['scene']['items'][1]
        self.assertFalse(deselected['identification']['selected_for_disposal'])
        self.assertEqual(deselected['handling']['route'], 'not_selected')

    def test_unknown_plastic_subtype_and_low_confidence_never_become_approved_projects(self):
        scene = self.create(rows=[{'name':'plastic bottle','material':'unknown_unsupported','score':.12,'box':[.1,.1,.4,.8]}]).json()['scene']
        item = self.select(scene, [scene['items'][0]['id']]).json()['scene']['items'][0]
        self.assertEqual(item['identification']['material_prediction']['title'], 'Plastic — subtype unconfirmed')
        self.assertEqual(item['handling']['route'], 'requires_information')
        self.assertFalse(item['handling']['upcycling_eligible'])
        self.assertEqual(item['prediction']['recommendation_choices'], [])

    def test_outside_material_database_keeps_no_verified_method_and_original_user_correction(self):
        scene = self.create(rows=[{'name':'wallet','material':'unknown_unsupported','score':.8,'box':[.1,.1,.4,.8]}]).json()['scene']
        item = scene['items'][0]
        corrected = self.select(scene,[item['id']],{str(item['id']):'cellphone'}).json()['scene']['items'][0]
        self.assertEqual(corrected['name'], 'wallet')
        self.assertEqual(corrected['identification']['user_object_name'],'cellphone')
        self.assertEqual(corrected['handling']['route'],'special_handling')
        self.assertEqual(corrected['prediction']['confidence'],0)
        self.assertEqual(corrected['prediction']['decision'],'unknown_unsupported')
        unknown = self.select(scene,[item['id']],{str(item['id']):''}).json()['scene']['items'][0]
        self.assertEqual(unknown['handling']['route'],'no_verified_method')

    def test_confirmed_supported_material_without_reviewed_project_says_so(self):
        scene = self.create().json()['scene']; item = scene['items'][0]
        response = self.client.patch(f"/api/predictions/{item['prediction']['id']}/",json.dumps({
            'answers':{'material_confirmation':'paper'}, 'condition':'Clean and dry',
        }),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        result = self.select(scene,[item['id']]).json()['scene']['items'][0]
        self.assertEqual(result['handling']['route'],'no_verified_method')
        self.assertFalse(result['handling']['upcycling_eligible'])

    def test_selection_validation_owner_scope_and_failed_detection(self):
        scene = self.create().json()['scene']; item = scene['items'][0]
        for ids in ([], [True], [item['id'],item['id']], [99999]):
            self.assertEqual(self.select(scene,ids).status_code,400)
        self.assertEqual(self.select(scene,[item['id']],{str(item['id']):'x'*121}).status_code,400)
        other = User.objects.create_user('other-disposal')
        result = self.client.post(f"/api/scenes/{scene['id']}/disposal-selection/",json.dumps({'item_ids':[item['id']]}),
                                 content_type='application/json',HTTP_AUTHORIZATION=f'Bearer {issue_token(other)}')
        self.assertEqual(result.status_code,404)
        self.assertEqual(self.client.post('/api/scenes/',{'request_id':'empty_image_test'},**self.auth).status_code,415)
        for data in (b'',b'not an image'):
            self.assertEqual(self.client.post('/api/scenes/',{'request_id':'invalid_image_test','image':SimpleUploadedFile('bad.jpg',data,content_type='image/jpeg')},**self.auth).status_code,400)
        with patch('predictions.scene_detector.available',return_value=True), patch('predictions.scene_detector.detect',side_effect=RuntimeError('test failure')):
            self.assertEqual(self.upload('failure_request_test').status_code,503)

    def test_disposal_selection_and_handling_history_remain_attached_to_original_scene(self):
        scene = self.create().json()['scene']; item = scene['items'][0]
        expected = self.select(scene,[item['id']]).json()['scene']
        self.create(rows=[{'name':'battery','material':'unknown_unsupported','score':.8,'box':[.1,.1,.4,.8]}], request_id='newer_scene_test')
        with patch('predictions.views.assess',side_effect=AssertionError('History must not reassess')):
            saved = self.client.get(f"/api/scenes/{scene['id']}/?history=1",**self.auth).json()['scene']
        self.assertEqual(saved['items'][0]['handling'],expected['items'][0]['handling'])
        self.assertEqual(saved['disposal_selection']['item_ids'],[item['id']])
        self.assertNotIn('battery',str(saved['items'][0]['handling']))

    def test_manual_region_name_is_a_user_report_and_special_route_survives_material_misreport(self):
        from django.core.management import call_command
        from core.test_support import expert_project_fixtures
        call_command('seed_reference_guidance',verbosity=0); expert_project_fixtures()
        scene = self.create().json()['scene']
        added = self.client.post(f"/api/scenes/{scene['id']}/items/",json.dumps({'box':[.1,.1,.5,.8],'request_id':'manual_object_test'}),content_type='application/json',**self.auth).json()['scene']
        item = added['items'][-1]
        result = self.select(added,[item['id']],{str(item['id']):'phone'}).json()['scene']['items'][-1]
        self.assertEqual(result['identification']['object_prediction']['source'],'user_marked_region')
        self.assertIsNone(result['identification']['object_prediction']['confidence'])
        changed = self.client.patch(f"/api/predictions/{item['prediction']['id']}/",json.dumps({
            'quantity':1,'condition':'Clean and dry','previous_contents':'No chemical contact known',
            'answers':{'material_confirmation':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'},
        }),content_type='application/json',**self.auth)
        self.assertEqual(changed.status_code,200)
        self.assertEqual(changed.json()['prediction']['recommendation_choices'],[])
        saved = self.client.get(f"/api/scenes/{scene['id']}/?history=1",**self.auth).json()['scene']['items'][-1]
        self.assertEqual(saved['handling']['route'],'special_handling')

    def test_overlapping_phone_and_towel_stay_distinct_when_detected(self):
        kept, _ = clean_detections([
            {'name':'mobile phone','score':.7,'box':[.1,.1,.7,.7]},
            {'name':'towel','score':.6,'box':[.09,.09,.72,.72]},
        ])
        self.assertEqual({row['name'] for row in kept},{'mobile phone','towel'})

    def test_matching_reviewed_project_route_keeps_sources_in_project_snapshot(self):
        # Synthetic approvals exist ONLY in this isolated test database.
        from django.core.management import call_command
        from core.test_support import expert_project_fixtures
        call_command('seed_reference_guidance',verbosity=0); expert_project_fixtures()
        scene = self.create().json()['scene']; item = scene['items'][0]
        self.select(scene,[item['id']])
        response = self.client.patch(f"/api/predictions/{item['prediction']['id']}/",json.dumps({
            'quantity':1,'condition':'Clean and dry','previous_contents':'No chemical contact known',
            'answers':{'material_confirmation':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'},
        }),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        saved = self.client.get(f"/api/scenes/{scene['id']}/?history=1",**self.auth).json()['scene']['items'][0]
        self.assertEqual(saved['handling']['route'],'eligible')
        self.assertTrue(saved['handling']['upcycling_eligible'])
        recommendation = saved['handling']['recommendations'][0]
        self.assertIn('source',recommendation['review'])
        selected = self.client.post(f"/api/predictions/{item['prediction']['id']}/recommendation/",json.dumps({'recommendation_id':recommendation['id']}),content_type='application/json',**self.auth)
        self.assertEqual(selected.status_code,200)
        project = self.client.post('/api/projects/',json.dumps({'prediction_id':item['prediction']['id']}),content_type='application/json',**self.auth)
        self.assertIn(project.status_code,(200,201))
        self.assertEqual(project.json()['project']['reference']['source'],recommendation['review']['source'])
