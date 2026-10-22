"""Acquire official, isolated research sources; does NOT train or change inference.

Run with --datasets realwaste realdirt zerowaste. Downloads are resumable and
checked before safe ZIP extraction. Source labels never become local bin rules.
"""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import stat
import time
import zipfile

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'data' / 'public_sources'
RESERVE = 12 * 1024**3
MAX_FILE = 9 * 1024**3
SOURCES = {
    'kaggle_drinking': {
        'page':'https://www.kaggle.com/datasets/arkadiyhacks/drinking-waste-classification',
        'metadata':'https://www.kaggle.com/api/v1/datasets/view/arkadiyhacks/drinking-waste-classification',
        'url':'https://www.kaggle.com/api/v1/datasets/download/arkadiyhacks/drinking-waste-classification?datasetVersionNumber=2',
        'filename':'drinking-waste-v2.zip','license':'CC0 on Kaggle; incorporates TrashNet material: retain original MIT notices and attribution',
        'expected_metadata_license':'CC0: Public Domain','version':2,
        'labels':['Aluminium cans','Glass bottles','PET bottles','HDPE milk bottles'],
        'annotation':'Classification raw images and YOLO image/label pairs; inspect source class IDs',
        'use':'Inspect both subsets for duplicates and preserve bounding-box labels. Public metadata and images downloaded anonymously; no credentials or competition agreements.',
    },
    'kaggle_organic': {
        'page':'https://www.kaggle.com/datasets/techsash/waste-classification-data',
        'metadata':'https://www.kaggle.com/api/v1/datasets/view/techsash/waste-classification-data',
        'url':'https://www.kaggle.com/api/v1/datasets/download/techsash/waste-classification-data?datasetVersionNumber=1',
        'filename':'waste-classification-v1.zip','license':'CC-BY-SA-4.0 per publisher; preserve attribution and share-alike conditions',
        'expected_metadata_license':'CC BY-SA 4.0','version':1,
        'labels':['O (publisher organic label)','R (publisher recyclable label)'],
        'annotation':'image classification; original TRAIN/TEST split must be preserved',
        'use':'Broad auxiliary labels only. Publisher R is not a Bacoor bin rule or a specific material. Publisher O does not establish safe compost inputs.',
    },
    'realwaste': {
        'page': 'https://archive.ics.uci.edu/dataset/908/realwaste',
        'metadata': 'https://archive.ics.uci.edu/api/dataset?id=908',
        'url': 'https://archive.ics.uci.edu/static/public/908/realwaste.zip',
        'filename': 'realwaste.zip', 'license': 'CC-BY-4.0',
        'labels': ['Cardboard','Food Organics','Glass','Metal','Miscellaneous Trash','Paper','Plastic','Textile Trash','Vegetation'],
        'annotation': 'image classification; not object boxes',
        'use': 'Broad material research; plastic is not resin-specific and no label proves contamination or local acceptance.',
    },
    'realdirt': {
        'page': 'https://zenodo.org/records/12517610',
        'metadata': 'https://zenodo.org/api/records/12517610',
        'url': 'https://zenodo.org/api/records/12517610/files/RealDirt.zip/content',
        'filename': 'RealDirt.zip', 'license': 'CC-BY-4.0',
        'md5': 'bd8ddd318398188579dce65ce9adbdd5',
        'labels': ['Plastic bottle','Plastic bag','Carton'],
        'annotation': 'object detection',
        'use': 'Industrial sorting scenes; evaluate domain mismatch and annotation quality before household training.',
    },
    'zerowaste': {
        'page': 'https://github.com/dbash/zerowaste/',
        'metadata': 'https://zenodo.org/api/records/6412647',
        'url': 'https://zenodo.org/api/records/6412647/files/zerowaste-f-final.zip/content',
        'filename': 'zerowaste-f-final.zip',
        'md5': 'e26e31a58080bca6782dca0e56074c5d',
        'license': 'RESEARCH_ONLY_PENDING_LICENSE_CONFLICT: author README CC-BY-NC-4.0; Zenodo metadata CC-BY-4.0',
        'labels': ['cardboard','soft plastic','rigid plastic','metal'],
        'annotation': 'segmentation / instance labels; fully annotated subset only',
        'use': 'Non-commercial research isolation only. Resolve license conflict before deployment or redistribution. No unlabeled or augmented bundles requested.',
    },
    'reclaim_pet': {
        'page':'https://zenodo.org/records/11504415',
        'metadata':'https://zenodo.org/api/records/11504415',
        'url':'https://zenodo.org/api/records/11504415/files/PET_waste.zip/content',
        'filename':'PET_waste.zip','md5':'e5aee9515c2351c52919af365b5a9438',
        'license':'CC-BY-4.0','labels':['PET recyclable waste'],
        'annotation':'Publisher material label; inspect actual per-object annotation availability',
        'use':'Conveyor scenes, not evidence of hidden contents. Extract RGB images and annotation files only, not hyperspectral cubes.',
        'rgb_only':True,
    },
    'reclaim_hdpe': {
        'page':'https://zenodo.org/records/11504453',
        'metadata':'https://zenodo.org/api/records/11504453',
        'url':'https://zenodo.org/api/records/11504453/files/HDPE_waste.zip/content',
        'filename':'HDPE_waste.zip','md5':'523776a3aae2c1329e6848872f602e80',
        'license':'CC-BY-4.0','labels':['HDPE recyclable waste'],
        'annotation':'Publisher material label; inspect actual per-object annotation availability',
        'use':'Conveyor scenes, not proof of safe reuse. Extract RGB images and annotation files only, not hyperspectral cubes.',
        'rgb_only':True,
    },
    'mmorwad_rgb': {
        'page':'https://zenodo.org/records/22226868',
        'metadata':'https://zenodo.org/api/records/22226868',
        'url':'https://zenodo.org/api/records/22226868/files/color_img.zip/content',
        'filename':'color_img.zip','md5':'0dd9d57cbcdd9e1fd6a5b43f5d7b8c00',
        'license':'CC-BY-4.0','labels':['See publisher dataset.csv and COCO categories'],
        'annotation':'COCO segmentation/boxes and material/condition attributes; physical-object split metadata',
        'use':'RGB subset only. Preserve physical object groups to prevent leakage. Labels describe this study, not unseen chemical safety or local collection acceptance.',
        'extra_files':['coco_annotations.json','dataset.csv','item_counts.jsonl','sample_splits.csv','object_splits.csv','split_properties.md','split_properties.csv','integrity_report.md'],
    },
    'trashnet': {
        'page':'https://github.com/garythung/trashnet',
        'metadata':'https://huggingface.co/api/datasets/garythung/trashnet',
        'url':'https://huggingface.co/datasets/garythung/trashnet/resolve/94cd17ebfd6702bf62281d3c89f22ff649815b46/dataset-resized.zip',
        'filename':'dataset-resized.zip',
        'sha256':'c060e8abfe5d6de0578ca15be1ed8ad0794a865d333c3473d53d1d9ad6e38b8c',
        'license':'MIT per creator-owned Hugging Face dataset card; preserve citation',
        'labels':['cardboard','glass','metal','paper','plastic','trash'],
        'annotation':'image classification',
        'use':'Baseline only. May duplicate existing legacy data; do not count repeated files as new samples or map plastic to PET/HDPE.',
    },
}


def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + f'.{os.getpid()}.tmp')
    temp.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)


def checksum(path, algorithm='sha256'):
    h = hashlib.new(algorithm)
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def member_target(root, info):
    name = info.filename.replace('\\', '/')
    if PurePosixPath(name).is_absolute() or PureWindowsPath(name).drive or '..' in PurePosixPath(name).parts:
        raise ValueError('Unsafe archive path')
    if stat.S_ISLNK(info.external_attr >> 16):
        raise ValueError('Archive symbolic link is not allowed')
    target = (root / name).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError('Archive escapes target')
    return target


def download(url, path):
    if not url.startswith('https://'):
        raise ValueError('HTTPS required')
    if path.exists():
        return
    partial = path.with_suffix(path.suffix + '.part')
    resume=True
    for attempt in range(4):
        offset = partial.stat().st_size if resume and partial.exists() else 0
        try:
            headers = {'User-Agent': 'SNAPTURE-research-dataset-acquisition/1.0','Accept-Encoding':'identity'}
            if offset:
                headers['Range'] = f'bytes={offset}-'
            with requests.get(url, headers=headers, stream=True, timeout=(30,90)) as response:
                if response.status_code==416 and offset:
                    resume=False
                    continue  # Restart only this temporary download, never source/user files.
                response.raise_for_status()
                if not response.url.startswith('https://'):
                    raise ValueError('Insecure download redirect')
                if offset and response.status_code == 206:
                    if not response.headers.get('Content-Range','').startswith(f'bytes {offset}-'):
                        raise ValueError('Invalid resume range')
                    mode = 'ab'
                else:
                    offset = 0
                    mode = 'wb'
                compressed=response.headers.get('Content-Encoding','identity').lower() not in {'','identity'}
                if compressed and offset:
                    resume=False
                    continue
                size = 0 if compressed else int(response.headers.get('Content-Length',0)) + offset
                if size > MAX_FILE:
                    raise ValueError('Archive exceeds size budget')
                if size and shutil.disk_usage(path.parent).free - (size-offset) < RESERVE:
                    raise OSError('Insufficient free disk space for reserve')
                received = offset
                last = time.monotonic()
                with partial.open(mode) as stream:
                    for chunk in response.iter_content(1024*1024):
                        if not chunk:
                            continue
                        if received + len(chunk) > MAX_FILE or shutil.disk_usage(path.parent).free < RESERVE + len(chunk):
                            raise OSError('Download stopped to preserve disk space')
                        stream.write(chunk)
                        received += len(chunk)
                        if time.monotonic()-last > 10:
                            print(f'{path.name}: {received/1024**2:.1f} MiB downloaded',flush=True)
                            last = time.monotonic()
                if size and received != size:
                    raise ValueError('Incomplete response body')
            partial.replace(path)
            return
        except (requests.RequestException, ValueError) as error:
            print(f'{path.name}: attempt {attempt+1}: {error}',flush=True)
            if attempt == 3:
                raise


def extract(archive, destination, rgb_only=False, depth=0):
    if depth>2:
        raise ValueError('Nested archive depth exceeded')
    with zipfile.ZipFile(archive) as package:
        members = [(info,member_target(destination,info)) for info in package.infolist()]
        if rgb_only:
            allowed={'.jpg','.jpeg','.png','.bmp','.webp','.json','.csv','.txt','.xml','.yaml','.yml','.md'}
            members=[(info,target) for info,target in members if info.is_dir() or target.suffix.lower() in allowed
                     or target.suffix.lower()=='.zip' and ('rgb' in target.stem.lower() or 'color' in target.stem.lower())]
        required = sum(info.file_size for info,target in members if not info.is_dir() and not target.exists())
        if shutil.disk_usage(archive.parent).free - required < RESERVE:
            raise OSError(f'Extraction needs {required/1024**3:.2f} GiB; disk reserve would be exceeded')
        for info,target in members:
            if info.is_dir():
                target.mkdir(parents=True,exist_ok=True)
                continue
            if target.exists() and target.stat().st_size == info.file_size:
                continue
            target.parent.mkdir(parents=True,exist_ok=True)
            temporary = target.with_name(target.name+'.extracting')
            with package.open(info) as source, temporary.open('wb') as output:
                shutil.copyfileobj(source,output)
            temporary.replace(target)
    if rgb_only:
        for info,target in members:
            if target.suffix.lower()=='.zip' and target.is_file():
                extract(target,target.parent/target.stem,rgb_only=True,depth=depth+1)


def inventory(root):
    images, failures = [], []
    for path in sorted(root.rglob('*')):
        if path.suffix.lower() not in {'.jpg','.jpeg','.png','.bmp','.webp','.tif','.tiff'}:
            continue
        try:
            with Image.open(path) as image:
                width,height=image.size
                image.verify()
            images.append({'path':path.relative_to(root).as_posix(),'bytes':path.stat().st_size,
                           'width':width,'height':height,'sha256':checksum(path),
                           'review_status':'unreviewed','training_eligible':False})
        except Exception as error:
            failures.append({'path':str(path.relative_to(root)),'error':str(error)[:160]})
    hashes=Counter(image['sha256'] for image in images)
    return {'image_files':len(images),'unreadable_images':failures,
            'exact_duplicate_extra_files':sum(n-1 for n in hashes.values()),
            'images':images}


def acquire(name):
    source=SOURCES[name]
    root=ROOT/name
    root.mkdir(parents=True,exist_ok=True)
    state={'dataset':name,**source,'retrieved_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
           'status':'downloading','used_for_training':False,'published_to_github':False}
    save_json(root/'acquisition.json',state)
    try:
        metadata=None
        for filename,url in [('publisher_metadata.json',source.get('metadata')),
                             ('publisher_README.txt','https://raw.githubusercontent.com/dbash/zerowaste/main/README.md' if name=='zerowaste' else None)]:
            if url:
                response=requests.get(url,timeout=45)
                response.raise_for_status()
                (root/filename).write_bytes(response.content)
                if filename=='publisher_metadata.json':
                    metadata=response.json()
                    if source.get('expected_metadata_license') and metadata.get('licenseName')!=source['expected_metadata_license']:
                        raise ValueError('Publisher license changed; hold before image download')
                    if source.get('version') and metadata.get('currentVersionNumber')!=source['version']:
                        raise ValueError('Publisher version changed; inspect the pinned release first')
        for filename in source.get('extra_files',[]):
            entry=next(row for row in metadata['files'] if row['key']==filename)
            extra=root/filename
            download(entry['links']['self'],extra)
            algorithm,expected=entry['checksum'].split(':',1)
            if checksum(extra,algorithm)!=expected:
                raise ValueError(f'Publisher checksum mismatch: {filename}')
        archive=root/source['filename']
        download(source['url'],archive)
        if source.get('md5') and checksum(archive,'md5') != source['md5']:
            raise ValueError('Publisher MD5 checksum mismatch; archive not extracted')
        state['archive_sha256']=checksum(archive)
        if source.get('sha256') and state['archive_sha256'] != source['sha256']:
            raise ValueError('Publisher SHA256 mismatch; archive not extracted')
        state['archive_bytes']=archive.stat().st_size
        extract(archive,root/'extracted',source.get('rgb_only',False))
        result=inventory(root/'extracted')
        if not result['image_files']:
            raise ValueError('No readable image files extracted; inspect archive layout')
        save_json(root/'image_inventory.json',result)
        state.update({key:value for key,value in result.items() if key!='images'})
        state['status']='downloaded_unreviewed'
        print(f'{name}: verified archive; {result["image_files"]} readable image files; {result["exact_duplicate_extra_files"]} extra exact duplicates (preserved)',flush=True)
    except Exception as error:
        state['status']='incomplete'
        state['error']=str(error)
        print(f'{name}: INCOMPLETE: {error}',flush=True)
    save_json(root/'acquisition.json',state)
    return state


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--datasets',nargs='+',choices=list(SOURCES),default=['realwaste','realdirt'])
    args=parser.parse_args()
    results=[]
    for name in args.datasets:
        results.append(acquire(name))
        from report_public_datasets import build_report
        save_json(Path(__file__).resolve().parents[2]/'research'/'public_dataset_acquisition_status.json',build_report())
    save_json(ROOT/'last_run.json',results)
    raise SystemExit(0 if all(r['status']=='downloaded_unreviewed' for r in results) else 1)
