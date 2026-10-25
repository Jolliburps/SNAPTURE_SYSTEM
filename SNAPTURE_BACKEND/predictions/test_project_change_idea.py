import json
from django.contrib.auth.models import User
from django.test import TestCase
from core.auth import issue_token
from .models import PredictionRecord, UserProject


class ChangeProjectIdeaTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('change-idea-user')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.record=PredictionRecord.objects.create(user=self.user,model_class='paper',decision='paper',title='Paper',
            confidence=.95,threshold=.8,condition='Clean and dry',model_version='dataset-candidate-unverified-test')
        self.project=self.start('paper_gift_wrap').json()['project']
        self.url=f"/api/projects/{self.project['id']}/ideas/"

    def start(self,idea):
        return self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.pk,'recommendation_id':idea}),content_type='application/json',**self.auth)

    def change(self,idea,**other):
        return self.client.post(self.url,json.dumps({'recommendation_id':idea,**other}),content_type='application/json',**self.auth)

    def mark(self,index,done=True):
        return self.client.patch(f"/api/projects/{self.project['id']}/steps/{index}/",json.dumps({'completed':done}),content_type='application/json',**self.auth)

    def test_lists_only_alternatives_for_this_item_without_changing_original(self):
        result=self.client.get(self.url,**self.auth)
        self.assertEqual(result.status_code,200)
        self.assertEqual({row['id'] for row in result.json()['ideas']},{'paper_gift_wrap','paper_organizer','paper_craft'})
        self.assertEqual(result.json()['source']['prediction_id'],self.record.pk)
        self.assertEqual(result.json()['source']['material'],'Paper')
        self.assertEqual(UserProject.objects.get(pk=self.project['id']).recommendation_id,'paper_gift_wrap')
        self.assertTrue(self.project['can_change_idea'])

    def test_replaces_choice_in_same_project_with_server_steps_and_can_change_back(self):
        result=self.change('paper_organizer',steps=['Client invented steps'],completed_steps=[0]).json()['project']
        self.assertEqual(result['id'],self.project['id'])
        self.assertEqual(result['source_prediction_id'],self.record.pk)
        self.assertEqual(result['recommendation_id'],'paper_organizer')
        self.assertEqual(result['title'],'Paper organizer')
        self.assertNotEqual(result['steps'],['Client invented steps'])
        self.assertEqual(result['completed_steps'],[])
        self.assertTrue(result['can_change_idea'])
        self.assertEqual(result['reference']['review_level'],'educational')
        self.assertEqual(UserProject.objects.count(),1)
        self.assertEqual(self.change('paper_gift_wrap').status_code,200)
        self.record.refresh_from_db();self.assertEqual(self.record.model_class,'paper')

    def test_retry_is_idempotent_and_does_not_add_history_or_extra_projects(self):
        first=self.change('paper_organizer').json()['project']
        second=self.change('paper_organizer').json()['project']
        self.assertEqual(first,second)
        self.assertEqual(UserProject.objects.count(),1)

    def test_step_one_locks_change_and_undo_does_not_remove_lock(self):
        result=self.mark(0).json()['project'];self.assertFalse(result['can_change_idea'])
        self.assertEqual(self.change('paper_organizer').status_code,409)
        result=self.mark(0,False).json()['project']
        self.assertEqual(result['completed_steps'],[])
        self.assertFalse(result['can_change_idea'])
        self.assertEqual(self.client.get(self.url,**self.auth).status_code,409)
        self.assertEqual(self.change('paper_organizer').status_code,409)
        self.assertEqual(UserProject.objects.get(pk=self.project['id']).recommendation_id,'paper_gift_wrap')

    def test_skipping_ahead_and_completing_a_step_also_protects_recorded_work(self):
        self.mark(1)
        self.assertEqual(self.change('paper_organizer').status_code,409)
        self.assertEqual(UserProject.objects.get(pk=self.project['id']).completed_steps,[1])

    def test_completed_and_restarted_projects_cannot_be_replaced(self):
        for index in range(self.project['total_steps']):self.mark(index)
        self.assertEqual(self.change('paper_organizer').status_code,409)
        response=self.client.post(f"/api/projects/{self.project['id']}/restart/",**self.auth)
        self.assertEqual(response.status_code,200)
        self.assertFalse(response.json()['project']['can_change_idea'])
        self.assertEqual(self.change('paper_organizer').status_code,409)

    def test_existing_target_is_reopened_without_reset_and_only_unused_choice_is_archived(self):
        other=self.start('paper_organizer').json()['project']
        self.client.patch(f"/api/projects/{other['id']}/steps/0/",json.dumps({'completed':True}),content_type='application/json',**self.auth)
        choices=self.client.get(self.url,**self.auth).json()['ideas']
        option=next(row for row in choices if row['id']=='paper_organizer')
        self.assertEqual(option['existing_project_id'],other['id'])
        result=self.change('paper_organizer')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['project']['id'],other['id'])
        existing=UserProject.objects.get(pk=other['id'])
        self.assertEqual(existing.completed_steps,[0])
        self.assertEqual(existing.reference['_replaced_unstarted_choices'][0]['id'],self.project['id'])
        self.assertFalse(UserProject.objects.filter(pk=self.project['id']).exists())
        self.assertEqual(UserProject.objects.count(),1)
        self.assertEqual(self.change('paper_organizer').json()['project']['id'],other['id'])

    def test_unknown_other_material_and_unsafe_choices_leave_original_unchanged(self):
        for value in ('made-up','fabric_rags',None,{},'x'*161):
            self.assertEqual(self.change(value).status_code,400)
        self.record.previous_contents='Chemical or cleaning product';self.record.save()
        self.assertEqual(self.client.get(self.url,**self.auth).json()['ideas'],[])
        self.assertEqual(self.change('paper_organizer').status_code,400)
        self.assertEqual(UserProject.objects.get(pk=self.project['id']).recommendation_id,'paper_gift_wrap')

    def test_owner_scope_and_authentication_are_enforced(self):
        self.assertEqual(self.client.get(self.url).status_code,401)
        other=User.objects.create_user('other-change-user')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(other)}'}
        self.assertEqual(self.client.get(self.url,**self.auth).status_code,404)
        self.assertEqual(self.change('paper_organizer').status_code,404)

    def test_deleted_source_scan_cannot_be_replaced(self):
        self.record.delete()
        result=self.client.get('/api/projects/',**self.auth).json()['projects'][0]
        self.assertFalse(result['can_change_idea'])
        self.assertEqual(self.change('paper_organizer').status_code,409)

    def test_fabric_chooser_stays_bound_to_original_blanket_not_a_newer_paper_scan(self):
        from .models import ScanScene, SceneItem
        record=PredictionRecord.objects.create(user=self.user,model_class='towel',decision='fabric_scraps',title='Fabric scraps',
            confidence=.95,threshold=.8,condition='Clean and dry',model_version='dataset-candidate-unverified-test',
            image_quality={'item_action':'recover','user_object_name':'blanket'})
        scene=ScanScene.objects.create(user=self.user,request_id='fabric_choice_test',width=100,height=100,status='complete')
        SceneItem.objects.create(scene=scene,prediction=record,name='towel',score=.8,box=[0,0,1,1])
        response=self.client.post('/api/projects/',json.dumps({'prediction_id':record.pk,'recommendation_id':'fabric_cleaning_cloth'}),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,201)
        project=response.json()['project']
        # A more recent scan must not replace the object's origin in this chooser.
        PredictionRecord.objects.create(user=self.user,model_class='paper',decision='paper',title='Paper',confidence=.99)
        result=self.client.get(f"/api/projects/{project['id']}/ideas/",**self.auth).json()
        self.assertEqual(result['source']['prediction_id'],record.pk)
        self.assertEqual(result['source']['material'],'Fabric scraps')
        self.assertEqual(result['source']['object_name'],'blanket')
        self.assertEqual(len(result['ideas']),3)
        self.assertTrue(all(idea['id'].startswith('fabric_') for idea in result['ideas']))
