from __future__ import annotations

import hashlib

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class Profile(models.Model):
    ROLE_CHOICES = (("regular", "Regular user"), ("admin", "Administrator"))

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="regular")
    display_name = models.CharField(max_length=120, blank=True)
    barangay = models.CharField(max_length=120, blank=True)
    profile_picture = models.ImageField(upload_to="profile_pictures/%Y/%m/%d/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class ApiToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="api_tokens")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    def touch(self):
        ApiToken.objects.filter(pk=self.pk).update(last_used_at=timezone.now())

    @staticmethod
    def hash_token(raw_token: str) -> str:
        return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    def __str__(self):
        return f"{self.user.username} · {self.created_at:%Y-%m-%d}"
