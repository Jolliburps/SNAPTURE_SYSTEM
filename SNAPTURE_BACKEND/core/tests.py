from django.test import TestCase

from .materials import public_materials


class MaterialGuideTests(TestCase):
    def test_public_materials_expose_all_thesis_categories_and_guidance(self):
        materials = public_materials()
        self.assertEqual(len(materials), 7)
        self.assertTrue(all(item["examples"] is not None for item in materials))
        self.assertTrue(all("upcycling" in item for item in materials))
