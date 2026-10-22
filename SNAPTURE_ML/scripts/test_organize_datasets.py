import tempfile
import unittest
from pathlib import Path
from PIL import Image

from organize_waste_datasets import inspect, mapped_label, create_view, conflicts


def row(path,label='classification/paper'):
    return {'source':'test','source_path':str(path),'source_relative':path.name,'destination':label,
            'license':'test fixture','source_split':'train','source_group':'unassigned'}


class OrganizeDatasetTests(unittest.TestCase):
    def test_general_plastic_is_never_mapped_to_pet_or_hdpe(self):
        self.assertEqual(mapped_label('trashnet','plastic/a.jpg'),'broad_materials/plastic_unspecified')
        self.assertEqual(mapped_label('realwaste','RealWaste/Plastic/a.jpg'),'broad_materials/plastic_unspecified')
        self.assertEqual(mapped_label('kaggle_drinking','Images_of_Waste/rawimgs/HDPEM/a.jpg'),'classification/hdpe_containers')
        self.assertEqual(mapped_label('kaggle_organic','DATASET/TEST/R/a.jpg'),'auxiliary_labels/publisher_recyclable')
        self.assertTrue(conflicts([{'destination':'auxiliary_labels/publisher_organic'},{'destination':'auxiliary_labels/publisher_recyclable'}]))
        self.assertFalse(conflicts([{'destination':'classification/pete_bottles'},{'destination':'broad_materials/plastic_unspecified'}]))
        self.assertEqual(mapped_label('mmorwad_rgb','example.png',{'material':None}),'needs_label_review/mmorwad_rgb')
        self.assertEqual(mapped_label('mmorwad_rgb','example.png',{'material':'Polyethylene Terephthalate (PET)'}),'classification/pete_bottles')

    def test_different_encodings_of_identical_pixels_are_deduplicated_recoverably(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)
            Image.new('RGB',(20,20),'green').save(base/'a.png')
            Image.open(base/'a.png').save(base/'b.bmp')
            rows=[inspect(row(base/'a.png')),inspect(row(base/'b.bmp'))]
            self.assertNotEqual(rows[0]['encoded_sha256'],rows[1]['encoded_sha256'])
            self.assertEqual(rows[0]['pixel_sha256'],rows[1]['pixel_sha256'])
            summary=create_view(rows,base/'organized')
            self.assertEqual(summary['duplicate_files_excluded_from_view'],1)
            self.assertEqual(summary['unique_pixel_groups'],1)
            self.assertTrue((base/'a.png').exists() and (base/'b.bmp').exists())
            self.assertEqual(summary['original_files_deleted'],0)

    def test_same_looking_but_different_pixels_are_not_deleted(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder)
            for name,color in [('a','green'),('b','blue')]:Image.new('RGB',(20,20),color).save(base/(name+'.png'))
            summary=create_view([inspect(row(base/'a.png')),inspect(row(base/'b.png'))],base/'out')
            self.assertEqual(summary['unique_pixel_groups'],2)
            self.assertEqual(summary['duplicate_files_excluded_from_view'],0)

    def test_conflicting_target_labels_are_held_not_silently_relabelled(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);p=base/'a.png';Image.new('RGB',(20,20),'green').save(p)
            rows=[inspect(row(p,'classification/pete_bottles')),inspect(row(p,'classification/hdpe_containers'))]
            self.assertTrue(conflicts(rows))
            summary=create_view(rows,base/'out')
            self.assertEqual(summary['conflicting_label_groups'],1)
            self.assertIn('needs_label_review/conflicting_targets',summary['folder_counts'])

    def test_annotations_and_source_splits_survive_duplicate_removal(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);p=base/'a.png';Image.new('RGB',(20,20),'green').save(p)
            label=base/'a.txt';label.write_text('0 0.5 0.5 0.5 0.5')
            first=inspect({**row(p),'annotation_file':str(label)})
            second={**first,'source_split':'test'}
            summary=create_view([first,second],base/'out')
            import json
            data=json.loads((base/'out/manifest.json').read_text())['records'][0]
            self.assertTrue(data['split_conflict'])
            self.assertFalse(data['training_eligible'])
            self.assertTrue(Path(data['aliases'][0]['staged_annotation_file']).exists())
            self.assertEqual(summary['preserved_annotation_files'],1)

    def test_corrupt_images_are_reported_and_outputs_never_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            base=Path(folder);p=base/'bad.png';p.write_bytes(b'invalid')
            data=inspect(row(p));self.assertIn('error',data)
            summary=create_view([data],base/'out')
            self.assertEqual(summary['invalid_images'],1)
            with self.assertRaises(ValueError):create_view([],base/'out')


if __name__=='__main__':unittest.main()
