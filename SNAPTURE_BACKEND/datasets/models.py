from __future__ import annotations

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from core.materials import SCOPE_LABELS


LABEL_CHOICES = [(label, label.replace("_", " ").title()) for label in SCOPE_LABELS]


class DatasetImage(models.Model):
    STATUS_CHOICES = (("pending", "Pending review"), ("verified", "Verified"), ("rejected", "Rejected"))

    label = models.CharField(max_length=80, choices=LABEL_CHOICES)
    image = models.ImageField(upload_to="dataset/%Y/%m/%d/")
    review_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="dataset_images")
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if self.review_status == "pending":
            self.reviewed_at = None
        elif self.reviewed_at is None:
            self.reviewed_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_label_display()} · {self.get_review_status_display()}"
