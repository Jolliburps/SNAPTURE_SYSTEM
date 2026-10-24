import json
from django.contrib.auth.models import User
from django.test import TestCase
from core.auth import issue_token
from .models import PredictionRecord, UserProject


class CatalogProjectTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('catalog-project')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.record=PredictionRecord.objects.create(user=self.user,model_class='paper',decision='paper',title='Paper',
                    confidence=.95,threshold=.8,model_version='dataset-candidate-unverified-test')

    def start(self, **changes):
        data={'prediction_id':self.record.id,'recommendation_id':'paper_gift_wrap'}
        data.update(changes)
        return self.client.post('/api/projects/',json.dumps(data),content_type='application/json',**self.auth)

    def test_chosen_task_persists_steps_and_completes_in_the_project_list(self):
        response=self.start(steps=['Fake client step'])
        self.assertEqual(response.status_code,201)
        project=response.json()['project']
        self.assertEqual(project['status'],'active')
        self.assertNotIn('Fake client step',project['steps'])
        self.assertEqual(project['reference']['review_level'],'educational')
        for index in range(project['total_steps']):
            response=self.client.patch(f"/api/projects/{project['id']}/steps/{index}/",json.dumps({'completed':True}),content_type='application/json',**self.auth)
            self.assertEqual(response.status_code,200)
            self.assertEqual(response.json()['project']['status'],'completed' if index==project['total_steps']-1 else 'active')
        saved=self.client.get('/api/projects/',**self.auth).json()['projects'][0]
        self.assertEqual(saved['status'],'completed')
        self.assertEqual(saved['progress_percent'],100)
        self.assertEqual(saved['completed_count'],saved['total_steps'])

    def test_retrying_task_selection_reuses_the_existing_project(self):
        first=self.start().json()['project']
        again=self.start()
        self.assertEqual(again.status_code,200)
        self.assertEqual(again.json()['project']['id'],first['id'])
        self.assertEqual(UserProject.objects.count(),1)

    def test_invalid_tasks_unknown_materials_and_reported_hazards_cannot_start(self):
        for value in ('not-a-real-task',None,{},'x'*161):
            self.assertEqual(self.start(recommendation_id=value).status_code,400)
        self.record.previous_contents='Chemical or cleaning product';self.record.save()
        self.assertEqual(self.start().status_code,400)
        self.assertEqual(UserProject.objects.count(),0)

    def test_another_user_cannot_start_or_change_this_project(self):
        other=User.objects.create_user('different-project-user')
        other_auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(other)}'}
        response=self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.id,'recommendation_id':'paper_gift_wrap'}),content_type='application/json',**other_auth)
        self.assertEqual(response.status_code,404)
        project=self.start().json()['project']
        response=self.client.patch(f"/api/projects/{project['id']}/steps/0/",json.dumps({'completed':True}),content_type='application/json',**other_auth)
        self.assertEqual(response.status_code,404)

    def test_a_completed_catalog_task_can_be_restarted(self):
        project=self.start().json()['project']
        for index in range(project['total_steps']):
            self.client.patch(f"/api/projects/{project['id']}/steps/{index}/",json.dumps({'completed':True}),content_type='application/json',**self.auth)
        result=self.client.post(f"/api/projects/{project['id']}/restart/",**self.auth)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['project']['status'],'active')
        self.assertEqual(result.json()['project']['completed_steps'],[])
