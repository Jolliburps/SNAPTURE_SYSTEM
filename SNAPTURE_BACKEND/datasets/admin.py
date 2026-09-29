from django.contrib import admin

from .models import DatasetImage


@admin.register(DatasetImage)
class DatasetImageAdmin(admin.ModelAdmin):
    list_display = ("label", "review_status", "uploaded_by", "created_at", "reviewed_at")
    list_filter = ("label", "review_status", "created_at")
    search_fields = ("label", "notes", "uploaded_by__username")
    list_editable = ("review_status",)
