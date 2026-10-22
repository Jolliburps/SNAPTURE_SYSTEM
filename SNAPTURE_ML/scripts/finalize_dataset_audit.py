"""Check staged annotation structure and finalize the generated review reports."""
from collections import Counter
import json
import math
from pathlib import Path

from acquire_public_datasets import ROOT, SOURCES, save_json
from organize_waste_datasets import mapped_label


def finalize(output):
    allowed=(ROOT.parent/'organized_candidates').resolve()
    output=output.resolve()
    if not output.is_relative_to(allowed) or output==allowed:
        raise ValueError('Only a generated organized-candidate run may be finalized')
    document=json.loads((output/'manifest.json').read_text(encoding='utf-8'))
    changes={};annotation_checks={};missing=[]
    for row in document['records']:
        # Correct broad source-folder normalization, not an inferred waste bin.
        if row['destination']=='needs_label_review/realwaste':
            route=mapped_label('realwaste',row['source_relative'])
            if route!=row['destination']:
                old=Path(row['path']);new=output/route/old.name
                if not old.resolve().is_relative_to(output) or not new.resolve().is_relative_to(output):raise ValueError('Unsafe generated path')
                if new.exists():raise ValueError('Refusing to overwrite a staged image')
                new.parent.mkdir(parents=True,exist_ok=True)
                old.rename(new)
                changes[str(old)]=str(new)
                row['path']=str(new);row['destination']=route
        for alias in row['aliases']:
            source=alias['source']
            if source not in {'kaggle_drinking','realdirt'}:continue
            if source=='kaggle_drinking' and 'yolo_imgs' not in alias['source_relative'].lower():continue
            original=alias.get('annotation_file')
            if not original:
                missing.append({'source':source,'image':alias['source_relative']})
                alias['annotation_review_status']='missing_label_file'
                continue
            if original not in annotation_checks:
                bad=[];boxes=Counter()
                for n,line in enumerate(Path(original).read_text(encoding='utf-8-sig').splitlines(),1):
                    if not line.strip():continue
                    try:
                        values=line.split();cid=int(values[0]);coords=list(map(float,values[1:]));maximum=4 if source=='kaggle_drinking' else 3
                        assert len(coords)==4 and 0<=cid<maximum and all(math.isfinite(v) and 0<=v<=1 for v in coords) and coords[2]>0 and coords[3]>0
                        boxes[cid]+=1
                    except (ValueError,IndexError,AssertionError):bad.append(n)
                annotation_checks[original]={'source':source,'file':original,'invalid_rows':bad,'valid_boxes_by_source_id':dict(boxes)}
            alias['annotation_review_status']='needs_coordinate_review' if annotation_checks[original]['invalid_rows'] else 'structure_checked_semantics_unreviewed'
    duplicates=json.loads((output/'duplicate_exclusions.json').read_text(encoding='utf-8'))
    for entry in duplicates:entry['kept_image']=changes.get(entry['kept_image'],entry['kept_image'])
    excluded=json.loads((output/'invalid_images.json').read_text(encoding='utf-8'))
    summary=json.loads((output/'summary.json').read_text(encoding='utf-8'))
    summary['folder_counts']=dict(sorted(Counter(row['destination'] for row in document['records']).items()))
    summary['oversize_images_held']=sum('megapixels' in row['error'] for row in excluded)
    summary['missing_detection_labels']=len(missing)
    summary['invalid_annotation_rows']=sum(len(row['invalid_rows']) for row in annotation_checks.values())
    summary['annotation_files_needing_review']=sum(bool(row['invalid_rows']) for row in annotation_checks.values())
    summary['annotation_note']='Structural checks only; class-ID mapping and actual box correctness require review. No labels fabricated or automatically clamped.'
    save_json(output/'manifest.json',document)
    save_json(output/'duplicate_exclusions.json',duplicates)
    save_json(output/'annotation_audit.json',{'missing_label_files':missing,'checks':list(annotation_checks.values())})
    save_json(output/'source_catalogue.json',SOURCES)
    save_json(output/'summary.json',summary)
    save_json(allowed/'latest.json',{'output':str(output),'summary':summary})
    save_json(Path(__file__).resolve().parents[2]/'research'/'dataset_audit_summary.json',{'run':output.name,**summary})
    print(json.dumps(summary,indent=2))


if __name__=='__main__':
    latest=json.loads((ROOT.parent/'organized_candidates/latest.json').read_text(encoding='utf-8'))
    finalize(Path(latest['output']))
