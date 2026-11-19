from types import SimpleNamespace
from django.test import SimpleTestCase
from core.project_suitability import fit, RULES, number
class SuitabilityTests(SimpleTestCase):
    def record(self, **overrides):
        fields=dict(decision='paper',quantity=2,condition='Clean and dry',answers={'usable_width_cm':'21','usable_height_cm':'29.7','usable_form':'Intact'})
        fields.update(overrides)
        return SimpleNamespace(**fields)
    def test_paper_count_size_and_condition_independently_gate(self):
        self.assertTrue(fit(self.record(),{'id':'paper_organizer'})[0])
        for change in [dict(quantity=1),dict(condition='Needs cleaning'),dict(answers={'usable_width_cm':'5','usable_height_cm':'5','usable_form':'Intact'}),dict(answers={})]:
            self.assertFalse(fit(self.record(**change),{'id':'paper_organizer'})[0])
    def test_small_pieces_fit_collage_not_whole_sheet_projects(self):
        record=self.record(quantity=1,answers={'usable_width_cm':'3','usable_height_cm':'3','usable_form':'Usable pieces'})
        self.assertTrue(fit(record,{'id':'paper_craft'})[0])
        self.assertFalse(fit(record,{'id':'paper_gift_wrap'})[0])
    def test_containers_capacity_count_and_intact_shape(self):
        record=self.record(decision='pete_bottles',quantity=2,answers={'usable_capacity_ml':'500','usable_form':'Intact'})
        self.assertTrue(fit(record,{'id':'pete_planter'})[0])
        self.assertFalse(fit(record,{'id':'pete_seed_set'})[0])
        record.answers['usable_form']='Usable pieces'
        self.assertFalse(fit(record,{'id':'pete_planter'})[0])
    def test_every_defined_project_has_a_satisfiable_rule(self):
        for id,(count,w,h) in RULES.items():
            record=self.record(decision='hdpe_containers' if id.startswith('hdpe') else 'pete_bottles' if id.startswith('pete') else 'paper',quantity=count,answers={'usable_width_cm':str(w),'usable_height_cm':str(h or 1),'usable_capacity_ml':str(w),'usable_form':'Intact'})
            self.assertTrue(fit(record,{'id':id})[0],id)
    def test_invalid_numbers_and_undefined_projects_are_rejected(self):
        for value in ['NaN','Infinity','-2','0','abc']: self.assertIsNone(number(value))
        self.assertFalse(fit(self.record(),{'id':'wood_shelf'})[0])
