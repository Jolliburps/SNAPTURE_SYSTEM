import json
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from core.auth import require_api_user
from .models import PredictionRecord, IdentificationReview


@csrf_exempt
@require_api_user
@require_http_methods(['POST', 'DELETE'])
def contribute(request, prediction_id):
    record = PredictionRecord.objects.filter(pk=prediction_id, user=request.api_user).first()
    if not record:
        return JsonResponse({'detail': 'Item not found.'}, status=404)
    if request.method == 'DELETE':
        IdentificationReview.objects.filter(prediction=record).delete()
        return JsonResponse({'withdrawn': True})
    try:
        payload = json.loads(request.body)
    except (ValueError, UnicodeDecodeError):
        payload = None
    if not isinstance(payload, dict) or payload.get('consent') is not True:
        return JsonResponse({'detail': 'Explicit consent to research review is required.'}, status=400)
    if not record.image:
        return JsonResponse({'detail': 'This item has no crop to review.'}, status=400)
    snapshot = {'decision': record.decision, 'answers': record.answers, 'condition': record.condition,
                'previous_contents': record.previous_contents, 'raw_model_class': record.model_class,
                'model_version': record.model_version, 'score': record.confidence}
    existing = IdentificationReview.objects.filter(prediction=record).first()
    if existing and existing.snapshot == snapshot:
        return JsonResponse({'status': existing.status, 'id': existing.pk})
    review, _ = IdentificationReview.objects.update_or_create(prediction=record, defaults={
        'snapshot': snapshot, 'status': 'pending', 'reviewer': None, 'reviewed_at': None,
        'review_notes': '', 'consented_at': timezone.now(),
    })
    return JsonResponse({'status': review.status, 'id': review.pk}, status=201)
