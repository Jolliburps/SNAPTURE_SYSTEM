"""Generate a small acquisition report from actual local manifests (no photos)."""
from collections import Counter
import json
from pathlib import Path
import time

from acquire_public_datasets import ROOT, SOURCES, save_json


def build_report():
    rows=[]
    for name,source in SOURCES.items():
        folder=ROOT/name
        status_file=folder/'acquisition.json'
        state=json.loads(status_file.read_text(encoding='utf-8')) if status_file.exists() else {}
        row={'dataset':name,'source':source['page'],'license':source['license'],
             'annotation':source['annotation'],'status':state.get('status','queued'),
             'used_for_training':False,'classes':source['labels']}
        partial=folder/(source['filename']+'.part')
        if partial.exists():row['partial_download_bytes']=partial.stat().st_size
        if state.get('status')=='downloaded_unreviewed':
            for key in ('image_files','archive_bytes','archive_sha256','exact_duplicate_extra_files','unreadable_images'):
                row[key]=state.get(key)
            inventory_file=folder/'image_inventory.json'
            if inventory_file.exists():
                data=json.loads(inventory_file.read_text(encoding='utf-8'))
                row['image_folder_counts']=dict(Counter(Path(image['path']).parent.as_posix() for image in data['images']))
        if state.get('error'):row['error']=state['error']
        rows.append(row)
    return {'generated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
            'datasets':rows,'verified_image_files_total':sum(r.get('image_files',0) for r in rows),
            'note':'Files are not unique physical objects or approved training samples. No training or inference change performed.'}


if __name__=='__main__':
    report=build_report()
    target=Path(__file__).resolve().parents[2]/'research'/'public_dataset_acquisition_status.json'
    save_json(target,report)
    for row in report['datasets']:
        print(row['dataset'],row['status'],row.get('image_files',''),row.get('partial_download_bytes',''))
    print('Verified image files:',report['verified_image_files_total'])
