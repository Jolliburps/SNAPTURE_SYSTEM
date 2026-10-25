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
        with patch('predictions.scene_detector.available',return_value=True), patch(
                'predictions.scene_detector.detect',return_value=(rows if rows is not None else [PAPER],truncated)) as detect:
            response = self.client.post('/api/scenes/',payload,**self.auth)
        return response, detect

    def test_only_inside_pixels_reach_inference_and_saved_photo(self):
        response, detect = self.upload_single()
        self.assertEqual(response.status_code,201)
        focused = detect.call_args.args[0]
        self.assertEqual(focused.size,(150,150))
        self.assertEqual(focused.getpixel((0,0)),(0,255,0))
        self.assertEqual(focused.getpixel((149,149)),(0,255,0))
        result = response.json()['scene']
        self.assertEqual((result['width'],result['height']),(150,150))
        self.assertEqual(result['frame'],[0,0,1,1])
        self.assertTrue(result['single_item']['enabled'])
        self.assertEqual(result['single_item']['input_frame'],[.3125,.25,.6875,.75])
        scene = ScanScene.objects.get(pk=result['id'])
        with scene.image.open('rb') as source:
            saved = Image.open(source).convert('RGB')
        self.assertEqual(saved.size,(150,150))
        self.assertLess(saved.getpixel((0,0))[0],10)
        self.assertGreater(saved.getpixel((0,0))[1],240)

    def test_multiple_reliable_items_require_retake_without_saving_partial_scan(self):
        other = {'name':'metal can','material':'unknown_unsupported','score':.8,'box':[.65,.1,.95,.4]}
        response, _ = self.upload_single(rows=[{**PAPER,'box':[.05,.1,.4,.5]},other])
        self.assertEqual(response.status_code,422)
        self.assertEqual(response.json()['code'],'multiple_items_in_frame')
        self.assertFalse(ScanScene.objects.exists())
        self.assertFalse(PredictionRecord.objects.exists())
        self.assertEqual([path for path in Path(settings.MEDIA_ROOT).rglob('*') if path.is_file()],[])

    def test_duplicate_proposals_do_not_count_as_two_objects(self):
        response, _ = self.upload_single(rows=[PAPER,{**PAPER,'score':.7,'box':[.11,.11,.89,.89]}])
        self.assertEqual(response.status_code,201)
        self.assertEqual(len(response.json()['scene']['items']),1)

    def test_proposal_limit_does_not_silently_choose_the_strongest_item(self):
        response, _ = self.upload_single(truncated=True)
        self.assertEqual(response.status_code,422)
        self.assertEqual(response.json()['code'],'uncertain_single_item')
        self.assertFalse(ScanScene.objects.exists())

    def test_uncertain_frame_gets_one_real_material_result_not_fake_object_boxes(self):
        material = {'label':'paper','raw_class':'paper','confidence':.91,'threshold':.8,
                    'model_version':'dataset-candidate-unverified-test','status':'classified','basis':'test classifier'}
        with patch('predictions.scene_views.classify_material',return_value=material) as classifier:
            response, _ = self.upload_single(rows=[{**PAPER,'score':.13},{**PAPER,'score':.12,'box':[.1,.1,.3,.3]}])
        self.assertEqual(response.status_code,201)
        self.assertEqual(classifier.call_args.args[0].size,(150,150))
        scene = response.json()['scene']
        self.assertEqual(scene['single_item']['status'],'needs_review')
        self.assertEqual(len(scene['items']),1)
        item = scene['items'][0]
        self.assertEqual(item['identification']['object_prediction']['source'],'whole_image_classifier')
        self.assertIsNone(item['identification']['object_prediction']['confidence'])
        self.assertFalse(item['display_box'])
        self.assertEqual(item['prediction']['confidence'],.91)

    def test_person_only_frame_is_rejected_without_forcing_a_material(self):
        with patch('predictions.scene_views.classify_material') as classifier:
            response, _ = self.upload_single(rows=[{'name':'person','material':'unknown_unsupported','score':.8,'box':[0,0,1,1]}])
        self.assertEqual(response.status_code,422)
        self.assertEqual(response.json()['code'],'person_in_frame')
        classifier.assert_not_called()
        self.assertFalse(ScanScene.objects.exists())

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
