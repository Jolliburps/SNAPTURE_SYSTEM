from django.test import TestCase

from core.materials import public_materials
from core.recommendations import CATALOG
from core.home_tutorials import TUTORIALS
from core.materials import SCOPE_LABELS
from django.contrib.auth.models import User
from core.auth import issue_token
from predictions.models import PredictionRecord
import json


class HomePhotoIdeasTests(TestCase):
    def test_separate_home_tutorials_cover_all_materials_without_catalog_id_changes(self):
        self.assertEqual(set(TUTORIALS), set(SCOPE_LABELS))
        source_ids = {'PET-003', 'HDPE-004', 'PAPER-003', 'CARD-004', 'FABRIC-001', 'COCO-004', 'WOOD-001'}
        entries = [idea for row in public_materials() for idea in row['home_tutorials']]
        self.assertEqual(len(entries), 7)
        self.assertEqual({idea['photos']['source_id'] for idea in entries}, source_ids)
        catalog_ids = {entry['id'] for choices in CATALOG.values() for entry in choices}
        images = missing = 0
        for idea in entries:
            self.assertTrue(idea['id'].startswith('tutorial:'))
            self.assertNotIn(idea['id'], catalog_ids)
            self.assertFalse(idea['can_start'])
            self.assertEqual(len(idea['steps']), len(idea['photos']['steps']))
            self.assertEqual([p['step_index'] for p in idea['photos']['steps']], list(range(len(idea['steps']))))
            for photo in [idea['photos']['finished'], *idea['photos']['steps']]:
                if photo['url']:
                    response = self.client.get(photo['url'])
                    self.assertEqual(response.status_code, 200)
                    response.close()
                    images += 1
                else:
                    missing += 1
                    self.assertEqual(idea['photos']['source_id'], 'COCO-004')
                    self.assertEqual(photo['source_stage'], 4)
        self.assertEqual((images, missing), (41, 1))

    def test_home_tutorial_cannot_be_started_as_a_scan_project(self):
        user = User.objects.create_user('home-tutorial-test')
        record = PredictionRecord.objects.create(user=user, model_class='paper', decision='paper', title='Paper', confidence=.95, threshold=.8)
        response = self.client.post('/api/projects/', json.dumps({'prediction_id': record.pk,
            'recommendation_id': TUTORIALS['paper'][0]['id']}), content_type='application/json',
            HTTP_AUTHORIZATION=f'Bearer {issue_token(user)}')
        self.assertEqual(response.status_code, 400)

    def test_home_only_exposes_exact_catalog_matches_as_read_only_educational_previews(self):
        response = self.client.get('/api/materials/')
        self.assertEqual(response.status_code, 200)
        rows = response.json()['materials']
        photos = [(row['label'], idea) for row in rows for idea in row['photo_ideas']]
        self.assertEqual({(material, idea['id']) for material, idea in photos}, {
            ('hdpe_containers', 'hdpe_scoop'), ('coconut_shells', 'coconut_bowl')})
        for material, idea in photos:
            original = next(entry for entry in CATALOG[material] if entry['id'] == idea['id'])
            for field in ('id', 'title', 'summary', 'materials', 'steps', 'photos'):
                self.assertEqual(idea[field], original[field])
            self.assertFalse(idea['can_start'])
            self.assertEqual(idea['status'], 'educational')
            self.assertEqual(idea['photos']['photo_rights'], 'Not verified for app reuse')
            self.assertTrue(idea['photos']['finished']['url'].startswith('/api/tutorial-assets/'))
        self.assertTrue(all(not row['upcycling'] for row in rows))
        pete = next(row for row in rows if row['label'] == 'pete_bottles')
        self.assertEqual(pete['photo_ideas'], [])

    def test_every_attached_home_image_is_served_and_missing_steps_stay_explicit(self):
        for row in public_materials():
            for idea in row['photo_ideas']:
                photos = idea['photos']
                for photo in [photos['finished'], *photos['steps']]:
                    if photo['url']:
                        response = self.client.get(photo['url'])
                        self.assertEqual(response.status_code, 200)
                        self.assertEqual(response['Content-Type'], 'image/jpeg')
                        response.close()
                    else:
                        self.assertEqual(photo['photo_status'], 'Dedicated process photo needed')
