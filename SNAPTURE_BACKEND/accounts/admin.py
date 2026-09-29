from django.contrib import admin

from .models import ApiToken, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "display_name", "created_at")
    list_filter = ("role",)
    search_fields = ("user__username", "user__email", "display_name")


@admin.register(ApiToken)
class ApiTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "created_at", "last_used_at")
    search_fields = ("user__username", "user__email")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
