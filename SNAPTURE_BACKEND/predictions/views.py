from __future__ import annotations

import json
import logging
from io import BytesIO
from PIL import Image, UnidentifiedImageError

from django.core.files.base import ContentFile
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import require_api_user
from core.materials import SCOPE_LABELS, material_info
from core.ml_service import predict_image
from core.assessment import assess, confirm_material, refresh, question_schema as assessment_questions

from .models import PredictionRecord
from .image_quality import oriented_image, quality_report


SUPPORTED_DECISIONS = set(SCOPE_LABELS)
PLASTIC_DECISIONS = {"pete_bottles", "hdpe_containers"}
logger = logging.getLogger(__name__)


def _parse_int(value):
    if isinstance(value, bool):
        return None
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
        if "candidate-unverified" in str(record.model_version):
            safe_title = f"{safe_title} (prototype result)"
    plastic_confirmed = record.answers.get("user_confirmed_material") == safe_decision and safe_decision in PLASTIC_DECISIONS
    requires_verification = (
        safe_decision == "unknown_unsupported"
        or ("candidate-unverified" in str(record.model_version) and record.answers.get("user_confirmed_material") != safe_decision)
        or (safe_decision in PLASTIC_DECISIONS and not plastic_confirmed)
        or (str(record.model_class).lower() in {"plastic", "metal", "glass", "trash"} and not plastic_confirmed)
    )
    assessment = assess(record)
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
        "experimental_model": "candidate-unverified" in str(record.model_version),
        "quantity": record.quantity,
        "condition": record.condition,
        "previous_contents": record.previous_contents,
        "answers": record.answers,
        "recommendation_choices": assessment["upcycling"]["recommendations"],
        "selected_recommendation": record.selected_recommendation if record.selected_recommendation in {item["id"] for item in assessment["upcycling"]["recommendations"]} else "",
        "assessment": assessment,
        "input_method": record.input_method,
        "image_quality": record.image_quality,
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
    owned = PredictionRecord.objects.filter(user=request.api_user)
    return JsonResponse({"predictions": [_serialize(record) for record in owned[:50]], "total_count": owned.count()})


@require_api_user
@require_http_methods(["GET"])
def list_saved_predictions(request):
    records = PredictionRecord.objects.filter(user=request.api_user).exclude(selected_recommendation="")
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
    if uploaded.size > 12 * 1024 * 1024:
        return JsonResponse({"detail": "Choose an image smaller than 12 MB."}, status=413)
    image_bytes = uploaded.read()
    if not image_bytes:
        return JsonResponse({"detail": "The image is empty."}, status=400)
    try:
        with Image.open(BytesIO(image_bytes)) as image:
            if min(image.size) < 64 or image.width * image.height > 25_000_000:
                raise ValueError("Use an image at least 64 pixels wide and high and at most 25 megapixels.")
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as error:
        return JsonResponse({"detail": f"Please retake or choose a readable image. {error}"}, status=400)
    if request.POST.get('frame'):
        from .image_quality import frame_bounds
        try:
            photo = oriented_image(image_bytes)
            photo = photo.crop(frame_bounds(photo,json.loads(request.POST['frame'])))
            encoded = BytesIO(); photo.save(encoded,format='JPEG',quality=90)
            image_bytes = encoded.getvalue()
        except (ValueError,OSError,TypeError):
            return JsonResponse({'detail':'Invalid camera guide. Retake the photo.'},status=400)
    quality = quality_report(oriented_image(image_bytes))
    if request.POST.get('check_objects') == 'true':
        from . import scene_detector
        if scene_detector.available() and scene_detector.inference_lock.acquire(blocking=False):
            try:
                located, _ = scene_detector.detect(oriented_image(image_bytes),tiled=False)
                quality = quality_report(oriented_image(image_bytes),[row['box'] for row in located],single=True)
            except Exception:
                logger.warning('single_photo_object_check_unavailable user_id=%s',request.api_user.id)
            finally:
                scene_detector.inference_lock.release()
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
    if not isinstance(answers, dict):
        return JsonResponse({"detail": "answers must be a JSON object."}, status=400)
    answers = {}
    choices = []
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
        image_quality=quality,
    )
    refresh(record)
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
    return JsonResponse({"prediction": _serialize(record), "result": result, "recommendations": record.recommendation_choices}, status=201)


@csrf_exempt
@require_api_user
@require_http_methods(["POST"])
def create_manual_prediction(request):
    try:
        payload = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload = None
    if not isinstance(payload, dict) or payload.get("label") not in SCOPE_LABELS:
        return JsonResponse({"detail": "Choose one of the supported catalog materials."}, status=400)
    label = payload["label"]
    record = PredictionRecord(user=request.api_user, model_class="manual_selection", decision=label,
                              title=material_info(label)["title"], confidence=0, model_version="not_used_manual",
                              input_method="manual", answers={"user_confirmed_material": label})
    refresh(record)
    record.save()
    return JsonResponse({"prediction": _serialize(record)}, status=201)


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
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({"detail": "The request body must be valid JSON."}, status=400)
        if not isinstance(payload, dict):
            return JsonResponse({"detail": "The request body must be a JSON object."}, status=400)
        quantity = _parse_int(payload.get("quantity")) if "quantity" in payload else record.quantity
        condition = str(payload.get("condition", record.condition)).strip()
        previous_contents = str(payload.get("previous_contents", record.previous_contents)).strip()
        available_materials = _parse_list(payload.get("available_materials", record.available_materials))
        answers = payload.get("answers", {})
        if not isinstance(answers, dict):
            return JsonResponse({"detail": "answers must be a JSON object."}, status=400)
        allowed_keys = {"material_confirmation", "resin_mark", "wood_treatment", "follow_up", "paper_surface"}
        incoming = {key: value for key, value in answers.items() if key in allowed_keys}
        if any(not isinstance(value, str) for value in incoming.values()):
            return JsonResponse({"detail": "Confirmation answers must be strings."}, status=400)
        if incoming.get("material_confirmation") not in set(SCOPE_LABELS) | {None, "Not sure"}:
            return JsonResponse({"detail": "Unsupported catalog material."}, status=400)
        merged = {**record.answers, **incoming}
        merged.pop("user_confirmed_material", None)
        old_decision = record.decision
        confirm_material(record, merged)
        material_changed = record.decision != old_decision
        record.quantity = quantity if "quantity" in payload or not material_changed else None
        record.condition = condition if "condition" in payload or not material_changed else ""
        record.previous_contents = previous_contents if "previous_contents" in payload or not material_changed else ""
        record.available_materials = available_materials
        refresh(record)
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
            "selected_recommendation",
            "assessment",
        ])
        logger.info(
            "scan_updated id=%s user_id=%s decision=%s quantity=%s condition=%s recommendations=%s",
            record.id,
            request.api_user.id,
            record.decision,
            record.quantity,
            record.condition or "<empty>",
            len(record.recommendation_choices),
        )
    return JsonResponse({"prediction": _serialize(record), "recommendations": record.recommendation_choices})


@csrf_exempt
@require_api_user
@require_http_methods(["DELETE"])
def delete_all_predictions(request):
    """Delete only the authenticated user's saved scans and their files."""
    from .models import ScanScene
    if ScanScene.objects.filter(user=request.api_user,status='processing').exists():
        return JsonResponse({'detail':'Wait for mixed-item analysis to finish before clearing scans.'},status=409)
    records = list(PredictionRecord.objects.filter(user=request.api_user))
    for record in records:
        if record.image:
            record.image.delete(save=False)
    deleted_count = len(records)
    PredictionRecord.objects.filter(user=request.api_user).delete()
    for scene in ScanScene.objects.filter(user=request.api_user):
        scene.image.delete(save=False)
        scene.delete()
    return JsonResponse({"deleted": True, "count": deleted_count})


@csrf_exempt
@require_api_user
@require_http_methods(["POST"])
def select_recommendation(request, prediction_id):
    record = PredictionRecord.objects.filter(id=prediction_id, user=request.api_user).first()
    if record is None:
        return JsonResponse({"detail": "Prediction not found."}, status=404)
    try:
        payload = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        payload = None
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "The request body must be a JSON object."}, status=400)
    selected = str(payload.get("recommendation_id", "")).strip()
    refresh(record)
    allowed = {str(item.get("id")) for item in record.recommendation_choices if isinstance(item, dict)}
    if selected not in allowed:
        return JsonResponse({"detail": "Choose one of the available recommendations."}, status=400)
    record.selected_recommendation = selected
    record.save(update_fields=["selected_recommendation", "assessment", "recommendation_choices"])
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
    return JsonResponse({"label": label, "title": info["title"], "questions": assessment_questions(label)})
