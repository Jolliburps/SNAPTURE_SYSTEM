import json
from django.test import TestCase
from core.assessment import refresh
from .models import PredictionRecord
from .test_scenes import SceneApiTests


class PreparationPersistenceTests(TestCase):
    setUp=SceneApiTests.setUp

    def record(self,label='paper',contents='No chemical contact known'):
        record=PredictionRecord(user=self.user,decision=label,title=label,
            model_class='manual_selection',input_method='manual',confidence=0,
            model_version='manual',condition='Needs cleaning',previous_contents=contents,
            answers={'user_confirmed_material':label,'contamination':'None known','moisture':'Wet'})
        refresh(record);record.save();return record

    def test_preparation_updates_and_reopens_only_its_own_saved_scan(self):
        paper=self.record();fabric=self.record('fabric_scraps')
        response=self.client.patch(f'/api/predictions/{paper.id}/',json.dumps({
            'condition':'Clean and dry','answers':{'contamination':'None known','moisture':'Dry'}}),
            content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        paper.refresh_from_db();fabric.refresh_from_db()
        self.assertEqual((paper.decision,paper.condition,paper.answers['moisture']),('paper','Clean and dry','Dry'))
        self.assertEqual(fabric.condition,'Needs cleaning')
        reopened=self.client.get(f'/api/predictions/{paper.id}/?history=1',**self.auth)
        self.assertEqual(reopened.status_code,200)
        self.assertEqual(reopened.json()['prediction']['condition'],'Clean and dry')
        self.assertEqual(reopened.json()['prediction']['id'],paper.id)

    def test_clean_report_does_not_clear_known_chemical_history(self):
        record=self.record('hdpe_containers','Chemical or cleaning product')
        response=self.client.patch(f'/api/predictions/{record.id}/',json.dumps({
            'condition':'Clean and dry','answers':{'contamination':'None known','moisture':'Dry'}}),
            content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        record.refresh_from_db()
        self.assertEqual(record.previous_contents,'Chemical or cleaning product')
        self.assertEqual(response.json()['prediction']['upcycling_ideas'],[])

    def test_size_and_count_survive_history_and_filter_projects(self):
        record=self.record()
        payload={'quantity':1,'condition':'Clean and dry','answers':{'moisture':'Dry','contamination':'None known','usable_width_cm':'3','usable_height_cm':'3','usable_form':'Usable pieces','wetness_cause':'Clean water'}}
        response=self.client.patch(f'/api/predictions/{record.id}/',json.dumps(payload),content_type='application/json',**self.auth)
        self.assertEqual(response.status_code,200)
        self.assertEqual([idea['id'] for idea in response.json()['prediction']['upcycling_ideas']],['paper_craft'])
        saved=self.client.get(f'/api/predictions/{record.id}/?history=1',**self.auth).json()['prediction']
        self.assertEqual(saved['quantity'],1)
        self.assertEqual(saved['answers']['usable_width_cm'],'3')
        self.assertEqual([idea['id'] for idea in saved['upcycling_ideas']],['paper_craft'])
        bad=self.client.patch(f'/api/predictions/{record.id}/',json.dumps({'answers':{'usable_width_cm':'NaN'}}),content_type='application/json',**self.auth)
        self.assertEqual(bad.status_code,400)
