"""Exercise rejection and label mapping without depending on image accuracy."""
import unittest
from unittest.mock import Mock

import numpy as np
from PIL import Image

from scripts.inference import ModelPredictor, SCOPE_CLASSES


class ScopeInferenceTests(unittest.TestCase):
    def predictor(self, label, confidence):
        predictor = ModelPredictor.__new__(ModelPredictor)
        predictor.labels = [label, "paper" if label != "paper" else "cardboard"]
        predictor.image_size = (2, 2)
        predictor.confidence_threshold = 0.8
        predictor.class_confidence_thresholds = {}
        predictor.scope_classes = set(SCOPE_CLASSES)
        predictor.unsupported_classes = set()
        predictor.generic_classes = {"plastic", "metal"}
        predictor.model_version = "candidate-unverified-test"
        predictor.experimental_model = True
        predictor.model = Mock()
        predictor.model.predict.return_value = np.array([[confidence, 1 - confidence]])
        return predictor

    def test_all_seven_labels_are_mapped_to_material_decisions(self):
        for label in SCOPE_CLASSES:
            with self.subTest(label=label):
                result = self.predictor(label, 0.95).predict_image(Image.new("RGB", (4, 4)))
                self.assertEqual(result["decision"], label)
                self.assertTrue(result["experimental_model"])

    def test_below_threshold_is_rejected_without_losing_diagnostic_label(self):
        result = self.predictor("cardboard", 0.79).predict_image(Image.new("RGB", (4, 4)))
        self.assertEqual(result["decision"], "unknown_unsupported")
        self.assertEqual(result["class"], "cardboard")
        self.assertTrue(result["needs_verification"])

    def test_unsupported_class_is_rejected_even_when_confident(self):
        result = self.predictor("glass", 0.99).predict_image(Image.new("RGB", (4, 4)))
        self.assertEqual(result["decision"], "unknown_unsupported")

    def test_restored_coconut_output_keeps_its_own_label(self):
        result = self.predictor("coconut_shells", 0.99).predict_image(Image.new("RGB", (4, 4)))
        self.assertEqual(result["class"], "coconut_shells")
        self.assertEqual(result["decision"], "coconut_shells")

    def test_corrupt_photo_is_rejected(self):
        with self.assertRaises(ValueError):
            self.predictor("paper", 0.99).predict_bytes(b"not an image")

    def test_exif_rotation_is_applied_before_resize(self):
        image = Image.new("RGB", (2, 1))
        image.putpixel((0, 0), (255, 0, 0))
        image.putpixel((1, 0), (0, 0, 255))
        image.getexif()[274] = 6
        predictor = self.predictor("paper", 0.99)
        predictor.image_size = (2, 1)
        array = predictor._prepare_image(image)
        self.assertEqual(array.shape, (1, 2, 1, 3))
        self.assertEqual(array[0, 0, 0].tolist(), [255, 0, 0])
        self.assertEqual(array[0, 1, 0].tolist(), [0, 0, 255])


if __name__ == "__main__":
    unittest.main()
