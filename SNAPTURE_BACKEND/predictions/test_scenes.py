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
        self.assertEqual(item['prediction']['image_quality'],{})
        self.assertFalse(item['display_box'])
        self.assertEqual(item['display_group'],'review')

    def test_no_detections_are_not_replaced_with_fake_boxes(self):
        result = self.create(rows=[]).json()['scene']
        self.assertEqual(result['items'],[]); self.assertEqual(PredictionRecord.objects.count(),0)

    def test_background_detections_do_not_become_waste_history_records(self):
        result = self.create(rows=[{'name':'computer keyboard','material':'unknown_unsupported','score':.6,'box':[.1,.1,.8,.8]}]).json()['scene']
        self.assertEqual(result['items'],[])
        self.assertEqual(result['background_objects'],[{'name':'computer keyboard','count':1}])
        self.assertEqual(PredictionRecord.objects.count(),0)

    def test_reported_chemical_contact_stays_in_special_handling_even_at_low_score(self):
        result = self.create().json()['scene']
        record = PredictionRecord.objects.get(pk=result['items'][0]['prediction']['id'])
        record.previous_contents = 'Chemical or cleaning product'
        record.save()
        refreshed = self.client.get(f"/api/scenes/{result['id']}/",**self.auth).json()['scene']
        self.assertEqual(refreshed['items'][0]['display_group'],'special')
        self.assertFalse(refreshed['items'][0]['display_box'])

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
        with patch('predictions.scene_detector.available',return_value=False):
            self.assertEqual(self.upload().status_code,503)
        self.assertEqual(self.create(frame={'aspect':1,'x':1,'y':1,'width':1,'height':1}).status_code,400)

    def test_negative_category_is_not_mistaken_for_recyclable(self):
        prediction = {'previous_contents':'','assessment':{'segregation':{'status':'available','category':'Non-recyclable'}}}
        self.assertEqual(routing(prediction)['key'],'review')

    def test_clearing_history_removes_scene_images_too(self):
        self.create()
        self.assertEqual(self.client.delete('/api/predictions/clear/',**self.auth).status_code,200)
        self.assertEqual(ScanScene.objects.count(),0)
