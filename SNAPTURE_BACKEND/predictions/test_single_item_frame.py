import json
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image

from . import test_scenes as fixtures
from .models import PredictionRecord, ScanScene


FRAME = {'aspect':1,'x':.25,'y':.25,'width':.5,'height':.5}
PAPER = {'name':'paper scrap','material':'paper','score':.8,'box':[.1,.1,.9,.9]}


class SingleItemFrameTests(TestCase):
    setUp = fixtures.SceneApiTests.setUp

    def upload_single(self, rows=None, truncated=False, **fields):
        # Red pixels are outside the border; green pixels are exactly its crop.
        image = Image.new('RGB',(400,300),'red')
        image.paste('lime',(125,75,275,225))
        data = BytesIO(); image.save(data,format='PNG')
        payload = {'request_id':'single_frame_123','single_item':'1','frame':json.dumps(FRAME),
                   'image':SimpleUploadedFile('frame.png',data.getvalue(),content_type='image/png'),**fields}
        material={'label':'paper','raw_class':'paper','confidence':.91,'threshold':.7,
                  'model_version':'test-material-model','status':'classified'}
        with patch('predictions.scene_views.model_status',return_value={'loaded':True}), patch('predictions.scene_views.classify_material',return_value=material) as classifier, patch('predictions.scene_detector.detect',side_effect=AssertionError('OWL is retired')) as detect:
            response=self.client.post('/api/scenes/',payload,**self.auth)
        return response,classifier

    def test_only_inside_pixels_reach_inference_and_saved_photo(self):
        response,classifier=self.upload_single()
        self.assertEqual(response.status_code,201,response.content)
        focused=classifier.call_args.args[0]
        self.assertEqual(focused.size,(150,150))
        self.assertEqual(focused.getpixel((0,0)),(0,255,0))
        self.assertEqual(focused.getpixel((149,149)),(0,255,0))
        scene=response.json()['scene'];record=PredictionRecord.objects.get()
        self.assertIsNone(scene['items'][0]['prediction']['focus_box'])
        self.assertEqual(record.image_quality['classification_crop'],[0,0,1,1])
        self.assertEqual(scene['single_item']['input_frame'],[.3125,.25,.6875,.75])
        with record.image.open('rb') as source:
            saved=Image.open(source).convert('RGB')
            self.assertEqual(saved.size,(150,150));self.assertGreater(saved.getpixel((0,0))[1],240)

    def test_detector_proposals_do_not_claim_multiple_item_detection(self):
        response,_=self.upload_single(rows=[PAPER,{**PAPER,'name':'metal can'}])
        self.assertEqual(response.status_code,201)
        scene=response.json()['scene']
        self.assertEqual(len(scene['items']),1)
        self.assertFalse(scene['items'][0]['display_box'])
        self.assertIn('No objects are located',scene['limitations'])

    def test_duplicate_proposals_do_not_count_as_two_objects(self):
        response, _ = self.upload_single(rows=[PAPER,{**PAPER,'score':.7,'box':[.11,.11,.89,.89]}])
        self.assertEqual(response.status_code,201)
        self.assertEqual(len(response.json()['scene']['items']),1)

    def test_retired_proposal_limit_cannot_block_material_classification(self):
        response,classifier=self.upload_single(truncated=True)
        self.assertEqual(response.status_code,201)
        classifier.assert_called_once()

    def test_frame_gets_one_material_result_without_object_boxes(self):
        response,classifier=self.upload_single(rows=[])
        self.assertEqual(response.status_code,201)
        scene=response.json()['scene'];item=scene['items'][0]
        self.assertEqual(scene['single_item']['status'],'material_only')
        self.assertIsNone(item['identification']['object_prediction']['confidence'])
        self.assertFalse(item['display_box'])
        self.assertEqual(item['prediction']['decision'],'paper')
        self.assertEqual(item['prediction']['image_quality']['workflow_version'],'camera-assessment-v2')

    def test_guide_area_is_same_for_classification_and_saved_preview(self):
        response,classifier=self.upload_single(rows=[PAPER,{'name':'human hand','score':.9,'box':[.3,.75,.6,1]}])
        self.assertEqual(response.status_code,201)
        item=response.json()['scene']['items'][0]
        record=PredictionRecord.objects.get(pk=item['prediction']['id'])
        with record.image.open('rb') as source:self.assertEqual(Image.open(source).size,classifier.call_args.args[0].size)
        updated=self.client.patch(f'/api/predictions/{record.pk}/',json.dumps({'condition':'Clean and dry'}),content_type='application/json',**self.auth)
        self.assertEqual(updated.status_code,409)

    def test_no_object_score_is_exposed_for_weak_retired_proposals(self):
        response,_=self.upload_single(rows=[{**PAPER,'score':.13}])
        self.assertEqual(response.status_code,201)
        item=response.json()['scene']['items'][0]
        self.assertFalse(item['display_box'])
        self.assertIsNone(item['identification']['object_prediction']['confidence'])

    def test_new_scan_does_not_claim_person_detection(self):
        response,classifier=self.upload_single(rows=[{'name':'person','score':.8,'box':[0,0,1,1]}])
        self.assertEqual(response.status_code,201)
        classifier.assert_called_once()
        self.assertFalse(response.json()['scene']['items'][0]['display_box'])

    def test_single_scan_cannot_add_extra_regions_or_select_multiple_objects(self):
        response, _ = self.upload_single()
        scene = response.json()['scene']
        result = self.client.post(f"/api/scenes/{scene['id']}/items/",json.dumps({
            'box':[.1,.1,.5,.5],'request_id':'single_region_123',
        }),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,409)
        item_id = scene['items'][0]['id']
        result = self.client.post(f"/api/scenes/{scene['id']}/disposal-selection/",json.dumps({
            'item_ids':[item_id,item_id+1],'automatic_routing':True,
        }),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,400)
        self.assertEqual(PredictionRecord.objects.count(),1)

    def test_missing_or_invalid_frame_is_not_silently_replaced_by_whole_photo(self):
        for fields in ({'frame':''},{'frame':'null'},{'frame':'[]'},{'single_item':'yes'}):
            response, detect = self.upload_single(**fields)
            self.assertEqual(response.status_code,400)
            detect.assert_not_called()
        self.assertFalse(ScanScene.objects.exists())

    def test_retry_and_history_preserve_single_scan_and_do_not_reanalyze(self):
        first, _ = self.upload_single()
        again, detect = self.upload_single()
        self.assertEqual(again.status_code,200)
        self.assertEqual(first.json()['scene']['id'],again.json()['scene']['id'])
        detect.assert_not_called()
        saved = self.client.get(f"/api/scenes/{first.json()['scene']['id']}/?history=1",**self.auth).json()['scene']
        self.assertTrue(saved['single_item']['enabled'])
        self.assertEqual(len(saved['items']),1)
