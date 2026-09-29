from __future__ import annotations

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .materials import public_materials
from .ml_service import model_status


@require_GET
def health(request):
    status = model_status()
    return JsonResponse({"status": "ok" if status["loaded"] else "degraded", "backend": "django", "model": status})


@require_GET
def materials(request):
    return JsonResponse({"materials": public_materials()})
