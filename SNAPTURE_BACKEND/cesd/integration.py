"""Read-only connection evidence, without credentials or resident records."""
from django.contrib import admin
from django.db import connection
from django.http import JsonResponse
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .models import Announcement, Material, Policy, Schedule
from .views import mobile_activity, staff_required


@staff_required()
@require_http_methods(['GET'])
def status(request):
    # A real query is required: never display a fabricated "connected" status.
    with connection.cursor() as cursor:
        cursor.execute('SELECT 1')
        connected = cursor.fetchone()[0] == 1
    from predictions.models import PredictionRecord, ScanScene, UserProject
    today = timezone.localdate()
    models = (Policy, Material, Announcement, Schedule, PredictionRecord, ScanScene, UserProject)
    return JsonResponse({
        'checked_at': timezone.now().isoformat(),
        'shared_backend': True,
        'database': {'connected': connected, 'engine': connection.vendor},
        'django_admin_url': reverse('admin:index') if admin.site.has_permission(request) else None,
        'content': {name: {'published': model.objects.filter(status='Published').count(),
                          'draft': model.objects.filter(status='Draft').count()}
                    for name, model in (('policies', Policy), ('materials', Material), ('announcements', Announcement))},
        'schedules': Schedule.objects.count(),
        'mobile_activity': mobile_activity(today.replace(year=1, month=1, day=1), today),
        'registered_models': [model._meta.label_lower for model in models if admin.site.is_registered(model)],
        'sync': 'Refresh the mobile screen to fetch published changes. No push or real-time subscription.',
        'privacy': 'CESD reports show totals, not resident identities or private scan photos.',
    })
