"""Separate final evidence and honest final verdict gates."""
import json
from unittest.mock import patch
from django.test import override_settings, TestCase
from .test_verification import VerificationFixture
from .models import CompletedProject, FinalProductAssessment


@override_settings(SNAPTURE_VISUAL_ASSESSOR='tests.explicit_fixture',
                   SNAPTURE_VISUAL_ASSESSOR_VALIDATION={'model':'test-fixture-only','purposes':['project_step','project_final'],'evidence_source':'Unit test only'})
class FinalProductTests(VerificationFixture, TestCase):
    def setUp(self):
        super().setUp()
        self.project.reference['suitability_requirements']['final_criteria']=['All required compartments visible','Edges joined']
        self.project.save()

    def adapter(self, **kwargs):
        return self.response(purpose=kwargs['purpose'],criteria=[{'id':c['id'],'status':'met','evidence':'Required feature visible.'} for c in kwargs['criteria']])

    def finish_steps(self):
        with patch('upcycling.verification.import_string',return_value=self.adapter):
            self.assertEqual(self.upload().status_code,200)
            self.assertEqual(self.upload(index=1,color='blue').status_code,200)

    def final(self,color='red',**kwargs):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        out=BytesIO();Image.new('RGB',(120,120),color).save(out,format='JPEG')
        return self.client.post(f'/api/upcycling/projects/{self.project.pk}/final/',{'image':SimpleUploadedFile('whole.jpg',out.getvalue(),content_type='image/jpeg')},**(kwargs.get('auth') or self.auth))

    def complete(self):
        return self.client.post('/api/upcycling/completions/',json.dumps({'project_id':self.project.pk,'materials':[{'name':'paper','quantity':1}]}),content_type='application/json',**self.auth)

    def test_final_requires_steps_and_separate_fresh_photo(self):
        self.assertEqual(self.final().status_code,409)
        self.finish_steps()
        self.assertEqual(self.complete().status_code,409)
        self.assertEqual(self.final(color='white').status_code,409)

    def test_passing_final_required_for_completion_and_snapshot_is_preserved(self):
        self.finish_steps()
        with patch('upcycling.verification.import_string',return_value=self.adapter):
            result=self.final();repeat=self.final()
        self.assertEqual(result.status_code,200,result.content)
        final=result.json()['project']['final_assessments'][0]
        self.assertEqual(final['verdict'],'meets_requirements')
        self.assertEqual(result.json()['project']['status'],'active')
        self.assertEqual(FinalProductAssessment.objects.count(),1)
        result=self.complete();self.assertEqual(result.status_code,200,result.content)
        self.assertEqual(result.json()['project']['status'],'completed')
        completion=CompletedProject.objects.get()
        self.assertEqual(completion.final_assessment['verdict'],'meets_requirements')
        with completion.image.open('rb') as cover, FinalProductAssessment.objects.get().image.open('rb') as whole:
            self.assertEqual(cover.read(),whole.read())
        self.assertEqual(self.final(color='yellow').status_code,409)
        self.assertEqual(self.complete().json()['completion']['id'],completion.pk)

    def test_missing_unmet_and_hidden_criteria_produce_distinct_nonpassing_verdicts(self):
        self.finish_steps()
        for state,code,color in [('missing','incomplete','red'),('unmet','needs_improvement','yellow'),('not_assessable','unable_to_assess','green')]:
            def adapter(**kw):
                return self.response(purpose='project_final',criteria=[{'id':c['id'],'status':state,'evidence':'Component absent or hidden.'} for c in kw['criteria']])
            with patch('upcycling.verification.import_string',return_value=adapter):result=self.final(color)
            self.assertEqual(result.status_code,200,result.content)
            self.assertEqual(result.json()['project']['final_assessments'][0]['verdict'],code)
            self.assertEqual(result.json()['project']['status'],'active')
            self.assertEqual(self.complete().status_code,409)

    def test_unavailable_final_checker_never_passes_and_can_be_rechecked(self):
        self.finish_steps()
        with self.settings(SNAPTURE_VISUAL_ASSESSOR=''):result=self.final()
        row=result.json()['project']['final_assessments'][0]
        self.assertEqual(row['verdict'],'unable_to_assess')
        self.assertEqual(self.complete().status_code,409)
        with patch('upcycling.verification.import_string',return_value=self.adapter):
            result=self.client.post(f'/api/upcycling/projects/{self.project.pk}/final/',json.dumps({'recheck_assessment_id':row['id']}),content_type='application/json',**self.auth)
        self.assertEqual(result.json()['project']['final_assessments'][0]['verdict'],'meets_requirements')

    def test_missing_final_criteria_cannot_call_checker(self):
        self.finish_steps()
        self.project.reference['suitability_requirements'].pop('final_criteria');self.project.save()
        with patch('upcycling.verification.import_string') as adapter:result=self.final()
        adapter.assert_not_called()
        self.assertFalse(result.json()['project']['verification_capabilities']['final_available'])
        self.assertEqual(result.json()['project']['final_assessments'][0]['verdict'],'unable_to_assess')

    def test_foreign_final_evidence_is_private_and_cannot_be_rechecked(self):
        self.finish_steps()
        with patch('upcycling.verification.import_string',return_value=self.adapter):result=self.final()
        row=result.json()['project']['final_assessments'][0]
        from core.auth import issue_token
        foreign={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.other)}
        self.assertEqual(self.final(auth=foreign).status_code,404)
        self.assertEqual(self.client.get(row['image_url'],**foreign).status_code,404)
        response=self.client.get(row['image_url'],**self.auth)
        self.assertEqual(response.status_code,200);response.close()
