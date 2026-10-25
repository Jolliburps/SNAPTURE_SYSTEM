"""The same CESD records and validation used by the web panel and mobile API."""
from django import forms
from django.contrib import admin
from django.urls import reverse

from .forms import AnnouncementForm, MaterialForm, PolicyForm, ScheduleForm
from .models import Activity, Announcement, Material, Policy, Schedule, StaffAccess
from .views import audit


def cesd_access(request, owner=False):
    user = request.user
    return bool(user.is_active and user.is_staff and
                StaffAccess.objects.filter(user=user, **({'access': 'owner'} if owner else {})).exists())


class AttachmentInput(forms.ClearableFileInput):
    """Keep draft downloads behind the same access checks as the web panel."""
    def __init__(self, url):
        super().__init__()
        self.preview_url = url

    def get_context(self, name, value, attrs):
        context = super().get_context(name, value, attrs)
        if value and self.preview_url:
            class Reference:
                url = self.preview_url

                def __str__(self):
                    return str(value)
            context['widget']['value'] = Reference()
        return context


class ContentAdmin(admin.ModelAdmin):
    readonly_fields = ('updated_by', 'created_at', 'updated_at')
    actions = None
    list_select_related = ('updated_by',)
    search_fields = ('title', 'description')
    list_display = ('title', 'status', 'updated_by', 'updated_at')
    list_filter = ('status',)
    resource = ''

    def has_module_permission(self, request):
        return cesd_access(request) or super().has_module_permission(request)

    def has_view_permission(self, request, obj=None):
        return cesd_access(request) or super().has_view_permission(request, obj)

    def has_add_permission(self, request):
        return cesd_access(request) or super().has_add_permission(request)

    def has_change_permission(self, request, obj=None):
        return cesd_access(request) or super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        # The web workflow withdraws content/cancels schedules instead of deleting.
        return False

    def get_form(self, request, obj=None, **kwargs):
        form = super().get_form(request, obj, **kwargs)
        if obj and 'attachment' in form.base_fields:
            form.base_fields['attachment'].widget = AttachmentInput(
                reverse('cesd-file', args=[self.resource, obj.pk]))
        return form

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        audit(request.user, ('Updated ' if change else 'Created ') + obj._meta.model_name + ' via Django admin', obj)


class PublishedContentAdmin(ContentAdmin):
    readonly_fields = (*ContentAdmin.readonly_fields, 'published_at')
    list_filter = ('status', 'category')


@admin.register(Policy)
class PolicyAdmin(PublishedContentAdmin):
    form = PolicyForm
    resource = 'policies'


@admin.register(Material)
class MaterialAdmin(PublishedContentAdmin):
    form = MaterialForm
    resource = 'materials'
    list_filter = ('status', 'material_type', 'category')


@admin.register(Announcement)
class AnnouncementAdmin(PublishedContentAdmin):
    form = AnnouncementForm


@admin.register(Schedule)
class ScheduleAdmin(ContentAdmin):
    form = ScheduleForm
    list_display = ('waste_type', 'barangay', 'collection_date', 'start_time', 'end_time', 'status', 'updated_by')
    list_filter = ('status', 'waste_type', 'barangay')
    search_fields = ('barangay', 'waste_type', 'notes')
    date_hierarchy = 'collection_date'


class OwnerReadOnlyAdmin(admin.ModelAdmin):
    actions = None

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_module_permission(self, request):
        return self.has_view_permission(request)

    def has_view_permission(self, request, obj=None):
        return cesd_access(request, owner=True) or super().has_view_permission(request, obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Activity)
class ActivityAdmin(OwnerReadOnlyAdmin):
    list_display = ('timestamp', 'actor', 'action', 'record_type', 'record_label')
    list_filter = ('record_type',)
    search_fields = ('action', 'record_label')
    list_select_related = ('actor',)


@admin.register(StaffAccess)
class StaffAccessAdmin(OwnerReadOnlyAdmin):
    list_display = ('user', 'access', 'department')
    list_select_related = ('user',)
    search_fields = ('user__email', 'department')
    # Account changes stay in Settings -> Staff Access so setup mail, owner
    # protection and session revocation cannot be bypassed by editing this row.
