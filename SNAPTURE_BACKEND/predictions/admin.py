from django.contrib import admin

from .models import PredictionRecord, IdentificationReview


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
