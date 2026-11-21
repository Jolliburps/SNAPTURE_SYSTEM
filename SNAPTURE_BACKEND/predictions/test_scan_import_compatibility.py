"""Integration checks for local content and saved records retained by the import."""
import json
from copy import deepcopy

from django.test import TestCase

from core.assessment import refresh
from core.recommendations import CATALOG, build_recommendations
from .models import PredictionRecord, ScanScene, SceneItem
from .test_scenes import SceneApiTests


class ScanImportCompatibilityTests(TestCase):
    setUp = SceneApiTests.setUp

    def record(self, label='paper', condition='Torn or crumpled, clean and dry', **extra):
        row = PredictionRecord(user=self.user, decision=label, title=label,
            model_class='manual_selection', input_method='manual', model_version='manual', confidence=0, threshold=.8,
            condition=condition, previous_contents='No chemical contact known',
            answers={'user_confirmed_material': label, 'contamination': 'None known', 'moisture': 'Dry'}, **extra)
        refresh(row)
        row.save()
        return row

    def test_scrap_filter_preserves_the_local_catalog_content_and_photos(self):
        original = deepcopy(CATALOG)
        for label, condition, expected in [
            ('paper', 'Torn or crumpled, clean and dry', ['paper_craft']),
            ('cardboard', 'Clean dry usable scraps', ['cardboard_craft']),
            ('fabric_scraps', 'Clean dry usable scraps', ['fabric_cleaning_cloth', 'fabric_patchwork']),
        ]:
            ideas = build_recommendations(label, condition=condition)
            self.assertEqual([idea['id'] for idea in ideas], expected)
            for idea in ideas:
                source = next(item for item in original[label] if item['id'] == idea['id'])
                for key in ('title', 'summary', 'materials', 'steps', 'photos'):
                    self.assertEqual(idea.get(key), source.get(key))
        self.assertEqual(CATALOG, original)

    def test_scrap_project_uses_its_own_scan_and_existing_local_instructions(self):
        row = self.record(image_quality={'item_action': 'recover', 'automatic_routing': True, 'selected_for_disposal': True})
        row.answers['assessment_checked_at'] = '2026-11-19T00:00:00Z'
        refresh(row)
        row.save()
        scene = ScanScene.objects.create(user=self.user, request_id='scrap-project', width=200, height=200,
                                        status='complete', quality={'single_item': {'enabled': True}})
        SceneItem.objects.create(scene=scene, prediction=row, name='paper scrap', score=.8, box=[.1, .1, .9, .9])
        other = self.record()
        result = self.client.get(f'/api/scenes/{scene.id}/?history=1', **self.auth).json()['scene']['items'][0]
        self.assertFalse(result['automatic_route']['confirmation_required'])
        self.assertEqual(result['action_advice']['projects'], [])
        ideas=self.client.post(f'/api/predictions/{row.id}/recommendations/',**self.auth).json()['recommendations']
        self.assertEqual([idea['id'] for idea in ideas], ['paper_craft'])
        response = self.client.post('/api/projects/', json.dumps({
            'prediction_id': row.id, 'recommendation_id': 'paper_craft'}),
            content_type='application/json', **self.auth)
        self.assertEqual(response.status_code, 201)
        project = response.json()['project']
        source = next(item for item in CATALOG['paper'] if item['id'] == 'paper_craft')
        self.assertEqual(project['source_prediction_id'], row.id)
        self.assertNotEqual(project['source_prediction_id'], other.id)
        self.assertEqual(project['steps'], source['steps'])
        self.assertEqual(project['summary'], source['summary'])

    def test_scrap_readiness_does_not_bypass_material_or_contamination_checks(self):
        from .item_actions import project_condition_ready
        for label, condition in [('paper', 'Torn or crumpled, clean and dry'),
                                 ('cardboard', 'Clean dry usable scraps'), ('fabric_scraps', 'Clean dry usable scraps')]:
            row = self.record(label, condition)
            self.assertTrue(project_condition_ready(row))
            row.answers['moisture'] = 'Wet'
            self.assertFalse(project_condition_ready(row))
            row.answers.update(moisture='Dry', contamination='Chemical contamination')
            self.assertFalse(project_condition_ready(row))
            row.answers['contamination'] = 'None known'
            row.decision = 'hdpe_containers'
            self.assertFalse(project_condition_ready(row))

    def test_history_without_measured_bounds_keeps_its_snapshot_and_no_padded_outline(self):
        metadata = {'object_source': 'model', 'detection_filter': {'status': 'accepted'},
                    'classification_crop': [.1, .2, .8, .9]}
        row = self.record(image_quality=metadata)
        snapshot = deepcopy(row.assessment)
        response = self.client.get(f'/api/predictions/{row.id}/?history=1', **self.auth)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()['prediction']['focus_box'])
        row.refresh_from_db()
        self.assertEqual(row.assessment, snapshot)
        self.assertEqual(row.image_quality, metadata)
