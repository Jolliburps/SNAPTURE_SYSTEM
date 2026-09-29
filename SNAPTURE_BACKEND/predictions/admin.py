from django.contrib import admin

from .models import PredictionRecord


@admin.register(PredictionRecord)
class PredictionRecordAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "confidence", "quantity", "selected_recommendation", "created_at")
    list_filter = ("decision", "created_at")
    search_fields = ("user__username", "user__email", "title", "model_class")
    readonly_fields = ("created_at",)
