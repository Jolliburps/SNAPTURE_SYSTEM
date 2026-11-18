from io import BytesIO
from unittest.mock import patch

import numpy as np
from django.test import SimpleTestCase
from PIL import Image

from .image_quality import localized_box, oriented_image, quality_report
from .material_classifier import classify_material


class PhaseOneTests(SimpleTestCase):
    def test_actual_bounds_are_separate_from_padded_classifier_crop(self):
        metadata = {'object_source':'model', 'detection_filter':{'status':'accepted'},
                    'localized_box':[.2,.3,.7,.8], 'classification_crop':[.1,.2,.8,.9]}
        self.assertEqual(localized_box(metadata), [.2,.3,.7,.8])
        for status in ('review','duplicate','excluded'):
            self.assertIsNone(localized_box({**metadata,'detection_filter':{'status':status}}))
        self.assertIsNone(localized_box({**metadata,'object_source':'whole_image_classifier'}))
        self.assertIsNone(localized_box({'classification_crop':[0,0,1,1]}))
        for box in ([0,0,float('nan'),1],[-.1,0,1,1],[.8,0,.2,1],[0,0,2,1]):
            self.assertIsNone(localized_box({**metadata,'localized_box':box}))

    def test_quality_signals_are_conditional(self):
        self.assertEqual(quality_report(Image.new('RGB',(320,320),'white'))['flags'], [])
        self.assertIn('low_resolution', [f['code'] for f in quality_report(Image.new('RGB',(96,96)))['flags']])
        bright=Image.new('RGB',(320,320),'white');bright.paste('black',(0,0,32,320))
        self.assertIn('overexposed',[f['code'] for f in quality_report(bright)['flags']])
        self.assertIn('dark',[f['code'] for f in quality_report(Image.new('RGB',(320,320),'black'))['flags']])

    @patch('predictions.material_classifier.predict_image')
    def test_exif_and_rgb_match_direct_and_material_paths(self, predict):
        image=Image.new('RGB',(160,240),'red');image.paste('blue',(0,0,80,240))
        image.getexif()[274]=6
        raw=BytesIO();image.save(raw,format='JPEG',exif=image.getexif())
        predict.return_value={'decision':'paper','model_class':'paper','confidence':.9,'threshold':.8,'model_version':'test'}
        with Image.open(BytesIO(raw.getvalue())) as original:
            classify_material(original)
        actual=oriented_image(predict.call_args.args[0]);expected=oriented_image(raw.getvalue())
        self.assertEqual(actual.size,(240,160))
        np.testing.assert_array_equal(np.asarray(actual),np.asarray(expected))
