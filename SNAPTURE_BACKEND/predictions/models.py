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


class UserProject(models.Model):
    """A started recommendation with a snapshot of its text instructions."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    source_prediction = models.ForeignKey(
        PredictionRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name="started_projects"
    )
    recommendation_id = models.CharField(max_length=160)
    title = models.CharField(max_length=160)
    material = models.CharField(max_length=160)
    summary = models.TextField(blank=True)
    materials = models.JSONField(default=list)
    steps = models.JSONField(default=list)
    safety_note = models.TextField(blank=True)
    completed_steps = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "source_prediction", "recommendation_id"],
                name="unique_started_prediction_recommendation",
            )
        ]

    def __str__(self):
        return f"{self.user.username} · {self.title}"
