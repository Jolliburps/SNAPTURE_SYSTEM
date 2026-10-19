from django.contrib import admin
from django.core.exceptions import ValidationError
from .content import publish, review, publish_notice
from .models import CollectionNotice, Guidance


@admin.register(Guidance)
class GuidanceAdmin(admin.ModelAdmin):
    list_display = ("title", "kind", "material", "version", "state", "reviewed_by")
    list_filter = ("state", "kind", "material")
    search_fields = ("title", "source", "key")
    readonly_fields = ("state", "reviewed_by", "reviewed_at", "published_at", "content_digest")
    actions = ("review_selected", "publish_selected", "archive_selected")

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.state != "draft":
            return tuple(field.name for field in obj._meta.fields)
        return self.readonly_fields

    def _transition(self, request, queryset, operation):
        for entry in queryset:
            try:
                operation(entry, request.user)
            except (ValidationError, PermissionError) as error:
                self.message_user(request, f"{entry}: {error}", level="ERROR")

    @admin.action(description="Review selected drafts", permissions=["review"])
    def review_selected(self, request, queryset):
        self._transition(request, queryset, review)

    @admin.action(description="Publish reviewed versions", permissions=["review"])
    def publish_selected(self, request, queryset):
        self._transition(request, queryset, publish)

    @admin.action(description="Archive selected content", permissions=["review"])
    def archive_selected(self, request, queryset):
        queryset.update(state="archived")

    def has_review_permission(self, request):
        return request.user.has_perm("core.review_guidance")


@admin.register(CollectionNotice)
class CollectionNoticeAdmin(admin.ModelAdmin):
    list_display = ("barangay", "title", "collection_date", "published")
    search_fields = ("barangay", "title")
    readonly_fields = ("published", "published_at", "published_digest")
    actions = ("publish_selected", "withdraw_selected")

    @admin.action(description="Publish checked collection notices", permissions=["review"])
    def publish_selected(self, request, queryset):
        for notice in queryset:
            try:
                publish_notice(notice, request.user)
            except (PermissionError, ValidationError) as error:
                self.message_user(request, str(error), level="ERROR")

    @admin.action(description="Withdraw collection notices", permissions=["review"])
    def withdraw_selected(self, request, queryset):
        queryset.update(published=False)

    def has_review_permission(self, request):
        return request.user.has_perm("core.review_guidance")
