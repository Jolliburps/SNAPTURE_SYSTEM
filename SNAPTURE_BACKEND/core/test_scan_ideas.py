from unittest.mock import patch
from django.contrib.auth.models import User
from django.test import TestCase

from core.assessment import refresh
from core.materials import SCOPE_LABELS
from core.models import Guidance
from core.scan_ideas import scan_ideas
from predictions.models import PredictionRecord
from predictions.views import _serialize


class ScanIdeasTests(TestCase):
    def setUp(self):
        self.user=User.objects.create_user('scan-ideas')

    def record(self, **changes):
        values=dict(user=self.user,model_class='paper',decision='paper',title='Paper',
                    confidence=.95,threshold=.8,model_version='dataset-candidate-unverified-test')
        values.update(dict(quantity=10,condition='Clean and dry',answers={'usable_width_cm':'100','usable_height_cm':'100','usable_capacity_ml':'2000','usable_form':'Intact'}))
        values.update(changes)
        values['answers']={**{'usable_width_cm':'100','usable_height_cm':'100','usable_capacity_ml':'2000','usable_form':'Intact'},**values.get('answers',{})}
        return PredictionRecord.objects.create(**values)

    def test_known_material_immediately_has_steps_with_an_empty_project_database(self):
        record=self.record()
        self.assertEqual(Guidance.objects.count(),0)
        refresh(record)
        result=_serialize(record)
        self.assertEqual(len(result['upcycling_ideas']),3)
        self.assertEqual(result['upcycling_ideas'][0]['id'],'paper_gift_wrap')
        self.assertTrue(all(idea['steps'] and idea['materials'] for idea in result['upcycling_ideas']))
        self.assertEqual(result['recommendation_choices'],[])

    def test_all_seven_recognized_materials_have_catalog_choices(self):
        for label in SCOPE_LABELS:
            with self.subTest(label=label):
                self.assertEqual(len(scan_ideas(self.record(decision=label,model_class=label))),2 if label=='dry_untreated_wood_scraps' else 3)

    def test_unknown_low_confidence_and_reported_hazards_have_no_suggestions(self):
        for changes in ({'decision':'unknown_unsupported'},{'confidence':.2},
                        {'previous_contents':'Chemical or cleaning product'},
                        {'model_class':'mobile phone'}, {'condition':'Moldy or contaminated'},
                        {'answers':{'contamination':'Chemical contamination'}}):
            with self.subTest(changes=changes):
                self.assertEqual(scan_ideas(self.record(**changes)),[])

    def test_user_confirmed_material_can_show_ideas_after_an_uncertain_scan(self):
        record=self.record(confidence=.2,answers={'user_confirmed_material':'paper'})
        self.assertEqual(len(scan_ideas(record)),3)

    def test_saved_ideas_are_read_from_the_snapshot_without_recomputing(self):
        record=self.record();refresh(record);record.save()
        expected=_serialize(record,saved=True)['upcycling_ideas']
        with patch('core.scan_ideas.build_recommendations',side_effect=AssertionError('Do not rewrite saved results')):
            self.assertEqual(_serialize(record,saved=True)['upcycling_ideas'],expected)

    def test_clean_torn_paper_only_offers_scrap_crafts_and_preserves_condition(self):
        record=self.record(condition='Torn or crumpled, clean and dry', previous_contents='No chemical contact known',
                           answers={'user_confirmed_material':'paper','contamination':'None known','moisture':'Dry'})
        refresh(record);record.save();record.refresh_from_db()
        self.assertEqual([idea['id'] for idea in _serialize(record,saved=True)['upcycling_ideas']],['paper_craft'])
        self.assertEqual(record.condition,'Torn or crumpled, clean and dry')

    def test_torn_paper_state_does_not_bypass_other_material_or_contamination_checks(self):
        for changes in ({'decision':'hdpe_containers'}, {'condition':'Damaged or cracked'},
                        {'previous_contents':'Chemical or cleaning product'},
                        {'answers':{'contamination':'Oil or grease','moisture':'Dry'}},
                        {'answers':{'contamination':'None known','moisture':'Wet'}}):
            values=dict(condition='Torn or crumpled, clean and dry',
                        answers={'contamination':'None known','moisture':'Dry'})
            values.update(changes)
            self.assertEqual(scan_ideas(self.record(**values)),[])

    def test_usable_cardboard_and_fabric_scraps_offer_only_piece_projects(self):
        for label, expected in [('cardboard',['cardboard_craft']), ('fabric_scraps',['fabric_cleaning_cloth','fabric_patchwork'])]:
            record=self.record(decision=label, model_class=label, condition='Clean dry usable scraps',
                               answers={'contamination':'None known','moisture':'Dry'})
            self.assertEqual([idea['id'] for idea in scan_ideas(record)],expected)

    def test_preparation_and_unknown_conditions_do_not_offer_projects_early(self):
        for changes in ({'condition':'Needs cleaning'}, {'condition':'Not sure'}, {'answers':{'moisture':'Wet'}}):
            self.assertEqual(scan_ideas(self.record(**changes)),[])

    def test_dried_paper_history_only_offers_piece_crafts(self):
        record=self.record(condition='Clean and dry',answers={'wetness_cause':'Clean water'})
        self.assertEqual([idea['id'] for idea in scan_ideas(record)],['paper_craft'])
        record.answers['wetness_cause']='Floodwater, sewage or animal waste'
        self.assertEqual(scan_ideas(record),[])
