import json,tempfile
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from core.auth import issue_token
from predictions.models import PredictionRecord
from .models import CompletedProject,ProjectRequirement,AdditionalView
from .workflow import scan_details

class HumanAssistedTests(TestCase):
 def setUp(self):
  self.user=get_user_model().objects.create_user('assisted-user')
  self.auth={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.user)}
  tmp=tempfile.TemporaryDirectory();self.addCleanup(tmp.cleanup)
  setting=self.settings(MEDIA_ROOT=tmp.name);setting.enable();self.addCleanup(setting.disable)
 def image(self,color):
  b=BytesIO();Image.new('RGB',(200,200),color).save(b,format='JPEG');return SimpleUploadedFile('evidence.jpg',b.getvalue(),content_type='image/jpeg')
 def json(self,path,payload):return self.client.post(path,json.dumps(payload),content_type='application/json',**self.auth)
 def facts(self,record,facts):
  response=self.client.patch(f'/api/upcycling/predictions/{record.pk}/assessment/',json.dumps({'facts':facts}),content_type='application/json',**self.auth)
  self.assertEqual(response.status_code,200,response.content);return response
 def scan(self,assisted=True,score=.9):
  details={'mode':'single','quantity':1,'approximate_size':'20 x 10 cm'}
  if assisted:details.update(assessment_mode='human_assisted',human_assisted_acknowledged=True)
  material={'label':'cardboard' if score>=.7 else 'unknown_unsupported','raw_class':'cardboard','confidence':score,'threshold':.7,'status':'classified','model_version':'test'}
  with patch('predictions.scene_views.model_status',return_value={'loaded':True}),patch('predictions.scene_views.classify_material',return_value=material),patch('upcycling.assessment.observe',return_value={'status':'unavailable','observations':[]}):
   r=self.client.post('/api/scenes/',{'request_id':f'assisted_scan_{PredictionRecord.objects.count()}_12345','single_item':'1','frame':json.dumps({'aspect':1,'x':0,'y':0,'width':1,'height':1}),'scan_details':json.dumps(details),'image':self.image('brown')},**self.auth)
  self.assertEqual(r.status_code,201,r.content)
  return PredictionRecord.objects.get(pk=r.json()['scene']['items'][0]['prediction']['id'])
 def prepare(self,r):
  self.facts(r,{'condition':'Clean and dry','previous_contents':'No chemical contact known'})
  self.facts(r,{'human_condition_confirmed':True,'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':1})
  self.facts(r,{'project_checks':{'cardboard_craft':{'tools':True,'additional_materials':True,'safety':True}}})
 def test_start_to_finish_records_user_evidence_never_ai_passes(self):
  r=self.scan();self.prepare(r)
  start=self.json(f'/api/upcycling/predictions/{r.pk}/projects/',{'recommendation_id':'cardboard_craft'})
  self.assertEqual(start.status_code,200,start.content);p=start.json()['project'];pid=p['id']
  self.assertTrue(p['verification_capabilities']['human_assisted'])
  self.assertEqual(ProjectRequirement.objects.filter(published=True).count(),0)
  premature=self.json('/api/upcycling/completions/',{'project_id':pid});self.assertNotEqual(premature.status_code,200)
  for index,color in enumerate(['red','blue','green']):
   if index==0:
    unconfirmed=self.client.post(f'/api/upcycling/projects/{pid}/steps/{index}/',{'image':self.image('yellow')},**self.auth)
    self.assertEqual(unconfirmed.status_code,200);self.assertEqual(unconfirmed.json()['project']['completed_steps'],[])
   result=self.client.post(f'/api/upcycling/projects/{pid}/steps/{index}/',{'image':self.image(color),'step_confirmed':'true'},**self.auth)
   self.assertEqual(result.status_code,200,result.content);p=result.json()['project']
   self.assertEqual(p['completed_steps'],list(range(index+1)))
   self.assertFalse(p['step_photos'][0]['assessment']['validated']);self.assertNotEqual(p['step_photos'][0]['status'],'ai_matches')
  self.assertEqual(p['status'],'active')
  blocked=self.json('/api/upcycling/completions/',{'project_id':pid});self.assertEqual(blocked.status_code,409)
  final=self.client.post(f'/api/upcycling/projects/{pid}/final/',{'image':self.image('purple'),'final_confirmed':'true'},**self.auth)
  self.assertEqual(final.status_code,200,final.content)
  self.assertEqual(final.json()['project']['final_assessments'][0]['verdict'],'user_confirmed')
  complete=self.json('/api/upcycling/completions/',{'project_id':pid,'name':'My cardboard craft','materials':[{'name':'Cardboard','quantity':1}]})
  self.assertEqual(complete.status_code,200,complete.content)
  self.assertEqual(complete.json()['project']['status'],'completed')
  row=CompletedProject.objects.get(project_id=pid);self.assertEqual(row.verification_status,'user_confirmed');self.assertFalse(row.final_assessment['validated'])
 def test_mode_requires_explicit_initial_ack_and_cannot_override_low_confidence(self):
  with self.assertRaises(ValueError):scan_details({'mode':'single','quantity':1,'approximate_size':'A4','assessment_mode':'human_assisted'})
  r=self.scan(score=.5);self.prepare(r)
  result=self.json(f'/api/upcycling/predictions/{r.pk}/projects/',{'recommendation_id':'cardboard_craft'})
  self.assertEqual(result.status_code,409)

 def test_existing_screened_project_can_switch_and_finish_without_an_assessor(self):
  from predictions.models import UserProject
  from .workflow import VERSION, INSPECTION_POLICY
  from .verification import VERSION as VERIFICATION_VERSION
  from .models import StepPhoto

  record=self.scan(assisted=False)
  record.image_quality['scan_details']['condition_policy']=INSPECTION_POLICY
  record.save(update_fields=['image_quality'])
  project=UserProject.objects.create(
   user=self.user,source_prediction=record,recommendation_id='cardboard_craft',
   title='Template',material='Cardboard',steps=['Trace the pattern','Cut the template'],completed_steps=[0],
   reference={'photo_workflow':True,'workflow_version':VERSION,'suitability_requirements_source':'Fixture',
              'suitability_requirements':{'checkpoint_criteria':['Outline','Cut shape'],'final_criteria':['Template']}},
  )
  StepPhoto.objects.create(project=project,step_index=0,image='fixture.jpg',digest='fixture',status='ai_matches',
                           assessment={'verification_version':VERIFICATION_VERSION,'validated':True,'verdict':'verified'})
  base=f'/api/upcycling/projects/{project.pk}/'
  with self.settings(SNAPTURE_VISUAL_ASSESSOR='',SNAPTURE_VISUAL_ASSESSOR_VALIDATION={}):
   caps=self.client.get(base,**self.auth).json()['project']['verification_capabilities']
   self.assertTrue(caps['manual_confirmation_available'])
   self.assertEqual(self.json(base+'manual-confirmation/',{}).status_code,400)
   enabled=self.json(base+'manual-confirmation/',{'acknowledged':True})
   self.assertEqual(enabled.status_code,200,enabled.content)
   self.assertTrue(enabled.json()['project']['verification_capabilities']['human_assisted'])
   self.assertEqual(enabled.json()['project']['completed_steps'],[0])
   saved=self.client.post(base+'steps/1/',{'image':self.image('blue'),'step_confirmed':'true'},**self.auth)
   self.assertEqual(saved.json()['project']['completed_steps'],[0,1])
   self.assertEqual(saved.json()['project']['step_photos'][0]['assessment']['verdict'],'user_confirmed')
   final=self.client.post(base+'final/',{'image':self.image('purple'),'final_confirmed':'true'},**self.auth)
   self.assertEqual(final.json()['project']['final_assessments'][0]['verdict'],'user_confirmed')
   complete=self.json('/api/upcycling/completions/',{'project_id':project.pk,'materials':[{'name':'Cardboard','quantity':1}]})
   self.assertEqual(complete.status_code,200,complete.content)
   self.assertEqual(complete.json()['completion']['verification_status'],'user_confirmed')

 def inspect(self,record,quantity=1):
  self.facts(record,{'condition':'Clean and dry','previous_contents':'No chemical contact known'})
  self.facts(record,{'human_condition_confirmed':True,'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':quantity,
                     'project_checks':{'cardboard_craft':{'tools':True,'additional_materials':True,'safety':True}}})
  record.refresh_from_db()

 def test_dirty_report_cannot_be_cleared_without_preparation_evidence(self):
  from .human_assisted import verdict
  record=self.scan();self.facts(record,{'condition':'Needs cleaning'})
  self.inspect(record)
  self.assertEqual(verdict(record)['code'],'requires_preparation')
  result=self.json(f'/api/upcycling/predictions/{record.pk}/projects/',{'recommendation_id':'cardboard_craft'})
  self.assertEqual(result.status_code,409)

 def test_condition_confirmation_does_not_erase_preparation_reassessment(self):
  from .human_assisted import verdict
  record=self.scan();self.facts(record,{'moisture_cause':'Water','condition':'Needs cleaning'})
  # Update the reported condition first; then document preparation and reassess.
  self.facts(record,{'condition':'Clean and dry','previous_contents':'No chemical contact known'})
  self.facts(record,{'preparation_completed':True})
  material={'label':'cardboard','raw_class':'cardboard','confidence':.9,'threshold':.7,'status':'classified'}
  with patch('predictions.material_classifier.classify_material',return_value=material):
   response=self.client.post(f'/api/upcycling/predictions/{record.pk}/assessment/',{'image':self.image('pink'),'view':'front','purpose':'reassessment','full_item_confirmed':'true','same_item_confirmed':'true','request_id':'human_reassessment_1'},**self.auth)
  self.assertEqual(response.status_code,200,response.content)
  self.facts(record,{'human_condition_confirmed':True,'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':1})
  record.refresh_from_db()
  self.assertTrue(record.image_quality['workflow']['reassessed'])
  self.assertTrue(record.image_quality['workflow']['preparation_completed'])
  self.assertEqual(verdict(record)['code'],'suitable')

 def test_old_wet_evidence_can_be_reassessed_but_hazard_evidence_remains(self):
  from .human_assisted import verdict
  record=self.scan();self.inspect(record)
  record.image_quality['visual_assessment']={'observations':[{'field':'wet_appearance','value':'wet','certainty':'clear'}]}
  updated=AdditionalView.objects.create(prediction=record,request_id='reassessment_fixture',view='front',image='fixture.jpg',observations={'condition':{'status':'documented','observations':[]}})
  record.image_quality['workflow'].update(preparation_required=True,preparation_completed=True,reassessed=True,reassessment_view_id=updated.pk)
  record.save()
  self.assertEqual(verdict(record)['code'],'suitable')
  record.image_quality['visual_assessment']['observations'].append({'field':'visible_contamination','value':'mold','certainty':'clear'})
  self.assertEqual(verdict(record)['code'],'for_disposal')

 def test_quantity_zero_or_above_original_cannot_start(self):
  from .human_assisted import verdict,suggestions
  record=self.scan();self.inspect(record,quantity=0)
  self.assertEqual(verdict(record)['code'],'no_suitable_project')
  self.assertFalse(any(r['can_start'] for r in suggestions(record)['items']))
  response=self.client.patch(f'/api/upcycling/predictions/{record.pk}/assessment/',json.dumps({'facts':{'usable_quantity':2,'inspection_confirmed':True}}),content_type='application/json',**self.auth)
  self.assertEqual(response.status_code,400)

 def test_human_mode_never_leaks_to_default_ai_or_other_materials(self):
  from .human_assisted import enabled,verdict,project_enabled
  from .workflow import verdict as shared_verdict
  from types import SimpleNamespace
  record=self.scan(assisted=False);self.inspect(record)
  self.assertFalse(enabled(record));self.assertEqual(shared_verdict(record)['code'],'assessment_pending')
  self.assertFalse(project_enabled(SimpleNamespace(reference={'assessment_mode':'human_assisted'})))
  record=self.scan();self.inspect(record)
  record.decision='fabric_scraps'
  self.assertEqual(verdict(record)['code'],'no_suitable_project')

 def test_hazard_history_remains_after_clean_user_report(self):
  from .human_assisted import verdict
  record=self.scan();self.facts(record,{'previous_contents':'Chemical or cleaning product'})
  self.inspect(record)
  self.assertEqual(verdict(record)['code'],'for_disposal')
 def test_reported_hazard_stays_blocked_even_after_clean_answer(self):
  r=self.scan();self.facts(r,{'previous_contents':'Chemical or cleaning product'});self.prepare(r)
  result=self.json(f'/api/upcycling/predictions/{r.pk}/projects/',{'recommendation_id':'cardboard_craft'})
  self.assertEqual(result.status_code,409)
 def test_human_answers_do_not_unlock_default_ai_mode(self):
  r=self.scan(assisted=False);self.prepare(r)
  result=self.json(f'/api/upcycling/predictions/{r.pk}/projects/',{'recommendation_id':'cardboard_craft'})
  self.assertEqual(result.status_code,409)
