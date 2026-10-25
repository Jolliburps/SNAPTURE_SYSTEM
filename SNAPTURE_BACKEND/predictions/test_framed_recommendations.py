import json

from django.test import TestCase

from core.materials import SCOPE_LABELS
from .models import PredictionRecord, ScanScene
from . import test_automatic_routing as fixtures


class FramedRecommendationTests(TestCase):
    setUp = fixtures.AutomaticRoutingTests.setUp
    item = fixtures.AutomaticRoutingTests.item
    automatic = fixtures.AutomaticRoutingTests.automatic

    def fallback(self, label='fabric_scraps'):
        self.scene.quality = {'single_item': {'enabled': True, 'status': 'needs_review'}}
        self.scene.save()
        return self.item('Unidentified or unsupported object', label, score=0, confidence=.4,
                         image_quality={'object_source': 'whole_image_classifier'})

    def check(self, item, **fields):
        return self.client.patch(f'/api/predictions/{item.prediction_id}/', json.dumps({
            'condition': 'Clean and dry', 'answers': {'material_confirmation': item.prediction.decision},
            **fields,
        }), content_type='application/json', **self.auth)

    def history(self):
        return self.client.get(f'/api/scenes/{self.scene.id}/?history=1', **self.auth).json()['scene']['items'][0]

    def test_all_seven_user_confirmed_materials_restore_own_ideas_and_working_guides(self):
        resin = {'pete_bottles': 'PET/PETE code 1', 'hdpe_containers': 'HDPE code 2'}
        for label in SCOPE_LABELS:
            with self.subTest(label=label):
                self.scene = ScanScene.objects.create(user=self.user, request_id=f'framed_{label}',
                                                     width=100, height=100, status='complete')
                item = self.fallback(label)
                pending = self.automatic(item).json()['scene']['items'][0]
                self.assertTrue(pending['automatic_route']['confirmation_required'])
                self.assertEqual(pending['prediction']['upcycling_ideas'], [])
                answers = {'material_confirmation': label}
                if label in resin:
                    answers['resin_mark'] = resin[label]
                checked = self.check(item, answers=answers)
                self.assertEqual(checked.status_code, 200)
                result = self.history()
                self.assertFalse(result['automatic_route']['confirmation_required'])
                ideas = result['action_advice']['projects']
                self.assertEqual(len(ideas), 3)
                self.assertTrue(all(idea['material'] == label for idea in ideas))
                self.assertEqual(result['name'], 'Unidentified or unsupported object')
                self.assertIn('confirmed by you', result['display_name'])
                self.assertFalse(result['display_box'])
                self.assertEqual(result['detection_status'], 'material_only')
                self.assertIsNone(result['identification']['object_prediction']['confidence'])
                opened = self.client.post('/api/projects/', json.dumps({
                    'prediction_id': item.prediction_id, 'recommendation_id': ideas[0]['id'],
                }), content_type='application/json', **self.auth)
                self.assertEqual(opened.status_code, 201, opened.content)

    def test_existing_confirmed_scan_recovers_without_rewriting_saved_history(self):
        item = self.fallback()
        self.automatic(item)
        self.check(item)
        item.prediction.refresh_from_db()
        record = item.prediction
        # Reproduce the snapshot saved by the old material-only blocker.
        record.image_quality = {**record.image_quality, 'action_snapshot': {
            'chosen_action': 'recover', 'status': 'needs_information', 'projects': [],
            'title': 'Check the object first',
        }}
        record.save()
        before = PredictionRecord.objects.values().get(pk=record.id)
        # A newer scan must not supply paper ideas to this fabric scan.
        self.item('paper scrap', 'paper')
        # The new record belongs to a different photo, not the framed scene.
        other = ScanScene.objects.create(user=self.user, request_id='newer_photo', status='complete', width=100, height=100)
        self.scene.items.exclude(pk=item.id).update(scene=other)
        result = self.history()
        self.assertEqual(len(result['action_advice']['projects']), 3)
        self.assertTrue(all(idea['material'] == 'fabric_scraps' for idea in result['action_advice']['projects']))
        self.assertNotEqual(result['action_advice']['status'], 'needs_information')
        self.assertEqual(PredictionRecord.objects.values().get(pk=record.id), before)

    def test_legacy_mixed_photo_fallback_still_requires_object_review(self):
        item = self.fallback()
        self.scene.quality = {}
        self.scene.save()
        self.automatic(item)
        self.check(item)
        result = self.history()
        self.assertTrue(result['automatic_route']['confirmation_required'])
        self.assertEqual(result['prediction']['upcycling_ideas'], [])
        self.assertEqual(result['action_advice']['projects'], [])

    def test_user_can_identify_unknown_framed_material_without_inventing_an_object_name(self):
        item = self.fallback('unknown_unsupported')
        self.automatic(item)
        payload = json.dumps({'prediction_id': item.prediction_id, 'recommendation_id': 'fabric_cleaning_cloth'})
        self.assertEqual(self.client.post('/api/projects/', payload, content_type='application/json', **self.auth).status_code, 400)
        self.assertEqual(self.check(item, answers={'material_confirmation': 'fabric_scraps'}).status_code, 200)
        result = self.history()
        self.assertEqual(result['prediction']['assessment']['material']['status'], 'user_selected')
        self.assertEqual(len(result['action_advice']['projects']), 3)
        self.assertTrue(all(idea['material'] == 'fabric_scraps' for idea in result['action_advice']['projects']))
        self.assertEqual(result['automatic_route']['label'], 'Recycling / upcycling ideas')
        self.assertFalse(result['identification']['user_object_name'])
        self.assertEqual(self.client.post('/api/projects/', payload, content_type='application/json', **self.auth).status_code, 201)

    def test_confirmation_does_not_bypass_resin_condition_or_hazard_checks(self):
        cases = [
            ('pete_bottles', {}),
            ('fabric_scraps', {'condition': 'Moldy or contaminated'}),
            ('paper', {'previous_contents': 'Chemical or cleaning product'}),
            ('dry_untreated_wood_scraps', {'answers': {
                'material_confirmation': 'dry_untreated_wood_scraps', 'wood_treatment': 'Yes'}}),
            ('paper', {'answers': {'material_confirmation': 'Not sure'}}),
        ]
        for index, (label, fields) in enumerate(cases):
            with self.subTest(label=label, fields=fields):
                self.scene = ScanScene.objects.create(user=self.user, request_id=f'unsafe_frame_{index}',
                                                     width=100, height=100, status='complete')
                item = self.fallback(label)
                self.automatic(item)
                self.assertEqual(self.check(item, **fields).status_code, 200)
                result = self.history()
                self.assertEqual(result['prediction']['upcycling_ideas'], [])
                self.assertEqual(result['action_advice']['projects'], [])
                rejected = self.client.post('/api/projects/', json.dumps({
                    'prediction_id': item.prediction_id, 'recommendation_id': 'paper_gift_wrap',
                }), content_type='application/json', **self.auth)
                self.assertEqual(rejected.status_code, 400)
