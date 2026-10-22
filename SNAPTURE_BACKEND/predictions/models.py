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
    assessment = models.JSONField(default=dict, blank=True)
    input_method = models.CharField(max_length=20, default="camera")
    image_quality = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} · {self.title} · {self.created_at:%Y-%m-%d %H:%M}"


class ScanScene(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='scan_scenes')
    request_id = models.CharField(max_length=80)
    image = models.ImageField(upload_to='scenes/%Y/%m/%d/')
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    frame = models.JSONField(default=list)
    quality = models.JSONField(default=dict)
    status = models.CharField(max_length=20, default='processing')
    error = models.TextField(blank=True)
    truncated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['user','request_id'],name='unique_scene_request')]


class SceneItem(models.Model):
    scene = models.ForeignKey(ScanScene, on_delete=models.CASCADE, related_name='items')
    box = models.JSONField()
    name = models.CharField(max_length=120)
    score = models.FloatField()
    prediction = models.OneToOneField(PredictionRecord, null=True, on_delete=models.SET_NULL, related_name='scene_item')


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
    reference = models.JSONField(default=dict, blank=True, help_text='Source and review snapshot captured when this project is started.')
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


class IdentificationReview(models.Model):
    """Explicitly contributed crop reference. Never included in training automatically."""
    prediction = models.OneToOneField(PredictionRecord, on_delete=models.CASCADE, related_name='identification_review')
    snapshot = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending')
    reviewer = models.ForeignKey(User, null=True, blank=True, on_delete=models.PROTECT, related_name='identification_reviews')
    review_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    consented_at = models.DateTimeField()

    class Meta:
        permissions = [('review_identification', 'Review consented identification examples')]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status != 'pending' and not (self.reviewer_id and self.reviewed_at and self.review_notes.strip()):
            raise ValidationError('A review decision needs an identified reviewer, date and evidence notes.')
