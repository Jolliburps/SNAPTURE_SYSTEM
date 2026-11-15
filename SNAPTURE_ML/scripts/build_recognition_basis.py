"""Seven-material review library plus separately annotated object-detection data.

Reuses verified encoded/pixel signatures from the previous audit, but still hashes
the current encoded file before a cache hit. No model is trained or promoted.
"""
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import time

from acquire_public_datasets import save_json
from organize_waste_datasets import CACHE, DATA, create_view, discover, inspect


def prime_cache(manifest):
    if not manifest.exists(): return 0
    rows=json.loads(manifest.read_text(encoding='utf-8'))['records']
    fields=('pixel_sha256','width','height','raw_width','raw_height','exif_orientation','visual_fingerprint')
    for row in rows:
        for alias in row.get('aliases', [row]):
            if all(key in row for key in fields) and alias.get('encoded_sha256'):
                CACHE[alias['encoded_sha256']]={**{key:row[key] for key in fields},
                    **{key:alias[key] for key in ('raw_width','raw_height','exif_orientation') if key in alias},
                    'encoded_sha256':alias['encoded_sha256']}
    return len(CACHE)


if __name__=='__main__':
    previous=DATA/'organized_candidates'/'20261021T214837Z'/'manifest.json'
    print('Cached signatures:',prime_cache(previous),flush=True)
    records,skipped=discover()
    output=DATA/'recognition_basis'/time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
    checked=[]
    print('Photo paths to inspect:',len(records),flush=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        for index,row in enumerate(pool.map(inspect,records),1):
            checked.append(row)
            if index%2000==0: print(f'Checked {index}/{len(records)}',flush=True)
    result=create_view(checked,output,friendly=True)
    save_json(output/'skipped_sources_and_annotations.json',skipped)
    # Preserve the source trees: COCO filenames, masks and split files still
    # resolve relative to the originals. The renamed review images are NOT a
    # drop-in training dataset; the manifest supplies the mapping.
    source_roots={row['source']:str(Path(row['source_path']).parents[len(Path(row['source_relative']).parts)-1]) for row in records if row['source']!='legacy'}
    save_json(output/'annotation_source_roots.json',source_roots)
    save_json(DATA/'recognition_basis'/'latest.json',{'output':str(output.resolve()),'summary':result})
    save_json(Path(__file__).resolve().parents[2]/'research'/'recognition_basis_summary.json',{'run':output.name,**result})
    print(json.dumps({'output':str(output),**result},indent=2),flush=True)
