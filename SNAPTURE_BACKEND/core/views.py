from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .materials import public_materials
from .ml_service import model_status
from .auth import require_api_user
from .content import is_publishable, notice_digest, published_guidance
from .models import CollectionNotice


@require_GET
def health(request):
    status = model_status()
    return JsonResponse({"status": "ok" if status["loaded"] else "degraded", "backend": "django", "model": status})


@require_GET
def materials(request):
    return JsonResponse({"materials": public_materials()})


@require_GET
def learning_information(request):
    entries = [{"key": entry.key, "version": entry.version, "title": entry.title,
                "category": entry.category, "summary": entry.summary, "instructions": entry.instructions,
                "warnings": entry.warnings, "source": entry.source, "review_note": entry.review_note,
                "review_level": entry.review_level}
               for entry in published_guidance() if entry.kind == "information"]
    return JsonResponse({"entries": entries})


@require_api_user
@require_GET
def collection_notices(request):
    from datetime import date
    month = request.GET.get("month", date.today().strftime("%Y-%m"))
    try:
        start = date.fromisoformat(month + "-01")
    except ValueError:
        return JsonResponse({"detail": "month must have YYYY-MM format."}, status=400)
    profile = getattr(request.api_user, "profile", None)
    barangay = (getattr(profile, "barangay", "") or "").strip()
    if not barangay:
        return JsonResponse({"entries": [], "status": "select_barangay"})
    rows = CollectionNotice.objects.select_related("guidance").filter(published=True, barangay__iexact=barangay, collection_date__year=start.year, collection_date__month=start.month)
    current_sources = {entry.pk for entry in published_guidance() if entry.kind == "information"}
    entries = [{"date": row.collection_date.isoformat(), "barangay": row.barangay, "title": row.title,
                "status": "Published source-based information", "description": row.description,
                "source": row.guidance.source}
               for row in rows if row.guidance_id in current_sources and row.published_digest == notice_digest(row) and is_publishable(row.guidance)]
    return JsonResponse({"entries": entries, "status": "available" if entries else "unavailable"})
