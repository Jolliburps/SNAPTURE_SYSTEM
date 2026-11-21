"""Screen the main photo with region evidence and the seven-class material model."""
from django.core import signing
from core.materials import SCOPE_LABELS

from upcycling.workflow import RESIN_MARKS, accepted_material
from . import scene_detector
from .framed_scan import crop_bounds, FrameReviewRequired, select_region, supported_query
from .material_classifier import PLASTIC_PROMPTS, classify_detected_material, classify_material


TOKEN_SALT = 'snapture-main-photo-v1'
EXCLUSION_MINIMUM = .35  # Provisional detector cutoff, not an accuracy estimate.
SPECIAL_HANDLING = scene_detector.GLASS_QUERIES | scene_detector.METAL_QUERIES | {'battery', 'fluorescent light bulb', 'syringe', 'paint can'}
PLASTIC_REVIEW = ('The bottle or container was located, but its plastic type could not be confirmed. Check the recycling code on its base. '
                  'PET/PETE #1 and HDPE #2 are supported.')
RESIN_CODES = {'1':'pete_bottles','2':'hdpe_containers'}


def material_scores(evidence):
    scores = {}
    for entry in [*evidence.get('alternatives', []), {'class': evidence.get('raw_class'), 'confidence': evidence.get('confidence')}]:
        label, score = entry.get('class'), entry.get('confidence')
        if label in SCOPE_LABELS and type(score) in (int, float) and 0 <= score <= 1:
            scores.setdefault(label, score)
    return [{'label': label, 'score': score} for label, score in sorted(scores.items(), key=lambda item: -item[1])[:3]]


def screen(image):
    rows, truncated = scene_detector.detect(image, scope_preview=True)
    try:
        selected = select_region(rows, truncated)
    except FrameReviewRequired as error:
        return {'status': 'photo_review', 'reason': str(error)}, None

    if not selected or selected['detection_status'] != 'accepted':
        return {'status': 'photo_review', 'reason': 'A clear target could not be located. Frame one item in even light with its edges visible.'}, None

    name = selected['name']
    if not supported_query(selected):
        if selected['score'] < EXCLUSION_MINIMUM:
            return {'status': 'photo_review', 'reason': 'The item could not be identified confidently. Retake with one item clearly in view.'}, None
        if name in SPECIAL_HANDLING:
            handling_kind = 'separate' if name in scene_detector.GLASS_QUERIES | scene_detector.METAL_QUERIES else 'hazardous'
            return {'status': 'special_handling', 'handling_kind': handling_kind,
                    'reason': f'The photo suggests {name}. Keep it separate and ask your barangay or CESD how to handle it.'}, selected
        return {'status': 'out_of_scope', 'reason': f'The photo suggests {name}, which is outside the upcycling categories.'}, selected

    material = classify_detected_material(image.crop(crop_bounds(image, selected)), selected)
    scores = {'crop_scores': material_scores(material)}
    label = accepted_material(material)
    if label:
        guide_material = classify_material(image)
        guide_label = accepted_material(guide_material)
        # A localized sheet and its crop can corroborate paper even when the
        # wider guide scores the background. Keep strong paper/cardboard conflicts.
        localized_paper = (label == 'paper' and selected.get('material') == 'paper'
                           and selected['score'] >= EXCLUSION_MINIMUM and guide_label != 'cardboard')
        if guide_label != label and not localized_paper:
            scores['guide_scores'] = material_scores(guide_material)
            if name in PLASTIC_PROMPTS:
                return {'status': 'photo_review', 'reason': PLASTIC_REVIEW, **scores}, selected
            advice = ('Lay the sheet flat on a plain, contrasting surface and keep all four edges inside the camera guide.'
                      if label == 'paper' else 'Place the item on a plain background and keep its edges inside the camera guide.')
            return {'status': 'photo_review', 'reason': f'The main photo and the outlined region did not confirm the same material. {advice}', **scores}, selected
        row = {**selected, 'source': 'local_object_detector', 'material_prediction': material}
        return {'status': 'supported', 'label': label, 'reason': 'The outlined region matches a supported material. Continue to enter the item details.', **scores}, row
    if material.get('status') == 'unavailable':
        return {'status': 'unavailable', 'reason': 'Material recognition is unavailable right now. Try the material check again later.'}, None
    if name in PLASTIC_PROMPTS:
        return {'status': 'photo_review', 'reason': PLASTIC_REVIEW, **scores}, selected
    return {'status': 'photo_review', 'reason': 'The outlined item could not be confirmed as a supported material. Retake with the whole item clearly visible.', **scores}, selected


def sign_preview(user_id, image_digest, frame, row):
    return signing.dumps({'user': user_id, 'image': image_digest, 'frame': list(frame), 'row': row}, salt=TOKEN_SALT, compress=True)


def read_preview(token, user_id, image_digest, frame, resin_code=None):
    data = signing.loads(token, salt=TOKEN_SALT, max_age=3600)
    if (data['user'], data['image'], data['frame']) != (user_id, image_digest, list(frame)):
        raise signing.BadSignature('The preview belongs to a different photo or frame.')
    row = data['row']
    if row.get('resin_review'):
        if resin_code not in RESIN_CODES:
            raise signing.BadSignature('Select a readable supported resin code.')
        label = RESIN_CODES[resin_code]
        return {**row, 'source':'local_object_detector', 'resin_mark':RESIN_MARKS[label],
                'material_prediction': {'label':label, 'raw_class':'unknown_unsupported', 'confidence':0,
                                        'threshold':.7, 'status':'user_reported_resin',
                                        'basis':'Material based on the recycling code reported by the user.'}}
    if resin_code is not None:
        raise signing.BadSignature('The code is only available for a plastic review.')
    return row


def overlay_box(row, frame, image):
    """Convert a guide-cropped detector box to the displayed full photo."""
    left, top, right, bottom = frame
    x1, y1, x2, y2 = row['box']
    return [(left + x1 * (right - left)) / image.width,
            (top + y1 * (bottom - top)) / image.height,
            (left + x2 * (right - left)) / image.width,
            (top + y2 * (bottom - top)) / image.height]
