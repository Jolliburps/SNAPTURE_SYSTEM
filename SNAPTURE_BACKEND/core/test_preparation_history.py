from types import SimpleNamespace
from django.test import SimpleTestCase
from core.preparation_history import preparation_block

class PreparationHistoryTests(SimpleTestCase):
    def item(self,label,cause,condition='Clean and dry'):
        return SimpleNamespace(decision=label,condition=condition,answers={'wetness_cause':cause,'moisture':'Dry'})
    def test_all_categories_retain_exposure_blocks_even_after_drying(self):
        from core.materials import SCOPE_LABELS
        for label in SCOPE_LABELS:
            for cause in ['Oil or grease','Chemical or cleaning product','Floodwater, sewage or animal waste','Not sure']:
                self.assertTrue(preparation_block(self.item(label,cause)))
            self.assertEqual(preparation_block(self.item(label,'Clean water')),'')
    def test_missing_history_requires_followup_for_preparation(self):
        self.assertTrue(preparation_block(self.item('paper',None,'Needs cleaning')))
    def test_food_exposure_uses_material_specific_route(self):
        self.assertTrue(preparation_block(self.item('paper','Food or drink')))
        self.assertEqual(preparation_block(self.item('pete_bottles','Food or drink')),'')
