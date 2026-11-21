"""Strict evidence contracts and progression, not model-accuracy claims."""
import json
import tempfile
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from core.auth import issue_token
from predictions.models import UserProject
from .models import StepPhoto
from .workflow import VERSION
from .verification import check, capabilities


class VerificationFixture:
    def setUp(self):
        self.user=get_user_model().objects.create_user('verification-owner')
        self.other=get_user_model().objects.create_user('verification-other')
        self.auth={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.user)}
        temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup)
        setting=self.settings(MEDIA_ROOT=temp.name);setting.enable();self.addCleanup(setting.disable)
        self.project=UserProject.objects.create(user=self.user,recommendation_id='fixture',title='Fixture project',material='paper',steps=['Fold','Join'],reference={
            'photo_workflow':True,'workflow_version':VERSION,'suitability_requirements_source':'Test criteria only',
            'suitability_requirements':{'checkpoint_criteria':['Fold line visible','Joined edges visible']}})

    def response(self, criteria=None, **extra):
        return {'schema_version':1,'purpose':'project_step','model':'test-fixture-only',
                'quality':{'usable':True,'guidance':''},'feedback':'Visible fold meets the checkpoint.',
                'criteria':criteria if criteria is not None else [{'id':'step_0','status':'met','evidence':'Fold line is visible.'}],**extra}

    def upload(self, index=0, color='white', auth=None, project=None):
        data=BytesIO();Image.new('RGB',(120,120),color).save(data,format='JPEG')
        return self.client.post(f'/api/upcycling/projects/{(project or self.project).pk}/steps/{index}/',
                                {'image':SimpleUploadedFile('frame.jpg',data.getvalue(),content_type='image/jpeg')},**(auth or self.auth))

    def assess(self, result):
        with patch('upcycling.verification.import_string',return_value=lambda **kw: result):
            return self.upload()

@override_settings(SNAPTURE_VISUAL_ASSESSOR='tests.explicit_fixture',
                   SNAPTURE_VISUAL_ASSESSOR_VALIDATION={'model':'test-fixture-only','purposes':['project_step'],'evidence_source':'Unit test, not production validation'})
class VerificationTests(VerificationFixture, TestCase):
    def test_verified_frame_unlocks_only_its_step_and_is_idempotent(self):
        with patch('upcycling.verification.import_string',return_value=lambda **kw:self.response()):
            first=self.upload();repeat=self.upload()
        self.assertEqual(first.status_code,200,first.content)
        self.assertEqual(first.json()['project']['completed_steps'],[0])
        self.assertEqual(repeat.json()['project']['completed_steps'],[0])
        self.assertEqual(StepPhoto.objects.count(),1)

    def test_next_step_foreign_owner_and_legacy_manual_patch_are_blocked(self):
        self.assertEqual(self.upload(index=1).status_code,400)
        foreign={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.other)}
        self.assertEqual(self.upload(auth=foreign).status_code,404)
        result=self.client.patch(f'/api/projects/{self.project.pk}/steps/0/',json.dumps({'completed':True}),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,409)

    def test_unavailable_or_unapproved_model_cannot_unlock(self):
        with self.settings(SNAPTURE_VISUAL_ASSESSOR=''):
            result=self.upload()
        self.assertEqual(result.json()['project']['completed_steps'],[])
        self.assertFalse(result.json()['project']['verification_capabilities']['step_available'])
        self.assertEqual(result.json()['project']['step_photos'][0]['assessment']['verdict'],'unable_to_verify')

    def test_missing_criteria_never_calls_model(self):
        self.project.reference['suitability_requirements']['checkpoint_criteria']=[];self.project.save()
        with patch('upcycling.verification.import_string') as adapter:
            result=self.upload()
        adapter.assert_not_called();self.assertEqual(result.json()['project']['completed_steps'],[])

    def test_malformed_or_incomplete_output_never_passes(self):
        for output in (self.response(criteria=[]),self.response(model='unapproved'),
                       self.response(criteria=[{'id':'other','status':'met','evidence':'Visible'}]),
                       {'model':'test-fixture-only','step_status':'matches'}):
            if output.get('criteria')==[]:output['criteria']=[]
            with patch('upcycling.verification.import_string',return_value=lambda **kw:output):
                result=check(Image.new('RGB',(20,20)),self.project,'project_step',[{'id':'step_0','instruction':'Fold line visible'}])
            self.assertNotEqual(result['verdict'],'verified')

    def test_poor_view_and_missing_visibility_are_not_false_failure(self):
        for output,expected in ((self.response(quality={'usable':False,'guidance':'Show the other side.'}),'retake'),
                                (self.response(criteria=[{'id':'step_0','status':'not_assessable','evidence':'Fold hidden.'}]),'unable_to_verify')):
            with patch('upcycling.verification.import_string',return_value=lambda **kw:output):
                result=check(Image.new('RGB',(20,20)),self.project,'project_step',[{'id':'step_0','instruction':'Fold'}])
            self.assertEqual(result['verdict'],expected)

    def test_unmet_criterion_requests_correction(self):
        result=self.assess(self.response(criteria=[{'id':'step_0','status':'unmet','evidence':'Required fold is absent.'}]))
        self.assertEqual(result.json()['project']['completed_steps'],[])
        self.assertEqual(result.json()['project']['step_photos'][0]['status'],'needs_correction')

    def test_duplicate_frame_cannot_verify_another_step_or_project(self):
        with patch('upcycling.verification.import_string',return_value=lambda **kw:self.response()):self.upload()
        self.assertEqual(self.upload(index=1).status_code,400)
        other=UserProject.objects.create(user=self.user,recommendation_id='second',title='Another',steps=['Fold'],reference=self.project.reference)
        self.assertEqual(self.upload(project=other).status_code,409)

    def test_forged_legacy_ai_match_is_not_progress_on_new_project(self):
        StepPhoto.objects.create(project=self.project,step_index=0,image='never-opened.jpg',digest='fixture',status='ai_matches',assessment={'step_status':'matches'})
        result=self.client.get(f'/api/upcycling/projects/{self.project.pk}/',**self.auth)
        self.assertEqual(result.json()['project']['completed_steps'],[])

    def test_existing_photo_project_keeps_original_ui_workflow(self):
        self.project.reference={'photo_workflow':True};self.project.save()
        result=self.client.get(f'/api/upcycling/projects/{self.project.pk}/',**self.auth)
        self.assertIsNone(result.json()['project']['verification_capabilities'])
