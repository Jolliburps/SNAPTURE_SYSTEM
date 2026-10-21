import json
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from core.auth import issue_token
from core.models import Guidance
from predictions.models import PredictionRecord, UserProject


class ProjectRestartTests(TestCase):
    def setUp(self):
        call_command('seed_reference_guidance',verbosity=0)
        from core.test_support import expert_project_fixtures
        expert_project_fixtures()
        self.user = User.objects.create_user('project-restart-test')
        self.auth = {'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.record = PredictionRecord.objects.create(user=self.user,model_class='paper',decision='paper',title='Paper',confidence=.9,
            quantity=1,condition='Clean and dry',previous_contents='No chemical contact known',answers={'user_confirmed_material':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'},selected_recommendation='paper-gift-wrap:v1')
        self.project = self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.id}),content_type='application/json',**self.auth).json()['project']
        self.url = f"/api/projects/{self.project['id']}/restart/"

    def complete(self):
        for i in range(self.project['total_steps']):
            result = self.client.patch(f"/api/projects/{self.project['id']}/steps/{i}/",json.dumps({'completed':True}),content_type='application/json',**self.auth)
        self.assertEqual(result.json()['project']['status'],'completed')

    def test_restart_persists_reset_and_can_complete_again(self):
        self.complete()
        result = self.client.post(self.url,**self.auth)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['project']['completed_steps'],[])
        self.assertEqual(result.json()['project']['status'],'active')
        self.assertEqual(UserProject.objects.get(pk=self.project['id']).completed_steps,[])
        self.complete()

    def test_restart_is_owner_scoped_and_requires_completed_state(self):
        self.assertEqual(self.client.post(self.url,**self.auth).status_code,409)
        other = User.objects.create_user('not-project-owner')
        self.assertEqual(self.client.post(self.url,HTTP_AUTHORIZATION=f'Bearer {issue_token(other)}').status_code,404)

    def test_withdrawn_guidance_cannot_be_restarted_but_completed_history_survives(self):
        self.complete()
        Guidance.objects.filter(key='paper-gift-wrap').update(state='archived')
        self.assertEqual(self.client.post(self.url,**self.auth).status_code,400)
        self.assertEqual(len(UserProject.objects.get(pk=self.project['id']).completed_steps),3)
