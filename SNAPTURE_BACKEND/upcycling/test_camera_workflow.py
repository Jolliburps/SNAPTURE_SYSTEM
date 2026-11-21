import json
from io import BytesIO
from tempfile import TemporaryDirectory
from unittest.mock import patch
from django.core.management import call_command
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from core.auth import issue_token
from core.recommendations import CATALOG
from predictions.models import PredictionRecord
from .models import AdditionalView, ProjectRequirement
from .workflow import VERSION, scan_details, combine_material, verdict
from .matching import suggestions


class CameraWorkflowTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('workflow')
        self.auth={'HTTP_AUTHORIZATION':'Bearer '+issue_token(self.user)}
        self.material={'label':'cardboard','raw_class':'cardboard','confidence':.9,'threshold':.7,'status':'classified'}
        self.visual={'status':'available','model':'test fixture only','validated':True,'observations':[
            *[{'field':field,'value':'acceptable','certainty':'clear'} for field in ('damage','deformation','usable_portions','structural_appearance')],
            {'field':'wet_appearance','value':'dry','certainty':'clear'},
            {'field':'visible_contamination','value':'none visible','certainty':'clear'}]}
        self.visual_spec={row['field']:[row['value']] for row in self.visual['observations']}
        self.record=PredictionRecord.objects.create(user=self.user,decision='cardboard',model_class='Cardboard',title='Cardboard',
            confidence=.9,threshold=.7,condition='Clean and dry',previous_contents='No chemical contact known',quantity=25,
            image_quality={'workflow_version':VERSION,'scan_details':{'mode':'batch','quantity':25,'approximate_size':'A4'},
                           'material_prediction':self.material,'visual_assessment':self.visual,'workflow':{}},answers={})

    def patch(self,facts):
        return self.client.patch(f'/api/upcycling/predictions/{self.record.pk}/assessment/',json.dumps({'facts':facts}),content_type='application/json',**self.auth)

    def test_details_validation_and_quantity_is_physical_count(self):
        self.assertEqual(scan_details({'mode':'batch','quantity':25,'approximate_size':'A4'})['quantity'],25)
        for value in ({'mode':'single','quantity':25,'approximate_size':'A4'},{'mode':'batch','quantity':True,'approximate_size':'A4'}):
            with self.assertRaises(ValueError):scan_details(value)
        with self.assertRaises(ValueError):
            scan_details({'mode':'batch','quantity':1,'approximate_size':'A4','inspection_report':'none_seen'})

    def test_guided_none_report_cannot_replace_validated_condition_evidence(self):
        from .assessment import facts_for
        self.record.image_quality['scan_details']['inspection_report']='none_seen'
        self.record.image_quality['workflow']={'inspection_confirmed':True,'safety_acknowledged':True,'usable_quantity':25}
        self.record.image_quality['visual_assessment']['validated']=False
        self.assertEqual(facts_for(self.record)['condition'],'')
        self.assertEqual(verdict(self.record)['code'],'assessment_pending')
        clear={'damage':'none visible','deformation':'none visible','wet_appearance':'dry','visible_contamination':'none visible',
               'usable_portions':'whole item visible','structural_appearance':'intact appearance'}
        self.record.condition=''
        self.record.image_quality['visual_assessment']={'status':'available','validated':True,'observations':[
            {'field':field,'value':value,'certainty':'clear'} for field,value in clear.items()]}
        self.assertEqual(facts_for(self.record)['condition'],'Clean and dry')
        self.assertEqual(verdict(self.record)['code'],'suitable')

    def test_inspection_first_acts_on_reported_condition_without_a_validated_assessor(self):
        details=self.record.image_quality['scan_details']
        details.update(condition_policy='inspection-first-v1',inspection_report='concern_photo')
        self.record.condition=''
        self.record.image_quality['visual_assessment']={'status':'not_assessed','observations':[]}
        self.record.image_quality['workflow']={'inspection_confirmed':True,'usable_quantity':25}
        for concern,moisture,expected in [
            ('minor_damage',None,'suitable'),
            ('dirt',None,'requires_preparation'),
            ('wet','Water','requires_preparation'),
            ('wet','Oil','for_disposal'),
            ('wet','Unknown','condition_review'),
            ('unknown',None,'condition_review'),
        ]:
            with self.subTest(concern=concern,moisture=moisture):
                details['reported_concern']=concern
                self.record.answers={'suitability_facts':{'moisture_cause':{'value':moisture}}} if moisture else {}
                self.assertEqual(verdict(self.record)['code'],expected)
        details.update(inspection_report='none_seen')
        self.record.previous_contents='Chemical or cleaning product'
        self.assertEqual(verdict(self.record)['code'],'for_disposal')

    def test_closeup_framing_preserves_project_readiness_and_real_conflicts(self):
        from .assessment import visual_summary

        call_command('publish_catalog_requirements', verbosity=0)
        key='cardboard_craft'
        self.record.image_quality['scan_details'].update(
            condition_policy='inspection-first-v1',inspection_report='none_seen',approximate_size='20 x 15 cm')
        self.record.image_quality['workflow']={'inspection_confirmed':True,'usable_quantity':25}
        clear={'damage':'none visible','deformation':'none visible','wet_appearance':'dry',
               'visible_contamination':'none visible','usable_portions':'whole item visible',
               'structural_appearance':'intact appearance'}
        self.record.image_quality['visual_assessment']={**self.visual,'observations':[
            {'field':field,'value':value,'certainty':'clear'} for field,value in clear.items()]}
        self.record.answers={'suitability_facts':{'project_checks':{'value':{key:{'tools':True,'safety':True}}}}}
        self.record.save()
        view=AdditionalView.objects.create(prediction=self.record,view='side',request_id='framing_closeup',
            image='test.jpg',observations={'purpose':'closeup','condition':{**self.visual,'observations':[
                {'field':'usable_portions','value':'partial portions visible','certainty':'clear'}]}})

        result=suggestions(self.record)
        self.assertEqual(result['facts']['usable_portions'],'whole item visible')
        project=next(row for row in result['items'] if row['id']==key)
        self.assertTrue(project['can_start'],project['missing_information'])
        self.assertNotIn('Conflicting usable portions observations.',visual_summary(self.record)['conflicts'])

        view.observations['condition']['observations'].append(
            {'field':'damage','value':'major damage','certainty':'clear'})
        view.save(update_fields=['observations'])
        self.assertEqual(suggestions(self.record)['verdict']['code'],'condition_review')
        self.assertIn('Conflicting damage observations.',visual_summary(self.record)['conflicts'])

    def test_catalog_size_and_quantity_are_per_piece(self):
        from core.project_sizes import CATALOG_FIT, estimated_dimensions
        self.assertEqual(set(CATALOG_FIT),{idea['id'] for ideas in CATALOG.values() for idea in ideas})
        self.assertEqual(estimated_dimensions('paper','A4'),{'length':297,'width':210})
        self.assertEqual(estimated_dimensions('cardboard','18 × 12 cm'),{'length':180,'width':120})
        details=self.record.image_quality['scan_details']
        details.update(condition_policy='inspection-first-v1',inspection_report='none_seen',approximate_size='8 × 6 cm')
        self.record.image_quality['visual_assessment']={'status':'not_assessed','observations':[]}
        self.record.image_quality['workflow']={'inspection_confirmed':True,'usable_quantity':25}
        def ideas():return {idea['id']:idea for idea in suggestions(self.record)['items']}
        self.assertEqual(set(ideas()),{'cardboard_craft'})
        details['approximate_size']='18 × 12 cm'
        self.record.quantity=2
        self.assertNotIn('cardboard_divider',ideas())
        self.record.quantity=3
        self.assertIn('cardboard_divider',ideas())
        self.assertFalse(ideas()['cardboard_divider']['can_start'])
        details['approximate_size']='50 × 20 cm'
        self.assertEqual(set(ideas()),{'cardboard_craft','cardboard_divider','cardboard_organizer'})
        self.assertNotIn('length in mm',ideas()['cardboard_organizer']['missing_information'])
        self.assertNotIn('width in mm',ideas()['cardboard_organizer']['missing_information'])
        self.assertEqual(suggestions(self.record)['fact_sources']['dimensions'],'item_details')

    def test_small_hdpe_never_pools_capacity_to_fit_scoop(self):
        self.record.decision='hdpe_containers'
        self.record.image_quality['material_prediction']={**self.material,'label':'hdpe_containers','raw_class':'hdpe_containers'}
        self.record.image_quality['visual_assessment']={'status':'not_assessed','observations':[]}
        details=self.record.image_quality['scan_details']
        details.update(condition_policy='inspection-first-v1',inspection_report='none_seen',approximate_size='100 mL')
        self.record.image_quality['workflow']={'inspection_confirmed':True,'usable_quantity':25}
        def ideas():return {idea['id']:idea for idea in suggestions(self.record)['items']}
        self.assertEqual(set(ideas()),{'hdpe_small_parts'})
        self.assertEqual(ideas()['hdpe_small_parts']['requirements']['minimum_quantity'],1)
        details['approximate_size']='5 L'
        scoop=ideas()['hdpe_scoop']
        self.assertIn('shape',scoop['missing_information'])
        self.assertNotIn('capacity in mL',scoop['missing_information'])
        self.assertNotIn('hdpe_small_parts',ideas())
        self.record.previous_contents='Chemical or cleaning product'
        self.assertEqual(ideas(),{})

    def test_published_project_can_start_with_size_from_item_details(self):
        idea=CATALOG['cardboard'][0]
        self.record.image_quality['scan_details'].update(condition_policy='inspection-first-v1',inspection_report='none_seen',approximate_size='50 x 20cm')
        self.record.image_quality['workflow']={'inspection_confirmed':True,'usable_quantity':5}
        self.record.quantity=5
        self.record.answers={'suitability_facts':{'project_checks':{'value':{idea['id']:{'safety':True}}}}}
        self.record.save()
        ProjectRequirement.objects.create(recommendation_id=idea['id'],material='cardboard',published=True,source='Test fixture',
            specification={'minimum_quantity':1,'dimensions':{},'conditions':['Clean and dry'],'tools':[],
                           'additional_materials':[],'safety':['Read the instructions.'],'checkpoint_criteria':list(idea['steps']),
                           'final_criteria':['Tray is visible.'],'visible_characteristics':self.visual_spec})
        selected=next(row for row in suggestions(self.record)['items'] if row['id']==idea['id'])
        self.assertTrue(selected['can_start'],selected['missing_information'])

    def test_uncertain_optional_view_does_not_veto_main_but_confident_conflict_does(self):
        weak_paper={**self.material,'confidence':.699,'raw_class':'paper','label':'paper'}
        view=AdditionalView.objects.create(prediction=self.record,view='back',request_id='additional_back',image='test.jpg',observations={'purpose':'material_view','material':weak_paper})
        combine_material(self.record)
        self.assertEqual(self.record.decision,'cardboard')
        self.assertEqual(self.record.confidence,.9)
        view.observations['material']['confidence']=.7
        view.save()
        combine_material(self.record);self.assertEqual(self.record.decision,'unknown_unsupported')
        self.assertEqual(self.record.image_quality['combined_material']['status'],'conflicting_evidence')

    def test_main_view_must_meet_threshold_even_if_optional_view_is_confident(self):
        AdditionalView.objects.create(prediction=self.record,view='side',request_id='additional_side',image='test.jpg',observations={'material':self.material})
        for confidence,label in ((.699,'unknown_unsupported'),(.7,'cardboard')):
            self.record.image_quality['primary_material_prediction']={**self.material,'confidence':confidence}
            combine_material(self.record)
            self.assertEqual(self.record.decision,label)

    def test_condition_closeup_preserves_material_and_requires_a_fresh_report(self):
        self.assertEqual(self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18}).status_code,200)
        self.record.refresh_from_db()
        snapshot={'version':'frozen','classification':{'kind':'supported'}}
        self.record.image_quality['result_snapshot']=snapshot
        self.record.save(update_fields=['image_quality'])
        AdditionalView.objects.create(prediction=self.record,view='back',request_id='historical_closeup',image='test.jpg',observations={
            'purpose':'closeup','material':{**self.material,'label':'paper','raw_class':'paper'},'condition':self.visual,
        })
        encoded=BytesIO()
        Image.new('RGB',(200,200),'brown').save(encoded,format='JPEG')
        with TemporaryDirectory() as media, self.settings(MEDIA_ROOT=media), patch('predictions.material_classifier.classify_material') as classify:
            response=self.client.post(f'/api/upcycling/predictions/{self.record.pk}/assessment/',{
                'image':SimpleUploadedFile('closeup.jpg',encoded.getvalue(),content_type='image/jpeg'),
                'purpose':'closeup','view':'side','request_id':'closeup_current','same_item_confirmed':'true',
            },**self.auth)
            self.assertEqual(response.status_code,200,response.content)
            classify.assert_not_called()
        self.record.refresh_from_db()
        self.assertEqual(self.record.decision,'cardboard')
        self.assertEqual(self.record.condition,'Not sure')
        self.assertFalse(self.record.image_quality['workflow']['inspection_confirmed'])
        self.assertFalse(verdict(self.record)['can_start'])
        self.assertEqual(self.record.image_quality['result_snapshot'],snapshot)
        self.assertNotIn('material',self.record.additional_views.get(request_id='closeup_current').observations)

    def test_reported_glass_or_metal_routes_to_special_handling_even_with_confident_material(self):
        for report in ('glass','metal'):
            with self.subTest(report=report):
                self.assertEqual(self.patch({'material_scope_report':report}).status_code,200)
                self.record.refresh_from_db()
                self.assertEqual(verdict(self.record)['code'],'for_disposal')
                self.assertEqual(suggestions(self.record)['items'],[])
        self.patch({'material_scope_report':'out_of_scope','condition':'Clean and dry'})
        self.record.refresh_from_db()
        self.assertEqual(verdict(self.record)['code'],'for_disposal')

    def test_other_out_of_scope_reports_withhold_ideas_without_claiming_hazard(self):
        response=self.patch({'material_scope_report':'out_of_scope'})
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['prediction']['recognition']['status'],'unsupported')
        self.record.refresh_from_db()
        self.assertEqual(verdict(self.record)['title'],'Out of Scope')
        self.assertEqual(suggestions(self.record)['items'],[])

    def test_uncertain_photo_out_of_scope_and_unavailable_have_distinct_messages(self):
        self.record.decision='unknown_unsupported'
        self.record.confidence=.51
        for status,title in [('needs_review','Photo Needs Review'),('not_applicable','Out of Scope'),('unavailable','Material Check Unavailable')]:
            with self.subTest(status=status):
                self.record.image_quality['material_prediction']={**self.material,'status':status}
                decision=verdict(self.record)
                self.assertEqual(decision['title'],title)
                self.assertFalse(decision['can_start'])
                if status=='needs_review':self.assertIn('whole item',decision['next_action'])

    def test_unapproved_condition_checker_stays_pending_without_inference(self):
        from .human_assisted import condition_record
        with self.settings(SNAPTURE_VISUAL_ASSESSOR='upcycling.local_vision.assess', SNAPTURE_VISUAL_ASSESSOR_VALIDATION={}), patch('upcycling.assessment.observe') as observe:
            result=condition_record(self.record,Image.new('RGB',(10,10)),purpose='condition')
        observe.assert_not_called()
        self.assertEqual(result['status'],'unavailable')

    def test_acknowledgment_does_not_confirm_inspection_or_unavailable_ai(self):
        self.assertEqual(self.patch({'safety_acknowledged':True}).status_code,200)
        self.record.refresh_from_db();self.assertFalse(verdict(self.record)['can_start'])
        self.assertEqual(self.patch({'inspection_confirmed':True,'usable_quantity':18}).status_code,200)
        self.record.refresh_from_db();self.assertEqual(self.record.quantity,18)
        self.record.image_quality['visual_assessment']={'status':'unavailable','observations':[]};self.record.save()
        result=verdict(self.record);self.assertEqual(result['code'],'assessment_pending');self.assertIn('unavailable',result['reason'])

    def test_quantity_cannot_exceed_original_and_inspection_is_invalidated(self):
        self.assertEqual(self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':26}).status_code,400)
        self.assertEqual(self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18}).status_code,200)
        self.assertEqual(self.patch({'dimensions':{'width':120}}).status_code,200)
        self.record.refresh_from_db();self.assertFalse(self.record.image_quality['workflow']['inspection_confirmed'])

    def test_chemical_history_survives_clean_answer(self):
        self.assertEqual(self.patch({'previous_contents':'Chemical or cleaning product'}).status_code,200)
        self.assertEqual(self.patch({'previous_contents':'No chemical contact known','condition':'Clean and dry'}).status_code,200)
        self.record.refresh_from_db();self.assertEqual(verdict(self.record)['code'],'for_disposal')

    def test_water_needs_drying_and_reassessment(self):
        self.patch({'moisture_cause':'Unknown'})
        self.record.refresh_from_db();self.assertEqual(verdict(self.record)['code'],'assessment_pending')
        self.patch({'moisture_cause':'Water','preparation_completed':True})
        self.record.refresh_from_db();self.assertEqual(verdict(self.record)['code'],'requires_preparation')
        self.patch({'moisture_cause':'Oil'})
        self.record.refresh_from_db();self.assertEqual(verdict(self.record)['code'],'for_disposal')

    def test_published_requirements_and_both_start_routes_are_gated(self):
        key=CATALOG['cardboard'][0]['id']
        ProjectRequirement.objects.create(recommendation_id=key,material='cardboard',published=True,source='test only',specification={
            'conditions':['Clean and dry','Damaged or cracked'],'dimensions':{},'minimum_quantity':20,
            'tools':[],'additional_materials':[],'safety':['Use safe preparation tools'],
            'checkpoint_criteria':list(CATALOG['cardboard'][0]['steps']),'final_criteria':['Visible completed organizer sections'],
            'visible_characteristics':self.visual_spec})
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18})
        self.record.refresh_from_db();row=next(r for r in suggestions(self.record)['items'] if r['id']==key)
        self.assertEqual(row['additional_quantity'],2);self.assertFalse(row['can_start'])
        first=self.client.post(f'/api/upcycling/predictions/{self.record.pk}/projects/',json.dumps({'recommendation_id':key}),content_type='application/json',**self.auth)
        legacy=self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.pk,'recommendation_id':key}),content_type='application/json',**self.auth)
        self.assertEqual(first.status_code,409);self.assertNotEqual(legacy.status_code,200)

    def test_get_does_not_rewrite_historical_snapshot(self):
        self.record.image_quality['result_snapshot']={'version':'original','classification':{'kind':'supported'}};self.record.save()
        self.client.get(f'/api/upcycling/predictions/{self.record.pk}/assessment/',**self.auth)
        self.record.refresh_from_db();self.assertEqual(self.record.image_quality['result_snapshot']['version'],'original')

    def test_incomplete_checkpoint_final_or_safety_requirements_never_allow_start(self):
        idea=CATALOG['cardboard'][0]
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18})
        requirement=ProjectRequirement.objects.create(recommendation_id=idea['id'],material='cardboard',published=True,source='Test evidence only',specification={
            'conditions':['Clean and dry'],'dimensions':{},'minimum_quantity':1,'tools':[],'additional_materials':[],
            'safety':['Follow reviewed handling instructions'],'checkpoint_criteria':list(idea['steps']),'final_criteria':['Completed project features visible'],
            'visible_characteristics':self.visual_spec})
        self.patch({'project_checks':{idea['id']:{'safety':True}}})
        self.record.refresh_from_db()
        def row():return next(r for r in suggestions(self.record)['items'] if r['id']==idea['id'])
        self.assertTrue(row()['can_start'])
        original=dict(requirement.specification)
        for field,value in [('checkpoint_criteria',[]),('checkpoint_criteria',['Only one of several steps']),('final_criteria',[]),('safety',[]),('conditions',[])]:
            requirement.specification={**original,field:value};requirement.save()
            self.assertFalse(row()['can_start'],field)
        requirement.specification=original;requirement.source='';requirement.save()
        self.assertFalse(row()['can_start'])

    def test_reported_visual_values_cannot_override_ai_damage_or_missing_acceptance(self):
        from .assessment import facts_for
        idea=CATALOG['cardboard'][0]
        requirement=ProjectRequirement.objects.create(recommendation_id=idea['id'],material='cardboard',published=True,source='Fixture only',specification={
            'conditions':['Clean and dry'],'dimensions':{},'minimum_quantity':1,'tools':[],'additional_materials':[],
            'safety':['Follow reviewed handling instructions'],'checkpoint_criteria':list(idea['steps']),
            'final_criteria':['Completed features visible'],'visible_characteristics':self.visual_spec})
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18,'project_checks':{idea['id']:{'safety':True}},'damage':'acceptable'})
        self.record.refresh_from_db()
        self.record.image_quality['visual_assessment']['observations'][0]['value']='severe tearing';self.record.save()
        self.assertEqual(facts_for(self.record)['damage'],'severe tearing')
        result=suggestions(self.record)
        selected=next(r for r in result['items'] if r['id']==idea['id'])
        self.assertFalse(selected['can_start']);self.assertEqual(selected['status'],'not_suitable')
        self.assertEqual(result['fact_sources']['damage'],'ai_observed')
        requirement.specification.pop('visible_characteristics');requirement.save()
        selected=next(r for r in suggestions(self.record)['items'] if r['id']==idea['id'])
        self.assertFalse(selected['can_start']);self.assertIn('reviewed visual acceptance: damage',selected['missing_information'])

    def test_vetted_seventy_percent_material_needs_no_owl_confirmation_on_either_start_route(self):
        idea=CATALOG['cardboard'][0]
        self.record.confidence=.7
        self.record.model_version='snapture-mobilenetv2-scope-candidate-unverified-v1'
        self.record.image_quality['material_prediction'].update(confidence=.7,experimental=True)
        self.record.save()
        ProjectRequirement.objects.create(recommendation_id=idea['id'],material='cardboard',published=True,source='Explicit fixture criteria, not production evidence',specification={
            'conditions':['Clean and dry'],'dimensions':{},'minimum_quantity':1,'tools':[],'additional_materials':[],
            'safety':['Follow reviewed handling instructions'],'checkpoint_criteria':list(idea['steps']),
            'final_criteria':['Completed features visible'],'visible_characteristics':self.visual_spec})
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18,
                    'project_checks':{idea['id']:{'safety':True}}})
        self.record.refresh_from_db()
        self.assertNotIn('user_confirmed_material',self.record.answers)
        selected=next(r for r in suggestions(self.record)['items'] if r['id']==idea['id'])
        self.assertTrue(selected['can_start'],selected['missing_information'])
        first=self.client.post(f'/api/upcycling/predictions/{self.record.pk}/projects/',json.dumps({'recommendation_id':idea['id']}),content_type='application/json',**self.auth)
        second=self.client.post('/api/projects/',json.dumps({'prediction_id':self.record.pk,'recommendation_id':idea['id']}),content_type='application/json',**self.auth)
        self.assertEqual(first.status_code,200,first.content)
        self.assertEqual(second.status_code,200,second.content)
        self.assertEqual(first.json()['project']['id'],second.json()['project']['id'])
        self.assertTrue(first.json()['project']['photo_workflow'])
        self.assertEqual(first.json()['project']['reference']['workflow_version'],VERSION)

    def test_legacy_update_cannot_bypass_history_or_inspection(self):
        response=self.client.patch(f'/api/predictions/{self.record.pk}/',json.dumps({'condition':'Clean and dry','quantity':999}),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,409)
        self.record.refresh_from_db();self.assertEqual(self.record.quantity,25)

    def test_changed_usable_quantity_requires_fresh_inspection(self):
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18})
        self.patch({'usable_quantity':17})
        self.record.refresh_from_db();self.assertFalse(self.record.image_quality['workflow']['inspection_confirmed'])

    def test_shape_only_or_unvalidated_observations_cannot_unlock(self):
        self.patch({'safety_acknowledged':True,'inspection_confirmed':True,'usable_quantity':18})
        for visual in ({'status':'available','validated':True,'observations':[{'field':'shape','value':'flat','certainty':'clear'}]},
                       {**self.visual,'validated':False}):
            self.record.refresh_from_db();self.record.image_quality['visual_assessment']=visual;self.record.save()
            self.assertEqual(verdict(self.record)['code'],'assessment_pending')

    def test_visible_ordinary_dirt_requires_preparation(self):
        self.record.image_quality['visual_assessment']['observations'][-1]['value']='removable dirt'
        self.record.save()
        self.assertEqual(verdict(self.record)['code'],'requires_preparation')

    def test_visible_hazard_takes_priority_over_uncertain_material(self):
        self.record.decision='unknown_unsupported'
        self.record.confidence=.4
        self.record.image_quality['visual_assessment']['observations'][-1]['value']='mold'
        self.record.save()
        self.assertEqual(verdict(self.record)['code'],'for_disposal')

    def test_capability_uses_latest_complete_reassessment(self):
        from .assessment import visual_summary
        view=AdditionalView.objects.create(prediction=self.record,view='front',request_id='reassessment_test',image='test.jpg',observations={'material':self.material,'condition':self.visual})
        self.record.image_quality['visual_assessment']={'status':'unavailable','observations':[]}
        self.record.image_quality['workflow']={'reassessment_view_id':view.pk,'reassessed':True}
        self.record.save()
        self.assertEqual(visual_summary(self.record)['capability']['condition_assessment'],'available')


class PublishedCatalogTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user('published-catalog')
        call_command('prepare_project_requirements', verbosity=0)
        call_command('publish_catalog_requirements', verbosity=0)

    def test_every_catalog_recipe_can_start_after_inspection_and_project_checks(self):
        from core.project_sizes import CATALOG_FIT

        sizes = {
            'pete_bottles': '7 L', 'hdpe_containers': '5 L', 'cardboard': '50 x 30 cm',
            'paper': 'A4', 'fabric_scraps': '30 x 25 cm', 'coconut_shells': '12 cm',
            'dry_untreated_wood_scraps': '30 x 15 x 2 cm',
        }
        self.assertEqual(ProjectRequirement.objects.filter(published=True).count(), len(CATALOG_FIT))
        for material, ideas in CATALOG.items():
            for idea in ideas:
                key = idea['id']
                with self.subTest(project=key):
                    size = '100 mL' if key == 'hdpe_small_parts' else sizes[material]
                    quantity = CATALOG_FIT[key]['minimum_quantity']
                    facts = {
                        'project_checks': {'value': {key: {'tools': True, 'additional_materials': True, 'safety': True}}},
                    }
                    if CATALOG_FIT[key].get('shapes'):
                        facts['shape'] = {'value': CATALOG_FIT[key]['shapes'][0]}
                    record = PredictionRecord.objects.create(
                        user=self.user, decision=material, title=material, model_class=material,
                        confidence=.9, threshold=.7, previous_contents='No chemical contact known', quantity=quantity,
                        image_quality={'workflow_version': VERSION, 'scan_details': {
                            'condition_policy': 'inspection-first-v1', 'inspection_report': 'none_seen',
                            'approximate_size': size, 'quantity': quantity,
                        }, 'workflow': {'inspection_confirmed': True, 'usable_quantity': quantity}},
                        answers={'suitability_facts': facts, 'resin_mark': {
                            'pete_bottles': 'PET/PETE code 1', 'hdpe_containers': 'HDPE code 2',
                        }.get(material), 'wood_treatment': 'Known untreated and free of paint, mold and hardware'},
                    )
                    result = suggestions(record)
                    row = next(item for item in result['items'] if item['id'] == key)
                    self.assertTrue(row['can_start'], row['missing_information'])
                    self.assertEqual(result['fact_sources']['dimensions'], 'item_details')

    def test_saved_bottle_can_start_with_no_new_measurement_and_rechecks_hazards(self):
        key = 'pete_planter'
        record = PredictionRecord.objects.create(
            user=self.user, decision='pete_bottles', title='PETE bottle', model_class='pete_bottles',
            confidence=.9, threshold=.7, previous_contents='Water or beverage', quantity=1,
            image_quality={'workflow_version': VERSION, 'scan_details': {
                'condition_policy': 'inspection-first-v1', 'inspection_report': 'none_seen',
                'approximate_size': '7000 ml', 'quantity': 1,
            }, 'workflow': {'inspection_confirmed': True, 'usable_quantity': 1, 'safety_acknowledged': True}},
        )
        auth = {'HTTP_AUTHORIZATION': 'Bearer ' + issue_token(self.user)}
        projects = f'/api/upcycling/predictions/{record.pk}/projects/'
        assessment = f'/api/upcycling/predictions/{record.pk}/assessment/'

        def start():
            return self.client.post(projects, {'recommendation_id': key}, content_type='application/json', **auth)

        def confirm(facts):
            response = self.client.patch(assessment, {'facts': facts}, content_type='application/json', **auth)
            self.assertEqual(response.status_code, 200, response.content)

        self.assertEqual(start().status_code, 409)
        confirm({'resin_mark': 'PET/PETE code 1', 'project_checks': {key: {'safety': True}}})
        self.assertEqual(start().status_code, 409)
        confirm({'project_checks': {key: {'tools': True, 'additional_materials': True}}})
        started = start()
        self.assertEqual(started.status_code, 200, started.content)
        self.assertIn('wick', started.json()['project']['steps'][1])

        record.refresh_from_db()
        self.assertEqual(record.image_quality['scan_details']['approximate_size'], '7000 ml')
        self.assertTrue(record.image_quality['workflow']['inspection_confirmed'])
        record.image_quality['visual_assessment'] = {'status': 'available', 'validated': True, 'observations': [
            {'field': 'damage', 'value': 'major damage', 'certainty': 'clear'},
        ]}
        record.save(update_fields=['image_quality'])
        self.assertEqual(start().status_code, 409)
