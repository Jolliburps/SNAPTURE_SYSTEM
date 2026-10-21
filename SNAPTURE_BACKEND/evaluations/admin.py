from django.contrib import admin
from django.core.exceptions import PermissionDenied, ValidationError
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils.html import format_html
from django.utils import timezone

from .models import EvaluationCase, EvaluationRun, RecommendationJudgment
from .scorecards import adjudicate, capture, freeze, lock_protocol, report
from .views import scorecard_response


@admin.register(EvaluationRun)
class EvaluationRunAdmin(admin.ModelAdmin):
    list_display = ("name", "split", "dataset_version", "created_at", "frozen_at", "scorecard")
    list_filter = ("split", "held_out_confirmed")
    readonly_fields = ("created_by", "created_at", "protocol_locked_at", "frozen_at", "frozen_report", "scorecard")
    actions = ("lock_selected_protocols", "freeze_selected")

    def scorecard(self, obj):
        return format_html('<a href="{}">Open evaluation scorecard</a>', reverse("admin:evaluations_scorecard", args=[obj.pk])) if obj.pk else "Save this run first."

    def get_urls(self):
        return [path("<int:pk>/scorecard/", self.admin_site.admin_view(self.view_scorecard), name="evaluations_scorecard")] + super().get_urls()

    def view_scorecard(self, request, pk):
        obj = self.get_object(request, pk)
        if not obj or not self.has_view_permission(request, obj):
            raise PermissionDenied
        if request.GET.get("format") in {"csv", "json"}:
            return scorecard_response(obj, request.GET["format"])
        return TemplateResponse(request, "evaluations/report.html", {**self.admin_site.each_context(request), "title": "SNAPTURE evaluation scorecard", "report": report(obj), "run": obj})

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.frozen_at:
            return tuple(field.name for field in obj._meta.fields) + ("scorecard",)
        return self.readonly_fields + (("protocol", "split", "dataset_version", "separation_notes", "held_out_confirmed") if obj and obj.protocol_locked_at else ())

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False

    def has_review_permission(self, request):
        return request.user.has_perm("evaluations.review_evaluationcase")

    @admin.action(description="Freeze reviewed scorecards (never train or publish guidance)", permissions=["review"])
    def freeze_selected(self, request, queryset):
        for entry in queryset:
            try:
                freeze(entry, request.user)
                self.message_user(request, f"Frozen: {entry.name}")
            except (ValidationError, PermissionError) as error:
                self.message_user(request, str(error), level="ERROR")

    @admin.action(description="Lock predefined protocols before capturing outputs", permissions=["review"])
    def lock_selected_protocols(self, request, queryset):
        for entry in queryset:
            try:
                lock_protocol(entry, request.user)
                self.message_user(request, f"Protocol locked: {entry.name}")
            except (ValidationError, PermissionError) as error:
                self.message_user(request, str(error), level="ERROR")


@admin.register(EvaluationCase)
class EvaluationCaseAdmin(admin.ModelAdmin):
    list_display = ("reference_id", "run", "expected_material", "requires_review", "reviewed_by", "reviewed_at")
    list_filter = ("run", "expected_material", "requires_review")
    search_fields = ("reference_id", "group_id")
    readonly_fields = ("snapshot", "snapshot_digest", "captured_at", "reference_revision", "reviewed_by", "reviewed_at")
    actions = ("adjudicate_selected",)

    def get_readonly_fields(self, request, obj=None):
        if obj and obj.run.frozen_at:
            return tuple(field.name for field in obj._meta.fields)
        return self.readonly_fields + (("run", "source_prediction") if obj and obj.snapshot else ())

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if not obj.snapshot and obj.source_prediction_id:
            capture(obj)

    def has_review_permission(self, request):
        return request.user.has_perm("evaluations.review_evaluationcase")

    @admin.action(description="Adjudicate references and recorded route safety", permissions=["review"])
    def adjudicate_selected(self, request, queryset):
        for entry in queryset:
            try:
                adjudicate(entry, request.user)
                self.message_user(request, f"Adjudicated: {entry.reference_id}")
            except (ValidationError, PermissionError) as error:
                self.message_user(request, str(error), level="ERROR")


@admin.register(RecommendationJudgment)
class RecommendationJudgmentAdmin(admin.ModelAdmin):
    list_display = ("case", "recommendation_id", "safety", "unsafe", "acceptable", "reviewed_by")
    list_filter = ("safety", "unsafe")
    readonly_fields = ("case_revision", "reviewed_by", "reviewed_at")

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in obj._meta.fields) if obj and obj.case.run.frozen_at else self.readonly_fields

    def has_add_permission(self, request):
        return super().has_add_permission(request) and request.user.has_perm("evaluations.review_evaluationcase")

    def has_change_permission(self, request, obj=None):
        return super().has_change_permission(request, obj) and request.user.has_perm("evaluations.review_evaluationcase")

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        if not request.user.has_perm("evaluations.review_evaluationcase"):
            raise PermissionDenied
        obj.reviewed_by = request.user
        obj.reviewed_at = timezone.now()
        super().save_model(request, obj, form, change)
