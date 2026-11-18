"""Material evidence from the selected dataset-trained checkpoint, not OWL queries."""
from io import BytesIO
from PIL import ImageOps

from core.materials import SCOPE_LABELS
from core.ml_service import predict_image

DATASET_BASIS = 'Model trained on SNAPTURE_ML/data; experimental labels require review.'
PREPROCESSING = {'version':'rgb-bilinear-v1', 'orientation':'EXIF corrected',
                 'resize':'model input size, bilinear', 'normalization':'embedded in saved model'}


PLASTIC_PROMPTS = {'plastic bottle', 'plastic jug or container'}
PLASTIC_MATERIALS = {'pete_bottles', 'hdpe_containers'}


def high_confidence_material(row, material):
    from .confidence_policy import approved_cutoffs

    label = material['label']
    compatible = (label in PLASTIC_MATERIALS if row['name'] in PLASTIC_PROMPTS else label == row.get('material'))
    if not (label in SCOPE_LABELS and compatible and row['detection_status'] == 'accepted' and
            material.get('status') == 'classified'):
        return None
    policy = approved_cutoffs(material.get('model_version'), row['name'], label)
    if (policy and row['score'] >= policy['object_cutoff'] and
            material.get('confidence', 0) >= max(policy['material_cutoff'], material.get('threshold', 1))):
        return {'label': label, 'query': row['name'], 'policy_digest': policy['digest']}
    return None


def classify_material(image):
    encoded = BytesIO()
    # Correct orientation before encoding: PNG conversion otherwise discards
    # the camera EXIF tag before the model gets a chance to apply it.
    ImageOps.exif_transpose(image).convert('RGB').save(encoded, format='PNG')
    result = predict_image(encoded.getvalue())
    decision = result['decision'] if result['decision'] in SCOPE_LABELS else 'unknown_unsupported'
    return {
        'label': decision, 'raw_class': result['model_class'],
        'confidence': result['confidence'], 'threshold': result['threshold'],
        'model_version': result['model_version'], 'status': 'classified',
        'basis': DATASET_BASIS, 'alternatives': result.get('alternatives', []),
        'experimental': result.get('experimental_model', False),
        'preprocessing': PREPROCESSING,
    }


def classify_detected_material(image, row):
    # Belongings, hazards and unsupported materials must not be forced into one
    # of the seven training classes merely because a softmax has a highest score.
    # A generic shape match such as "wallet" can be a folded fabric item.
    # Inspect its actual crop, but never auto-accept material from that name.
    neutral_object = row['name'] in {'wallet','unfamiliar discarded object'}
    allowed = set(SCOPE_LABELS) if neutral_object else PLASTIC_MATERIALS if row['name'] in PLASTIC_PROMPTS else {row.get('material')} & set(SCOPE_LABELS)
    if not allowed:
        return {'label':'unknown_unsupported', 'status':'not_applicable', 'basis':'Object outside the material dataset scope.'}
    try:
        result = classify_material(image)
        if neutral_object:
            return {**result, 'label':'unknown_unsupported', 'status':'needs_review',
                    'basis':'The object outline was located, but its identity is uncertain. Check the suggested material.'}
        if result['raw_class'] in SCOPE_LABELS and result['raw_class'] not in allowed:
            return {**result, 'label': 'unknown_unsupported', 'status': 'conflicting_evidence',
                    'basis': 'The object and material models suggested different categories.'}
        return result
    except (RuntimeError, OSError, ValueError, ImportError):
        return {'label':'unknown_unsupported', 'status':'unavailable',
                'basis':'The dataset-trained material model is unavailable. No material was inferred from the object name.'}


def recognition_result(record):
    """Distinguish an uncertain in-scope suggestion from an out-of-scope item.

    This is presentation of this record's evidence only, never a new prediction
    or an override of the classifier threshold or stored assessment.
    """
    if record.decision in SCOPE_LABELS:
        return {'status':'supported', 'suggested_label':None, 'reason':''}
    evidence = (record.image_quality or {}).get('material_prediction') or {}
    status = evidence.get('status')
    if status == 'not_applicable':
        return {'status':'unsupported', 'suggested_label':None,
                'reason':'This item is outside the seven supported categories.'}
    if status in {'needs_review','conflicting_evidence','unavailable'} or evidence.get('raw_class') in SCOPE_LABELS:
        suggestion = evidence.get('raw_class') if status != 'conflicting_evidence' else None
        return {'status':'needs_review', 'suggested_label':suggestion if suggestion in SCOPE_LABELS else None,
                'reason':evidence.get('basis') or 'Check the category or take a clearer photo.'}
    return {'status':'unsupported', 'suggested_label':None,
            'reason':'No supported category was identified.'}
