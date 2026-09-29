from __future__ import annotations

from io import BytesIO

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import Image, UnidentifiedImageError

from core.auth import require_api_admin
from core.materials import SCOPE_LABELS

from .models import DatasetImage


MAX_DATASET_IMAGE_BYTES = 10 * 1024 * 1024


@require_api_admin
@require_http_methods(["GET"])
def counts(request):
    result = {label: DatasetImage.objects.filter(label=label, review_status="verified").count() for label in SCOPE_LABELS}
    pending = DatasetImage.objects.filter(review_status="pending").count()
    recommended_per_class = 100
    minimum_for_training = 30
    return JsonResponse(
        {
            "labels": list(SCOPE_LABELS),
            "verified_counts": result,
            "pending_count": pending,
            "recommended_per_class": recommended_per_class,
            "minimum_for_training": minimum_for_training,
            "training_ready": all(
                count >= minimum_for_training for count in result.values()
            ),
            "categories_needing_data": [
                label for label, count in result.items() if count < recommended_per_class
            ],
        }
    )


@csrf_exempt
@require_api_admin
@require_http_methods(["POST"])
def upload(request):
    label = str(request.POST.get("label", "")).strip().lower()
    image = request.FILES.get("image") or request.FILES.get("file")
    if label not in SCOPE_LABELS:
        return JsonResponse({"detail": "Choose an approved thesis-scope label."}, status=422)
    if image is None or not image.content_type or not image.content_type.startswith("image/"):
        return JsonResponse({"detail": "Upload an image using the image field."}, status=400)
    if image.size > MAX_DATASET_IMAGE_BYTES:
        return JsonResponse({"detail": "The image must be 10 MB or smaller."}, status=413)
    image_bytes = image.read()
    image.seek(0)
    try:
        with Image.open(BytesIO(image_bytes)) as opened:
            width, height = opened.size
            opened.verify()
    except (UnidentifiedImageError, OSError):
        return JsonResponse({"detail": "The uploaded file is not a valid image."}, status=400)
    if width < 64 or height < 64:
        return JsonResponse({"detail": "The image must be at least 64 by 64 pixels."}, status=422)
    record = DatasetImage.objects.create(label=label, image=image, uploaded_by=request.api_user, notes=str(request.POST.get("notes", "")).strip())
    return JsonResponse({"saved": True, "id": record.id, "label": record.label, "review_status": record.review_status}, status=201)
