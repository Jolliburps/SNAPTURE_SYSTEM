"""Reclaim duplicate byte storage without breaking source/annotation paths.

Only exact encoded-byte matches are coalesced as NTFS hardlinks. Similar photos,
different encodings, archives and annotations are not deleted. Never edit linked
images in place: write transformed images to a new file.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import shutil
import time
from uuid import uuid4

EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'}


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def compact(root, apply=False, workers=4):
    root = root.resolve(strict=True)
    if root.parent == root or root.name.lower() != 'data':
        raise ValueError('Choose the explicit ML data directory, not a drive/workspace root.')
    before = shutil.disk_usage(root).free
    sizes = defaultdict(list)
    for path in root.rglob('*'):
        if path.suffix.lower() not in EXTENSIONS or not path.is_file(): continue
        if path.is_symlink() or not path.resolve().is_relative_to(root):
            raise ValueError('Image path escapes the data directory.')
        sizes[path.stat().st_size].append(path)
    changes, saved, hashed = [], 0, 0
    for size, paths in sizes.items():
        if len(paths) < 2: continue
        # An existing hardlink group needs one hash, not one hash per pathname.
        inodes = {}
        for path in paths:
            stat = path.stat()
            inodes.setdefault((stat.st_dev, stat.st_ino), []).append(path)
        if len(inodes) < 2: continue
        representatives = [group[0] for group in inodes.values()]
        with ThreadPoolExecutor(max_workers=workers) as pool:
            signatures = list(pool.map(digest, representatives))
        hashed += len(representatives)
        canonical = {}
        for representative, signature in zip(representatives, signatures):
            stat = representative.stat(); inode = (stat.st_dev, stat.st_ino)
            if signature not in canonical:
                canonical[signature] = representative
                continue
            keeper = canonical[signature]
            for duplicate in inodes[inode]:
                if not duplicate.resolve().is_relative_to(root) or duplicate.is_symlink():
                    raise ValueError('Refusing an unsafe replacement target.')
                row = {'path': str(duplicate), 'kept_bytes_at': str(keeper), 'sha256': signature, 'size': size}
                if apply:
                    # Recheck both files immediately before an atomic replacement.
                    if digest(duplicate) != signature or digest(keeper) != signature:
                        raise ValueError('An image changed during compaction; stopping.')
                    old = duplicate.stat()
                    temporary = duplicate.with_name('.dedup-' + uuid4().hex + duplicate.suffix)
                    try:
                        os.link(keeper, temporary)
                        os.replace(temporary, duplicate)
                    finally:
                        if temporary.exists(): temporary.unlink()
                    if old.st_nlink == 1: saved += size
                changes.append(row)
    return {'applied': apply, 'image_paths': sum(map(len, sizes.values())), 'hashed_physical_files': hashed,
            'duplicate_paths_coalesced': len(changes), 'estimated_reclaimed_bytes': saved,
            'free_bytes_before': before, 'free_bytes_after': shutil.disk_usage(root).free,
            'records': changes, 'method': 'exact SHA256 byte matches replaced atomically by hardlinks; paths preserved'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, default=Path(__file__).resolve().parents[1] / 'data')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    report = compact(args.data, args.apply)
    output = args.data / ('storage_compaction_' + time.strftime('%Y%m%dT%H%M%SZ', time.gmtime()) + '.json')
    output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({key:value for key,value in report.items() if key != 'records'}))
    print('Report:', output)
