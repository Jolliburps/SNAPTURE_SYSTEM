import stat
from io import BytesIO
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
import zipfile

from PIL import Image

from acquire_public_datasets import download, extract, inventory, member_target, SOURCES


class PublicDatasetTests(unittest.TestCase):
    def test_archive_cannot_escape_destination_or_create_symlinks(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            for name in ['../escape.jpg','/absolute.jpg','C:/absolute.jpg','..\\escape.jpg']:
                with self.subTest(name=name), self.assertRaises(ValueError):
                    member_target(root,zipfile.ZipInfo(name))
            entry=zipfile.ZipInfo('link')
            entry.external_attr=(stat.S_IFLNK | 0o777) << 16
            with self.assertRaises(ValueError):member_target(root,entry)

    def test_rgb_subset_preserves_annotations_but_not_hyperspectral_cubes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);archive=root/'source.zip';out=root/'extracted'
            with zipfile.ZipFile(archive,'w') as z:
                z.writestr('data/photo.jpg',b'example')
                z.writestr('data/labels.json',b'{}')
                z.writestr('data/cube.bil',b'spectral data')
            with patch('acquire_public_datasets.RESERVE',0):extract(archive,out,rgb_only=True)
            self.assertTrue((out/'data/photo.jpg').exists())
            self.assertTrue((out/'data/labels.json').exists())
            self.assertFalse((out/'data/cube.bil').exists())

    def test_inventory_finds_corruption_and_duplicates_without_approving_training(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            Image.new('RGB',(20,20),'green').save(root/'a.png')
            (root/'b.png').write_bytes((root/'a.png').read_bytes())
            (root/'bad.jpg').write_bytes(b'not an image')
            result=inventory(root)
            self.assertEqual(result['image_files'],2)
            self.assertEqual(result['exact_duplicate_extra_files'],1)
            self.assertEqual(len(result['unreadable_images']),1)
            self.assertTrue(all(not row['training_eligible'] for row in result['images']))

    def test_rgb_nested_archive_extracted_but_hsi_archive_not_copied(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);inner=BytesIO()
            with zipfile.ZipFile(inner,'w') as z:z.writestr('images/photo.png',b'image bytes')
            archive=root/'outer.zip'
            with zipfile.ZipFile(archive,'w') as z:
                z.writestr('RGB_HDPE_waste.zip',inner.getvalue())
                z.writestr('HSI_HDPE_waste.zip',b'unneeded spectral archive')
            with patch('acquire_public_datasets.RESERVE',0):extract(archive,root/'out',rgb_only=True)
            self.assertTrue((root/'out/RGB_HDPE_waste/images/photo.png').exists())
            self.assertFalse((root/'out/HSI_HDPE_waste.zip').exists())

    def test_all_sources_are_https_and_do_not_change_model_configuration(self):
        self.assertTrue(all(source.get('url', source['page']).startswith('https://') for source in SOURCES.values()))
        self.assertTrue(all(source['provider']=='mendeley' and source['dataset_id'] and source['version'] for source in SOURCES.values() if 'url' not in source))
        self.assertIn('RESEARCH_ONLY',SOURCES['zerowaste']['license'])

    def test_unsatisfiable_resume_restarts_only_temporary_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'data.json'
            path.with_suffix('.json.part').write_bytes(b'old partial')
            first=MagicMock(status_code=416)
            first.__enter__.return_value=first
            second=MagicMock(status_code=200,url='https://example.org/data.json')
            second.__enter__.return_value=second
            second.headers={'Content-Length':'2'}
            second.iter_content.return_value=[b'{}']
            with patch('acquire_public_datasets.requests.get',side_effect=[first,second]) as get, patch('acquire_public_datasets.RESERVE',0):
                download('https://example.org/data.json',path)
            self.assertEqual(path.read_bytes(),b'{}')
            self.assertEqual(get.call_args.kwargs['headers']['Accept-Encoding'],'identity')


if __name__=='__main__':unittest.main()
