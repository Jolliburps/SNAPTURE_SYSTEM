from io import BytesIO
from unittest.mock import patch

import numpy as np
from PIL import Image
from django.test import SimpleTestCase

from .material_classifier import classify_material, classify_detected_material


class MaterialClassifierTests(SimpleTestCase):
    def result(self, label='paper', confidence=.94):
        return {'model_class':label, 'decision':label, 'confidence':confidence,
                'threshold':.8, 'model_version':'dataset-candidate-unverified-test',
                'experimental_model':True, 'alternatives':[]}

    def test_original_crop_and_dataset_scores_override_the_detector_material(self):
        image=Image.fromarray(np.random.default_rng(42).integers(0,255,(80,90,3),dtype=np.uint8))
        with patch('predictions.material_classifier.predict_image',return_value=self.result('cardboard')) as infer:
            result=classify_detected_material(image, {'name':'paper scrap','material':'paper'})
        uploaded=Image.open(BytesIO(infer.call_args.args[0]))
        np.testing.assert_array_equal(np.asarray(uploaded),np.asarray(image))
        self.assertEqual(result['label'],'cardboard')
        self.assertEqual(result['confidence'],.94)
        self.assertIn('SNAPTURE_ML/data',result['basis'])

    def test_rejection_retains_the_raw_material_without_promoting_it(self):
        result=self.result('paper',.45);result['decision']='unknown_unsupported'
        with patch('predictions.material_classifier.predict_image',return_value=result):
            actual=classify_material(Image.new('RGB',(80,80)))
        self.assertEqual(actual['label'],'unknown_unsupported')
        self.assertEqual(actual['raw_class'],'paper')

    def test_runtime_failure_does_not_fall_back_to_prompt_material_labels(self):
        with patch('predictions.material_classifier.predict_image',side_effect=RuntimeError('offline')):
            result=classify_detected_material(Image.new('RGB',(80,80)),{'name':'paper scrap','material':'paper'})
        self.assertEqual(result['label'],'unknown_unsupported')
        self.assertEqual(result['status'],'unavailable')
        self.assertNotIn('confidence',result)

    def test_background_and_hazards_are_not_forced_into_dataset_materials(self):
        with patch('predictions.material_classifier.predict_image') as infer:
            for name in ('mobile phone','battery','glass bottle or glass jar'):
                result=classify_detected_material(Image.new('RGB',(80,80)),{'name':name,'material':'unknown_unsupported'})
                self.assertEqual(result['status'],'not_applicable')
        infer.assert_not_called()
