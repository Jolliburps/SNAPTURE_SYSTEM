import json
from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase
from core.assessment import assess
from core.auth import issue_token
from core.waste_taxonomy import identity
from .models import PredictionRecord, IdentificationReview
from . import test_scenes as scene_fixtures


class SafetyGateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('safety-test')
        self.record = PredictionRecord(user=self.user, model_class='paper', decision='paper', title='Paper', confidence=.9,
            quantity=1, condition='Clean and dry', previous_contents='No chemical contact known',
            answers={'user_confirmed_material':'paper','paper_surface':'Plain uncoated material without personal details','contamination':'None known','moisture':'Dry'})

    def test_source_checked_project_is_not_expert_verified(self):
        call_command('seed_reference_guidance',verbosity=0)
        result = assess(self.record)
        self.assertEqual(result['upcycling']['status'],'awaiting_review')
        self.assertEqual(result['upcycling']['recommendations'],[])
        self.assertEqual(result['segregation']['status'],'available')
        from core.materials import public_materials
        self.assertTrue(all(not material['upcycling'] for material in public_materials()))

    def test_condition_gate_withholds_wet_contaminated_and_uncertain_material(self):
        call_command('seed_reference_guidance',verbosity=0)
        from core.test_support import expert_project_fixtures
        expert_project_fixtures()
        self.assertTrue(assess(self.record)['upcycling']['recommendations'])
        for key,value in [('moisture','Wet'),('contamination','Oil or grease'),('contamination','Not sure'),('reported_category','C'),('reported_category','B2')]:
            with self.subTest(key=key,value=value):
                old = self.record.answers.copy(); self.record.answers[key] = value
                self.assertFalse(assess(self.record)['upcycling']['recommendations'])
                self.assertFalse(identity(self.record,assess(self.record))['safety_gate_passed'])
                self.record.answers = old

    def test_hazard_precaution_overrides_user_recyclable_report(self):
        self.record.model_class = 'battery'; self.record.answers['reported_category'] = 'B1'
        value = identity(self.record,assess(self.record),[.1,.2,.3,.4])
        self.assertEqual(value['category'],'C')
        self.assertFalse(value['safety_gate_passed']); self.assertEqual(value['upcycle_ideas'],[])
        self.assertEqual(value['box'],[.1,.2,.3,.4])

    def test_unsupported_metal_does_not_become_a_supported_target(self):
        self.record.decision = 'unknown_unsupported'; self.record.model_class = 'metal can'
        self.record.answers = {'reported_category':'B1','other_material':'Metal'}
        value = identity(self.record,assess(self.record))
        self.assertEqual(value['category'],'B1'); self.assertEqual(value['target_material'],'Other')
        self.assertFalse(value['safety_gate_passed']); self.assertTrue(value['needs_confirmation'])

    def test_no_three_predictions_are_invented(self):
        self.assertEqual(identity(self.record,assess(self.record))['top_predictions'],[])


class HumanRegionAndConsentTests(TestCase):
    setUp = scene_fixtures.SceneApiTests.setUp
    upload = scene_fixtures.SceneApiTests.upload
    create = scene_fixtures.SceneApiTests.create
    def test_add_missed_region_is_manual_idempotent_and_owner_scoped(self):
        scene = self.create(rows=[]).json()['scene']; url = f"/api/scenes/{scene['id']}/items/"
        payload = {'box':[.1,.1,.5,.8],'request_id':'manual_item_123'}
        added = self.client.post(url,json.dumps(payload),content_type='application/json',**self.auth)
        self.assertEqual(added.status_code,201)
        item = added.json()['scene']['items'][0]
        self.assertTrue(item['display_box']); self.assertEqual(item['prediction']['confidence'],0)
        self.assertEqual(item['prediction']['input_method'],'manual')
        self.assertEqual(item['waste_identifier']['category'],'UNIDENTIFIED')
        self.assertEqual(self.client.post(url,json.dumps(payload),content_type='application/json',**self.auth).status_code,200)
        self.assertEqual(PredictionRecord.objects.count(),1)
        other = User.objects.create_user('foreign-review')
        self.assertEqual(self.client.post(url,json.dumps(payload),content_type='application/json',HTTP_AUTHORIZATION=f'Bearer {issue_token(other)}').status_code,404)

    def test_region_rejects_malformed_coordinates(self):
        scene = self.create(rows=[]).json()['scene']
        for box in ([0,0,2,1],[.5,.5,.1,.2],[True,0,1,1],[0,0,float('nan'),1],None):
            response = self.client.post(f"/api/scenes/{scene['id']}/items/",json.dumps({'box':box,'request_id':'invalid_item_123'}),content_type='application/json',**self.auth)
            self.assertEqual(response.status_code,400)

    def test_contribution_requires_consent_is_pending_and_can_be_withdrawn(self):
        scene = self.create().json()['scene']; pk = scene['items'][0]['prediction']['id']
        url = f'/api/predictions/{pk}/review-contribution/'
        self.assertEqual(self.client.post(url,'{}',content_type='application/json',**self.auth).status_code,400)
        result = self.client.post(url,'{"consent":true}',content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,201); self.assertEqual(result.json()['status'],'pending')
        self.assertEqual(IdentificationReview.objects.count(),1)
        self.assertEqual(self.client.post(url,'{"consent":true}',content_type='application/json',**self.auth).status_code,200)
        self.assertEqual(self.client.delete(url,**self.auth).status_code,200)
        self.assertFalse(IdentificationReview.objects.exists()); self.assertTrue(PredictionRecord.objects.filter(pk=pk).exists())

    def test_deleting_scan_removes_consent_reference(self):
        scene = self.create().json()['scene']; pk = scene['items'][0]['prediction']['id']
        self.client.post(f'/api/predictions/{pk}/review-contribution/','{"consent":true}',content_type='application/json',**self.auth)
        self.client.delete(f"/api/scenes/{scene['id']}/",**self.auth)
        self.assertFalse(IdentificationReview.objects.exists())

    def test_forged_category_and_condition_fields_are_rejected(self):
        scene = self.create().json()['scene']; pk = scene['items'][0]['prediction']['id']
        for answers in ({'reported_category':'approved'}, {'contamination':'safe'}, {'moisture':True}):
            self.assertEqual(self.client.patch(f'/api/predictions/{pk}/',json.dumps({'answers':answers}),content_type='application/json',**self.auth).status_code,400)
