import base64
import tempfile
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.storage import default_storage
from django.test import TestCase

from core.auth import issue_token
from .image_quality import oriented_image
from .models import PredictionRecord, ScanScene
from .photo_privacy import PrivacyError, detect_faces, redact_image


def sample():
    return Image.fromarray(np.random.default_rng(12).integers(0, 255, (160, 240, 3), dtype=np.uint8))


def encoded(image):
    output = BytesIO()
    image.save(output, format='PNG')
    return output.getvalue()


class RedactionTests(TestCase):
    def test_two_faces_are_redacted_without_changing_pixels_outside_the_regions(self):
        original = sample()
        with patch('predictions.photo_privacy.detect_faces', return_value=[[30, 40, 30, 40], [150, 60, 35, 40]]):
            protected, count = redact_image(original)
        self.assertEqual(count, 2)
        self.assertLess(np.asarray(protected.crop((30, 40, 60, 80))).std(), 5)
        self.assertLess(np.asarray(protected.crop((150, 60, 185, 100))).std(), 5)
        np.testing.assert_array_equal(np.asarray(protected)[:10], np.asarray(original)[:10])

    def test_no_faces_preserves_pixels_and_real_detector_handles_blank_image(self):
        original = sample()
        with patch('predictions.photo_privacy.detect_faces', return_value=[]):
            protected, count = redact_image(original)
        np.testing.assert_array_equal(np.asarray(protected), np.asarray(original))
        self.assertEqual(count, 0)
        self.assertEqual(detect_faces(Image.new('RGB', (160, 100), 'white')), [])

    def test_invalid_coordinates_fail_closed_and_partial_faces_are_clamped(self):
        for box in ([float('nan'), 10, 20, 20], [1, 1, -2, 20], [500, 500, 20, 20], ['bad', 1, 10, 10], None):
            with self.subTest(box=box), patch('predictions.photo_privacy.detect_faces', return_value=[box]):
                with self.assertRaises(PrivacyError):
                    redact_image(sample())
        with patch('predictions.photo_privacy.detect_faces', return_value=[[-5, -5, 30, 30]]):
            self.assertEqual(redact_image(sample())[1], 1)

    def test_exif_orientation_is_applied_before_face_coordinates(self):
        image = Image.new('RGB', (120, 80), 'white')
        exif = image.getexif()
        exif[274] = 6
        output = BytesIO()
        image.save(output, format='JPEG', exif=exif)
        self.assertEqual(oriented_image(output.getvalue()).size, (80, 120))


class PhotoPrivacyApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('privacy-test')
        self.auth = {'HTTP_AUTHORIZATION': f'Bearer {issue_token(self.user)}'}
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.media = Path(temporary.name)
        override = self.settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)

    def upload(self):
        return SimpleUploadedFile('photo.png', encoded(sample()), content_type='image/png')

    def test_preview_is_protected_in_memory_and_never_creates_a_scan_or_media_file(self):
        with patch('predictions.photo_privacy.detect_faces', return_value=[[30, 40, 30, 40]]):
            response = self.client.post('/api/photo-privacy/preview/', {'image': self.upload()}, **self.auth)
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['faces_blurred'], 1)
        image = Image.open(BytesIO(base64.b64decode(payload['preview_uri'].split(',')[1])))
        self.assertLess(np.asarray(image.crop((30, 40, 60, 80))).std(), 6)
        self.assertEqual(list(self.media.rglob('*')), [])
        self.assertEqual(PredictionRecord.objects.count(), 0)
        self.assertEqual(ScanScene.objects.count(), 0)

    def test_preview_failure_returns_no_original_image_and_requires_sign_in(self):
        self.assertEqual(self.client.post('/api/photo-privacy/preview/', {'image': self.upload()}).status_code, 401)
        with patch('predictions.photo_privacy.detect_faces', side_effect=PrivacyError('offline')):
            response = self.client.post('/api/photo-privacy/preview/', {'image': self.upload()}, **self.auth)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('preview_uri', response.json())

    def test_legacy_media_url_serves_redacted_pixels_not_raw_file(self):
        name = default_storage.save('scenes/legacy.png', ContentFile(encoded(sample())))
        with patch('predictions.photo_privacy.detect_faces', return_value=[[30, 40, 30, 40]]):
            response = self.client.get('/media/' + name)
        self.assertEqual(response.status_code, 200)
        image = Image.open(BytesIO(response.content))
        self.assertLess(np.asarray(image.crop((30, 40, 60, 80))).std(), 6)
        self.assertEqual(response['Cache-Control'], 'private, no-store')
        self.assertNotEqual(response.content, encoded(sample()))

    def test_legacy_media_failure_never_falls_through_to_static_original(self):
        unique = Image.new('RGB', (100, 100), 'purple')
        name = default_storage.save('predictions/failed.png', ContentFile(encoded(unique)))
        with patch('predictions.photo_privacy.detect_faces', side_effect=PrivacyError('offline')):
            response = self.client.get('/media/' + name)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(self.client.get('/media/scenes/not-here.jpg').status_code, 404)

    def test_small_saved_item_crops_are_not_rejected_as_invalid_camera_uploads(self):
        tiny = Image.new('RGB', (20, 30), 'white')
        name = default_storage.save('predictions/tiny.png', ContentFile(encoded(tiny)))
        response = self.client.get('/media/' + name)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Image.open(BytesIO(response.content)).size, tiny.size)

    def test_scene_inference_uses_original_but_only_protected_original_and_crops_are_saved(self):
        observed = []
        def infer(image):
            observed.append(np.asarray(image).copy())
            return [{'name':'paper scrap','material':'paper','score':.8,'box':[0,0,1,1]}], False
        with patch('predictions.scene_detector.available', return_value=True), patch('predictions.scene_detector.detect', side_effect=infer), patch('predictions.photo_privacy.detect_faces', return_value=[[30,40,30,40]]):
            response = self.client.post('/api/scenes/', {'image':self.upload(),'request_id':'privacy_scene_123'}, **self.auth)
        self.assertEqual(response.status_code, 201)
        np.testing.assert_array_equal(observed[0], np.asarray(sample()))
        for file in (ScanScene.objects.get().image, PredictionRecord.objects.get().image):
            with file.open('rb') as source:
                self.assertLess(np.asarray(Image.open(source).crop((30,40,60,80))).std(), 6)

    def test_privacy_failure_keeps_detection_results_but_saves_no_unprotected_images(self):
        with patch('predictions.scene_detector.available', return_value=True), patch('predictions.scene_detector.detect', return_value=([{'name':'paper scrap','material':'paper','score':.8,'box':[0,0,1,1]}],False)), patch('predictions.photo_privacy.detect_faces', side_effect=PrivacyError('offline')):
            response = self.client.post('/api/scenes/', {'image':self.upload(),'request_id':'privacy_failed_123'}, **self.auth)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['scene']['items']), 1)
        self.assertEqual(response.json()['scene']['image_url'], '')
        self.assertIsNone(response.json()['scene']['items'][0]['prediction']['image_url'])
        self.assertFalse([path for path in self.media.rglob('*') if path.is_file()])

    def test_single_item_classifier_also_keeps_the_original_internal_and_stores_redacted_image(self):
        data = encoded(sample())
        result = {'model_class':'paper','decision':'paper','title':'Paper','confidence':.8,'threshold':.6,'model_version':'test'}
        with patch('predictions.views.predict_image', return_value=result) as classifier, patch('predictions.photo_privacy.detect_faces', return_value=[[30,40,30,40]]):
            response = self.client.post('/api/predictions/create/', {'image':self.upload()}, **self.auth)
        self.assertEqual(response.status_code, 201)
        classifier.assert_called_once_with(data)
        with PredictionRecord.objects.get().image.open('rb') as source:
            self.assertLess(np.asarray(Image.open(source).crop((30,40,60,80))).std(), 6)
