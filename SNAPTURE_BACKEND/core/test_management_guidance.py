from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from core.assessment import assess, refresh
from core.auth import issue_token
from core.management_guidance import MATERIALS
from predictions.models import PredictionRecord, ScanScene, SceneItem


class ManagementGuidanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('recommendation-owner')
        self.auth = {'HTTP_AUTHORIZATION': f'Bearer {issue_token(self.user)}'}

    def record(self, label, **changes):
        record = PredictionRecord(user=self.user, model_class=label, decision=label,
                                  title=label, confidence=.9, condition='Clean and dry',
                                  previous_contents='No chemical contact known',
                                  answers={'user_confirmed_material': label, 'moisture': 'Dry', 'contamination': 'None known'})
        for key, value in changes.items():
            setattr(record, key, value)
        refresh(record)
        record.save()
        return record

    def test_six_materials_have_distinct_actionable_sections_without_unlocking_projects(self):
        for label in MATERIALS:
            with self.subTest(label=label):
                record = self.record(label)
                assessment = record.assessment
                advice = assessment['management_guidance']
                self.assertEqual(advice['material_label'], label)
                self.assertEqual({s['key'] for s in advice['sections']}, {'disposal', 'preparation', 'recovery', 'safety', 'impact', 'local'})
                self.assertTrue(all(s['instructions'] for s in advice['sections']))
                self.assertTrue(advice['sources'])
                self.assertFalse(assessment['upcycling']['recommendations'])
                self.assertNotEqual(assessment['segregation']['status'], 'available')

    def test_hazards_override_even_a_confirmed_material_and_do_not_offer_rinsing_or_reuse(self):
        for change in ({'previous_contents': 'Chemical or cleaning product'},
                       {'answers': {'contamination': 'Chemical contamination'}},
                       {'model_class': 'battery'}):
            with self.subTest(change=change):
                record = self.record('hdpe_containers', **change)
                advice = record.assessment['management_guidance']
                self.assertEqual(advice['status'], 'precaution_only')
                preparation = next(s['instructions'] for s in advice['sections'] if s['key'] == 'preparation')
                self.assertNotIn('drain dry', ' '.join(preparation))
                self.assertNotIn('watering ornamental plants', str(advice))
                self.assertIn('Do not rinse', str(advice))

    def test_contaminated_damaged_and_unknown_items_get_no_material_reuse_instruction(self):
        for label, changes in [('fabric_scraps', {'condition': 'Moldy or contaminated'}),
                               ('paper', {'condition': 'Damaged or cracked'}),
                               ('unknown_unsupported', {})]:
            record = self.record(label, **changes)
            advice = record.assessment['management_guidance']
            recovery = next(s['instructions'] for s in advice['sections'] if s['key'] == 'recovery')
            self.assertNotIn('gift wrapping', str(recovery))
            self.assertNotIn('dust a non-food surface', str(recovery))
            self.assertIn('reference', advice['notice'].lower())

    def test_history_keeps_each_snapshot_even_after_new_scan_and_catalog_changes(self):
        first = self.record('paper')
        second = self.record('hdpe_containers')
        scene = ScanScene.objects.create(user=self.user, request_id='management-history', width=100, height=100, status='complete')
        SceneItem.objects.create(scene=scene, prediction=first, name='paper scrap', score=.9, box=[.1,.1,.3,.3])
        before = first.assessment
        with patch('predictions.views.assess', side_effect=AssertionError('Must use saved snapshot')), patch('core.management_guidance.management_guidance', side_effect=AssertionError('Must not regenerate saved guidance')):
            payload = self.client.get(f'/api/predictions/{first.id}/?history=1', **self.auth).json()
            self.assertEqual(payload['prediction']['assessment'], before)
            self.assertEqual(payload['scene']['items'][0]['prediction']['assessment'], before)
            self.assertNotIn('watering ornamental plants', str(payload))
        first.refresh_from_db()
        self.assertEqual(first.assessment, before)
        self.assertNotEqual(first.assessment['management_guidance'], second.assessment['management_guidance'])

    def test_legacy_supplement_is_based_only_on_saved_material_not_current_decision(self):
        record = self.record('paper')
        record.assessment.pop('management_guidance')
        record.decision = 'hdpe_containers'
        record.save()
        before = record.assessment
        with patch('predictions.views.assess', side_effect=AssertionError('No reassessment')):
            result = self.client.get(f'/api/predictions/{record.id}/?history=1', **self.auth).json()['prediction']
        advice = result['assessment']['management_guidance']
        self.assertEqual(advice['material_label'], 'paper')
        self.assertTrue(advice['legacy_supplement'])
        self.assertNotIn('watering ornamental plants', str(advice))
        record.refresh_from_db()
        self.assertEqual(record.assessment, before)

    def test_assessment_addition_does_not_mutate_the_record_on_read(self):
        record = self.record('paper')
        before = record.assessment
        assess(record)
        record.refresh_from_db()
        self.assertEqual(record.assessment, before)

    def test_existing_other_object_hypotheses_get_conditional_references_not_new_classes(self):
        for hypothesis, expected in [('glass bottle or glass jar', 'chipped or cracked'),
                                     ('metal can', 'sharp edges'),
                                     ('food scraps or fruit peel', 'managed compost'),
                                     ('dry leaf', 'garden-waste'),
                                     ('plastic bag or plastic wrapper', 'flexible packaging')]:
            record = self.record('unknown_unsupported', model_class=hypothesis)
            advice = record.assessment['management_guidance']
            self.assertIn(expected, str(advice))
            self.assertIn('not a confirmed material or bin assignment', advice['notice'])
            self.assertEqual(record.decision, 'unknown_unsupported')
            self.assertEqual(record.assessment['material']['label'], 'unknown_unsupported')
            self.assertFalse(record.assessment['upcycling']['recommendations'])
