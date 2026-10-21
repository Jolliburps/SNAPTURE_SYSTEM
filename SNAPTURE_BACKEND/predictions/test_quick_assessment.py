import json
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from core.auth import issue_token
from core.assessment import assess
from .models import PredictionRecord

class QuickAssessmentTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('quick-assessment-test')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        call_command('seed_reference_guidance',verbosity=0)
        self.record=PredictionRecord.objects.create(user=self.user,model_class='unfamiliar discarded object',decision='unknown_unsupported',title='Unknown',confidence=.2,model_version='owlvit-scene-candidate-unverified-v2')

    def update(self,**changes):
        payload={'condition':'Clean and dry','previous_contents':'No chemical contact known','answers':{'material_confirmation':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'}}
        payload.update(changes)
        return self.client.patch(f'/api/predictions/{self.record.pk}/',json.dumps(payload),content_type='application/json',**self.auth)

    def test_new_material_and_specific_answers_work_in_one_save(self):
        response=self.update();self.assertEqual(response.status_code,200)
        result=response.json()['prediction']
        self.assertEqual(result['assessment']['segregation']['status'],'available')
        self.assertTrue(result['assessment']['quick_check']['sorting_complete'])
        self.assertTrue(result['assessment']['quick_check']['user_reviewed'])
        self.assertEqual(result['answers']['paper_surface'],'Plain uncoated material without personal details')
        self.assertEqual(result['answers']['contamination'],'None known')
        self.assertIsNone(result['quantity'])
        self.assertEqual(result['assessment']['upcycling']['status'],'awaiting_review')

    def test_no_project_questions_are_required_to_get_sorting_advice(self):
        response=self.client.get('/api/predictions/questions/paper/',**self.auth).json()
        self.assertIn('paper_surface',[q['id'] for q in response['questions']])
        self.assertIn('paper_surface',response['quick_check']['sorting_question_ids'])
        self.assertFalse(response['quick_check']['has_reviewed_projects'])
        self.assertNotIn('quantity',response['quick_check']['sorting_question_ids'])

    def test_material_without_local_rule_does_not_require_long_sorting_form(self):
        for label in ('fabric_scraps','dry_untreated_wood_scraps'):
            response=self.client.get(f'/api/predictions/questions/{label}/',**self.auth).json()
            self.assertFalse(response['quick_check']['has_sorting_rule'])
            self.assertEqual(response['quick_check']['sorting_question_ids'],['material_confirmation'])

    def test_chemical_or_wet_report_never_returns_clean_recyclable_route(self):
        for changes in ({'previous_contents':'Chemical or cleaning product'},{'answers':{'material_confirmation':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Wet'}}):
            with self.subTest(changes=changes):
                result=self.update(**changes).json()['prediction']
                self.assertNotEqual(result['assessment']['segregation']['status'],'available')
                self.assertEqual(result['recommendation_choices'],[])

    def test_changing_material_drops_stale_answers_but_not_explicit_new_answers(self):
        self.update()
        result=self.update(answers={'material_confirmation':'dry_untreated_wood_scraps'}).json()['prediction']
        self.assertNotIn('paper_surface',result['answers'])
        self.assertNotIn('contamination',result['answers'])
        self.assertNotIn('moisture',result['answers'])
        self.assertEqual(assess(PredictionRecord.objects.get(pk=self.record.pk))['upcycling']['recommendations'],[])
