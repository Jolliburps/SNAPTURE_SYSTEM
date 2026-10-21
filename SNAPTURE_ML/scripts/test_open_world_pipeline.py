import unittest
from PIL import Image
from open_world_pipeline import proposed_objects

class ProposalContractTests(unittest.TestCase):
    def test_unknown_keeps_its_box_and_actual_candidates(self):
        boxes = [[.1,.1,.5,.5],[.6,.6,.9,.9]]
        result = proposed_objects(Image.new('RGB',(100,100)),lambda _:boxes,lambda _:([('metal',.4),('plastic',.3)],False))
        self.assertEqual([row['box'] for row in result],boxes)
        self.assertTrue(all(row['fine_class'] is None and len(row['top_predictions'])==2 for row in result))

    def test_no_fake_detections_and_ood_rejects_high_score(self):
        image = Image.new('RGB',(100,100))
        self.assertEqual(proposed_objects(image,lambda _:[],lambda _:None),[])
        result = proposed_objects(image,lambda _:[[0,0,1,1]],lambda _:([('paper',.99)],True))
        self.assertIsNone(result[0]['fine_class']); self.assertFalse(result[0]['safety_gate_passed'])

if __name__ == '__main__': unittest.main()
