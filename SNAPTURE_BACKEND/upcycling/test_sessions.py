import json
from unittest.mock import patch
from django.test import TestCase
from predictions import test_scenes as fixtures
from predictions import test_single_item_frame as frame_fixtures
from predictions.models import PredictionRecord,ScanScene,SceneItem
from upcycling.models import AdditionalView,InventoryLot,ProjectRequirement
from upcycling.scan_sessions import MissingScanViews,freeze,classification,validate_capture_plan

class ScanSessionTests(TestCase):
    setUp=fixtures.SceneApiTests.setUp
    upload_single=frame_fixtures.SingleItemFrameTests.upload_single

    def photo(self,name):
        from io import BytesIO
        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile
        out=BytesIO();Image.new('RGB',(120,120),name).save(out,format='PNG')
        return SimpleUploadedFile('view.png',out.getvalue(),content_type='image/png')

    def test_five_views_produce_one_scene_item_and_one_frozen_result(self):
        material={'label':'paper','status':'classified','raw_class':'paper','confidence':.9}
        fields={'primary_view':'front','same_item_confirmed':'true','view_names':json.dumps(['back','side','top','bottom']),
                'view_frames':json.dumps([None]*4),'additional_views':[self.photo(c) for c in ('blue','red','green','yellow')]}
        with patch('predictions.material_classifier.classify_material',return_value=material):response,_=self.upload_single(**fields)
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(ScanScene.objects.count(),1);self.assertEqual(SceneItem.objects.count(),1);self.assertEqual(PredictionRecord.objects.count(),1)
        self.assertEqual(AdditionalView.objects.count(),4);self.assertEqual(InventoryLot.objects.count(),0)
        record=PredictionRecord.objects.get();snapshot=record.image_quality['result_snapshot']
        self.assertEqual([p['view'] for p in snapshot['photos']],['front','back','side','top','bottom'])
        with patch('predictions.scene_detector.detect',side_effect=AssertionError('History must not detect again')):
            old=self.client.get(f'/api/upcycling/predictions/{record.pk}/result/',**self.auth)
        self.assertEqual(old.status_code,200);self.assertEqual(old.json()['snapshot'],snapshot)
        ProjectRequirement.objects.create(recommendation_id='paper_gift_wrap',material='paper',specification={'minimum_quantity':99},source='Test changed requirements',published=True)
        self.assertEqual(self.client.get(f'/api/upcycling/predictions/{record.pk}/result/',**self.auth).json()['snapshot'],snapshot)

    def test_duplicate_views_are_rejected_before_inference(self):
        response,detect=self.upload_single(primary_view='front',same_item_confirmed='true',view_names='["front"]',view_frames='[null]',additional_views=[self.photo('blue')])
        self.assertEqual(response.status_code,400);detect.assert_not_called();self.assertEqual(ScanScene.objects.count(),0)

    def test_invalid_form_values_return_actionable_errors(self):
        for field,message in [('mode','Choose single item or batch.'),
                              ('assessment_mode','Choose AI assessment or human-assisted assessment.')]:
            for invalid in ([],{}):
                with self.subTest(field=field,value=invalid):
                    details={'mode':'single','quantity':1,'approximate_size':'A4',field:invalid}
                    response,classifier=self.upload_single(scan_details=json.dumps(details))
                    self.assertEqual(response.status_code,400,response.content)
                    self.assertEqual(response.json()['detail'],message)
                    classifier.assert_not_called()

    def test_flat_material_requires_back_and_excludes_inside(self):
        back=('back',None,'material_view')
        for material in ('paper','fabric_scraps'):
            with self.subTest(material=material):
                validate_capture_plan(material,'front',[back])
                with self.assertRaises(MissingScanViews):
                    validate_capture_plan(material,'front',[back,('inside',None,'interior')])

    def test_guided_scan_requires_six_sides_and_checks_the_bottom_for_concerns(self):
        details=json.dumps({'mode':'single','quantity':1,'approximate_size':'A4',
                            'inspection_report':'none_seen','previous_contents':'No chemical contact known',
                            'condition_policy':'inspection-first-v1','capture_mode':'all-sides-v1'})
        response,classifier=self.upload_single(scan_details=details)
        self.assertEqual(response.status_code,400,response.content)
        self.assertIn('front, back, left, right, top and bottom',response.json()['detail'])
        classifier.assert_not_called()

        names=['back','left','right','top','bottom']
        material={'label':'paper','status':'classified','raw_class':'paper','confidence':.9}
        def assess(_record, _image, **context):
            observations=[{'field':'visible_contamination','value':'suspected mold','certainty':'clear'}] if context['view']=='bottom' else []
            return {'status':'available','validated':True,'observations':observations}

        with patch('predictions.material_classifier.classify_material',return_value=material) as classify_views, patch('upcycling.human_assisted.condition_record',side_effect=assess) as check_views:
            response,_=self.upload_single(scan_details=details,primary_view='front',same_item_confirmed='true',
                view_names=json.dumps(names),view_frames=json.dumps([None]*5),
                additional_views=[self.photo(color) for color in ('blue','red','green','yellow','white')])
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(classify_views.call_count,5)
        self.assertEqual([call.kwargs['view'] for call in check_views.call_args_list],['primary',*names])
        snapshot=PredictionRecord.objects.get().image_quality['result_snapshot']
        self.assertEqual([photo['view'] for photo in snapshot['photos']],['front',*names])
        self.assertEqual(snapshot['classification']['kind'],'hazardous')
        self.assertEqual(snapshot['suggestions']['items'],[])

    def test_recognized_out_of_scope_has_a_distinct_disposal_route(self):
        self.upload_single()
        record=PredictionRecord.objects.get()
        record.model_class='disposable diaper'
        record.decision='unknown_unsupported'
        record.image_quality['material_prediction']={'status':'not_applicable','basis':'Item outside the catalog.'}
        self.assertEqual(classification(record)['kind'],'disposal')
        record.previous_contents='Chemical or cleaning product'
        self.assertEqual(classification(record)['kind'],'hazardous')

    def test_hazardous_and_unsupported_are_separate(self):
        response,_=self.upload_single();record=PredictionRecord.objects.get()
        record.decision='unknown_unsupported';record.model_class='metal can';record.image_quality={};record.save()
        self.assertEqual(classification(record)['kind'],'hazardous')
        record.previous_contents='Chemical or cleaning product';record.save()
        self.assertEqual(classification(record)['kind'],'hazardous')
        snap=freeze(record)
        self.assertEqual(snap['suggestions']['items'],[])

    def test_saved_result_is_private_and_legacy_is_not_recomputed(self):
        response,_=self.upload_single();record=PredictionRecord.objects.get()
        self.assertEqual(self.client.get(f'/api/upcycling/predictions/{record.pk}/result/').status_code,401)
        record.image_quality={};record.save()
        with patch('upcycling.scan_sessions.freeze',side_effect=AssertionError('No backfilling')):
            result=self.client.get(f'/api/upcycling/predictions/{record.pk}/result/',**self.auth)
        self.assertTrue(result.json()['legacy']);self.assertIsNone(result.json()['snapshot'])

    def test_session_metadata_requires_lists_matching_files_and_confirmation(self):
        for fields in ({'view_names':'{}'},{'view_frames':'[null]'},{'primary_view':'front','same_item_confirmed':'false'}):
            with self.subTest(fields=fields):
                response,detect=self.upload_single(**fields)
                self.assertEqual(response.status_code,400,response.content)
                detect.assert_not_called()
        self.assertEqual(ScanScene.objects.count(),0)
