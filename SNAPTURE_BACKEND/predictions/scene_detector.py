"""Local, optional open-vocabulary detector. No remote inference or download on request."""
from pathlib import Path
from threading import Lock
from django.conf import settings

MODEL_DIR = Path(settings.SNAPTURE_ML_DIR) / 'models' / 'owlvit-base-patch32'
PROMPTS = [
    ('plastic bottle', 'unknown_unsupported'), ('plastic jug or container', 'unknown_unsupported'),
    ('cardboard box or cardboard scrap', 'cardboard'), ('paper scrap', 'paper'),
    ('cloth or fabric scrap', 'fabric_scraps'), ('wood scrap', 'dry_untreated_wood_scraps'),
    ('glass bottle or glass jar', 'unknown_unsupported'), ('metal can', 'unknown_unsupported'),
    ('food scraps or fruit peel', 'unknown_unsupported'), ('dry leaf', 'unknown_unsupported'),
    ('plastic bag or plastic wrapper', 'unknown_unsupported'), ('battery', 'unknown_unsupported'),
    ('plastic sachet', 'unknown_unsupported'), ('disposable diaper', 'unknown_unsupported'),
    ('cigarette butt', 'unknown_unsupported'), ('fluorescent light bulb', 'unknown_unsupported'),
    ('syringe', 'unknown_unsupported'), ('paint can', 'unknown_unsupported'),
    ('electronic waste', 'unknown_unsupported'), ('unfamiliar discarded object', 'unknown_unsupported'),
    ('computer keyboard', None), ('computer monitor', None), ('wristwatch', None),
    ('computer mouse', None), ('laptop computer', None), ('mobile phone', None),
    ('towel', 'fabric_scraps'), ('wallet', 'unknown_unsupported'),
    ('comb', 'unknown_unsupported'), ('coconut shell', 'coconut_shells'),
    ('blanket', 'fabric_scraps'), ('bed sheet', 'fabric_scraps'), ('pillow', 'fabric_scraps'),
    # Contrast queries: these are never waste detections. They reduce forced
    # matches of skin/worn clothes to the waste prompts, not a person guarantee.
    ('person', None), ('human hand', None), ('human foot', None),
    ('human leg', None), ('human arm', None), ('clothing worn by a person', None),
]
HUMAN_NAMES = {'person','human hand','human foot','human leg','human arm','clothing worn by a person'}
BACKGROUND_NAMES = {name for name, material in PROMPTS if material is None}
# Recognizing a belonging does not establish whether it is waste. Keep these
# distinct from material queries when suppressing overlapping proposals.
OBJECT_NAMES = BACKGROUND_NAMES | {'towel', 'blanket', 'bed sheet', 'pillow', 'wallet', 'comb', 'coconut shell'}
DISPLAY_THRESHOLD = .28  # Proposal-score cutoff, not a calibrated accuracy percentage.
MIN_PROPOSAL_SCORE = .1
FILTER_VERSION = 'conservative-object-filter-v3'
TEXTILE_NAMES = {'cloth or fabric scrap','towel','blanket','bed sheet','pillow'}
# Provisional abstention rules, not measured accuracy or a calibrated confidence
# threshold. Exact textile names stay unconfirmed even above these cutoffs.
TEXTILE_REVIEW_BELOW = .45
TEXTILE_MAX_AUTO_AREA = .5
_model = _processor = None
_load_lock = Lock()
inference_lock = Lock()


def available():
    return (MODEL_DIR / 'model.safetensors').is_file() and (MODEL_DIR / 'config.json').is_file()


def iou(a, b):
    overlap = max(0,min(a[2],b[2])-max(a[0],b[0])) * max(0,min(a[3],b[3])-max(a[1],b[1]))
    return overlap / max(1e-9,(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-overlap)


def family(name):
    if name in {'plastic bottle','plastic jug or container'}: return 'plastic-container'
    if name in {'cloth or fabric scrap','towel','blanket','bed sheet'}: return 'textile'
    return name


def conflicting_query(row):
    return any(family(candidate.get('label','')) != family(row['name']) and
               candidate.get('score',0) >= row['score']*.9
               for candidate in row.get('alternatives', []) or [])


def textile_review_reason(row):
    if row['name'] not in TEXTILE_NAMES or row.get('object_confirmed'):
        return ''
    box = row['box']
    area = max(0,box[2]-box[0])*max(0,box[3]-box[1])
    if area > TEXTILE_MAX_AUTO_AREA:
        return 'Possible fabric item—exact object needs confirmation. This broad region may contain more than one item.'
    if row['score'] < TEXTILE_REVIEW_BELOW:
        return 'Possible fabric item—exact object needs confirmation. The object score is borderline or weak.'
    return ''


def presentation(rows):
    """Read-only confidence/overlap policy, also applied to old saved proposals.

    Never delete saved records or alter their boxes. Human-confirmed objects
    remain reviewable, but a material score cannot validate an object box.
    """
    result = []
    for original in rows:
        row = {**original}
        status, reason = 'accepted', ''
        if row['name'] in HUMAN_NAMES:
            status, reason = 'excluded', 'Person, body part or worn clothing; not a waste item.'
        elif row.get('source') == 'whole_image_classifier':
            status, reason = 'material_only', 'Whole-photo material result; no object location was detected.'
        elif not row.get('object_confirmed'):
            if row['name'] in BACKGROUND_NAMES:
                status, reason = 'review', 'Possible background belonging. Identify the intended item before disposal guidance.'
            elif textile_review_reason(row):
                status, reason = 'review', textile_review_reason(row)
            elif row['score'] < DISPLAY_THRESHOLD:
                status, reason = 'review', 'Weak object match. Check the object name or take a closer photo.'
            elif row['name'] == 'unfamiliar discarded object' or conflicting_query(row):
                status, reason = 'review', 'The object name is uncertain or competing matches disagree.'
            elif row.get('stored_review_reason'):
                status, reason = 'review', row['stored_review_reason']
            elif any(other['name'] in BACKGROUND_NAMES and other['name'] != 'person' and
                     other['score'] >= max(DISPLAY_THRESHOLD,row['score']*.85) and
                     iou(row['box'],other['box']) > .5 for other in rows):
                status, reason = 'review', 'This region overlaps a possible body part or background object.'
        row.update(detection_status=status, detection_reason=reason)
        result.append(row)
    # Only near-identical/contained same-family proposals are duplicates. Merely
    # touching boxes, separate objects, and explicit user corrections survive.
    chosen = []
    for row in sorted(result,key=lambda value:(bool(value.get('object_confirmed')),value['score']),reverse=True):
        duplicate = next((other for other in chosen if family(other['name']) == family(row['name']) and
                          iou(row['box'],other['box']) > .45),None)
        if duplicate and not row.get('object_confirmed') and row['detection_status'] != 'excluded':
            row.update(detection_status='duplicate', detection_reason='Duplicate region for the same possible item.',
                       duplicate_of=duplicate.get('source_id'))
        else:
            chosen.append(row)
    return result


def clean_detections(rows, limit=30):
    import math
    chosen = []
    def area(box):
        return max(0,box[2]-box[0])*max(0,box[3]-box[1])
    def overlap_smaller(a,b):
        return max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))/max(1e-9,min(area(a),area(b)))
    valid = []
    for row in rows:
        box = row['box']
        if len(box)!=4 or not all(math.isfinite(float(v)) for v in [*box,row['score']]):
            continue
        box = [min(1.,max(0.,float(v))) for v in box]
        if row['score'] < MIN_PROPOSAL_SCORE or box[2]-box[0] < .015 or box[3]-box[1] < .015:
            continue
        valid.append({**row,'box':box})
    background = [row for row in valid if row['name'] in BACKGROUND_NAMES]
    for row in sorted(valid,key=lambda value:(bool(value.get('user_confirmed')),value['score']),reverse=True):
        box = row['box']
        if row['name'] not in OBJECT_NAMES and not row.get('user_confirmed') and any(
            (iou(box,bg['box'])>.4 or (overlap_smaller(box,bg['box'])>.9 and min(area(box),area(bg['box']))/max(area(box),area(bg['box']))>.5)) and bg['score'] >= row['score']*.85 for bg in background):
            continue
        duplicate = next((other for other in chosen if family(row['name'])==family(other['name']) and
            (iou(box,other['box'])>.4 or (overlap_smaller(box,other['box'])>.9 and min(area(box),area(other['box']))/max(area(box),area(other['box']))>(.12 if row['name']==other['name'] else .3)))),None)
        if duplicate:
            # Keep the strongest/confirmed item's identity and average near-identical
            # boundaries. Never union boxes into a giant rectangle.
            if not duplicate.get('user_confirmed'):
                weight = duplicate['score']+row['score']
                duplicate['box'] = [(a*duplicate['score']+b*row['score'])/weight for a,b in zip(duplicate['box'],box)]
            continue
        if any(iou(box,other['box'])>.65 and not (
            row['name'] != other['name'] and (row['name'] in OBJECT_NAMES or other['name'] in OBJECT_NAMES)
        ) for other in chosen):
            continue
        row['background'] = row['name'] in BACKGROUND_NAMES
        row['ambiguous_large'] = area(box)>.5
        chosen.append(row)
    return chosen[:limit], len(chosen)>limit


def detect(image, tiled=False):
    global _model, _processor
    if not available():
        raise RuntimeError('The local detector is not installed. Choose a material manually or ask the administrator to install it.')
    import os
    os.environ.setdefault('USE_TF','0')
    import torch
    with _load_lock:
        if _model is None:
            from transformers import OwlViTForObjectDetection, OwlViTProcessor
            torch.set_num_threads(4)
            _processor = OwlViTProcessor.from_pretrained(str(MODEL_DIR), local_files_only=True)
            _model = OwlViTForObjectDetection.from_pretrained(str(MODEL_DIR), local_files_only=True, use_safetensors=True).eval()
    rows = []
    regions = [(0,0,image.width,image.height)]
    # Default to one full-photo pass: overlapping crops fragmented bedding and
    # produced repeated weak regions. Tiling is experimental/explicit opt-in.
    if tiled and max(image.size) >= 350:
        for y in (0,.4):
            for x in (0,.4):
                regions.append((round(x*image.width),round(y*image.height),round((x+.6)*image.width),round((y+.6)*image.height)))
    for left,top,right,bottom in regions:
        region = image.crop((left,top,right,bottom))
        inputs = _processor(text=[[f'a photo of {name}' for name,_ in PROMPTS]], images=region, return_tensors='pt')
        with torch.inference_mode():
            outputs = _model(**inputs)
        result = _processor.post_process_grounded_object_detection(outputs=outputs, threshold=.1, target_sizes=torch.tensor([[region.height,region.width]]))[0]
        for box, score, label in zip(result['boxes'].tolist(), result['scores'].tolist(), result['labels'].tolist()):
            name, material = PROMPTS[label]
            # Ignore detections cut by an internal tile boundary; the overlapping tile
            # or full-image pass can supply a complete box instead.
            if (left>0 and box[0]<2) or (top>0 and box[1]<2) or (right<image.width and box[2]>region.width-2) or (bottom<image.height and box[3]>region.height-2):
                continue
            rows.append({'name':name, 'material':material or 'unknown_unsupported', 'score':float(score), 'box':[(left+box[0])/image.width,(top+box[1])/image.height,(left+box[2])/image.width,(top+box[3])/image.height]})
    cleaned, truncated = clean_detections(rows)
    for row in cleaned:
        # Actual overlapping query outputs only; never fabricate three alternatives.
        alternatives = {}
        for candidate in rows:
            if iou(row['box'], candidate['box']) >= .5:
                alternatives[candidate['name']] = max(alternatives.get(candidate['name'], 0), candidate['score'])
        row['alternatives'] = [{'label': name, 'score': score} for name, score in sorted(alternatives.items(), key=lambda pair: pair[1], reverse=True)[:3]]
    return presentation(cleaned), truncated
