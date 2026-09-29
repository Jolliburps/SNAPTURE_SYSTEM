from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models


class PredictionRecord(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="predictions")
    image = models.ImageField(upload_to="predictions/%Y/%m/%d/", blank=True, null=True)
    model_class = models.CharField(max_length=100)
    decision = models.CharField(max_length=100)
    title = models.CharField(max_length=160)
    confidence = models.FloatField()
    threshold = models.FloatField(default=0.60)
    model_version = models.CharField(max_length=120, blank=True)
    quantity = models.PositiveIntegerField(null=True, blank=True)
    condition = models.CharField(max_length=120, blank=True)
    previous_contents = models.CharField(max_length=160, blank=True)
    available_materials = models.JSONField(default=list, blank=True)
    answers = models.JSONField(default=dict, blank=True)
    recommendation_choices = models.JSONField(default=list, blank=True)
    selected_recommendation = models.CharField(max_length=160, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} · {self.title} · {self.created_at:%Y-%m-%d %H:%M}"
