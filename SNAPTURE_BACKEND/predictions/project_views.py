"""User-owned projects started from saved scan recommendations."""

from __future__ import annotations

import json

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import require_api_user
from core.assessment import refresh

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
        "reference": project.reference,
        "completed_steps": completed,
        "completed_count": count,
        "total_steps": total,
        "progress_percent": round(count * 100 / total) if total else 0,
        "status": "completed" if total and count == total else "active",
        "can_change_idea": _can_change_idea(project),
        "created_at": project.created_at.isoformat(),
        "updated_at": project.updated_at.isoformat(),
    }


def _can_change_idea(project):
    reference = project.reference if isinstance(project.reference, dict) else {}
    return bool(project.source_prediction_id and project.steps and not project.completed_steps
                and not reference.get('_progress_started_at'))


def _project_choices(record, allow_catalog):
    """Same material, condition and safety gates for starting or changing a task."""
    refresh(record)
    if record.image_quality.get('automatic_routing'):
        from .item_actions import automatic_route
        from .views import _serialize as serialize_prediction
        item = getattr(record, 'scene_item', None)
        route = automatic_route(item, serialize_prediction(record)) if item else None
        if (not record.image_quality.get('selected_for_disposal') or not route or
                route['action'] != 'recover' or route['confirmation_required']):
            return []
    choices = record.recommendation_choices
    action = record.image_quality.get('item_action')
    if allow_catalog and (not action or action == 'recover' and record.condition == 'Clean and dry'):
        choices = [*choices, *record.assessment['upcycling'].get('suggested_ideas', [])]
    if action in {'keep', 'discard'}:
        return []
    if action == 'recover':
        from .item_actions import advice
        from .views import _serialize as serialize_prediction
        from .disposal_workflow import handling
        item = getattr(record, 'scene_item', None)
        prediction = serialize_prediction(record)
        allowed = advice(item, prediction, handling(item, prediction))['projects'] if item else []
        allowed_ids = {idea['id'] for idea in allowed}
        choices = [choice for choice in choices if choice['id'] in allowed_ids]
    return [choice for choice in choices if isinstance(choice, dict) and
            isinstance(choice.get('steps'), list) and choice['steps'] and
            all(isinstance(step, str) and step.strip() for step in choice['steps'])]


def _project_values(record, choice):
    return {
        'title': str(choice.get('title', 'Project'))[:160], 'material': record.title[:160],
        'summary': str(choice.get('summary', '')),
        'materials': choice.get('materials') if isinstance(choice.get('materials'), list) else [],
        'steps': choice['steps'], 'safety_note': str(choice.get('safety_note', '')),
        'reference': choice.get('review', {}) if choice.get('basis') != 'educational_catalog' else {
            'review_level': 'educational', 'catalog_version': 'v1',
            'source': 'SNAPTURE built-in upcycling idea catalog',
        },
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
    selected = payload.get('recommendation_id', record.selected_recommendation)
    if not isinstance(selected, str) or len(selected) > 160:
        return JsonResponse({'detail':'Choose a valid upcycling task.'},status=400)
    choices = _project_choices(record, allow_catalog='recommendation_id' in payload)
    if record.image_quality.get('item_action') in {'keep','discard'}:
        return JsonResponse({'detail':'Confirm a supported material and suitable condition before starting a project.'},status=400)
    choice = next(
        (item for item in choices if isinstance(item, dict) and item.get("id") == selected),
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
            defaults=_project_values(record, choice),
        )
    return JsonResponse({"project": _serialize(project)}, status=201 if created else 200)


@csrf_exempt
@require_api_user
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def project_ideas(request, project_id):
    project = UserProject.objects.select_for_update().filter(user=request.api_user, pk=project_id).first()
    if project is None:
        # A response can be lost after reusing another saved project. Resolve
        # only this owner's archived unused choice on an identical POST retry.
        if request.method == 'POST':
            payload=_body(request)
            selected=payload.get('recommendation_id') if payload else None
            for existing in UserProject.objects.select_for_update().filter(user=request.api_user):
                archives=(existing.reference or {}).get('_replaced_unstarted_choices',[])
                if selected == existing.recommendation_id and any(row.get('id') == project_id for row in archives):
                    return JsonResponse({'project':_serialize(existing),'replaced_project_id':project_id,'reused_existing':True})
        return JsonResponse({'detail': 'Project not found.'}, status=404)
    if not _can_change_idea(project):
        return JsonResponse({'detail': 'This project has already been started. Its idea cannot be changed.'}, status=409)
    record = PredictionRecord.objects.select_for_update().filter(user=request.api_user, pk=project.source_prediction_id).first()
    if record is None:
        return JsonResponse({'detail': 'The original scan is unavailable. Assess a suitable item again.'}, status=400)
    choices = _project_choices(record, allow_catalog=True)
    others = {row.recommendation_id:row for row in UserProject.objects.filter(user=request.api_user, source_prediction=record).exclude(pk=project.pk)}
    if request.method == 'GET':
        from .views import _serialize as serialize_prediction
        prediction=serialize_prediction(record, saved=True)
        item=getattr(record,'scene_item',None)
        source={'prediction_id':record.pk, 'material':record.title,
                'object_name':record.image_quality.get('user_object_name') or (item.name if item else record.title),
                'image_url':prediction['image_url']}
        return JsonResponse({'source':source,'ideas':[{**choice,**({'existing_project_id':others[choice['id']].pk,
                             'existing_project_status':_serialize(others[choice['id']])['status']} if choice['id'] in others else {})} for choice in choices]})
    payload = _body(request)
    selected = payload.get('recommendation_id') if payload else None
    if not isinstance(selected, str) or not selected or len(selected) > 160:
        return JsonResponse({'detail': 'Choose an available idea for this item.'}, status=400)
    if selected == project.recommendation_id:
        return JsonResponse({'project': _serialize(project)})  # Safe retry; no rewrite.
    choice = next((idea for idea in choices if idea['id'] == selected), None)
    if choice is None:
        return JsonResponse({'detail': 'This idea no longer matches the item. Check its material and condition.'}, status=400)
    if selected in others:
        # Reuse the existing project, never reset its progress or leave an unused
        # duplicate plan. Preserve the unstarted choice as recoverable metadata.
        existing=UserProject.objects.select_for_update().get(pk=others[selected].pk)
        archive={key:_serialize(project)[key] for key in ('id','source_prediction_id','recommendation_id','title','material','summary','materials','steps','safety_note','created_at')}
        archive['reference']=project.reference
        history=(existing.reference or {}).get('_replaced_unstarted_choices',[])
        existing.reference={**(existing.reference or {}),'_replaced_unstarted_choices':[*history,archive]}
        existing.save(update_fields=['reference'])
        replaced_id=project.pk
        project.delete()
        return JsonResponse({'project':_serialize(existing),'replaced_project_id':replaced_id,'reused_existing':True})
    history = (project.reference or {}).get('_idea_changes', [])
    values = _project_values(record, choice)
    values['reference'] = {**values['reference'], '_idea_changes': [*history[-19:], {
        'from': project.recommendation_id, 'to': selected, 'at': timezone.now().isoformat(),
    }]}
    for field, value in values.items():
        setattr(project, field, value)
    project.recommendation_id = selected
    try:
        with transaction.atomic():
            project.save(update_fields=[*values, 'recommendation_id', 'updated_at'])
    except IntegrityError:
        return JsonResponse({'detail': 'That idea was just added to My projects. Reopen the project list.'}, status=409)
    return JsonResponse({'project': _serialize(project)})


@csrf_exempt
@require_api_user
@require_http_methods(["PATCH"])
@transaction.atomic
def project_step(request, project_id, step_index):
    project = UserProject.objects.select_for_update().filter(user=request.api_user, pk=project_id).first()
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
        project.reference = {**(project.reference or {}), '_progress_started_at':
                             (project.reference or {}).get('_progress_started_at') or timezone.now().isoformat()}
    else:
        completed.discard(step_index)
    project.completed_steps = sorted(completed)
    project.save(update_fields=["completed_steps", "reference", "updated_at"])
    return JsonResponse({"project": _serialize(project)})


@csrf_exempt
@require_api_user
@require_http_methods(['POST'])
@transaction.atomic
def restart_project(request, project_id):
    project = UserProject.objects.select_for_update().filter(user=request.api_user,pk=project_id).first()
    if project is None:
        return JsonResponse({'detail':'Project not found.'},status=404)
    if _serialize(project)['status'] != 'completed':
        return JsonResponse({'detail':'Only a completed project can be restarted.'},status=409)
    record = PredictionRecord.objects.filter(user=request.api_user,pk=project.source_prediction_id).first()
    if record is None:
        return JsonResponse({'detail':'Assess a suitable item again before starting another project.'},status=400)
    refresh(record)
    choices = record.recommendation_choices
    if project.reference.get('review_level') == 'educational':
        choices = [*choices, *record.assessment['upcycling'].get('suggested_ideas', [])]
    if not any(choice['id']==project.recommendation_id for choice in choices):
        return JsonResponse({'detail':'This project no longer matches current guidance. Assess the material again.'},status=400)
    project.completed_steps = []
    project.reference = {**(project.reference or {}), '_progress_started_at':
                         (project.reference or {}).get('_progress_started_at') or timezone.now().isoformat()}
    project.save(update_fields=['completed_steps','reference','updated_at'])
    return JsonResponse({'project':_serialize(project)})
