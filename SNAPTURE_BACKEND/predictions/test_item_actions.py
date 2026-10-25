import json
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from core.auth import issue_token
from core.assessment import refresh
from .item_actions import COMPOSITION
from .models import PredictionRecord, ScanScene, SceneItem, UserProject


class ItemActionTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('item-actions')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.scene=ScanScene.objects.create(user=self.user,request_id='action_test_scene',width=100,height=100,status='complete')

    def item(self,name='paper scrap',label='paper',score=.8,**changes):
        values=dict(user=self.user,model_class=name,decision=label,title=label,confidence=.95,threshold=.8,
                    model_version='dataset-candidate-unverified-test',condition='Clean and dry')
        values.update(changes)
        record=PredictionRecord.objects.create(**values);refresh(record);record.save()
        return SceneItem.objects.create(scene=self.scene,prediction=record,name=name,score=score,box=[.1,.1,.8,.8])

    def select(self,item,action='keep',condition='Clean and dry',**extra):
        return self.client.post(f'/api/scenes/{self.scene.id}/disposal-selection/',json.dumps({
            'item_ids':[item.id],'item_actions':{str(item.id):action},
            'item_conditions':{str(item.id):condition},**extra}),content_type='application/json',**self.auth)

    def test_keep_sets_intent_without_calling_a_belonging_waste(self):
        item=self.item('towel','fabric_scraps')
        response=self.select(item,'keep','Needs cleaning');self.assertEqual(response.status_code,200)
        saved=response.json()['scene']['items'][0]
        self.assertFalse(saved['identification']['selected_for_disposal'])
        self.assertEqual(saved['action_advice']['chosen_action'],'keep')
        self.assertIn('Dry fully',str(saved['action_advice']['steps']))
        self.assertEqual(saved['prediction']['condition'],'Needs cleaning')
        self.assertEqual(saved['prediction']['raw_model_class'],'towel')

    def test_discard_groups_are_conditional_and_do_not_recommend_breaking_glass(self):
        cases=[('food scraps or fruit peel','biodegradable'),('disposable diaper','residual'),
               ('bubble wrap','diversion'),('battery','special'),('glass bottle or glass jar','special')]
        for name,group in cases:
            with self.subTest(name=name):
                result=self.select(self.item(name,'unknown_unsupported'),'discard').json()['scene']['items'][-1]['action_advice']
                self.assertEqual(result['waste_group'],group)
                self.assertLessEqual(len(result['steps']),3)
                self.assertEqual(result['projects'],[])
                if 'glass' in name:self.assertIn('Do not break or crush',str(result['steps']))
                if 'food' in name:self.assertIn('oily soup',result['caution'])
                if name=='bubble wrap':self.assertIn('No buyer',result['caution'])

    def test_low_score_does_not_become_a_bin_or_project_approval(self):
        item=self.item(score=.12)
        result=self.select(item,'recover').json()['scene']['items'][0]['action_advice']
        self.assertEqual(result['status'],'needs_information')
        self.assertEqual(result['waste_group'],'unconfirmed')
        self.assertEqual(result['projects'],[])

    def test_conflicting_object_queries_are_not_counted_as_agreement(self):
        item=self.item(image_quality={'alternatives':[{'label':'mobile phone','score':.79},{'label':'paper scrap','score':.8}]})
        result=self.select(item,'recover').json()['scene']['items'][0]['action_advice']
        self.assertEqual(result['status'],'needs_information')
        self.assertEqual(result['projects'],[])
        response=self.client.post('/api/projects/',json.dumps({'prediction_id':item.prediction_id,
            'recommendation_id':'paper_gift_wrap'}),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,400)

    def test_generic_unknown_object_does_not_suggest_keeping_or_a_specific_bin(self):
        item=self.item('unfamiliar discarded object','unknown_unsupported',score=.9)
        result=self.select(item,'discard').json()['scene']['items'][0]['action_advice']
        self.assertEqual(result['suggested_action'],'review')
        self.assertEqual(result['waste_group'],'unconfirmed')

    def test_safe_recovery_uses_existing_educational_guides_not_invented_approval(self):
        item=self.item()
        result=self.select(item,'recover').json()['scene']['items'][0]['action_advice']
        self.assertTrue(result['projects'])
        self.assertEqual(result['projects'][0]['basis'],'educational_catalog')
        self.assertEqual(len(result['projects']),3)
        started=self.client.post('/api/projects/',json.dumps({'prediction_id':item.prediction_id,
            'recommendation_id':result['projects'][0]['id']}),content_type='application/json',**self.auth)
        self.assertEqual(started.status_code,201)
        self.assertEqual(started.json()['project']['reference']['review_level'],'educational')

    def test_unsafe_condition_and_keep_do_not_start_new_reuse_projects(self):
        for action,condition in [('keep','Clean and dry'),('recover','Moldy or contaminated'),('recover','Needs cleaning')]:
            item=self.item();result=self.select(item,action,condition).json()['scene']['items'][-1]
            self.assertEqual(result['action_advice']['projects'],[])
            response=self.client.post('/api/projects/',json.dumps({'prediction_id':item.prediction_id,
                'recommendation_id':'paper_gift_wrap'}),content_type='application/json',**self.auth)
            self.assertEqual(response.status_code,400)
        self.assertFalse(UserProject.objects.exists())

    def test_later_condition_edit_updates_advice_not_stale_condition_metadata(self):
        item=self.item();self.select(item,'keep')
        response=self.client.patch(f'/api/predictions/{item.prediction_id}/',json.dumps({'condition':'Moldy or contaminated'}),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        saved=self.client.get(f'/api/scenes/{self.scene.id}/?history=1',**self.auth).json()['scene']['items'][0]
        self.assertEqual(saved['action_advice']['condition'],'Moldy or contaminated')
        self.assertIn('Do not use',str(saved['action_advice']['steps']))

    def test_history_reads_own_snapshot_even_after_a_newer_scan(self):
        item=self.item();expected=self.select(item,'keep').json()['scene']['items'][0]['action_advice']
        newer=ScanScene.objects.create(user=self.user,request_id='newer_action_scene',width=100,height=100,status='complete')
        original=self.scene;self.scene=newer
        battery=self.item('battery','unknown_unsupported');self.select(battery,'discard');self.scene=original
        with patch('predictions.item_actions.advice',side_effect=AssertionError('History must not recalculate saved advice')):
            result=self.client.get(f'/api/scenes/{self.scene.id}/?history=1',**self.auth)
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['scene']['items'][0]['action_advice'],expected)

    def test_action_validation_and_owner_boundaries(self):
        item=self.item()
        for fields in ({'item_actions':{}},{'item_actions':{str(item.id):'burn'}},
                       {'item_conditions':{str(item.id):'approved'}}, {'item_actions':{str(item.id):'keep','9999':'keep'}}):
            self.assertEqual(self.select(item,**fields).status_code,400)
        other=User.objects.create_user('other-action-user')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(other)}'}
        self.assertEqual(self.select(item).status_code,404)

    def test_waste_composition_is_not_prediction_confidence(self):
        self.assertEqual(sum(row['reported_share'] for row in COMPOSITION),100)
        item=self.item(score=.63);result=self.select(item,'discard').json()['scene']['items'][0]
        self.assertEqual(result['score'],.63)
        self.assertEqual(result['prediction']['confidence'],.95)
        self.assertIn('not detection confidence',result['action_advice']['composition_note'])

    def test_recognized_objects_outside_seven_materials_get_conditional_handling_not_forced_projects(self):
        item=self.item('metal can','unknown_unsupported')
        result=self.select(item,'recover').json()['scene']['items'][0]
        self.assertEqual(result['action_advice']['waste_group'],'recyclable')
        self.assertIn('known safe food',str(result['action_advice']['steps']))
        self.assertEqual(result['action_advice']['projects'],[])
        self.assertEqual(result['prediction']['decision'],'unknown_unsupported')
