import json
import os
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from compact_dataset_storage import compact
from organize_waste_datasets import create_view, inspect, mapped_label, TARGETS


class DatasetStorageTests(unittest.TestCase):
    def test_exact_duplicates_share_bytes_but_annotation_paths_survive(self):
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)/'data';root.mkdir()
            a,b,c=(root/name for name in ('a.png','b.png','c.png'))
            Image.new('RGB',(10,10),'green').save(a);b.write_bytes(a.read_bytes())
            Image.new('RGB',(10,10),'blue').save(c)
            annotation=root/'b.txt';annotation.write_text('0 .5 .5 .2 .2')
            before=c.read_bytes();report=compact(root,apply=True)
            self.assertEqual(report['duplicate_paths_coalesced'],1)
            self.assertTrue(os.path.samefile(a,b))
            self.assertEqual(c.read_bytes(),before)
            self.assertTrue(annotation.exists())
            self.assertEqual(compact(root,apply=True)['duplicate_paths_coalesced'],0)

    def test_dry_run_and_root_boundary(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError):compact(Path(temporary),True)
            root=Path(temporary)/'data';root.mkdir()
            (root/'a.jpg').write_bytes(b'same');(root/'b.jpg').write_bytes(b'same')
            compact(root,False)
            self.assertFalse(os.path.samefile(root/'a.jpg',root/'b.jpg'))

    def test_all_seven_materials_and_other_object_library_are_distinct(self):
        self.assertEqual(len(TARGETS),7)
        self.assertEqual(mapped_label('legacy','coconut_shells/a.jpg'),'classification/coconut_shells')
        self.assertEqual(mapped_label('indoor_waste','shell/a.jpg'),'detection/indoor_waste')
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary);photo=root/'a.png';Image.new('RGB',(10,10),'green').save(photo)
            row=inspect({'source':'fixture','source_path':str(photo),'source_relative':'a.png',
                'source_split':'train','source_group':'fixture','destination':'detection/fixture'})
            create_view([row],root/'review',friendly=True)
            self.assertTrue(all((root/'review'/label).is_dir() for label in TARGETS))
            manifest=json.loads((root/'review/manifest.json').read_text())
            self.assertIn('Object detection datas',manifest['records'][0]['path'])
            self.assertFalse(manifest['training_ready'])


if __name__=='__main__':unittest.main()
