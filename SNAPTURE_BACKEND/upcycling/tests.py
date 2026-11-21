"""Contract and state-transition tests, not real-world model accuracy claims."""
import json
import tempfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase,override_settings
from django.utils import timezone
from core.auth import issue_token
from core.materials import SCOPE_LABELS
from core.recommendations import CATALOG
from predictions.models import PredictionRecord,UserProject
from .models import ProjectRequirement,InventoryLot,AdditionalView,CompletedProject,StepPhoto,Organization,Membership,Program,Submission,MaterialUsage
from .matching import suggestions
from .assessment import observe,validate_facts

class UpcyclingTests(TestCase):
    def setUp(self):
        tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
        settings=override_settings(MEDIA_ROOT=tmp.name);settings.enable();self.addCleanup(settings.disable)
        self.user=User.objects.create_user('resident');self.other=User.objects.create_user('other')
        self.auth={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.user)}
        self.other_auth={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.other)}
        self.photo_checker=patch('upcycling.views.observe',return_value={'status':'available','model':'test-fixture','observations':[],'step_status':'matches','feedback':'Required step matches.'})
        self.photo_checker.start();self.addCleanup(self.photo_checker.stop)
        self.record=self.make_record('paper')
    def make_record(self,label):
        return PredictionRecord.objects.create(user=self.user,decision=label,model_class=label,title=label,confidence=.9,threshold=.8,
            condition='Clean and dry',previous_contents='No chemical contact known',quantity=1,
            answers={'user_confirmed_material':label,'resin_mark':{'pete_bottles':'PET/PETE code 1','hdpe_containers':'HDPE code 2'}.get(label,''),'wood_treatment':'Known untreated and free of paint, mold and hardware'})
    def requirement(self,label='paper',**spec):
        key=CATALOG[label][0]['id']
        row=ProjectRequirement.objects.create(recommendation_id=key,material=label,source='Explicit test fixture; not production evidence',published=True,specification={'conditions':['Clean and dry'],**spec})
        return row
    def post(self,path,value=None,auth=None):return self.client.post('/api/upcycling/'+path,json.dumps(value or {}),content_type='application/json',**(auth or self.auth))
    def image(self,color='white'):
        out=BytesIO();Image.new('RGB',(120,120),color).save(out,format='JPEG')
        return SimpleUploadedFile('photo.jpg',out.getvalue(),content_type='image/jpeg')
    def project(self):
        return UserProject.objects.create(user=self.user,source_prediction=self.record,recommendation_id='test',title='Test craft',material='paper',steps=['Prepare material','Finish craft'],reference={'photo_workflow':True,'material_label':'paper'},completed_steps=[])
    def upload(self,p,index,color='white',auth=None):return self.client.post(f'/api/upcycling/projects/{p.pk}/steps/{index}/',{'image':self.image(color)},**(auth or self.auth))
    def finished(self):
        p=self.project();self.upload(p,0);self.upload(p,1,'blue')
        result=self.post('completions/',{'project_id':p.pk,'materials':[{'name':'paper','quantity':1}]})
        self.assertEqual(result.status_code,200,result.content)
        return p,CompletedProject.objects.get(project=p)

    def test_all_seven_materials_support_preliminary_and_configured_matching(self):
        for label in SCOPE_LABELS:
            with self.subTest(label=label):
                record=self.make_record(label)
                self.assertTrue(suggestions(record)['items'])
                self.assertFalse(any(r['can_start'] for r in suggestions(record)['items']))
                requirement=self.requirement(label)
                result=suggestions(record)
                self.assertEqual(next(r for r in result['items'] if r['id']==requirement.recommendation_id)['status'],'suitable')

    def test_dimensions_are_unknown_not_guessed_and_quantity_deficit_is_explicit(self):
        requirement=self.requirement(dimensions={'width':{'minimum':100}},minimum_quantity=3)
        row=suggestions(self.record)['items'][0];self.assertEqual(row['status'],'needs_information')
        self.assertIn('width in mm',row['missing_information'])
        self.record.answers['suitability_facts']=validate_facts({'dimensions':{'width':120}});self.record.save()
        row=suggestions(self.record)['items'][0];self.assertEqual(row['status'],'more_materials');self.assertEqual(row['additional_quantity'],2)
        self.record.answers['suitability_facts']=validate_facts({'dimensions':{'width':50}});self.record.save()
        self.assertEqual(next(r for r in suggestions(self.record)['items'] if r['id']==requirement.recommendation_id)['status'],'not_suitable')

    def test_uncertain_material_can_preview_but_not_start_and_explicit_exclusions_stay_separate(self):
        self.record.decision='unknown_unsupported';self.record.image_quality={'material_prediction':{'raw_class':'paper','status':'needs_review'}};self.record.save()
        result=suggestions(self.record)
        self.assertTrue(result['items']);self.assertFalse(any(r['can_start'] for r in result['items']))
        self.assertEqual(result['material_suggestion'],'paper')
        self.record.image_quality['material_prediction']['status']='not_applicable';self.record.save()
        self.assertEqual(suggestions(self.record)['items'],[])

    def test_damage_is_project_specific_but_known_hazards_block(self):
        requirement=self.requirement();requirement.specification={'conditions':['Damaged or cracked']};requirement.save()
        self.record.condition='Damaged or cracked';self.record.save()
        self.assertEqual(next(r for r in suggestions(self.record)['items'] if r['id']==requirement.recommendation_id)['status'],'suitable')
        self.record.previous_contents='Chemical or cleaning product';self.record.save()
        self.assertEqual(suggestions(self.record)['outcome'],'no_suitable_project')

    def test_later_history_correction_cannot_be_overridden_by_stale_suitability_facts(self):
        self.requirement()
        self.record.answers['suitability_facts']=validate_facts({'previous_contents':'No chemical contact known','condition':'Clean and dry'})
        self.record.previous_contents='Chemical or cleaning product';self.record.save()
        self.assertEqual(suggestions(self.record)['outcome'],'no_suitable_project')

    def test_ownership_authentication_and_spoofed_measurement_rejection(self):
        path=f'predictions/{self.record.pk}/assessment/'
        self.assertEqual(self.client.get('/api/upcycling/'+path).status_code,401)
        self.assertEqual(self.client.get('/api/upcycling/'+path,**self.other_auth).status_code,404)
        response=self.client.patch('/api/upcycling/'+path,json.dumps({'facts':{'dimensions':{'width':-2}}}),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,400)
        self.assertEqual(self.post('inventory/',{'prediction_id':self.record.pk,'quantity':True}).status_code,400)

    def test_inventory_duplicate_scan_and_consumption_exactly_once(self):
        payload={'prediction_id':self.record.pk,'quantity':3}
        self.assertEqual(self.post('inventory/',payload).status_code,200)
        self.assertEqual(self.post('inventory/',payload).status_code,409)
        lot=InventoryLot.objects.get();p=self.project();self.upload(p,0);self.upload(p,1,'blue')
        payload={'project_id':p.pk,'materials':[{'name':'paper','quantity':2}],'usage':[{'lot_id':lot.pk,'quantity':2}]}
        self.assertEqual(self.post('completions/',payload).status_code,200)
        self.assertEqual(self.post('completions/',payload).status_code,200)
        lot.refresh_from_db();self.assertEqual(lot.consumed,2);self.assertEqual(MaterialUsage.objects.count(),1)
        self.assertEqual(self.client.delete(f'/api/upcycling/inventory/{lot.pk}/',**self.auth).status_code,409)
        result=self.client.patch(f'/api/upcycling/inventory/{lot.pk}/',json.dumps({'quantity':1}),content_type='application/json',**self.auth)
        self.assertEqual(result.status_code,400)

    def test_collection_totals_include_only_compatible_available_lots(self):
        requirement=self.requirement(minimum_quantity=5,shapes=['flat'])
        self.record.answers['suitability_facts']=validate_facts({'shape':'flat'});self.record.save()
        good={'shape':'flat','condition':'Clean and dry','previous_contents':'No chemical contact known'}
        InventoryLot.objects.create(user=self.user,material='paper',quantity=3,consumed=1,attributes=good)
        lot=InventoryLot.objects.create(user=self.user,material='paper',quantity=2,attributes=good)
        InventoryLot.objects.create(user=self.user,material='paper',quantity=50,attributes={**good,'shape':'curved'})
        row=next(i for i in suggestions(self.record,use_inventory=True)['items'] if i['id']==requirement.recommendation_id)
        self.assertEqual(row['available_quantity'],4);self.assertEqual(row['additional_quantity'],1)
        lot.quantity=3;lot.save()
        row=next(i for i in suggestions(self.record,use_inventory=True)['items'] if i['id']==requirement.recommendation_id)
        self.assertEqual(row['available_quantity'],5);self.assertTrue(row['can_start'])

    def test_photo_required_for_every_step_and_final_photo_becomes_cover(self):
        p=self.project()
        self.assertEqual(self.upload(p,1).status_code,400)
        self.assertEqual(self.upload(p,0,auth=self.other_auth).status_code,404)
        first=self.upload(p,0);self.assertEqual(first.status_code,200)
        self.assertEqual(first.json()['project']['step_photos'][0]['status'],'ai_matches')
        self.assertEqual(self.upload(p,1).status_code,400) # same bytes cannot count twice
        self.assertEqual(self.upload(p,1,'blue').status_code,200)
        response=self.post('completions/',{'project_id':p.pk,'materials':[{'name':'paper','quantity':1}]})
        self.assertEqual(response.status_code,200,response.content)
        completion=CompletedProject.objects.get()
        self.assertEqual(completion.verification_status,'ai_checked')
        with completion.image.open('rb') as cover:cover_bytes=cover.read()
        with StepPhoto.objects.get(project=p,step_index=1).image.open('rb') as photo:self.assertEqual(cover_bytes,photo.read())
        photo=self.client.get(response.json()['completion']['image_url'],**self.auth);self.assertEqual(photo.status_code,200);photo.close()
        self.assertEqual(self.client.get(response.json()['completion']['image_url'],**self.other_auth).status_code,404)
        self.assertEqual(self.upload(p,0,'green').status_code,409)

    def test_failed_ai_step_does_not_unlock_next_step(self):
        p=self.project()
        with patch('upcycling.views.observe',return_value={'status':'available','model':'fixture','observations':[],'step_status':'needs_correction','feedback':'Opening not visible.'}):
            result=self.upload(p,0)
        self.assertEqual(result.json()['project']['completed_steps'],[])
        self.assertEqual(self.upload(p,1,'blue').status_code,400)

    def test_more_views_are_attached_to_one_record_without_inventory_double_counting(self):
        data={'image':self.image(),'view':'side','same_item_confirmed':'true','request_id':'test_side_123'}
        with patch('predictions.material_classifier.classify_material',return_value={'label':'cardboard'}):
            response=self.client.post(f'/api/upcycling/predictions/{self.record.pk}/assessment/',data,**self.auth)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(AdditionalView.objects.count(),1)
        self.assertEqual(PredictionRecord.objects.count(),1)
        self.assertTrue(response.json()['assessment']['conflicts'])
        self.assertEqual(InventoryLot.objects.count(),0)

    def test_visual_adapter_absence_never_reports_clean_or_verified(self):
        with override_settings(SNAPTURE_VISUAL_ASSESSOR=''):
            result=observe(Image.new('RGB',(100,100)))
        self.assertEqual(result['status'],'unavailable');self.assertEqual(result['observations'],[])

    def test_clear_visual_shape_can_refine_matching_but_uncertainty_cannot(self):
        requirement=self.requirement(shapes=['flat'])
        self.record.image_quality={'visual_assessment':{'status':'available','observations':[{'field':'shape','value':'flat','certainty':'clear','source':'ai_observed'}]}}
        self.record.save()
        row=next(i for i in suggestions(self.record)['items'] if i['id']==requirement.recommendation_id)
        self.assertTrue(row['can_start'])
        self.assertEqual(suggestions(self.record)['fact_sources']['shape'],'ai_observed')
        self.record.image_quality['visual_assessment']['observations'][0]['certainty']='uncertain';self.record.save()
        row=next(i for i in suggestions(self.record)['items'] if i['id']==requirement.recommendation_id)
        self.assertFalse(row['can_start']);self.assertIn('shape',row['missing_information'])

    def test_configured_checker_failure_does_not_advance_photo_progress(self):
        self.photo_checker.stop()
        project=self.project()
        with override_settings(SNAPTURE_VISUAL_ASSESSOR='missing.service'):
            response=self.upload(project,0)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['project']['completed_steps'],[])
        self.assertEqual(response.json()['project']['step_photos'][0]['status'],'retake')

    def test_organization_scope_and_official_rating_validation(self):
        p,completion=self.finished()
        org=Organization.objects.create(name='Local organization')
        other_org=Organization.objects.create(name='Other organization')
        Membership.objects.create(user=self.other,organization=other_org,role='reviewer')
        program=Program.objects.create(organization=org,title='Craft activity',description='Make a craft',guidelines='Use paper',accepted_materials=['paper'],criteria=[{'name':'Workmanship','maximum':5}],starts_at=timezone.now()-timedelta(days=1),ends_at=timezone.now()+timedelta(days=1),status='published')
        response=self.post(f'programs/{program.pk}/submissions/',{'completion_id':completion.pk,'eligibility_confirmed':True})
        self.assertEqual(response.status_code,200,response.content)
        row=Submission.objects.get();path=f'/api/upcycling/submissions/{row.pk}/'
        payload={'status':'rated','scores':{'Workmanship':4},'feedback':'Good work.'}
        self.assertEqual(self.client.patch(path,json.dumps(payload),content_type='application/json',**self.other_auth).status_code,403)
        Membership.objects.create(user=self.other,organization=org,role='reviewer')
        payload['scores']['Workmanship']=6
        self.assertEqual(self.client.patch(path,json.dumps(payload),content_type='application/json',**self.other_auth).status_code,400)
        payload['scores']['Workmanship']=4
        result=self.client.patch(path,json.dumps(payload),content_type='application/json',**self.other_auth)
        self.assertEqual(result.status_code,200,result.content);self.assertEqual(result.json()['submission']['total'],4)
        self.assertEqual(self.client.patch(path,json.dumps(payload),content_type='application/json',**self.other_auth).status_code,409)
        program.criteria=[{'name':'Changed','maximum':10}];program.save()
        row.refresh_from_db();self.assertEqual(row.snapshot['criteria'],[{'name':'Workmanship','maximum':5}])

    def test_unconfigured_checker_blocks_and_same_photo_can_be_rechecked(self):
        self.photo_checker.stop()
        p=self.project()
        with override_settings(SNAPTURE_VISUAL_ASSESSOR=''):
            response=self.upload(p,0)
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['project']['completed_steps'],[])
        photo=StepPhoto.objects.get(project=p)
        self.assertEqual(photo.status,'retake')
        with patch('upcycling.views.observe',return_value={'status':'available','model':'fixture','observations':[],'step_status':'matches','feedback':'Matches.'}):
            response=self.post(f'projects/{p.pk}/steps/0/',{'recheck_photo_id':photo.pk})
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['project']['completed_steps'],[0])
        self.assertEqual(StepPhoto.objects.filter(project=p).count(),1)

    def test_documentary_steps_do_not_unlock_strict_completion(self):
        p=self.project();self.upload(p,0);self.upload(p,1,'blue')
        p.step_photos.update(status='submitted',assessment={'status':'unavailable'})
        response=self.client.get(f'/api/upcycling/projects/{p.pk}/',**self.auth)
        self.assertEqual(response.json()['project']['completed_steps'],[])
        self.assertEqual(self.post('completions/',{'project_id':p.pk,'materials':[{'name':'Paper','quantity':1}]}).status_code,400)

    def test_visual_warnings_are_assigned_to_their_own_photo_and_primary_label_is_preserved(self):
        from .assessment import visual_summary
        self.record.image_quality={'result_snapshot':{'photos':[{'view':'front'}]}}
        self.record.save()
        back=AdditionalView.objects.create(prediction=self.record,request_id='test_back',view='back',same_item_confirmed=True,observations={'material':{'label':'paper'}})
        top=AdditionalView.objects.create(prediction=self.record,request_id='test_top',view='top',same_item_confirmed=True,observations={'material':{'label':'cardboard'}})
        result=visual_summary(self.record)
        self.assertEqual(result['primary_view'],'front')
        rows={row['id']:row for row in result['views']}
        self.assertEqual(rows[back.pk]['warnings'],[])
        self.assertEqual(rows[top.pk]['warnings'],['Top view has a different or uncertain material suggestion.'])
        self.assertEqual(result['conflicts'],rows[top.pk]['warnings'])
        self.record.image_quality={'result_snapshot':{'photos':[{'view':'bottom'}]}}
        self.assertEqual(visual_summary(self.record)['primary_view'],'bottom')
        self.record.image_quality={}
        self.assertIsNone(visual_summary(self.record)['primary_view'])

    def test_all_registered_ideas_receive_condition_feedback_without_bypassing_requirements(self):
        from core.assessment import CONDITIONS
        for label in SCOPE_LABELS:
            record=self.make_record(label)
            for condition in CONDITIONS+['Torn or crumpled, clean and dry','Clean dry usable scraps']:
                with self.subTest(label=label,condition=condition):
                    record.condition=condition;record.save()
                    result=suggestions(record)
                    self.assertTrue(result['assessment_feedback'])
                    self.assertFalse(any(row['can_start'] for row in result['items']))
                    if condition=='Moldy or contaminated':self.assertEqual(result['items'],[])
                    elif condition=='Needs cleaning':
                        message=' '.join(row['message'] for row in result['assessment_feedback'])
                        self.assertIn('does not automatically mark it clean and dry',message)
                        if label in {'paper','cardboard'}:self.assertNotIn('rinse',message)
                    for row in result['items']:
                        self.assertIn('published project-specific suitability requirements',row['missing_information'])

    def test_each_reported_history_resin_and_wood_choice_gets_relevant_feedback(self):
        from core.assessment import CONTENTS,WOOD
        record=self.make_record('pete_bottles')
        for history in CONTENTS:
            record.previous_contents=history;record.save()
            result=suggestions(record)
            codes={n['code'] for n in result['assessment_feedback']}
            if history=='Chemical or cleaning product':
                self.assertIn('separate_handling',codes);self.assertEqual(result['items'],[])
            if history=='Other / unknown':self.assertIn('history_unknown',codes)
            if history=='Food or oil':self.assertIn('food_history',codes)
        record.previous_contents='Water or beverage'
        for mark in ['PET/PETE code 1','HDPE code 2','Another code','Not sure']:
            record.answers['resin_mark']=mark;record.save()
            codes={n['code'] for n in suggestions(record)['assessment_feedback']}
            self.assertEqual('resin_mark' in codes,mark!='PET/PETE code 1')
        wood=self.make_record('dry_untreated_wood_scraps')
        for history in WOOD:
            wood.answers['wood_treatment']=history;wood.save()
            result=suggestions(wood)
            self.assertEqual('wood_history' in {n['code'] for n in result['assessment_feedback']},history!=WOOD[0])
            if history==WOOD[1]:self.assertEqual(result['items'],[])

    def test_clean_answer_does_not_override_known_chemical_history(self):
        self.requirement()
        self.record.previous_contents='Chemical or cleaning product';self.record.save()
        result=suggestions(self.record)
        self.assertEqual(result['items'],[])
        self.assertIn('separate_handling',{n['code'] for n in result['assessment_feedback']})
