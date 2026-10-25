"""Remove one redundant downloaded ZIP only after every extracted byte checks.

This does not remove photos, labels, manifests or unique content. The retained
source URL allows the cache ZIP to be downloaded again.
"""
import argparse
import json
from pathlib import Path
import time
import zipfile
import zlib
from acquire_public_datasets import ROOT, member_target, save_json


def prune(name):
    folder = (ROOT / name).resolve(strict=True)
    if folder.parent != ROOT.resolve(): raise ValueError('Choose a direct public source directory.')
    state = json.loads((folder / 'acquisition.json').read_text(encoding='utf-8'))
    if state['status'] != 'downloaded_unreviewed' or not state.get('url'):
        raise ValueError('Only a complete, redownloadable source may be pruned.')
    archive = (folder / state['filename']).resolve(strict=True)
    if archive.parent != folder or archive.suffix != '.zip': raise ValueError('Unsafe archive path.')
    count = 0
    with zipfile.ZipFile(archive) as package:
        for info in package.infolist():
            if info.is_dir(): continue
            target = member_target(folder / 'extracted', info)
            if target.is_symlink() or not target.is_file() or target.stat().st_size != info.file_size:
                raise ValueError(f'Extraction incomplete: {info.filename}')
            crc = 0
            with target.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024**2), b''): crc = zlib.crc32(chunk, crc)
            if crc != info.CRC: raise ValueError(f'CRC mismatch: {info.filename}')
            count += 1
            if count % 1000 == 0: print('Verified extracted files:', count, flush=True)
    size = archive.stat().st_size
    state['archive_cache_removed'] = {'bytes':size,'extracted_files_crc_verified':count,'utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    save_json(folder / 'acquisition.json', state)
    archive.unlink()
    print(json.dumps({'removed_redundant_zip':str(archive),'bytes_reclaimed':size,'extracted_files_kept':count}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('dataset'); prune(parser.parse_args().dataset)
