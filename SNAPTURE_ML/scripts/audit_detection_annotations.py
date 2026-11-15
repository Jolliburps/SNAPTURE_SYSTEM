"""Read every new annotation; validate structure/geometry, never infer new labels.

This is not a visual annotation-accuracy assessment. Video splits and object
identity still need leakage review before training.
"""
from collections import Counter
import json
import math
from pathlib import Path
import re

from acquire_public_datasets import ROOT, save_json


def audit_coco(path):
    data=json.loads(path.read_text(encoding='utf-8'))
    images={row['id']:row for row in data['images']}
    categories={row['id']:row['name'] for row in data['categories']}
    errors=[];counts=Counter();missing=[]
    for image in images.values():
        relative=Path(image['file_name'].replace('\\','/'))
        candidates=[path.parent/relative,path.parent/'data'/relative]
        if not any(candidate.exists() for candidate in candidates):
            # Some publisher COCO files omit the images/ prefix.
            hits=list(path.parent.rglob(relative.name))
            if not hits:missing.append(image['file_name'])
    for row in data['annotations']:
        image=images.get(row.get('image_id'));category=categories.get(row.get('category_id'))
        box=row.get('bbox',[])
        if image is None or category is None or len(box)!=4 or not all(isinstance(v,(int,float)) and math.isfinite(v) for v in box):
            errors.append({'id':row.get('id'),'reason':'invalid image/category/box'});continue
        x,y,w,h=box
        if min(x,y)<-1 or min(w,h)<=0 or x+w>image['width']+1 or y+h>image['height']+1:
            errors.append({'id':row.get('id'),'reason':'box outside image or non-positive'})
        counts[category]+=1
    return {'file':path.relative_to(ROOT.parent).as_posix(),'format':'COCO','images':len(images),'boxes':sum(counts.values()),
            'categories':dict(counts),'missing_images':missing,'geometry_errors':errors}


def audit_labelme(folder):
    counts=Counter();errors=[];files=0
    for path in sorted(folder.glob('*.json')):
        data=json.loads(path.read_text(encoding='utf-8'));files+=1
        if not path.with_suffix('.jpg').exists():errors.append({'file':path.name,'reason':'missing image'})
        for shape in data.get('shapes',[]):
            points=shape.get('points',[])
            if shape.get('shape_type')!='rectangle' or len(points)!=2:
                errors.append({'file':path.name,'reason':'unexpected geometry'});continue
            if any(not math.isfinite(v) for point in points for v in point):
                errors.append({'file':path.name,'reason':'non-finite point'});continue
            xs,ys=zip(*points)
            if min(xs)<-1 or min(ys)<-1 or max(xs)>data['imageWidth']+1 or max(ys)>data['imageHeight']+1 or min(xs)==max(xs) or min(ys)==max(ys):
                errors.append({'file':path.name,'reason':'out-of-bounds/empty rectangle'})
            counts[shape['label']]+=1
    return {'format':'LabelMe rectangles','images':files,'boxes':sum(counts.values()),'categories':dict(counts),'geometry_errors':errors,
            'note':'Publisher shell label is not asserted to be coconut shell. Video sequence identity must be grouped before splitting.'}


def audit_mmorwad(folder):
    data=json.loads((folder/'coco_annotations.json').read_text(encoding='utf-8'))
    images={row['id']:row for row in data.get('images',[])}
    attributes={}
    attribute_errors=[]
    for row in data.get('categories',[]):
        image_id=row.get('image_id')
        if image_id is None or image_id in attributes:
            attribute_errors.append({'image_id':image_id,'reason':'missing or duplicate per-image attributes'})
        else:
            attributes[image_id]=row
    extracted=folder/'extracted'
    photo_files=[p for p in extracted.rglob('*') if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.bmp','.webp','.tif','.tiff'}]
    by_name={}
    by_index={}
    for path in photo_files:
        by_name.setdefault(path.name.casefold(),[]).append(path)
        match=re.match(r'^(\d+ic_)',path.name,re.IGNORECASE)
        if match:by_index.setdefault(match.group(1).casefold(),[]).append(path)
    missing=[];mismatch_candidates=[]
    expected_names=set()
    for image in images.values():
        relative=Path(str(image.get('file_name','')).replace('\\','/'))
        expected_names.add(relative.name.casefold())
        candidates=(extracted/relative,extracted/'color_img'/relative)
        if any(candidate.is_file() for candidate in candidates):continue
        missing.append(image.get('file_name'))
        match=re.match(r'^(\d+ic_)',relative.name,re.IGNORECASE)
        alternatives=by_index.get(match.group(1).casefold(),[]) if match else []
        mismatch_candidates.append({'expected':image.get('file_name'),
            'same_index_candidates':[p.relative_to(extracted).as_posix() for p in alternatives]})
    unreferenced=[p.relative_to(extracted).as_posix() for p in photo_files if p.name.casefold() not in expected_names]
    errors=[];counts=Counter();polygon_errors=[]
    for annotation in data.get('annotations',[]):
        image=images.get(annotation.get('image_id'))
        if image is None:
            errors.append({'id':annotation.get('id'),'reason':'unknown image reference'});continue
        attrs=attributes.get(image['id'])
        if attrs is None:
            attribute_errors.append({'image_id':image['id'],'reason':'missing per-image attributes'})
        else:
            counts[attrs.get('material','unknown')]+=1
        box=annotation.get('bbox',[])
        if len(box)!=4 or not all(isinstance(value,(int,float)) and math.isfinite(value) for value in box):
            errors.append({'id':annotation.get('id'),'reason':'invalid bbox'});continue
        x,y,width,height=box
        if min(x,y)<-1 or min(width,height)<=0 or x+width>image['width']+1 or y+height>image['height']+1:
            errors.append({'id':annotation.get('id'),'reason':'bbox outside image or non-positive'})
        segmentation=annotation.get('segmentation',[])
        if isinstance(segmentation,list):
            for polygon in segmentation:
                if len(polygon)<6 or len(polygon)%2 or not all(isinstance(value,(int,float)) and math.isfinite(value) for value in polygon):
                    polygon_errors.append({'id':annotation.get('id'),'reason':'invalid polygon structure'});continue
                xs=polygon[0::2];ys=polygon[1::2]
                if min(xs)<-1 or min(ys)<-1 or max(xs)>image['width']+1 or max(ys)>image['height']+1:
                    polygon_errors.append({'id':annotation.get('id'),'reason':'polygon outside image'})
    return {'format':'COCO segmentation with per-image attributes','images':len(images),
        'boxes':len(data.get('annotations',[])),'categories':dict(counts),'missing_images':missing,
        'unreferenced_images':unreferenced,'filename_mismatch_candidates':mismatch_candidates,
        'geometry_errors':errors+polygon_errors,'attribute_errors':attribute_errors,
        'note':'The publisher stores material/condition attributes per image, not COCO category_id. Same-index filename candidates are review hints only and are not remapped.'}


def audit_yolo(folder):
    image_exts={'.jpg','.jpeg','.png','.bmp','.webp'}
    images={path.stem.casefold():path for path in folder.rglob('*') if path.is_file() and path.suffix.lower() in image_exts}
    labels=[path for path in folder.rglob('*.txt') if path.is_file()]
    label_stems={path.stem.casefold() for path in labels}
    yaml_files=list(folder.rglob('*.yaml'))
    class_count=None
    if yaml_files:
        text=yaml_files[0].read_text(encoding='utf-8',errors='replace')
        match=re.search(r'(?m)^nc:\s*(\d+)\s*$',text)
        if match:class_count=int(match.group(1))
    errors=[];counts=Counter();boxes=0
    for path in labels:
        if path.stem.casefold() not in images:
            errors.append({'file':path.name,'reason':'missing image'})
        for line_number,line in enumerate(path.read_text(encoding='utf-8',errors='replace').splitlines(),1):
            fields=line.split()
            if not fields:continue
            try:
                values=[float(value) for value in fields]
                class_id=int(values[0])
                valid=(len(values)==5 and values[0].is_integer() and class_id>=0
                    and (class_count is None or class_id<class_count)
                    and all(math.isfinite(value) for value in values)
                    and all(0<=value<=1 for value in values[1:])
                    and values[3]>0 and values[4]>0
                    and values[1]-values[3]/2>=-1e-6 and values[2]-values[4]/2>=-1e-6
                    and values[1]+values[3]/2<=1+1e-6 and values[2]+values[4]/2<=1+1e-6)
                if not valid:
                    errors.append({'file':path.name,'line':line_number,'reason':'invalid YOLO class or normalized box'})
                else:
                    counts[str(class_id)]+=1;boxes+=1
            except (ValueError,OverflowError):
                errors.append({'file':path.name,'line':line_number,'reason':'unparseable YOLO row'})
    missing=[path.name for stem,path in images.items() if stem not in label_stems]
    return {'format':'YOLO normalized boxes','images':len(images),'label_files':len(labels),'boxes':boxes,
        'categories':dict(counts),'missing_images':missing,'labels_without_images':len(label_stems-set(images)),
        'geometry_errors':errors,'class_count':class_count,
        'note':'Publisher class ids are preserved; inspect data.yaml names before any training export.'}


if __name__=='__main__':
    result={'indoor_waste':audit_labelme(ROOT/'indoor_waste'/'extracted')}
    for name in ('wasteinsight','packwise','zerowaste'):
        result[name]=[audit_coco(path) for path in sorted((ROOT/name/'extracted').rglob('*.json'))]
    result['realdirt']=audit_yolo(ROOT/'realdirt'/'extracted')
    result['mmorwad_rgb']=audit_mmorwad(ROOT/'mmorwad_rgb')
    save_json(ROOT.parent/'detection_annotation_audit.json',{'datasets':result,'visual_review_completed':False,'approved_for_training':False})
    for name,rows in result.items():
        rows=[rows] if isinstance(rows,dict) else rows
        print(name,'images',sum(row['images'] for row in rows),'boxes',sum(row['boxes'] for row in rows),
              'geometry errors',sum(len(row['geometry_errors']) for row in rows),'missing images',sum(len(row.get('missing_images',[])) for row in rows))
