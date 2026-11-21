import json
import tempfile
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from core.auth import issue_token

class ClassifierScanTests(TestCase):
    def setUp(self):
        user=get_user_model().objects.create_user('classifier-scan')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(user)}'}
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        setting=self.settings(MEDIA_ROOT=temp.name);setting.enable();self.addCleanup(setting.disable)

    def scan(self, label, confidence):
        image=BytesIO();Image.new('RGB',(200,200),'brown').save(image,format='JPEG')
        material={'label':label,'raw_class':'cardboard','confidence':confidence,'threshold':.7,
                  'model_version':'test-mobilenetv2','status':'classified','alternatives':[]}
        with patch('predictions.scene_views.model_status',return_value={'loaded':True}), patch('predictions.scene_views.classify_material',return_value=material), patch('predictions.scene_detector.detect',side_effect=AssertionError('OWL must not run')):
            response=self.client.post('/api/scenes/',{'request_id':'classifier_request_'+str(int(confidence*100)),'single_item':'1','same_item_confirmed':'true','primary_view':'front','frame':json.dumps({'aspect':1,'x':0,'y':0,'width':1,'height':1}),'image':SimpleUploadedFile('item.jpg',image.getvalue(),content_type='image/jpeg')},**self.auth)
        self.assertEqual(response.status_code,201,response.content)
        item=response.json()['scene']['items'][0]
        self.assertEqual(item['prediction']['decision'],label)
        self.assertFalse(item['display_box'])
        self.assertEqual(item['prediction']['image_quality']['object_source'],'whole_image_classifier')
        from predictions.models import PredictionRecord
        record=PredictionRecord.objects.get(pk=item['prediction']['id'])
        self.assertEqual(record.image_quality['result_snapshot']['classification']['kind'], 'supported' if label=='cardboard' else 'unsupported')
        return item

    def test_accepted_material_has_no_detector_veto(self):
        self.scan('cardboard',.7)

    def test_low_confidence_remains_unsupported(self):
        self.scan('unknown_unsupported',.699)

