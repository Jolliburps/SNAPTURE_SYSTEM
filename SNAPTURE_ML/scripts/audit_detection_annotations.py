"""Read every new annotation; validate structure/geometry, never infer new labels.

This is not a visual annotation-accuracy assessment. Video splits and object
identity still need leakage review before training.
"""
from collections import Counter
import json
import math
from pathlib import Path

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
    return {'file':str(path),'format':'COCO','images':len(images),'boxes':sum(counts.values()),
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


if __name__=='__main__':
    result={'indoor_waste':audit_labelme(ROOT/'indoor_waste'/'extracted')}
    for name in ('wasteinsight','packwise','zerowaste'):
        result[name]=[audit_coco(path) for path in sorted((ROOT/name/'extracted').rglob('*.json'))]
    save_json(ROOT.parent/'detection_annotation_audit.json',{'datasets':result,'visual_review_completed':False,'approved_for_training':False})
    for name,rows in result.items():
        rows=[rows] if isinstance(rows,dict) else rows
        print(name,'images',sum(row['images'] for row in rows),'boxes',sum(row['boxes'] for row in rows),
              'geometry errors',sum(len(row['geometry_errors']) for row in rows),'missing images',sum(len(row.get('missing_images',[])) for row in rows))
