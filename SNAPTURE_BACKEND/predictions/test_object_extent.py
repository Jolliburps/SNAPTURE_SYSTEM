from django.test import SimpleTestCase
from PIL import Image,ImageDraw
from .object_extent import refine_sheet
class SheetExtentTests(SimpleTestCase):
    def test_partial_sheet_expands_to_measured_edges(self):
        image=Image.new('RGB',(400,400),'black');ImageDraw.Draw(image).rectangle((80,50,320,350),fill='white')
        row={'material':'paper','detection_status':'accepted','box':[.2,.3,.8,.875]}
        refined=refine_sheet(image,row)
        self.assertLess(refined['box'][1],.16)
        self.assertAlmostEqual(refined['box'][0],.2,delta=.02)
    def test_no_clear_edge_or_other_material_does_not_invent_extent(self):
        row={'material':'paper','detection_status':'accepted','box':[.2,.3,.8,.875]}
        self.assertEqual(refine_sheet(Image.new('RGB',(400,400),'white'),row),row)
        self.assertEqual(refine_sheet(Image.new('RGB',(400,400),'black'),{**row,'material':'fabric_scraps'}),{**row,'material':'fabric_scraps'})
    def test_uncertain_detection_is_not_promoted(self):
        row={'material':'paper','detection_status':'review','box':[.2,.3,.8,.875]}
        self.assertEqual(refine_sheet(Image.new('RGB',(400,400),'white'),row),row)
