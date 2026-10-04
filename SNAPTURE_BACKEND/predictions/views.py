from __future__ import annotations

import json
import logging

from django.core.files.base import ContentFile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import require_api_user
from core.materials import SCOPE_LABELS, material_info
from core.ml_service import predict_image
from core.recommendations import build_recommendations, question_schema

from .models import PredictionRecord


SUPPORTED_DECISIONS = set(SCOPE_LABELS)
logger = logging.getLogger(__name__)


def _parse_int(value):
    try:
        parsed = int(value)
        return parsed if parsed > 0 else None
    except (TypeError, ValueError):
        return None


def _parse_list(value):
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return []


def _serialize(record):
    # Older records may have been created by the generic baseline model and
    # contain labels such as ``glass`` or ``plastic``.  Keep those raw values
    # for model diagnostics, but never expose them as a supported result.
    safe_decision = (
        record.decision
        if record.decision in SUPPORTED_DECISIONS
        else "unknown_unsupported"
    )
    if safe_decision == "unknown_unsupported":
        safe_title = material_info("unknown_unsupported")["title"]
    else:
        safe_title = material_info(safe_decision)["title"]
        if "user confirmed" in str(record.title).lower():
            safe_title = f"{safe_title} (user confirmed)"
    requires_verification = (
        safe_decision == "unknown_unsupported"
        or str(record.model_class).lower() in {"plastic", "metal", "glass", "trash"}
    )
    return {
        "id": record.id,
        "image_url": record.image.url if record.image else None,
        # Keep the raw class in a separate diagnostic field.  The public
        # model_class is always scope-safe so clients cannot mistake a
        # generic baseline label for a thesis category.
        "model_class": safe_decision,
        "raw_model_class": record.model_class,
        "decision": safe_decision,
        "label": safe_decision,
        "title": safe_title,
        "confidence": record.confidence,
        "threshold": record.threshold,
        "model_version": record.model_version,
        "quantity": record.quantity,
        "condition": record.condition,
        "previous_contents": record.previous_contents,
        "answers": record.answers,
        "recommendation_choices": record.recommendation_choices,
        "selected_recommendation": record.selected_recommendation,
        "needs_verification": requires_verification,
        "verification_reasons": (
            ["model_result_requires_material_review"]
            if requires_verification
            else []
        ),
        "created_at": record.created_at.isoformat(),
    }


@require_api_user
@require_http_methods(["GET"])
def list_predictions(request):
    records = PredictionRecord.objects.filter(user=request.api_user)[:50]
    return JsonResponse({"predictions": [_serialize(record) for record in records]})


@csrf_exempt
@require_api_user
@require_http_methods(["POST"])
def create_prediction(request):
    uploaded = request.FILES.get("image") or request.FILES.get("file")
    if uploaded is None:
        return JsonResponse({"detail": "Upload an image using the image field."}, status=400)
    if not uploaded.content_type or not uploaded.content_type.startswith("image/"):
        return JsonResponse({"detail": "Only image uploads are supported."}, status=415)
    image_bytes = uploaded.read()
    if not image_bytes:
        return JsonResponse({"detail": "The image is empty."}, status=400)
    try:
        result = predict_image(image_bytes)
    except (RuntimeError, ValueError) as error:
        logger.exception("prediction_failed user_id=%s", request.api_user.id)
        return JsonResponse({"detail": str(error)}, status=503 if isinstance(error, RuntimeError) else 400)

    quantity = _parse_int(request.POST.get("quantity"))
    condition = str(request.POST.get("condition", "")).strip()
    previous_contents = str(request.POST.get("previous_contents", "")).strip()
    available_materials = _parse_list(request.POST.get("available_materials", ""))
    raw_answers = request.POST.get("answers", "{}")
    try:
        answers = json.loads(raw_answers) if isinstance(raw_answers, str) else {}
    except json.JSONDecodeError:
        answers = {}
    choices = build_recommendations(result["decision"], quantity, condition, previous_contents, available_materials)
    record = PredictionRecord(
        user=request.api_user,
        model_class=str(result["model_class"]),
        decision=str(result["decision"]),
        title=str(result["title"]),
        confidence=float(result["confidence"]),
        threshold=float(result.get("threshold", 0.60)),
        model_version=str(result.get("model_version", "local")),
        quantity=quantity,
        condition=condition,
        previous_contents=previous_contents,
        available_materials=available_materials,
        answers=answers,
        recommendation_choices=choices,
    )
    filename = getattr(uploaded, "name", "capture.jpg")
    record.image.save(filename, ContentFile(image_bytes), save=False)
    record.save()
    logger.info(
        "scan_created id=%s user_id=%s model=%s decision=%s confidence=%.3f threshold=%.3f recommendations=%s",
        record.id,
        request.api_user.id,
        record.model_class,
        record.decision,
        record.confidence,
        record.threshold,
        len(choices),
    )
    return JsonResponse({"prediction": _serialize(record), "result": result, "recommendations": choices}, status=201)


@csrf_exempt
@require_api_user
@require_http_methods(["GET", "PATCH", "DELETE"])
def prediction_detail(request, prediction_id):
    record = PredictionRecord.objects.filter(id=prediction_id, user=request.api_user).first()
    if record is None:
        return JsonResponse({"detail": "Prediction not found."}, status=404)
    if request.method == "DELETE":
        if record.image:
            record.image.delete(save=False)
        record.delete()
        return JsonResponse({"deleted": True, "id": prediction_id})
    if request.method == "PATCH":
        try:
            payload = json.loads(request.body or "{}")
        except json.JSONDecodeError:
            return JsonResponse({"detail": "The request body must be valid JSON."}, status=400)
        quantity = _parse_int(payload.get("quantity")) if "quantity" in payload else record.quantity
        condition = str(payload.get("condition", record.condition)).strip()
        previous_contents = str(payload.get("previous_contents", record.previous_contents)).strip()
        available_materials = _parse_list(payload.get("available_materials", record.available_materials))
        answers = payload.get("answers", record.answers)
        if not isinstance(answers, dict):
            return JsonResponse({"detail": "answers must be a JSON object."}, status=400)
        confirmation_map = {
            "PET/PETE code 1": "pete_bottles",
            "HDPE code 2": "hdpe_containers",
        }
        confirmed_label = confirmation_map.get(str(answers.get("follow_up", "")).strip())
        if record.decision not in SUPPORTED_DECISIONS and confirmed_label:
            # A user-visible resin-code confirmation can unlock the matching
            # guide without pretending that the model itself was confident.
            record.decision = confirmed_label
            record.model_class = confirmed_label
            record.title = f"{material_info(confirmed_label)['title']} (user confirmed)"
            answers = {**answers, "user_confirmed_material": confirmed_label}
        choices = build_recommendations(
            record.decision,
            quantity,
            condition,
            previous_contents,
            available_materials,
        )
        record.quantity = quantity
        record.condition = condition
        record.previous_contents = previous_contents
        record.available_materials = available_materials
        record.answers = answers
        record.recommendation_choices = choices
        record.save(update_fields=[
            "model_class",
            "decision",
            "title",
            "quantity",
            "condition",
            "previous_contents",
            "available_materials",
            "answers",
            "recommendation_choices",
        ])
        logger.info(
            "scan_updated id=%s user_id=%s decision=%s quantity=%s condition=%s recommendations=%s",
            record.id,
            request.api_user.id,
            record.decision,
            record.quantity,
            record.condition or "<empty>",
            len(choices),
        )
    return JsonResponse({"prediction": _serialize(record), "recommendations": record.recommendation_choices})


@csrf_exempt
@require_api_user
@require_http_methods(["DELETE"])
def delete_all_predictions(request):
    """Delete only the authenticated user's saved scans and their files."""
    records = list(PredictionRecord.objects.filter(user=request.api_user))
    for record in records:
        if record.image:
            record.image.delete(save=False)
    deleted_count = len(records)
    PredictionRecord.objects.filter(user=request.api_user).delete()
    return JsonResponse({"deleted": True, "count": deleted_count})


@csrf_exempt
@require_api_user
@require_http_methods(["POST"])
def select_recommendation(request, prediction_id):
    record = PredictionRecord.objects.filter(id=prediction_id, user=request.api_user).first()
    if record is None:
        return JsonResponse({"detail": "Prediction not found."}, status=404)
    payload = json.loads(request.body or "{}") if request.body else {}
    selected = str(payload.get("recommendation_id", "")).strip()
    allowed = {str(item.get("id")) for item in record.recommendation_choices if isinstance(item, dict)}
    if selected not in allowed:
        return JsonResponse({"detail": "Choose one of the available recommendations."}, status=400)
    record.selected_recommendation = selected
    record.save(update_fields=["selected_recommendation"])
    logger.info(
        "recommendation_selected prediction_id=%s user_id=%s recommendation_id=%s",
        record.id,
        request.api_user.id,
        selected,
    )
    return JsonResponse({"prediction": _serialize(record)})


@require_api_user
@require_http_methods(["GET"])
def material_questions(request, label):
    info = material_info(label)
    return JsonResponse({"label": label, "title": info["title"], "questions": question_schema(label)})
