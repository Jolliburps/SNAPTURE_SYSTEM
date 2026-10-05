from __future__ import annotations

import json
from PIL import Image, UnidentifiedImageError

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.db import IntegrityError, transaction
from django.db.models import Count
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import issue_token, require_api_admin, require_api_user, user_from_request
from core.materials import SCOPE_LABELS, material_info
from predictions.models import PredictionRecord

from .models import ApiToken, Profile


SUPPORTED_DECISIONS = set(SCOPE_LABELS)


def _safe_prediction_values(record):
    """Return a scope-safe decision/title for old and new model records."""
    decision = record.decision if record.decision in SUPPORTED_DECISIONS else "unknown_unsupported"
    if decision == "unknown_unsupported":
        title = material_info("unknown_unsupported")["title"]
    else:
        title = material_info(decision)["title"]
        if "user confirmed" in str(record.title).lower():
            title = f"{title} (user confirmed)"
    return decision, title


def _json_body(request):
    try:
        return json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return None


def _serialize_user(user, request=None):
    profile, _ = Profile.objects.get_or_create(user=user)
    # Django superusers/staff members are administrators even if an older
    # database row was created before the Profile role was synchronized.
    role = "admin" if user.is_staff or user.is_superuser else profile.role
    if role == "admin" and profile.role != "admin":
        Profile.objects.filter(pk=profile.pk).update(role="admin")
    return {
        "id": user.id,
        "email": user.email,
        "display_name": profile.display_name or user.get_username(),
        "barangay": profile.barangay,
        "profile_picture_url": request.build_absolute_uri(profile.profile_picture.url) if request and profile.profile_picture else None,
        "role": role,
    }


@csrf_exempt
@require_http_methods(["POST"])
def register(request):
    payload = _json_body(request)
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "Request body must be a JSON object."}, status=400)
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    display_name_value = payload.get("display_name", "")
    barangay_value = payload.get("barangay", "")
    if not isinstance(display_name_value, str) or not isinstance(barangay_value, str):
        return JsonResponse({"detail": "Name and barangay must be text."}, status=400)
    display_name = display_name_value.strip()
    barangay = barangay_value.strip()
    if not email or "@" not in email:
        return JsonResponse({"detail": "A valid email address is required."}, status=400)
    if len(password) < 8:
        return JsonResponse({"detail": "Password must contain at least 8 characters."}, status=400)
    if len(display_name) > 120 or len(barangay) > 120:
        return JsonResponse({"detail": "Name and barangay must be 120 characters or fewer."}, status=400)
    if User.objects.filter(username=email).exists():
        return JsonResponse({"detail": "An account with that email already exists."}, status=409)
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, password=password)
            Profile.objects.create(user=user, display_name=display_name, barangay=barangay)
    except IntegrityError:
        return JsonResponse({"detail": "Unable to create the account."}, status=409)
    return JsonResponse({"user": _serialize_user(user, request), "token": issue_token(user)}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def login(request):
    payload = _json_body(request)
    if not isinstance(payload, dict):
        return JsonResponse({"detail": "Request body must be a JSON object."}, status=400)
    identifier = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    # Regular accounts use their email as the username. The administrator
    # account uses the short username "admin", so accept either identifier.
    user = authenticate(request, username=identifier, password=password)
    if user is None:
        account = User.objects.filter(email__iexact=identifier).first()
        if account is not None:
            user = authenticate(request, username=account.get_username(), password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid email or password."}, status=401)
    return JsonResponse({"user": _serialize_user(user, request), "token": issue_token(user)})


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_request(request):
    """Start a password reset without revealing whether an email exists.

    The local thesis build runs with DEBUG enabled and returns a one-time
    Django reset token so the mobile UI can complete the flow without an
    email provider. Production builds should send this token by email instead
    of returning it in the API response.
    """
    payload = _json_body(request)
    if payload is None:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)
    email = str(payload.get("email", "")).strip().lower()
    response = {
        "requested": True,
        "detail": "If an account exists for that email, reset instructions are available.",
    }
    user = User.objects.filter(email__iexact=email).first() if email else None
    if user is not None and settings.DEBUG:
        response["reset_token"] = default_token_generator.make_token(user)
    return JsonResponse(response)


@csrf_exempt
@require_http_methods(["POST"])
def password_reset_confirm(request):
    """Set a new password using a single-use Django reset token."""
    payload = _json_body(request)
    if payload is None:
        return JsonResponse({"detail": "Request body must be valid JSON."}, status=400)
    email = str(payload.get("email", "")).strip().lower()
    token = str(payload.get("token", "")).strip()
    password = str(payload.get("password", ""))
    if len(password) < 8:
        return JsonResponse({"detail": "Password must contain at least 8 characters."}, status=400)
    user = User.objects.filter(email__iexact=email).first() if email else None
    if user is None or not token or not default_token_generator.check_token(user, token):
        return JsonResponse({"detail": "The reset code is invalid or has expired."}, status=400)
    user.set_password(password)
    user.save(update_fields=["password"])
    return JsonResponse({"reset": True, "detail": "Your password has been reset. You can now log in."})


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    header = request.headers.get("Authorization", "")
    user = user_from_request(request)
    if header.startswith("Bearer ") and user is not None:
        raw_token = header.removeprefix("Bearer ").strip()
        ApiToken.objects.filter(token_hash=ApiToken.hash_token(raw_token)).delete()
    return JsonResponse({"logged_out": True})


@csrf_exempt
@require_api_user
@require_http_methods(["GET", "PATCH"])
def me(request):
    if request.method == "PATCH":
        payload = _json_body(request)
        if not isinstance(payload, dict):
            return JsonResponse({"detail": "Request body must be a JSON object."}, status=400)
        profile, _ = Profile.objects.get_or_create(user=request.api_user)
        changed = []
        for field in ("display_name", "barangay"):
            if field in payload:
                value = payload[field]
                if not isinstance(value, str) or len(value.strip()) > 120:
                    return JsonResponse({"detail": f"{field} must be text of 120 characters or fewer."}, status=400)
                if field == "display_name" and not value.strip():
                    return JsonResponse({"detail": "display_name cannot be empty."}, status=400)
                setattr(profile, field, value.strip())
                changed.append(field)
        if changed:
            profile.save(update_fields=changed)
    return JsonResponse({"user": _serialize_user(request.api_user, request)})


@csrf_exempt
@require_api_user
@require_http_methods(["POST"])
def profile_picture(request):
    upload = request.FILES.get("image")
    if upload is None or upload.size > 5 * 1024 * 1024:
        return JsonResponse({"detail": "Choose an image smaller than 5 MB."}, status=400)
    try:
        with Image.open(upload) as image:
            image.verify()
            image_format = image.format
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return JsonResponse({"detail": "Choose a valid JPEG, PNG, or WebP image."}, status=400)
    if image_format not in {"JPEG", "PNG", "WEBP"}:
        return JsonResponse({"detail": "Choose a JPEG, PNG, or WebP image."}, status=400)
    upload.seek(0)
    profile, _ = Profile.objects.get_or_create(user=request.api_user)
    old_picture = profile.profile_picture
    extension = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[image_format]
    profile.profile_picture.save(f"profile-{request.api_user.id}.{extension}", upload, save=True)
    if old_picture and old_picture.name != profile.profile_picture.name:
        old_picture.delete(save=False)
    return JsonResponse({"user": _serialize_user(request.api_user, request)})


@require_api_admin
@require_http_methods(["GET"])
def admin_overview(request):
    """Return privacy-preserving dashboard metrics and anonymized activity."""
    users = User.objects.order_by("-date_joined")
    records = PredictionRecord.objects.select_related("user").order_by("-created_at")[:20]
    category_counts = {}
    for row in PredictionRecord.objects.values("decision").annotate(count=Count("id")):
        decision = row["decision"] if row["decision"] in SUPPORTED_DECISIONS else "unknown_unsupported"
        category_counts[decision] = category_counts.get(decision, 0) + row["count"]
    recent_predictions = [
        {
            "id": record.id,
            "reference": f"scan-{record.id:04d}",
            "title": _safe_prediction_values(record)[1],
            "decision": _safe_prediction_values(record)[0],
            "confidence": record.confidence,
            "created_at": record.created_at.isoformat(),
        }
        for record in records
    ]
    return JsonResponse(
        {
            "users_count": users.count(),
            "predictions_count": PredictionRecord.objects.count(),
            "admin_count": users.filter(is_staff=True).count(),
            "category_counts": category_counts,
            "recent_predictions": recent_predictions,
        }
    )


@require_api_admin
@require_http_methods(["GET"])
def admin_prediction_detail(request, prediction_id):
    """Return one record only after an administrator explicitly opens it.

    The overview intentionally excludes email addresses and image URLs. This
    endpoint is the deliberate, auditable detail action for model evaluation.
    """
    record = PredictionRecord.objects.filter(id=prediction_id).first()
    if record is None:
        return JsonResponse({"detail": "Prediction not found."}, status=404)
    decision, title = _safe_prediction_values(record)
    return JsonResponse(
        {
            "id": record.id,
            "reference": f"scan-{record.id:04d}",
            "user_id": record.user_id,
            "title": title,
            "decision": decision,
            # Do not expose generic baseline labels such as ``glass`` in the
            # admin UI; the only public class is the scope-safe decision.
            "model_class": decision,
            "confidence": record.confidence,
            "threshold": record.threshold,
            "model_version": record.model_version,
            "quantity": record.quantity,
            "condition": record.condition,
            "previous_contents": record.previous_contents,
            "answers": record.answers,
            "selected_recommendation": record.selected_recommendation,
            "created_at": record.created_at.isoformat(),
            "image_url": record.image.url if record.image else None,
        }
    )
