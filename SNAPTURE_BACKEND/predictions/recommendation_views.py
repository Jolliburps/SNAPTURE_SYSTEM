import json
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.auth import require_api_user
from core.recommendation_requests import generate, revision
from .models import PredictionRecord


@csrf_exempt
@require_api_user
@require_http_methods(['POST'])
@transaction.atomic
def request_recommendations(request, prediction_id):
    record = PredictionRecord.objects.select_for_update().filter(user=request.api_user, pk=prediction_id).first()
    if record is None:
        return JsonResponse({'detail': 'Prediction not found.'}, status=404)
    try:
        payload = json.loads(request.body or '{}') if request.content_type == 'application/json' else {}
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'detail': 'A JSON object is required.'}, status=400)
    if not isinstance(payload, dict):
        return JsonResponse({'detail': 'A JSON object is required.'}, status=400)
    if payload.get('screening_revision') and payload['screening_revision'] != revision(record):
        return JsonResponse({'detail': 'This item changed. Return to screening and review its current details.'}, status=409)
    screening, choices = generate(record)
    if screening['status'] != 'eligible':
        return JsonResponse({'detail': 'Complete item screening before requesting recommendations.',
                             'screening': screening}, status=409)
    return JsonResponse({'prediction_id': record.id, 'scene_id': getattr(getattr(record, 'scene_item', None), 'scene_id', None),
                         'screening': screening, 'revision': revision(record), 'recommendations': choices,
                         'status': 'available' if choices else 'no_matching_project'})
