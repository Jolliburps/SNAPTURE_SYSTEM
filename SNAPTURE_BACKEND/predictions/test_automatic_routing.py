import json

from django.contrib.auth.models import User
from django.test import TestCase

from core.auth import issue_token
from core.assessment import refresh
from core.materials import SCOPE_LABELS
from .models import PredictionRecord, ScanScene, SceneItem


class AutomaticRoutingTests(TestCase):
    """Exercise the actual API and saved snapshots, without model inference."""

    def setUp(self):
        self.user = User.objects.create_user('automatic-routing')
        self.auth = {'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.scene = ScanScene.objects.create(user=self.user, request_id='auto_test_scene', width=100, height=100, status='complete')

    def item(self, name='paper scrap', label='paper', score=.8, **changes):
        values = dict(user=self.user, model_class=name, decision=label, title=label, confidence=.95, threshold=.8,
                      model_version='dataset-candidate-unverified-test', condition='Clean and dry')
        values.update(changes)
        record = PredictionRecord.objects.create(**values)
        refresh(record)
        record.save()
        return SceneItem.objects.create(scene=self.scene, prediction=record, name=name, score=score, box=[.1,.1,.8,.8])

    def automatic(self, item, **extra):
        return self.client.post(f'/api/scenes/{self.scene.id}/disposal-selection/', json.dumps({
            'item_ids':[item.id], 'automatic_routing':True,
            'item_conditions':{str(item.id):'Clean and dry'}, **extra,
        }), content_type='application/json', **self.auth)

    def test_all_seven_materials_route_to_recovery_without_exposing_unconfirmed_ideas(self):
        for label in SCOPE_LABELS:
            with self.subTest(label=label):
                item = self.item('material item', label)
                response = self.automatic(item)
                self.assertEqual(response.status_code, 200)
                result = next(row for row in response.json()['scene']['items'] if row['id'] == item.id)
                self.assertEqual(result['automatic_route']['action'], 'recover')
                self.assertTrue(result['automatic_route']['confirmation_required'])
                self.assertEqual(result['action_advice']['chosen_action'], 'recover')
                self.assertEqual(result['action_advice']['projects'], [])
                self.assertEqual(result['prediction']['upcycling_ideas'], [])
                self.assertEqual(result['prediction']['recommendation_choices'], [])

    def test_confirmation_is_required_even_for_direct_project_requests_then_unlocks_matching_ideas(self):
        item = self.item()
        self.automatic(item)
        url = '/api/projects/'
        payload = json.dumps({'prediction_id':item.prediction_id, 'recommendation_id':'paper_gift_wrap'})
        self.assertEqual(self.client.post(url, payload, content_type='application/json', **self.auth).status_code, 400)
        response = self.client.patch(f'/api/predictions/{item.prediction_id}/', json.dumps({
            'condition':'Clean and dry', 'answers':{'material_confirmation':'paper'},
        }), content_type='application/json', **self.auth)
        self.assertEqual(response.status_code, 200)
        result = self.client.get(f'/api/scenes/{self.scene.id}/?history=1', **self.auth).json()['scene']['items'][0]
        self.assertFalse(result['automatic_route']['confirmation_required'])
        self.assertTrue(result['action_advice']['projects'])
        self.assertEqual(self.client.post(url, payload, content_type='application/json', **self.auth).status_code, 201)

    def test_other_objects_route_to_disposal_not_automatically_residual(self):
        for name, group in [('food scraps or fruit peel','biodegradable'), ('metal can','recyclable'),
                            ('battery','special'), ('glass bottle or glass jar','special'), ('disposable diaper','residual')]:
            with self.subTest(name=name):
                item = self.item(name, 'unknown_unsupported')
                result = next(row for row in self.automatic(item).json()['scene']['items'] if row['id'] == item.id)
                self.assertEqual(result['automatic_route']['action'], 'discard')
                self.assertEqual(result['action_advice']['waste_group'], group)
                self.assertEqual(result['action_advice']['projects'], [])

    def test_weak_unknown_detection_stays_review_only(self):
        item = self.item('unfamiliar discarded object', 'unknown_unsupported', score=.12)
        result = self.automatic(item).json()['scene']['items'][0]
        self.assertTrue(result['automatic_route']['needs_review'])
        self.assertEqual(result['action_advice']['waste_group'], 'unconfirmed')
        self.assertEqual(result['action_advice']['status'], 'needs_information')

    def test_hazard_report_overrides_supported_material(self):
        item = self.item(previous_contents='Chemical or cleaning product')
        result = self.automatic(item).json()['scene']['items'][0]
        self.assertEqual(result['automatic_route']['action'], 'discard')
        self.assertEqual(result['action_advice']['waste_group'], 'special')
        self.assertEqual(result['action_advice']['projects'], [])

    def test_material_correction_replaces_route_and_snapshot_for_that_scan_only(self):
        item = self.item('material item', 'unknown_unsupported')
        self.automatic(item)
        response = self.client.patch(f'/api/predictions/{item.prediction_id}/', json.dumps({
            'condition':'Clean and dry', 'answers':{'material_confirmation':'fabric_scraps'},
        }), content_type='application/json', **self.auth)
        self.assertEqual(response.status_code, 200)
        result = self.client.get(f'/api/scenes/{self.scene.id}/?history=1', **self.auth).json()['scene']['items'][0]
        self.assertEqual(result['action_advice']['chosen_action'], 'recover')
        self.assertEqual(self.client.get(f'/api/scenes/{self.scene.id}/?history=1', **self.auth).json()['scene']['disposal_selection']['item_actions'][str(item.id)], 'recover')
        self.assertTrue(result['action_advice']['projects'])
        self.assertTrue(all(idea['id'].startswith('fabric_') for idea in result['action_advice']['projects']))

    def test_client_cannot_supply_action_overrides_in_automatic_mode(self):
        item = self.item()
        self.assertEqual(self.automatic(item, item_actions={str(item.id):'keep'}).status_code, 400)
        self.assertEqual(self.automatic(item, automatic_routing='true').status_code, 400)
