"""User-owned projects started from saved scan recommendations."""

from __future__ import annotations

import json

from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import require_api_user

from .models import PredictionRecord, UserProject


def _body(request):
    try:
        value = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _serialize(project):
    steps = project.steps if isinstance(project.steps, list) else []
    completed = sorted({index for index in project.completed_steps if type(index) is int and 0 <= index < len(steps)})
    count = len(completed)
    total = len(steps)
    return {
        "id": project.id,
        "source_prediction_id": project.source_prediction_id,
        "recommendation_id": project.recommendation_id,
        "title": project.title,
        "material": project.material,
        "summary": project.summary,
        "materials": project.materials,
        "steps": steps,
        "safety_note": project.safety_note,
        "completed_steps": completed,
        "completed_count": count,
        "total_steps": total,
        "progress_percent": round(count * 100 / total) if total else 0,
        "status": "completed" if total and count == total else "active",
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


@csrf_exempt
@require_api_user
@require_http_methods(["GET", "POST"])
def projects(request):
    if request.method == "GET":
        rows = UserProject.objects.filter(user=request.api_user)
        return JsonResponse({"projects": [_serialize(row) for row in rows]})

    payload = _body(request)
    if payload is None or type(payload.get("prediction_id")) is not int:
        return JsonResponse({"detail": "A valid prediction_id is required."}, status=400)
    record = PredictionRecord.objects.filter(user=request.api_user, pk=payload["prediction_id"]).first()
    if record is None:
        return JsonResponse({"detail": "Saved scan not found."}, status=404)
    selected = record.selected_recommendation
    choice = next(
        (item for item in record.recommendation_choices if isinstance(item, dict) and item.get("id") == selected),
        None,
    )
    if not selected or choice is None:
        return JsonResponse({"detail": "Select a recommendation for this scan before starting a project."}, status=400)
    steps = choice.get("steps")
    if not isinstance(steps, list) or not steps or any(not isinstance(step, str) or not step.strip() for step in steps):
        return JsonResponse({"detail": "This recommendation has no usable text steps."}, status=400)
    with transaction.atomic():
        project, created = UserProject.objects.get_or_create(
            user=request.api_user,
            source_prediction=record,
            recommendation_id=selected,
            defaults={
                "title": str(choice.get("title", "Project"))[:160],
                "material": record.title[:160],
                "summary": str(choice.get("summary", "")),
                "materials": choice.get("materials") if isinstance(choice.get("materials"), list) else [],
                "steps": steps,
                "safety_note": str(choice.get("safety_note", "")),
            },
        )
    return JsonResponse({"project": _serialize(project)}, status=201 if created else 200)


@csrf_exempt
@require_api_user
@require_http_methods(["PATCH"])
def project_step(request, project_id, step_index):
    project = UserProject.objects.filter(user=request.api_user, pk=project_id).first()
    if project is None:
        return JsonResponse({"detail": "Project not found."}, status=404)
    payload = _body(request)
    if payload is None or type(payload.get("completed")) is not bool:
        return JsonResponse({"detail": "completed must be true or false."}, status=400)
    if step_index >= len(project.steps):
        return JsonResponse({"detail": "Project step not found."}, status=404)
    completed = {index for index in project.completed_steps if type(index) is int and 0 <= index < len(project.steps)}
    if payload["completed"]:
        completed.add(step_index)
    else:
        completed.discard(step_index)
    project.completed_steps = sorted(completed)
    project.save(update_fields=["completed_steps", "updated_at"])
    return JsonResponse({"project": _serialize(project)})
