from types import SimpleNamespace
from unittest.mock import patch
from django.test import SimpleTestCase
from .scan_sessions import classification

class ResultPolicyTests(SimpleTestCase):
    def record(self, **changes):
        fields=dict(model_class='cardboard box or cardboard scrap', decision='cardboard', previous_contents='', answers={}, image_quality={}, input_method='camera', confidence=.9, threshold=.7)
        fields.update(changes)
        return SimpleNamespace(**fields)

    @patch('upcycling.assessment.facts_for', return_value={})
    def test_routes(self, facts):
        for name in ('glass bottle or glass jar','metal can','paint can'):
            with self.subTest(name=name):
                self.assertEqual(classification(self.record(model_class=name))['kind'],'hazardous')
        self.assertEqual(classification(self.record())['kind'],'supported')
        self.assertEqual(classification(self.record(confidence=.7))['kind'],'supported')
        self.assertEqual(classification(self.record(confidence=.699))['kind'],'unsupported')
        self.assertEqual(classification(self.record(confidence=.5))['kind'],'unsupported')
        self.assertEqual(classification(self.record(decision='unknown_unsupported'))['kind'],'unsupported')
        self.assertEqual(classification(self.record(image_quality={'material_prediction':{'status':'conflicting_evidence','raw_class':'cardboard'}}))['kind'],'unsupported')
        self.assertEqual(classification(self.record(answers={'contamination':'Chemical contamination'}))['kind'],'hazardous')
        self.assertEqual(classification(self.record(previous_contents='Chemical or cleaning product'))['kind'],'hazardous')
