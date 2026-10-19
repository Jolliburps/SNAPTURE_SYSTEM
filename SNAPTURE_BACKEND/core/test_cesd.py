import hashlib
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.management import call_command, CommandError
from django.test import TestCase

from core.assessment import assess
from core.cesd_sources import information
from core.models import CollectionNotice, Guidance
from predictions.models import PredictionRecord


class CESDInformationTests(TestCase):
    def load_sources(self):
        with patch('core.management.commands.import_cesd_information.SOURCE_HASHES', {'sample.png': hashlib.sha256(b'reference').hexdigest()}), \
             patch('pathlib.Path.is_file', return_value=True), patch('pathlib.Path.read_bytes', return_value=b'reference'):
            call_command('import_cesd_information', source_dir='source-fixture', verbosity=0)

    def test_import_is_idempotent_and_does_not_create_classes_or_collection_dates(self):
        self.load_sources()
        self.load_sources()
        self.assertEqual(Guidance.objects.count(), 6)
        self.assertEqual(CollectionNotice.objects.count(), 0)
        self.assertFalse(Guidance.objects.exclude(kind='information', material='').exists())
        self.assertTrue(all(entry.review_level == 'source_checked' and entry.reviewed_by_id is None for entry in Guidance.objects.all()))
        self.assertEqual(len(self.client.get('/api/materials/').json()['materials']), 6)

    def test_source_change_fails_before_database_writes(self):
        with patch('core.management.commands.import_cesd_information.SOURCE_HASHES', {'sample.png': 'wrong'}), \
             patch('pathlib.Path.is_file', return_value=True), patch('pathlib.Path.read_bytes', return_value=b'changed'):
            with self.assertRaises(CommandError):
                call_command('import_cesd_information', source_dir='source-fixture', verbosity=0)
        self.assertFalse(Guidance.objects.exists())

    def test_library_only_returns_intact_published_information(self):
        self.load_sources()
        Guidance.objects.create(key='draft-not-public', kind='information', title='PRIVATE DRAFT')
        result = self.client.get('/api/learning/').json()['entries']
        self.assertEqual(len(result), 6)
        self.assertTrue(all(entry['source'] and entry['review_note'] for entry in result))
        Guidance.objects.filter(key='cesd-household-hazardous').update(instructions=['Changed without review'])
        self.assertEqual(len(self.client.get('/api/learning/').json()['entries']), 5)

    def test_reimport_does_not_reactivate_withdrawn_reference(self):
        self.load_sources()
        Guidance.objects.filter(key='cesd-household-hazardous').update(state='archived')
        self.load_sources()
        self.assertEqual(len(self.client.get('/api/learning/').json()['entries']), 5)

    def test_unknown_item_with_reported_chemicals_gets_precautions_not_a_category_or_project(self):
        self.load_sources()
        user = User.objects.create_user('cesd-test')
        record = PredictionRecord.objects.create(user=user, decision='unknown_unsupported', model_class='paper', confidence=0.2, title='Unknown', previous_contents='Chemical or cleaning product')
        result = assess(record)
        self.assertIsNotNone(result['safety'])
        self.assertIn('not a hazard detected by the camera', result['safety']['explanation'])
        self.assertIsNone(result['segregation']['category'])
        self.assertEqual(result['upcycling']['recommendations'], [])
        Guidance.objects.filter(key='cesd-household-hazardous').update(state='archived')
        self.assertIsNone(assess(record)['safety'])

    def test_safe_history_does_not_trigger_a_chemical_warning(self):
        self.load_sources()
        record = PredictionRecord(decision='paper', confidence=0.9, previous_contents='No chemical contact known')
        self.assertIsNone(assess(record)['safety'])
        compost = next(entry for entry in information() if entry['key'] == 'cesd-compost-learning')
        self.assertIn('withheld', compost['warnings'])
