from django.contrib import admin

from .models import PredictionRecord, IdentificationReview, ScanScene, SceneItem, UserProject


class SavedRecordAdmin(admin.ModelAdmin):
    """Inspect shared resident records without corrupting saved progress/results.

    Normal Django model-view permissions still apply. CESD content access does
    not automatically grant access to these private records.
    """
    actions = None

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ScanScene)
class ScanSceneAdmin(SavedRecordAdmin):
    list_display = ('id', 'user', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    list_select_related = ('user',)
    search_fields = ('user__username', 'request_id')


@admin.register(SceneItem)
class SceneItemAdmin(SavedRecordAdmin):
    list_display = ('id', 'scene_id', 'name', 'score', 'prediction_id')
    list_select_related = ('scene', 'prediction')
    search_fields = ('name',)


@admin.register(UserProject)
class UserProjectAdmin(SavedRecordAdmin):
    list_display = ('id', 'user', 'title', 'material', 'source_prediction_id', 'updated_at')
    list_filter = ('material', 'created_at')
    list_select_related = ('user', 'source_prediction')
    search_fields = ('title', 'user__username', 'recommendation_id')


@admin.register(PredictionRecord)
class PredictionRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "confidence", "quantity", "selected_recommendation", "created_at")
    list_filter = ("decision", "created_at")
    search_fields = ("user__username", "user__email", "title", "model_class")
    readonly_fields = ("created_at",)


@admin.register(IdentificationReview)
class IdentificationReviewAdmin(admin.ModelAdmin):
    list_display = ('id', 'prediction_id', 'status', 'consented_at', 'reviewed_at')
    list_filter = ('status',)
    readonly_fields = ('prediction', 'snapshot', 'consented_at', 'reviewer', 'reviewed_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.has_perm('predictions.review_identification')

    def get_form(self, request, obj=None, **kwargs):
        base = super().get_form(request, obj, **kwargs)
        class ReviewForm(base):
            def clean(self):
                from django.utils import timezone
                data = super().clean()
                self.instance.reviewer = request.user if data.get('status') != 'pending' else None
                self.instance.reviewed_at = timezone.now() if data.get('status') != 'pending' else None
                return data
        return ReviewForm

    def save_model(self, request, obj, form, change):
        from django.utils import timezone
        obj.reviewer = request.user if obj.status != 'pending' else None
        obj.reviewed_at = timezone.now() if obj.status != 'pending' else None
        obj.full_clean()
        super().save_model(request, obj, form, change)
