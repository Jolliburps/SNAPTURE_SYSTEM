"""Material evidence from the selected dataset-trained checkpoint, not OWL queries."""
from io import BytesIO

from core.materials import SCOPE_LABELS
from core.ml_service import predict_image

DATASET_BASIS = 'Model trained on SNAPTURE_ML/data; experimental labels require review.'


def classify_material(image):
    encoded = BytesIO()
    image.convert('RGB').save(encoded, format='PNG')
    result = predict_image(encoded.getvalue())
    decision = result['decision'] if result['decision'] in SCOPE_LABELS else 'unknown_unsupported'
    return {
        'label': decision, 'raw_class': result['model_class'],
        'confidence': result['confidence'], 'threshold': result['threshold'],
        'model_version': result['model_version'], 'status': 'classified',
        'basis': DATASET_BASIS, 'alternatives': result.get('alternatives', []),
        'experimental': result.get('experimental_model', False),
    }


def classify_detected_material(image, row):
    # Belongings, hazards and unsupported materials must not be forced into one
    # of the seven training classes merely because a softmax has a highest score.
    eligible = row.get('material') in SCOPE_LABELS or row['name'] in {
        'plastic bottle', 'plastic jug or container', 'unfamiliar discarded object',
    }
    if not eligible:
        return {'label':'unknown_unsupported', 'status':'not_applicable', 'basis':'Object outside the material dataset scope.'}
    try:
        return classify_material(image)
    except (RuntimeError, OSError, ValueError, ImportError):
        return {'label':'unknown_unsupported', 'status':'unavailable',
                'basis':'The dataset-trained material model is unavailable. No material was inferred from the object name.'}
