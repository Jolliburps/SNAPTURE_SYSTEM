"""Build an isolated, recoverable, deduplicated review collection; never trains.

Original images and their annotation-relative paths are left untouched. Exactly
one representative per decoded-pixel group enters the organized collection.
Aliases/duplicate exclusions retain all source, label and annotation references.
Similar-looking photos are flagged for review, not deleted automatically.
"""
import argparse
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
import csv
import hashlib
import json
import os
from pathlib import Path
import shutil
import time
from threading import Lock

from PIL import Image, ImageOps, UnidentifiedImageError

from acquire_public_datasets import ROOT, SOURCES, save_json

DATA=ROOT.parent
TARGETS={'pete_bottles','hdpe_containers','cardboard','paper','fabric_scraps','dry_untreated_wood_scraps','coconut_shells'}
EXTENSIONS={'.jpg','.jpeg','.png','.bmp','.webp','.tif','.tiff'}
BROAD={'plastic':'plastic_unspecified','glass':'glass','metal':'metal','trash':'mixed_trash',
       'miscellaneous trash':'mixed_trash',
       'food organics':'food_organics','vegetation':'vegetation','textile trash':'textile_trash'}
CACHE={}
CACHE_LOCK=Lock()


def mapped_label(source, relative, metadata=None):
    parts=relative.replace('\\','/').split('/')
    lower=[part.lower() for part in parts]
    if source=='legacy':
        return ('classification/'+parts[0]) if parts[0] in TARGETS else 'excluded_scope/coconut_shells'
    if source=='realdirt':return 'detection/realdirt'
    if source in {'indoor_waste','wasteinsight','packwise'}:return 'detection/'+source
    if source=='zerowaste':return 'detection/zerowaste'
    if source in {'reclaim_pet','reclaim_hdpe'}:
        return 'classification/'+('pete_bottles' if source=='reclaim_pet' else 'hdpe_containers')
    if source=='kaggle_drinking':
        if 'yolo_imgs' in lower:return 'detection/kaggle_drinking'
        for key,label in [('pet','pete_bottles'),('hdpem','hdpe_containers'),('glass','glass'),('alucan','metal')]:
            if key in lower:return ('classification/' if label in TARGETS else 'broad_materials/')+label
        return 'needs_label_review/kaggle_drinking'
    if source=='kaggle_organic':
        if 'o' in lower:return 'auxiliary_labels/publisher_organic'
        if 'r' in lower:return 'auxiliary_labels/publisher_recyclable'
        return 'needs_label_review/kaggle_organic'
    if source=='mmorwad_rgb' and metadata:
        material=metadata.get('material') or ''
        if not material:return 'needs_label_review/mmorwad_rgb'
        labels={'Polyethylene Terephthalate (PET)':'classification/pete_bottles',
                'High Density Polyethylene (HDPE)':'classification/hdpe_containers',
                'Cardboard (PAP)':'classification/cardboard','Paper (PAP)':'classification/paper'}
        return labels.get(material,'broad_materials/'+''.join(c.lower() if c.isalnum() else '_' for c in material).strip('_'))
    if source in {'realwaste','trashnet'}:
        for part in reversed(lower[:-1]):
            if part in {'paper','cardboard'}:return 'classification/'+part
            if part in BROAD:return 'broad_materials/'+BROAD[part]
    return 'needs_label_review/'+source


def discover():
    records=[];skipped=[]
    for label in sorted(TARGETS|{'coconut_shells'}):
        for path in sorted((DATA/label).rglob('*')):
            if path.is_file() and path.suffix.lower() in EXTENSIONS:
                records.append({'source':'legacy','source_path':str(path.resolve()),'source_relative':path.relative_to(DATA).as_posix(),
                                'destination':mapped_label('legacy',path.relative_to(DATA).as_posix()),
                                'license':'User source manifest/permissions require review','source_split':'unassigned','source_group':'unassigned'})
    for name in SOURCES:
        folder=ROOT/name;state=folder/'acquisition.json'
        if not state.exists():continue
        status=json.loads(state.read_text(encoding='utf-8')).get('status')
        if status!='downloaded_unreviewed':
            skipped.append({'source':name,'reason':status+'; not a complete extracted source'})
            continue
        inventory_file=folder/'image_inventory.json'
        if not inventory_file.exists():
            skipped.append({'source':name,'reason':'Missing verified inventory'});continue
        details={}
        if name=='packwise':
            for annotation_file in sorted((folder/'extracted'/'data').glob('*.json')):
                coco=json.loads(annotation_file.read_text(encoding='utf-8'))
                for image in coco['images']:
                    details[Path(image['file_name']).name]={'image_id':image['id'],
                        'annotation_file':str(annotation_file.resolve()),'source_split':annotation_file.stem,
                        'source_group':Path(image['file_name']).stem}
        if name=='mmorwad_rgb':
            metadata=json.loads((folder/'coco_annotations.json').read_text(encoding='utf-8'))
            categories={c['id']:c for c in metadata['categories']}
            categories_by_image={c['image_id']:c for c in metadata['categories'] if 'image_id' in c}
            annotations={a['image_id']:a for a in metadata['annotations']}
            with (folder/'sample_splits.csv').open(encoding='utf-8-sig') as f:
                splits={int(row['ID']):row for row in csv.DictReader(f)}
            for image in metadata['images']:
                a=annotations.get(image['id'],{});c=categories.get(a.get('category_id'),categories_by_image.get(image['id'],{}))
                details[Path(image['file_name']).name]={'material':c.get('material'),
                    'image_id':image['id'],'annotation_file':str((folder/'coco_annotations.json').resolve()),
                    'source_group':splits.get(image['id'],{}).get('item_name','unassigned'),
                    'source_split':splits.get(image['id'],{}).get('split','unassigned')}
        for entry in json.loads(inventory_file.read_text(encoding='utf-8'))['images']:
            relative=entry['path'];path=folder/'extracted'/relative
            if name=='packwise' and path.name not in details:
                skipped.append({'source':name,'reason':'Publisher illustration, not an annotated dataset photo','path':relative});continue
            # Do not treat segmentation masks/depth images as waste photographs.
            if any(token in part.lower() for part in Path(relative).parts[:-1] for token in ['mask','semantic','depth','label','sem_seg']):
                skipped.append({'source':name,'reason':'Non-photo annotation image','path':relative});continue
            extra=details.get(path.name,{})
            parts=Path(relative).parts
            split=next((p.lower() for p in parts if p.lower() in {'train','test','val','valid','validation','trainset','testset'}),'unassigned')
            row={'source':name,'source_path':str(path.resolve()),'source_relative':relative,
                 'destination':mapped_label(name,relative,extra),'license':SOURCES[name]['license'],
                 'source_split':extra.get('source_split',split),'source_group':extra.get('source_group','unassigned'),**extra}
            if name=='indoor_waste':row['source_group']=path.stem.rsplit('_',1)[0]
            if name=='zerowaste':row['source_group']=path.stem.split('_frame_',1)[0]
            sidecar=path.with_suffix('.txt')
            if name=='realdirt':sidecar=path.parent.parent/'labels'/(path.stem+'.txt')
            if name=='indoor_waste':sidecar=path.with_suffix('.json')
            if name=='wasteinsight':sidecar=path.parent/'_annotations.coco.json'
            if name=='zerowaste':sidecar=path.parent.parent/'labels.json'
            if sidecar.exists():row['annotation_file']=str(sidecar.resolve())
            records.append(row)
    return records,skipped


def inspect(row):
    path=Path(row['source_path'])
    try:
        with path.open('rb') as stream:encoded=hashlib.file_digest(stream,'sha256').hexdigest()
        with CACHE_LOCK:cached=CACHE.get(encoded)
        if cached is not None:return {**row,**cached,'training_eligible':False,'reviewed':False}
        with Image.open(path) as original:
            if original.width*original.height>25_000_000:raise ValueError('Over 25 megapixels; inspect separately')
            raw_width,raw_height=original.size
            orientation=original.getexif().get(274,1)
            image=ImageOps.exif_transpose(original).convert('RGBA')
            width,height=image.size
            h=hashlib.sha256(f'{width}x{height}:RGBA:'.encode()+image.tobytes()).hexdigest()
            small=image.convert('L').resize((9,8))
            pixels=small.load();visual=0
            for y in range(8):
                for x in range(8):visual=(visual<<1)|int(pixels[x,y]>pixels[x+1,y])
        signature={'encoded_sha256':encoded,'pixel_sha256':h,'width':width,'height':height,
                'raw_width':raw_width,'raw_height':raw_height,'exif_orientation':orientation,
                'visual_fingerprint':f'{visual:016x}'}
        with CACHE_LOCK:CACHE[encoded]=signature
        return {**row,**signature,'training_eligible':False,'reviewed':False}
    except (OSError,ValueError,UnidentifiedImageError,Image.DecompressionBombError) as error:
        return {**row,'error':str(error)[:220],'training_eligible':False}


def conflicts(rows):
    labels={row['destination'].split('/',1)[1] for row in rows if row['destination'].startswith('classification/')}
    # Broad labels and detection scenes are retained as provenance, not forced
    # into a fine material category. Conflicting target labels require review.
    if len(labels)>1:return True
    routes={row['destination'] for row in rows}
    if {'auxiliary_labels/publisher_organic','auxiliary_labels/publisher_recyclable'}.issubset(routes):return True
    families=set()
    for route in routes:
        label=route.split('/',1)[-1]
        if label in {'pete_bottles','hdpe_containers','plastic_unspecified'}:families.add('plastic')
        elif label in {'paper','cardboard','glass','metal'}:families.add(label)
        elif label in {'fabric_scraps','textile_trash'}:families.add('textile')
        elif label in {'food_organics','vegetation','publisher_organic'}:families.add('organic')
        elif label=='dry_untreated_wood_scraps':families.add('wood')
    return len(families)>1


def create_view(rows,output,friendly=False):
    if output.exists():raise ValueError('Use a new run folder; previous outputs are never overwritten')
    output.mkdir(parents=True)
    if friendly:
        for label in sorted(TARGETS): (output/label).mkdir()
        (output/'Object detection datas').mkdir()
    groups=defaultdict(list);errors=[]
    for row in rows:
        if 'error' in row:errors.append(row)
        else:groups[row['pixel_sha256']].append(row)
    manifest=[];duplicates=[];conflict_groups=[];visual=defaultdict(list);methods=Counter();annotation_copies={}
    for digest,group in groups.items():
        group.sort(key=lambda row:(0 if row['source']=='legacy' and row['destination'].startswith('classification/') else
                   1 if row['destination'].startswith('classification/') else 2 if row['destination'].startswith('detection/') else
                   3 if row['destination'].startswith('broad_materials/') else 4,row['source'],row['source_relative']))
        primary=group[0]
        route='needs_label_review/conflicting_targets' if conflicts(group) else primary['destination']
        if conflicts(group):conflict_groups.append({'group':digest,'labels':sorted({r['destination'] for r in group}),'sources':[r['source_relative'] for r in group]})
        directory=(route.split('/',1)[1] if route.startswith('classification/') else 'Object detection datas/'+route) if friendly else route
        destination=output/directory/(digest+Path(primary['source_path']).suffix.lower())
        destination.parent.mkdir(parents=True,exist_ok=True)
        try:
            os.link(primary['source_path'],destination);methods['hardlink']+=1
        except OSError:
            if shutil.disk_usage(output).free<12*1024**3+Path(primary['source_path']).stat().st_size:raise OSError('Disk reserve reached')
            shutil.copy2(primary['source_path'],destination);methods['copy']+=1
        aliases=[]
        for row in group:
            alias={k:v for k,v in row.items() if k not in {'pixel_sha256','encoded_sha256','width','height','visual_fingerprint'}}
            if row.get('annotation_file'):
                original=Path(row['annotation_file'])
                key=(row['source'],str(original))
                if key not in annotation_copies:
                    annotation=output/'source_annotations'/row['source']/(hashlib.sha256(str(original).encode()).hexdigest()[:16]+original.suffix)
                    annotation.parent.mkdir(parents=True,exist_ok=True)
                    try:os.link(original,annotation)
                    except OSError:shutil.copy2(original,annotation)
                    annotation_copies[key]=str(annotation.resolve())
                alias['staged_annotation_file']=annotation_copies[key]
                alias['annotation_transform_required']=(row.get('exif_orientation')!=primary.get('exif_orientation')
                     or (row.get('raw_width'),row.get('raw_height'))!=(primary.get('raw_width'),primary.get('raw_height')))
            alias['encoded_sha256']=row['encoded_sha256'];aliases.append(alias)
        splits={r['source_split'] for r in group if r['source_split']!='unassigned'}
        record={**primary,'path':str(destination.resolve()),'destination':route,'directory':directory,'aliases':aliases,
                'split_conflict':len(splits)>1,'review_status':'label_conflict' if conflicts(group) else 'unreviewed',
                'training_eligible':False,'physical_item_group':'unassigned'}
        manifest.append(record)
        for row in group[1:]:duplicates.append({'source':row['source'],'excluded_from_view':row['source_path'],'kept_image':str(destination.resolve()),'pixel_sha256':digest,
                                              'reason':'identical_encoded_file' if row['encoded_sha256']==primary['encoded_sha256'] else 'identical_oriented_RGBA_pixels',
                                              'source_original_preserved':True})
        visual[(primary['visual_fingerprint'],round(primary['width']/primary['height'],1))].append(digest)
    similar=[{'fingerprint':key[0],'groups':ids,'action':'manual_review_only_not_removed'} for key,ids in visual.items() if len(ids)>1]
    save_json(output/'manifest.json',{'schema_version':1,'training_ready':False,'records':manifest,
              'warning':'Hardlinked review view: do not modify image files in place. Sources remain intact; no training split is assigned.'})
    save_json(output/'duplicate_exclusions.json',duplicates)
    save_json(output/'label_conflicts.json',conflict_groups)
    save_json(output/'visual_similarity_review.json',similar)
    save_json(output/'invalid_images.json',errors)
    counts=Counter(row['destination'] for row in manifest)
    summary={'input_image_files':len(rows),'readable_image_files':len(rows)-len(errors),'unique_pixel_groups':len(groups),
             'duplicate_files_excluded_from_view':len(duplicates),'invalid_images':len(errors),'conflicting_label_groups':len(conflict_groups),
             'possible_visual_similarity_groups':len(similar),'folder_counts':dict(sorted(counts.items())),
             'source_input_counts':dict(Counter(row['source'] for row in rows)),
             'duplicate_exclusions_by_source':dict(Counter(d['source'] for d in duplicates)),
             'split_conflict_groups':sum(row['split_conflict'] for row in manifest),
             'preserved_annotation_files':len(annotation_copies),
             'link_methods':dict(methods),'original_files_deleted':0,'training_performed':False,'training_ready':False}
    save_json(output/'summary.json',summary)
    return summary


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers',type=int,default=4)
    args=parser.parse_args()
    output=DATA/'organized_candidates'/time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
    records,skipped=discover()
    print(f'Auditing {len(records)} photos from completed sources; unfinished downloads excluded.',flush=True)
    checked=[]
    with ThreadPoolExecutor(max_workers=max(1,min(args.workers,4))) as pool:
        for index,row in enumerate(pool.map(inspect,records),1):
            checked.append(row)
            if index%1000==0:print(f'Checked {index}/{len(records)} images',flush=True)
    result=create_view(checked,output)
    save_json(output/'skipped_sources_and_annotations.json',skipped)
    save_json(DATA/'organized_candidates'/'latest.json',{'output':str(output.resolve()),'summary':result})
    save_json(Path(__file__).resolve().parents[2]/'research'/'dataset_audit_summary.json',{
        'run':output.name,'scope':'Completed source photos plus existing material folders; incomplete downloads excluded',**result})
    print(json.dumps({'output':str(output.resolve()),**result},indent=2),flush=True)
