"""Versioned content. Drafts are never used as public decision rules."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from .materials import SCOPE_LABELS


class Guidance(models.Model):
    KIND_CHOICES = [("segregation", "Segregation rule"), ("project", "Reuse or upcycling project"), ("information", "Local information source")]
    STATE_CHOICES = [(s, s.title()) for s in ("draft", "reviewed", "published", "archived")]
    key = models.SlugField(max_length=120)
    version = models.PositiveIntegerField(default=1)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    material = models.CharField(max_length=100, blank=True, choices=[(s, s.replace("_", " ")) for s in SCOPE_LABELS])
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=120, blank=True, help_text="Reviewed local waste category; not an image-model class.")
    summary = models.TextField(blank=True)
    instructions = models.JSONField(default=list, help_text="List of preparation instructions or project steps.")
    materials = models.JSONField(default=list, blank=True)
    requirements = models.JSONField(default=dict, blank=True, help_text='Exact allowed answers, e.g. {"condition": ["Clean and dry"]}. Never inferred from a photo.')
    minimum_quantity = models.PositiveIntegerField(default=1)
    warnings = models.TextField(blank=True)
    source = models.TextField(blank=True, help_text="Document title, issuing office, date and page, or authoritative URL.")
    review_note = models.TextField(blank=True, help_text="Reviewer qualification and restrictions; not a claim of CESD endorsement.")
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default="draft")
    review_level = models.CharField(max_length=20, choices=[("source_checked", "Public-source reference; not expert approval"), ("expert_reviewed", "Expert reviewed")], default="expert_reviewed")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    content_digest = models.CharField(max_length=64, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["key", "version"], name="unique_guidance_version")]
        permissions = [("review_guidance", "Review and publish decision guidance")]
        ordering = ["key", "-version"]

    def __str__(self):
        return f"{self.title} v{self.version} ({self.state})"

    def clean(self):
        super().clean()
        allowed_fields = {"condition", "previous_contents", "wood_treatment", "resin_mark", "paper_surface", "contamination", "moisture"}
        if self.kind != "information" and self.material not in SCOPE_LABELS:
            raise ValidationError("Choose an active supported material.")
        if not isinstance(self.requirements, dict) or any(
            key not in allowed_fields or not isinstance(values, list) or not values
            or any(not isinstance(value, str) for value in values)
            for key, values in self.requirements.items()
        ):
            raise ValidationError("Requirements must map supported question IDs to nonempty lists of answer strings.")
        for name in ("instructions", "materials"):
            values = getattr(self, name)
            if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
                raise ValidationError({name: "Use a list of nonempty strings."})
        if self.state in {"reviewed", "published"}:
            if not all((self.source.strip(), self.review_note.strip(), self.reviewed_at, self.instructions)):
                raise ValidationError("Reviewed guidance needs a source, review note, reviewer, review date, and instructions.")
            if self.review_level == "expert_reviewed" and not self.reviewed_by_id:
                raise ValidationError("Expert-reviewed content needs an identified reviewer.")
            if self.kind == "segregation" and not self.category.strip():
                raise ValidationError("A segregation rule needs a reviewed waste category.")
            if self.kind == "project" and not self.warnings.strip():
                raise ValidationError("A project needs explicit restrictions and warnings.")
        if self.state == "published" and not self.published_at:
            raise ValidationError("Publish through the review action to record its publication date.")


class CollectionNotice(models.Model):
    barangay = models.CharField(max_length=120)
    title = models.CharField(max_length=160)
    collection_date = models.DateField()
    description = models.TextField(blank=True)
    guidance = models.ForeignKey(Guidance, on_delete=models.PROTECT, help_text="Published reviewed source for this collection notice.")
    published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    published_digest = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["collection_date", "id"]
