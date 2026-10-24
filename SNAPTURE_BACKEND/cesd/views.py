import csv
import json
import mimetypes
import re
from pathlib import Path
from datetime import date, datetime, time, timedelta
from heapq import merge
from functools import wraps
from urllib.parse import urlencode
from django.conf import settings
from django.contrib.auth import authenticate, login as session_login, logout as session_logout
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.http import FileResponse, Http404, HttpResponse, JsonResponse, StreamingHttpResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.http import require_http_methods
from django.views.static import serve
from accounts.models import ApiToken, Profile
from core.auth import user_from_request
from core import views as core_views
from .forms import BARANGAYS, AnnouncementForm, MaterialForm, PolicyForm, ScheduleForm
from .models import Activity, Announcement, Material, Policy, Schedule, StaffAccess


def audit(actor, action, record):
    label = f'{record.waste_type} · {record.barangay} · {record.collection_date}' if isinstance(record, Schedule) else (getattr(record, 'title', None) or getattr(record, 'email', None) or str(record))
    Activity.objects.create(actor=actor, action=action, record_type=record.__class__.__name__,
        record_id=str(record.pk), record_label=label[:180])


def revoke_access(user):
    ApiToken.objects.filter(user=user).delete()
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
        if session.get_decoded().get('_auth_user_id') == str(user.pk):
            session.delete()


def staff_required(owner=False):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            user = request.user
            if not user.is_authenticated or not user.is_active:
                return JsonResponse({'detail': 'Sign in with an active CESD account.'}, status=401)
            access = StaffAccess.objects.filter(user=user).first()
            if access is None or (owner and access.access != 'owner'):
                return JsonResponse({'detail': 'Account Owner access required.' if owner else 'CESD staff access required.'}, status=403)
            request.cesd_access = access
            request.activity_user_id = user.pk
            return view(request, *args, **kwargs)
        return wrapped
    return decorator


def json_body(request):
    try:
        data = json.loads(request.body or '{}')
        if not isinstance(data, dict):
            raise ValueError()
        return data
    except (ValueError, UnicodeDecodeError):
        raise ValidationError('Request body must be a JSON object.')


def errors(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        try:
            return view(*args, **kwargs)
        except ValidationError as error:
            return JsonResponse({'detail': ' '.join(error.messages)}, status=400)
        except IntegrityError:
            return JsonResponse({'detail': 'An account with this email already exists.'}, status=409)
    return wrapped


def text(data, field, maximum=120):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > maximum:
        raise ValidationError(f'{field.replace("_", " ").title()} must be 1–{maximum} characters.')
    return value.strip()


def staff_json(user):
    return {'id': user.pk, 'name': user.profile.display_name or user.username, 'email': user.email,
        'department': user.cesd_access.department, 'access': user.cesd_access.access,
        'status': 'Active' if user.is_active else 'Deactivated', 'setup_pending': not user.has_usable_password()}


@require_http_methods(['GET'])
def csrf(request):
    return JsonResponse({'csrf': get_token(request)})


@require_http_methods(['POST'])
@errors
def login(request):
    data = json_body(request)
    email = text(data, 'email', 254).lower()
    account = User.objects.filter(email__iexact=email).first()
    password = data.get('password', '')
    user = authenticate(request, username=account.username if account else email, password=password if isinstance(password, str) else '')
    if user is None or not StaffAccess.objects.filter(user=user).exists():
        return JsonResponse({'detail': 'Invalid email or password, or this CESD account is inactive.'}, status=401)
    session_login(request, user)
    audit(user, 'Signed in', user)
    return JsonResponse({'user': staff_json(user), 'csrf': get_token(request)})


@require_http_methods(['POST'])
def logout(request):
    session_logout(request)
    return JsonResponse({'logged_out': True})


@staff_required()
@require_http_methods(['GET', 'PATCH'])
@errors
def me(request):
    user = request.user
    if request.method == 'PATCH':
        data = json_body(request)
        name, email = text(data, 'name'), text(data, 'email', 254).lower()
        validate_email(email)
        if email != user.email:
            current_password = data.get('current_password', '')
            if not isinstance(current_password, str) or not user.check_password(current_password):
                raise ValidationError('Enter your current password to change your email.')
            if User.objects.exclude(pk=user.pk).filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
                raise ValidationError('This email address is already in use.')
        with transaction.atomic():
            user.email = email
            user.save(update_fields=['email'])
            Profile.objects.filter(user=user).update(display_name=name)
            audit(user, 'Updated own profile', user)
        user.refresh_from_db()
    return JsonResponse({'user': staff_json(user)})


def setup_message(user):
    params = urlencode({'uid': urlsafe_base64_encode(force_bytes(user.pk)), 'token': default_token_generator.make_token(user)})
    url = f'{settings.ADMIN_WEB_URL}/account-setup?{params}'
    send_mail('Set your SNAPTURE CESD password', f'Set your individual password using this single-use link (expires in 24 hours):\n\n{url}\n\nIf you did not request this, contact the CESD account owner.', settings.DEFAULT_FROM_EMAIL, [user.email])


@require_http_methods(['POST'])
@errors
def password_request(request):
    data = json_body(request)
    user = User.objects.filter(email__iexact=str(data.get('email', '')).strip(), is_active=True, cesd_access__isnull=False).first()
    if user:
        setup_message(user)
        if request.user.is_authenticated and StaffAccess.objects.filter(user=request.user).exists():
            audit(request.user, 'Requested password instructions', user)
    return JsonResponse({'detail': 'If an active CESD account exists, password instructions have been prepared.'})


@require_http_methods(['POST'])
@errors
def password_confirm(request):
    data = json_body(request)
    try:
        uid = urlsafe_base64_decode(str(data.get('uid', ''))).decode()
        user = User.objects.get(pk=uid, is_active=True, cesd_access__isnull=False)
    except (ValueError, UnicodeDecodeError, User.DoesNotExist, OverflowError):
        raise ValidationError('This setup link is invalid or expired.')
    if not default_token_generator.check_token(user, str(data.get('token', ''))):
        raise ValidationError('This setup link is invalid or expired.')
    password = data.get('password', '')
    if not isinstance(password, str) or not 8 <= len(password) <= 128:
        raise ValidationError('Password must be 8–128 characters.')
    validate_password(password, user)
    with transaction.atomic():
        user.set_password(password)
        user.save(update_fields=['password'])
        revoke_access(user)
        audit(user, 'Set account password', user)
    return JsonResponse({'detail': 'Password saved. You can now sign in.'})


@staff_required(owner=True)
@require_http_methods(['GET', 'POST', 'PATCH'])
@errors
def staff(request, pk=None):
    if request.method == 'GET':
        return JsonResponse({'results': [staff_json(u) for u in User.objects.filter(cesd_access__isnull=False).select_related('profile', 'cesd_access').order_by('pk')]})
    data = json_body(request)
    with transaction.atomic():
        if pk:
            user = get_object_or_404(User.objects.select_for_update(), pk=pk, cesd_access__access='staff')
        else:
            user = User(is_staff=True)
            user.set_unusable_password()
        name, email = text(data, 'name'), text(data, 'email', 254).lower()
        department = text(data, 'department')
        validate_email(email)
        if User.objects.exclude(pk=user.pk).filter(Q(email__iexact=email) | Q(username__iexact=email)).exists():
            raise ValidationError('An account with this email already exists. Resident accounts cannot be converted here.')
        if data.get('status', 'Active') not in {'Active', 'Deactivated'}:
            raise ValidationError('Invalid account status.')
        email_changed = bool(pk and email != user.email)
        was_active = user.is_active
        user.email = email
        user.is_active = data.get('status', 'Active') == 'Active'
        if not pk:
            user.username = email
        if email_changed:
            user.set_unusable_password()
        user.save()
        Profile.objects.update_or_create(user=user, defaults={'display_name': name, 'role': 'admin'})
        StaffAccess.objects.update_or_create(user=user, defaults={'department': department, 'access': 'staff'})
        if not user.is_active or email_changed:
            revoke_access(user)
        action = 'Updated staff account' if pk else 'Created staff account'
        if pk and was_active != user.is_active:
            action = 'Activated staff account' if user.is_active else 'Deactivated staff account'
        audit(request.user, action, user)
        if user.is_active and (not pk or email_changed or (not was_active and not user.has_usable_password())):
            # Transaction rollback prevents half-created accounts on mail failure.
            setup_message(user)
    return JsonResponse({'user': staff_json(user), 'detail': 'Account saved. Password setup instructions have been prepared when needed.'}, status=200 if pk else 201)


@staff_required(owner=True)
@require_http_methods(['GET'])
def activity(request):
    page = Paginator(Activity.objects.select_related('actor', 'actor__profile'), 20).get_page(request.GET.get('page', 1))
    return JsonResponse({'results': [{'id': row.pk, 'actor': row.actor.profile.display_name or row.actor.email,
        'action': row.action, 'record_type': row.record_type, 'record_id': row.record_id,
        'record_label': row.record_label, 'timestamp': row.timestamp.isoformat()} for row in page], 'pages': page.paginator.num_pages, 'count': page.paginator.count})


RESOURCES = {'policies': (Policy, PolicyForm), 'materials': (Material, MaterialForm), 'schedules': (Schedule, ScheduleForm), 'announcements': (Announcement, AnnouncementForm)}


def record_json(row):
    result = {'id': row.pk, 'created_at': row.created_at.isoformat(), 'updated_at': row.updated_at.isoformat(),
        'updated_by': row.updated_by.profile.display_name or row.updated_by.email, 'status': row.status}
    if isinstance(row, Schedule):
        result.update({f: getattr(row, f) for f in ['waste_type', 'barangay', 'notes']})
        result.update(collection_date=row.collection_date.isoformat(), start_time=row.start_time.strftime('%H:%M'),
            end_time=row.end_time.strftime('%H:%M'), day=row.collection_date.strftime('%A'))
    else:
        result['published_at'] = row.published_at.isoformat() if row.published_at else None
        result.update({f: getattr(row, f) for f in ['title', 'category', 'description']})
        kind = 'policies' if isinstance(row, Policy) else 'materials'
        result['file_url'] = f'/api/cesd/files/{kind}/{row.pk}/' if getattr(row, 'attachment', None) else None
        if isinstance(row, Policy):
            result.update(content=row.content, effective_date=row.effective_date.isoformat())
        elif isinstance(row, Material):
            result['material_type'] = row.material_type
    return result


@staff_required()
@require_http_methods(['GET'])
def metadata(request):
    return JsonResponse({'barangays': BARANGAYS, 'categories': {
        'policies': list(Policy.objects.order_by('category').values_list('category', flat=True).distinct()),
        'materials': list(Material.objects.order_by('category').values_list('category', flat=True).distinct()),
        'announcements': list(Announcement.objects.order_by('category').values_list('category', flat=True).distinct())}})


def mobile_activity(start, end):
    """Current saved records, without resident identities or scan images."""
    from predictions.models import PredictionRecord, ScanScene, UserProject
    filters = {'created_at__date__gte': start, 'created_at__date__lte': end}
    predictions = PredictionRecord.objects.filter(**filters)
    projects = UserProject.objects.filter(**filters)
    completed = 0
    for row in projects.values('steps', 'completed_steps').iterator():
        steps = row['steps'] if isinstance(row['steps'], list) else []
        valid = {index for index in row['completed_steps'] if type(index) is int and 0 <= index < len(steps)}
        if steps and len(valid) == len(steps):
            completed += 1
    total_projects = projects.count()
    return {'scans': ScanScene.objects.filter(**filters).count() + predictions.filter(scene_item__isnull=True).count(),
        'items': predictions.count(), 'projects_started': total_projects,
        'projects_active': total_projects - completed, 'projects_completed': completed}


@staff_required()
@require_http_methods(['GET'])
@errors
def dashboard(request):
    month = request.GET.get('month') or timezone.localdate().strftime('%Y-%m')
    try:
        if not re.fullmatch(r'\d{4}-\d{2}', month):
            raise ValueError()
        start = date.fromisoformat(month + '-01')
        finish = date(start.year + 1, 1, 1) if start.month == 12 else date(start.year, start.month + 1, 1)
    except ValueError:
        raise ValidationError('Month must use YYYY-MM between 0001-01 and 9999-11.')
    zone = timezone.get_default_timezone()
    lower = timezone.make_aware(datetime.combine(start, time.min), zone)
    upper = timezone.make_aware(datetime.combine(finish, time.min), zone)
    counts, drafts, recent = {}, [], {}
    unknown = 0
    for kind, model in [('policies', Policy), ('materials', Material), ('announcements', Announcement)]:
        rows = model.objects.select_related('updated_by', 'updated_by__profile')
        # Half-open local month boundaries include the entire final day.
        updated = rows.filter(updated_at__gte=lower, updated_at__lt=upper).order_by('-updated_at', '-pk')
        counts[kind] = rows.filter(published_at__gte=lower, published_at__lt=upper).count()
        unknown += rows.filter(status='Published', published_at__isnull=True).count()
        pending = updated.filter(status='Draft')
        counts[kind + '_drafts'] = pending.count()
        drafts.append([{'type': kind, **record_json(row)} for row in pending[:3]])
        # CESD personnel can already see both Draft and Published content.
        recent[kind] = [record_json(row) for row in updated[:3]]
    schedules = Schedule.objects.filter(collection_date__gte=start, collection_date__lt=finish).select_related('updated_by', 'updated_by__profile').order_by('collection_date', 'start_time', 'pk')
    counts['schedules'] = schedules.count()
    counts['drafts'] = sum(counts.pop(kind + '_drafts') for kind in ('policies', 'materials', 'announcements'))
    return JsonResponse({'month': month, 'timezone': str(zone), 'start': start.isoformat(),
        'end': (finish - timedelta(days=1)).isoformat(), 'counts': counts,
        'unknown_publication_dates': unknown,
        'mobile_activity': mobile_activity(start, finish - timedelta(days=1)),
        'drafts': list(merge(*drafts, key=lambda row: (row['updated_at'], row['id'], row['type']), reverse=True))[:3],
        'schedules': [record_json(row) for row in schedules[:3]], **recent})


@staff_required()
@require_http_methods(['GET', 'POST'])
def records(request, resource, pk=None):
    if resource not in RESOURCES:
        raise Http404()
    model, form_class = RESOURCES[resource]
    row = get_object_or_404(model, pk=pk) if pk else None
    if request.method == 'POST':
        form = form_class(request.POST, request.FILES, instance=row)
        if not form.is_valid():
            return JsonResponse({'detail': ' '.join(f'{key.replace("_", " ").title()}: {" ".join(values)}' for key, values in form.errors.items())}, status=400)
        with transaction.atomic():
            row = form.save(commit=False)
            row.updated_by = request.user
            row.save()
            audit(request.user, ('Updated ' if pk else 'Created ') + {'policies': 'policy', 'materials': 'material', 'schedules': 'schedule', 'announcements': 'announcement'}[resource], row)
        return JsonResponse({'record': record_json(row)}, status=200 if pk else 201)
    if pk:
        return JsonResponse({'record': record_json(row)})
    rows = model.objects.select_related('updated_by', 'updated_by__profile').order_by('-updated_at', '-pk')
    search = request.GET.get('search', '').strip()
    if search:
        rows = rows.filter(Q(waste_type__icontains=search) | Q(barangay__icontains=search)) if resource == 'schedules' else rows.filter(Q(title__icontains=search) | Q(description__icontains=search))
    for field in ['status', 'category', 'material_type', 'waste_type', 'barangay']:
        if request.GET.get(field) and field in {f.name for f in model._meta.fields}:
            rows = rows.filter(**{field: request.GET[field]})
    if resource == 'schedules' and request.GET.get('month'):
        try:
            start = date.fromisoformat(request.GET['month'] + '-01')
        except ValueError:
            return JsonResponse({'detail': 'Month must use YYYY-MM.'}, status=400)
        rows = rows.filter(collection_date__year=start.year, collection_date__month=start.month)
    page = Paginator(rows, 10).get_page(request.GET.get('page', 1))
    return JsonResponse({'results': [record_json(r) for r in page], 'count': page.paginator.count, 'pages': page.paginator.num_pages, 'page': page.number})


@require_http_methods(['GET'])
def file_view(request, resource, pk):
    if resource not in {'policies', 'materials'}:
        raise Http404()
    row = get_object_or_404(RESOURCES[resource][0], pk=pk)
    if row.status != 'Published' and not (request.user.is_authenticated and request.user.is_active and StaffAccess.objects.filter(user=request.user).exists()):
        raise Http404()
    if not row.attachment:
        raise Http404()
    content_type = mimetypes.guess_type(row.attachment.name)[0] or 'application/octet-stream'
    file = row.attachment.open('rb')
    size = row.attachment.size
    requested_range = request.headers.get('Range', '')
    if requested_range:
        match = re.fullmatch(r'bytes=(\d*)-(\d*)', requested_range)
        if not match or not any(match.groups()):
            file.close()
            return HttpResponse(status=416, headers={'Content-Range': f'bytes */{size}'})
        begin, finish = match.groups()
        start = int(begin) if begin else max(0, size - int(finish))
        end = min(int(finish), size - 1) if begin and finish else size - 1
        if start > end or start >= size:
            file.close()
            return HttpResponse(status=416, headers={'Content-Range': f'bytes */{size}'})
        def chunks():
            try:
                file.seek(start)
                remaining = end - start + 1
                while remaining:
                    chunk = file.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk
            finally:
                file.close()
        response = StreamingHttpResponse(chunks(), status=206, content_type=content_type)
        response['Content-Range'] = f'bytes {start}-{end}/{size}'
        response['Content-Length'] = end - start + 1
    else:
        response = FileResponse(file, content_type=content_type)
    response['Accept-Ranges'] = 'bytes'
    response['X-Content-Type-Options'] = 'nosniff'
    response['X-Frame-Options'] = 'SAMEORIGIN'
    response['Cache-Control'] = 'no-store'
    return response


@require_http_methods(['GET'])
def legacy_media(request, filename):
    """Preserve existing resident images without exposing CESD draft storage."""
    root = Path(settings.MEDIA_ROOT).resolve()
    target = (root / filename).resolve()
    if target == root or not target.is_relative_to(root) or target.relative_to(root).parts[0] not in {'profile_pictures', 'predictions', 'scenes', 'dataset'}:
        raise Http404()
    if target.relative_to(root).parts[0] in {'scenes', 'predictions'}:
        from predictions.photo_privacy import protected_media
        return protected_media(request, path=target.relative_to(root).as_posix())
    return serve(request, filename, document_root=root)


@require_http_methods(['GET'])
def learning(request):
    legacy = json.loads(core_views.learning_information(request).content)['entries']
    entries = []
    for resource, model in [('policy', Policy), ('material', Material)]:
        for row in model.objects.filter(status='Published').select_related('updated_by', 'updated_by__profile').order_by('-updated_at'):
            data = record_json(row)
            entries.append({**data, 'key': f'cesd-{resource}-{row.pk}', 'version': 1, 'summary': row.description,
                'instructions': row.content.splitlines() if resource == 'policy' else [row.description], 'warnings': '',
                'source': 'CESD staff publication', 'review_note': 'Published information; not an assessment rule or expert-reviewed decision guidance.',
                'review_level': 'staff_published', 'content_type': resource})
    return JsonResponse({'entries': legacy + entries})


@require_http_methods(['GET'])
def announcements(request):
    rows = Announcement.objects.filter(status='Published').order_by('-published_at', '-pk')
    return JsonResponse({'entries': [{'id': str(row.pk), 'title': row.title,
        'description': row.description, 'category': row.category,
        'publishedAt': (row.published_at or row.updated_at).isoformat()} for row in rows]})


@require_http_methods(['GET'])
def collection(request):
    if 'month' not in request.GET:
        request.GET = request.GET.copy()
        request.GET['month'] = timezone.localdate().strftime('%Y-%m')
    response = core_views.collection_notices(request)
    if response.status_code != 200:
        return response
    result = json.loads(response.content)
    user = user_from_request(request)
    if user and not user.is_active:
        return JsonResponse({'detail': 'Account inactive.'}, status=401)
    barangay = getattr(getattr(user, 'profile', None), 'barangay', '')
    if barangay:
        month = request.GET.get('month', timezone.localdate().strftime('%Y-%m'))
        start = date.fromisoformat(month + '-01')
        rows = Schedule.objects.filter(barangay__iexact=barangay, collection_date__year=start.year, collection_date__month=start.month).order_by('collection_date', 'start_time', 'pk')
        result['entries'] += [{'id': f'cesd-schedule-{row.pk}', 'date': row.collection_date.isoformat(), 'barangay': row.barangay,
            'title': f'{row.waste_type} collection', 'status': row.status,
            'description': f'{row.start_time:%H:%M}–{row.end_time:%H:%M}. {row.notes}', 'source': 'CESD staff schedule'} for row in rows]
        result['status'] = 'available' if result['entries'] else 'unavailable'
    return JsonResponse(result)


def csv_safe(value):
    value = str(value)
    return "'" + value if value.lstrip().startswith(('=', '+', '-', '@', '\t', '\r')) else value


@staff_required()
@require_http_methods(['GET'])
@errors
def reports(request):
    try:
        start, end = date.fromisoformat(request.GET.get('start', '')), date.fromisoformat(request.GET.get('end', ''))
    except ValueError:
        raise ValidationError('Select a valid start and end date.')
    if start > end:
        raise ValidationError('Start date must be on or before end date.')
    selected = request.GET.get('type', 'all')
    if selected not in {*RESOURCES, 'all'}:
        raise ValidationError('Invalid report type.')
    rows, counts = [], {}
    for kind, (model, _) in RESOURCES.items():
        field = 'collection_date' if kind == 'schedules' else 'updated_at__date'
        records = model.objects.filter(**{f'{field}__gte': start, f'{field}__lte': end}).select_related('updated_by', 'updated_by__profile').order_by('pk')
        counts[kind] = records.count()
        counts[kind + '_statuses'] = {status: records.filter(status=status).count() for status, _ in model._meta.get_field('status').choices}
        if selected in {'all', kind}:
            rows.extend({'type': kind, **record_json(row)} for row in records)
    if request.GET.get('format') == 'csv':
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="snapture-{selected}-{start}-{end}.csv"'
        response.write('\ufeff')
        writer = csv.writer(response)
        fields = ['type', 'id', 'title', 'category', 'description', 'content', 'material_type', 'effective_date', 'waste_type', 'barangay', 'collection_date', 'start_time', 'end_time', 'notes', 'status', 'updated_by', 'created_at', 'updated_at']
        writer.writerow(fields)
        writer.writerows([[csv_safe(row.get(key, '')) for key in fields] for row in rows])
        Activity.objects.create(actor=request.user, action='Exported CSV report', record_type='Report', record_id=selected, record_label=f'{selected}: {start} to {end}')
        return response
    page = Paginator(rows, 10).get_page(request.GET.get('page', 1))
    return JsonResponse({'results': list(page), 'counts': counts, 'mobile_activity': mobile_activity(start, end), 'count': len(rows), 'pages': page.paginator.num_pages, 'page': page.number})
