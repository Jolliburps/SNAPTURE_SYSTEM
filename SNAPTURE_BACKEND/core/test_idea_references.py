from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase

from .assessment import assess
from .materials import public_materials
from .models import Guidance
from predictions.models import PredictionRecord


class IdeaReferenceTests(TestCase):
    def setUp(self):
        call_command('seed_reference_guidance', verbosity=0)

    def test_six_materials_have_honest_reference_or_pending_cards(self):
        rows = {row['label']: row for row in public_materials()}
        self.assertEqual(len(rows), 6)
        self.assertNotIn('coconut_shells', rows)
        for label, row in rows.items():
            self.assertEqual(row['upcycling'], [])
            self.assertEqual(len(row['idea_references']), 1)
            idea = row['idea_references'][0]
            self.assertFalse(idea['can_start'])
            if label in {'paper', 'cardboard', 'fabric_scraps'}:
                self.assertEqual(idea['status'], 'source_checked')
                self.assertTrue(idea['source'])
                self.assertTrue(idea['steps'])
                self.assertTrue(idea['safety_note'])
            else:
                self.assertEqual(idea['status'], 'awaiting_review')
                self.assertEqual(idea['steps'], [])
                self.assertEqual(idea['materials'], [])

    def test_newer_unpublished_content_is_not_exposed_through_reference_library(self):
        entry = Guidance.objects.filter(kind='project', material='paper').first()
        entry.pk = None
        entry.version += 1
        entry.state = 'draft'
        entry.instructions = ['DRAFT INSTRUCTION MUST NOT BE PUBLIC']
        entry.save()
        paper = next(row for row in public_materials() if row['label'] == 'paper')
        self.assertEqual(paper['idea_references'][0]['status'], 'awaiting_review')
        self.assertNotIn('DRAFT INSTRUCTION', str(paper))

    def test_read_only_references_do_not_unlock_item_recommendations(self):
        user = User.objects.create_user('idea-reference-test')
        record = PredictionRecord.objects.create(user=user, model_class='paper', decision='paper', title='Paper', confidence=.9,
            condition='Clean and dry', previous_contents='No chemical contact known', quantity=1,
            answers={'user_confirmed_material':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'})
        assessment = assess(record)
        self.assertEqual(assessment['upcycling']['recommendations'], [])
        self.assertEqual(assessment['upcycling']['status'], 'awaiting_review')
        self.assertFalse(assessment['quick_check']['has_reviewed_projects'])
