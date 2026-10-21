import tempfile
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.test import Client, TestCase
from PIL import Image

from core.auth import issue_token
from core.assessment import refresh
from .models import PredictionRecord, ScanScene, SceneItem


class SavedScanHistoryTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('history-owner')
        self.auth = {'HTTP_AUTHORIZATION': f'Bearer {issue_token(self.user)}'}
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        override = self.settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)

    def record(self, name='paper'):
        record = PredictionRecord(user=self.user, model_class=name, decision='paper', title='Paper', confidence=.81)
        data = BytesIO()
        Image.new('RGB', (80, 60), 'white').save(data, format='JPEG')
        record.image.save(f'{name}.jpg', ContentFile(data.getvalue()), save=False)
        refresh(record)
        record.save()
        return record

    def test_unique_images_and_assessments_survive_new_client_without_inference_or_writes(self):
        first, second = self.record('first'), self.record('second')
        before = list(PredictionRecord.objects.values())
        with patch('predictions.views.predict_image') as classifier, patch('predictions.scene_detector.detect') as detector, patch('predictions.views.assess', side_effect=AssertionError('History must not recompute assessment')):
            for record in (first, second):
                response = Client().get(f'/api/predictions/{record.pk}/?history=1', **self.auth)
                self.assertEqual(response.status_code, 200)
                saved = response.json()['prediction']
                self.assertEqual(saved['id'], record.pk)
                self.assertEqual(saved['original_image_url'], record.image.url)
                self.assertEqual(saved['assessment'], record.assessment)
                self.assertTrue(record.image.storage.exists(record.image.name))
            classifier.assert_not_called()
            detector.assert_not_called()
        self.assertEqual(before, list(PredictionRecord.objects.values()))

    def test_crop_history_resolves_its_own_scene_original_and_saved_item_details(self):
        record = self.record()
        scene = ScanScene.objects.create(user=self.user, request_id='saved_scene', width=80, height=60, frame=[0,0,1,1], status='complete')
        with record.image.open('rb') as image:
            scene.image.save('original.jpg', ContentFile(image.read()))
        SceneItem.objects.create(scene=scene, prediction=record, box=[.1,.1,.4,.4], name='paper scrap', score=.81)
        with patch('predictions.views.assess', side_effect=AssertionError('No recomputation')):
            saved = self.client.get(f'/api/predictions/{record.pk}/?history=1', **self.auth).json()
        self.assertEqual(saved['prediction']['scene_id'], scene.pk)
        self.assertEqual(saved['prediction']['original_image_url'], scene.image.url)
        self.assertEqual(saved['scene']['image_url'], scene.image.url)
        self.assertEqual(saved['scene']['items'][0]['prediction']['assessment'], record.assessment)
        self.assertEqual(saved['scene']['created_at'], scene.created_at.isoformat())

    def test_scene_with_missing_snapshot_and_deleted_image_file_still_opens(self):
        record = self.record()
        scene = ScanScene.objects.create(user=self.user, request_id='missing_file', image=record.image.name, width=80, height=60, frame=[0,0,1,1], status='complete')
        SceneItem.objects.create(scene=scene, prediction=record, box=[.1,.1,.4,.4], name='paper scrap', score=.81)
        record.image.storage.delete(record.image.name)
        record.assessment = {'material': {}, 'segregation': {}, 'upcycling': {}}
        record.save(update_fields=['assessment'])
        saved = self.client.get(f'/api/predictions/{record.pk}/?history=1', **self.auth)
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()['scene']['image_url'], scene.image.url)
        self.assertIsNone(saved.json()['scene']['items'][0]['prediction']['assessment'])
        self.assertEqual(saved.json()['scene']['items'][0]['route']['label'], 'No saved assessment')

    def test_missing_files_or_snapshot_do_not_crash_and_other_accounts_cannot_open_record(self):
        record = self.record()
        record.image.delete(save=False)
        record.assessment = {}
        record.save()
        response = self.client.get(f'/api/predictions/{record.pk}/?history=1', **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['prediction']['original_image_url'])
        self.assertIsNone(response.json()['prediction']['assessment'])
        other = User.objects.create_user('history-other')
        response = self.client.get(f'/api/predictions/{record.pk}/?history=1', HTTP_AUTHORIZATION=f'Bearer {issue_token(other)}')
        self.assertEqual(response.status_code, 404)

    def test_history_groups_by_photo_id_not_date_and_preserves_all_item_results(self):
        scenes = [ScanScene.objects.create(user=self.user, request_id=f'grouped_{index}', image=f'photo{index}.jpg', width=80, height=60, status='complete') for index in range(2)]
        for scene in scenes:
            for index in range(3):
                record = self.record(f'{scene.pk}_{index}')
                SceneItem.objects.create(scene=scene, prediction=record, box=[.1,.1,.4,.4], name='paper scrap', score=.81)
        manual = self.record('standalone')
        response = self.client.get('/api/predictions/?grouped=1', **self.auth).json()
        self.assertEqual(response['total_count'], 3)
        self.assertEqual(len(response['predictions']), 3)
        photos = [row for row in response['predictions'] if row['scene_id']]
        self.assertEqual({row['scene_id'] for row in photos}, {scene.pk for scene in scenes})
        self.assertEqual([row['item_count'] for row in photos], [3, 3])
        self.assertIn(manual.pk, [row['id'] for row in response['predictions']])
        for row in photos:
            detail = self.client.get(f"/api/predictions/{row['id']}/?history=1", **self.auth).json()
            self.assertEqual(len(detail['scene']['items']), 3)
        self.assertEqual(PredictionRecord.objects.count(), 7)
        self.assertEqual(self.client.get('/api/predictions/', **self.auth).json()['total_count'], 7)

    def test_grouping_happens_before_history_page_limit(self):
        scene = ScanScene.objects.create(user=self.user, request_id='many_items', image='many.jpg', width=80, height=60, status='complete')
        for index in range(51):
            record = PredictionRecord.objects.create(user=self.user, model_class='paper', decision='paper', title='Paper', confidence=.8)
            SceneItem.objects.create(scene=scene, prediction=record, box=[.1,.1,.4,.4], name='paper scrap', score=.8)
        response = self.client.get('/api/predictions/?grouped=1', **self.auth).json()
        self.assertEqual(response['total_count'], 1)
        self.assertEqual(response['predictions'][0]['item_count'], 51)
