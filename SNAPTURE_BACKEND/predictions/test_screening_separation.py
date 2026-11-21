import json
from copy import deepcopy
from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase
from core.auth import issue_token
from core.assessment import assess, refresh, WOOD
from core.materials import SCOPE_LABELS
from core.recommendation_requests import requested_choices
from predictions.models import PredictionRecord, UserProject
from predictions.views import _serialize
from predictions import test_scenes as scene_fixtures


class ScreeningSeparationTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('screening')
        self.auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(self.user)}'}
        self.record=PredictionRecord.objects.create(user=self.user,decision='paper',model_class='paper',title='Paper',
            confidence=.9,threshold=.8,quantity=1,condition='Clean and dry',previous_contents='No chemical contact known',
            answers={'user_confirmed_material':'paper','assessment_checked_at':'test','contamination':'None known','moisture':'Dry'})
    def post(self, suffix='recommendations/', body=None, auth=None):
        return self.client.post(f'/api/predictions/{self.record.id}/{suffix}',json.dumps(body or {}),content_type='application/json',**(self.auth if auth is None else auth))
    def assert_screening_only(self, value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key in {'recommendations','recommendation_choices','upcycling_ideas','suggested_ideas','projects','upcycle_ideas'}:
                    self.assertEqual(item,[],key)
                if key == 'management_guidance':
                    self.assertNotIn('recovery', [section['key'] for section in item.get('sections',[])])
                self.assertNotEqual(key,'recommendation_request')
                self.assert_screening_only(item)
        elif isinstance(value,list):
            for item in value:self.assert_screening_only(item)
    def test_screening_serialization_updates_and_history_do_not_generate(self):
        self.record.selected_recommendation='legacy-choice'
        self.record.recommendation_choices=[{'id':'legacy-choice','title':'Private old project'}]
        self.record.assessment=assess(self.record)
        self.record.assessment['upcycling']['suggested_ideas']=deepcopy(self.record.recommendation_choices)
        self.record.assessment['management_guidance']['sections'].append({'key':'recovery','instructions':['Old gift wrapping idea']})
        self.record.image_quality={'handling_snapshot':{'recommendations':self.record.recommendation_choices},'recommendation_request':{'recommendations':self.record.recommendation_choices}}
        self.record.save()
        before=deepcopy(self.record.assessment)
        with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('implicit generation')),patch('core.recommendations.build_recommendations',side_effect=AssertionError('implicit generation')):
            for saved in (True,False):self.assert_screening_only(_serialize(self.record,saved=saved))
            self.record.refresh_from_db();self.assertEqual(self.record.assessment,before)
            refresh(self.record)
            self.assertEqual(self.record.selected_recommendation,'legacy-choice')
            self.assertEqual(self.record.recommendation_choices[0]['id'],'legacy-choice')
            response=self.client.patch(f'/api/predictions/{self.record.id}/',json.dumps({'condition':'Needs cleaning','answers':{'moisture':'Wet'}}),content_type='application/json',**self.auth)
            self.assertEqual(response.status_code,200);self.assert_screening_only(response.json())
            response=self.client.patch(f'/api/predictions/{self.record.id}/',json.dumps({'condition':'Clean and dry','answers':{'moisture':'Dry'}}),content_type='application/json',**self.auth)
            self.assertEqual(response.json()['prediction']['screening']['status'],'eligible');self.assert_screening_only(response.json())
        self.record.refresh_from_db();self.assertEqual(self.record.selected_recommendation,'legacy-choice')
    def test_all_seven_can_pass_without_any_projects(self):
        for label in SCOPE_LABELS:
            with self.subTest(label=label):
                self.record.decision=label;self.record.model_class=label
                self.record.answers.update(user_confirmed_material=label,wood_treatment=WOOD[0],resin_mark={'pete_bottles':'PET/PETE code 1','hdpe_containers':'HDPE code 2'}.get(label,''))
                with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('implicit generation')):
                    result=assess(self.record)
                self.assertEqual(result['screening']['status'],'eligible');self.assert_screening_only(result)
    def test_revalidation_rejects_missing_unsafe_and_client_flags(self):
        cases=[('condition','Not sure','needs_information'),('condition','Needs cleaning','needs_preparation'),('condition','Moldy or contaminated','ineligible'),('previous_contents','Other / unknown','needs_information'),('previous_contents','Chemical or cleaning product','ineligible'),('decision','unknown_unsupported','unsupported')]
        for key,value,status in cases:
            with self.subTest(value=value):
                original=getattr(self.record,key);setattr(self.record,key,value);self.record.save()
                with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('unsafe generation')):
                    response=self.post(body={'eligible':True})
                self.assertEqual(response.status_code,409);self.assertEqual(response.json()['screening']['status'],status)
                setattr(self.record,key,original)
        self.record.answers.pop('assessment_checked_at');self.record.save()
        self.assertEqual(self.post().status_code,409)
    def test_explicit_request_is_owned_and_preserves_photos_and_start_resume_progress(self):
        outsider=User.objects.create_user('other')
        self.assertEqual(self.post(auth={}).status_code,401)
        self.assertEqual(self.post(auth={'HTTP_AUTHORIZATION':f'Bearer {issue_token(outsider)}'}).status_code,404)
        with patch('core.scan_ideas.scan_ideas',wraps=__import__('core.scan_ideas',fromlist=['scan_ideas']).scan_ideas) as generator:
            response=self.post();self.assertEqual(response.status_code,200);generator.assert_called_once()
        value=response.json();self.assertEqual(value['prediction_id'],self.record.id)
        choice=value['recommendations'][0];self.assertEqual(choice['basis'],'educational_catalog')
        result=self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.id,'recommendation_id':choice['id']}),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,201,result.content)
        project=UserProject.objects.get(pk=result.json()['project']['id']);project.completed_steps=[0];project.save()
        self.record.refresh_from_db();self.record.condition='Not sure';self.record.save()
        with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('resume generation')):
            result=self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.id,'recommendation_id':choice['id']}),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,200);self.assertEqual(result.json()['project']['completed_steps'],[0]);self.assertEqual(result.json()['project']['steps'],choice['steps'])
        self.assertEqual(result.json()['project']['reference']['review_level'],'educational')
    def test_changed_inputs_invalidate_requested_choices_without_generation(self):
        self.assertEqual(self.post().status_code,200);self.record.refresh_from_db()
        self.assertTrue(requested_choices(self.record))
        self.record.quantity=9
        with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('implicit generation')):self.assertEqual(requested_choices(self.record),[])
    def test_no_matching_project_keeps_screening_eligible(self):
        with patch('core.scan_ideas.scan_ideas',return_value=[]):value=self.post().json()
        self.assertEqual(value['status'],'no_matching_project');self.assertTrue(value['screening']['eligible'])
    def test_resin_wood_moisture_and_material_confirmation_are_required(self):
        for label,key in [('pete_bottles','resin_mark'),('hdpe_containers','resin_mark'),('dry_untreated_wood_scraps','wood_treatment'),('paper','moisture'),('paper','user_confirmed_material')]:
            self.record.decision=label;self.record.answers={'user_confirmed_material':label,'assessment_checked_at':'test','contamination':'None known','moisture':'Dry'};self.record.answers.pop(key,None)
            value=assess(self.record)['screening'];self.assertFalse(value['eligible'])
    def test_scene_creation_confirmation_and_history_never_generate(self):
        fixture=scene_fixtures.SceneApiTests(methodName='test_items_get_real_boxes_but_no_automatic_approval')
        # Reuse deterministic detector upload fixture without inheriting its test cases.
        fixture.client=self.client;fixture.setUp();self.addCleanup(fixture.doCleanups)
        with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('implicit generation')),patch('core.recommendations.build_recommendations',side_effect=AssertionError('implicit generation')):
            response=fixture.create();self.assertEqual(response.status_code,201);self.assert_screening_only(response.json())
            scene=response.json()['scene']
            response=self.client.post(f"/api/scenes/{scene['id']}/disposal-selection/",json.dumps({'item_ids':[scene['items'][0]['id']], 'item_conditions':{str(scene['items'][0]['id']):'Not sure'}}),content_type='application/json',**fixture.auth)
            self.assertEqual(response.status_code,200,response.content);self.assert_screening_only(response.json())
            response=self.client.get(f"/api/scenes/{scene['id']}/?saved=1",**fixture.auth);self.assertEqual(response.status_code,200);self.assert_screening_only(response.json())

    def test_changed_server_revision_requires_a_new_review(self):
        from core.recommendation_requests import revision
        old_revision=revision(self.record)
        self.record.condition='Needs cleaning';self.record.save()
        with patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('stale generation')):
            result=self.post(body={'screening_revision':old_revision,'eligible':True})
        self.assertEqual(result.status_code,409)
        self.assertIn('changed',result.json()['detail'])

    def test_screening_never_fetches_or_matches_project_guidance(self):
        from core.assessment import published_guidance, _matches
        with patch('core.assessment.published_guidance',wraps=published_guidance) as query, patch('core.assessment._matches',wraps=_matches) as match:
            assess(self.record)
        for call in query.call_args_list:
            self.assertNotIn('project',call.kwargs['kinds'])
        for call in match.call_args_list:
            self.assertNotEqual(call.args[0].kind,'project')

    def test_legacy_single_photo_creation_is_screening_only(self):
        from io import BytesIO
        from tempfile import TemporaryDirectory
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        stream=BytesIO();Image.new('RGB',(200,200),'white').save(stream,format='JPEG')
        result={'model_class':'paper','decision':'paper','title':'Paper','confidence':.9,'threshold':.8,
                'model_version':'fixture','recommendations':[{'title':'Old project'}],
                'nested':{'projects':[{'steps':['Old specific project step']}]}}
        with TemporaryDirectory() as directory, self.settings(MEDIA_ROOT=directory), patch('predictions.views.predict_image',return_value=result), patch('core.scan_ideas.scan_ideas',side_effect=AssertionError('implicit generation')), patch('core.recommendations.build_recommendations',side_effect=AssertionError('implicit generation')):
            response=self.client.post('/api/predictions/create/',{'image':SimpleUploadedFile('screen.jpg',stream.getvalue(),content_type='image/jpeg')},**self.auth)
            self.assertEqual(response.status_code,201,response.content)
            self.assert_screening_only(response.json())
            self.assertNotIn('Old specific project step',str(response.json()))

    def test_known_treated_wood_and_uncertain_report_do_not_pass(self):
        self.record.decision='dry_untreated_wood_scraps'
        self.record.answers.update(user_confirmed_material='dry_untreated_wood_scraps',wood_treatment=WOOD[1])
        self.assertEqual(assess(self.record)['screening']['status'],'ineligible')
        self.record.decision='paper';self.record.answers.update(user_confirmed_material='paper',reported_category='UNIDENTIFIED')
        self.assertEqual(assess(self.record)['screening']['status'],'needs_information')
