import hashlib
import json
from copy import deepcopy
from tempfile import TemporaryDirectory
from pathlib import Path
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from core.auth import issue_token
from core.recommendations import CATALOG
from core.tutorial_media import ASSETS, PHOTOS
from predictions.models import PredictionRecord, UserProject


class TutorialAssetTests(TestCase):
    def test_every_allowlisted_image_is_reachable_and_matches_its_digest(self):
        self.assertEqual(len(ASSETS), 45)  # Four catalog images plus 41 Home tutorial images.
        for path, checksum in ASSETS.items():
            with self.subTest(path=path):
                response = self.client.get('/api/tutorial-assets/' + path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response['Content-Type'], 'image/jpeg')
                self.assertEqual(response['X-Content-Type-Options'], 'nosniff')
                self.assertEqual(hashlib.sha256(b''.join(response.streaming_content)).hexdigest(), checksum)
                head = self.client.head('/api/tutorial-assets/' + path)
                self.assertEqual(head.status_code, 200)
                self.assertEqual(b''.join(head.streaming_content), b'')
                head.close()

    def test_route_denies_traversal_manifests_private_media_and_other_methods(self):
        for path in ('../photos.json', '%2e%2e/config/settings.py', '..%5cconfig%5csettings.py',
                     '/etc/passwd', 'C:/Windows/win.ini', 'media/scenes/private.jpg',
                     '2026-11-18-v1/photos.json', '2026-11-18-v1/hdpe_scoop/missing.jpg'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get('/api/tutorial-assets/' + path).status_code, 404)
        self.assertEqual(self.client.post('/api/tutorial-assets/' + next(iter(ASSETS))).status_code, 405)

    def test_absent_files_and_even_an_accidental_traversal_allowlist_fail_closed(self):
        with TemporaryDirectory() as directory, patch('core.tutorial_media.CONTENT_ROOT', Path(directory)):
            self.assertEqual(self.client.get('/api/tutorial-assets/' + next(iter(ASSETS))).status_code, 404)
        with patch.dict(ASSETS, {'../outside.jpg': 'test'}):
            self.assertEqual(self.client.get('/api/tutorial-assets/../outside.jpg').status_code, 404)

    def test_metadata_keeps_exact_indices_credits_and_missing_source_stage(self):
        self.assertEqual(set(PHOTOS), {'hdpe_scoop', 'coconut_bowl'})
        for project, photos in PHOTOS.items():
            self.assertEqual(photos['photo_rights'], 'Not verified for app reuse')
            self.assertTrue(photos['credit'] and photos['source_url'].startswith('https://'))
            for photo in photos['steps']:
                self.assertIn(photo['step_index'], range(3))
        self.assertEqual([(p['source_stage'], p['step_index']) for p in PHOTOS['hdpe_scoop']['steps']], [(3, 0), (4, 1)])
        self.assertTrue(all(p['url'] is None and p['source_stage'] == 4 for p in PHOTOS['coconut_bowl']['steps']))
        self.assertTrue(all('action is not shown' in p['visual_note'] for p in PHOTOS['hdpe_scoop']['steps']))


class TutorialSnapshotTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('tutorial-snapshot')
        self.auth = {'HTTP_AUTHORIZATION': f'Bearer {issue_token(self.user)}'}
        self.record = PredictionRecord.objects.create(user=self.user, model_class='hdpe_containers',
            decision='hdpe_containers', title='HDPE container', confidence=.95, threshold=.8,
            condition='Clean and dry', model_version='dataset-candidate-unverified-test')

        from core.test_support import screen_and_request
        screen_and_request(self, self.record, self.auth)

    def start(self, idea='hdpe_scoop', **extra):
        return self.client.post('/api/projects/', json.dumps({
            'prediction_id': self.record.pk, 'recommendation_id': idea, **extra}),
            content_type='application/json', **self.auth)

    def test_new_snapshot_uses_server_media_and_retry_never_rewrites_it(self):
        response = self.start(photos={'url': 'file:///private'}, steps=['Invented'])
        self.assertEqual(response.status_code, 201)
        project = response.json()['project']
        self.assertEqual(project['reference']['photos'], PHOTOS['hdpe_scoop'])
        self.assertEqual(project['reference']['review_level'], 'educational')
        original = deepcopy(CATALOG['hdpe_containers'][2])
        try:
            CATALOG['hdpe_containers'][2]['steps'] = ['Changed later'] * 3
            CATALOG['hdpe_containers'][2]['photos']['credit'] = 'Changed later'
            self.assertEqual(self.start().json()['project'], project)
            self.assertEqual(self.client.get('/api/projects/', **self.auth).json()['projects'][0], project)
        finally:
            CATALOG['hdpe_containers'][2] = original

    def test_legacy_text_only_snapshot_and_progress_are_not_enriched_or_rewritten(self):
        old = UserProject.objects.create(user=self.user, source_prediction=self.record,
            recommendation_id='hdpe_scoop', title='Older title', summary='Older text',
            steps=['Old first', 'Old second', 'Old third'], completed_steps=[0], reference={'source': 'Old source'})
        project = self.start().json()['project']
        self.assertEqual(project['id'], old.pk)
        self.assertEqual(project['steps'], old.steps)
        self.assertEqual(project['completed_steps'], [0])
        self.assertNotIn('photos', project['reference'])

    def test_change_idea_captures_media_in_same_project_then_progress_locks_change(self):
        old = self.start('hdpe_planter').json()['project']
        url = f"/api/projects/{old['id']}/ideas/"
        response = self.client.post(url, json.dumps({'recommendation_id': 'hdpe_scoop'}),
            content_type='application/json', **self.auth)
        project = response.json()['project']
        self.assertEqual(project['id'], old['id'])
        self.assertEqual(project['reference']['photos'], PHOTOS['hdpe_scoop'])
        self.assertEqual(project['completed_steps'], [])
        step_url = f"/api/projects/{old['id']}/steps/0/"
        self.client.patch(step_url, json.dumps({'completed': True}), content_type='application/json', **self.auth)
        self.client.patch(step_url, json.dumps({'completed': False}), content_type='application/json', **self.auth)
        self.assertEqual(self.client.get(url, **self.auth).status_code, 409)
        self.assertEqual(UserProject.objects.get(pk=old['id']).reference['photos'], PHOTOS['hdpe_scoop'])

    def test_catalog_keeps_all_project_ids_and_zero_based_three_step_sequences(self):
        expected = ['pete_planter', 'pete_organizer', 'pete_seed_set', 'hdpe_planter', 'hdpe_storage', 'hdpe_scoop',
                    'cardboard_organizer', 'cardboard_divider', 'cardboard_craft', 'paper_gift_wrap', 'paper_organizer',
                    'paper_craft', 'fabric_cleaning_cloth', 'fabric_pouch', 'fabric_patchwork', 'coconut_planter',
                    'coconut_bowl', 'coconut_craft', 'wood_shelf', 'wood_marker', 'wood_craft']
        rows = [row for choices in CATALOG.values() for row in choices]
        self.assertEqual([row['id'] for row in rows], expected)
        self.assertTrue(all(len(row['steps']) == 3 and all(isinstance(s, str) for s in row['steps']) for row in rows))
