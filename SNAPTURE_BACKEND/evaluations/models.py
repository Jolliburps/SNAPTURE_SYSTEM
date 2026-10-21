"""Research records, never automatic approval flags for public guidance."""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone

from core.materials import SCOPE_LABELS

MATERIALS = list(SCOPE_LABELS) + ["unknown_unsupported"]
RATINGS = [(value, label) for value, label in [("pass", "Pass"), ("revise", "Needs revision"), ("reject", "Reject")]]
CRITERIA = ("material_suitability", "condition_suitability", "safety", "instruction_correctness", "practicality", "local_applicability")


class EvaluationRun(models.Model):
    name = models.CharField(max_length=160)
    split = models.CharField(max_length=12, choices=[("validation", "Validation / tuning"), ("test", "Final held-out test")], default="validation")
    dataset_version = models.CharField(max_length=120)
    protocol = models.TextField(help_text="Predefined scope, sampling, metrics, acceptance criteria, comparison and reviewer procedure.")
    separation_notes = models.TextField(blank=True, help_text="Explain how test items, near duplicates and capture sessions are separated from training/tuning. This is an attestation, not an automatic leakage check.")
    held_out_confirmed = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    protocol_locked_at = models.DateTimeField(null=True, blank=True, editable=False)
    frozen_at = models.DateTimeField(null=True, blank=True)
    frozen_report = models.JSONField(default=dict, blank=True, editable=False)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} ({self.split})"

    @transaction.atomic
    def save(self, *args, **kwargs):
        if self.pk:
            previous = type(self).objects.select_for_update().get(pk=self.pk)
            if previous.frozen_at:
                raise ValidationError("A frozen evaluation cannot be edited. Create a new run.")
            if previous.protocol_locked_at and any(getattr(self, key) != getattr(previous, key) for key in ("protocol", "dataset_version", "split", "separation_notes", "held_out_confirmed", "protocol_locked_at")):
                raise ValidationError("The predefined protocol is locked. Create a new run for another protocol.")
        super().save(*args, **kwargs)


class EvaluationCase(models.Model):
    run = models.ForeignKey(EvaluationRun, on_delete=models.PROTECT, related_name="cases")
    reference_id = models.CharField(max_length=120, help_text="Anonymous test-item identifier, not a resident's name.")
    group_id = models.CharField(max_length=120, help_text="Physical item/capture group; keep related images in one dataset split.")
    source_prediction = models.ForeignKey("predictions.PredictionRecord", null=True, blank=True, on_delete=models.SET_NULL)
    snapshot = models.JSONField(default=dict, blank=True, editable=False)
    snapshot_digest = models.CharField(max_length=64, blank=True, editable=False)
    reference_revision = models.PositiveIntegerField(default=1, editable=False)
    captured_at = models.DateTimeField(null=True, blank=True, editable=False)
    expected_material = models.CharField(max_length=100, choices=[(key, key.replace("_", " ")) for key in MATERIALS], blank=True)
    expected_routes = models.JSONField(default=list, blank=True, help_text='Exact acceptable category names, e.g. ["Recyclable"]. Use [] when review is required.')
    requires_review = models.BooleanField(null=True, blank=True)
    project_eligible = models.BooleanField(null=True, blank=True, help_text="Can any project appropriately be offered for this case? Unknown is not a safe answer.")
    route_unsafe = models.BooleanField(null=True, blank=True, help_text="Expert judgment of the captured segregation instructions. Do not infer this from a model score.")
    reference_source = models.TextField(blank=True, help_text="Reference guidance, conditions and agreed acceptable responses; no personal information.")
    reviewer_qualification = models.TextField(blank=True, help_text="Relevant expertise; do not claim CESD approval without actual review.")
    review_notes = models.TextField(blank=True, help_text="Record independent reference labeling, disagreements and adjudication.")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, editable=False)
    reviewed_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["run", "reference_id"], name="unique_evaluation_reference")]
        ordering = ["id"]
        permissions = [("review_evaluationcase", "Adjudicate evaluation reference answers and recommendation judgments")]

    def __str__(self):
        return f"{self.run.name}: {self.reference_id}"

    def clean(self):
        super().clean()
        if not isinstance(self.expected_routes, list) or any(not isinstance(value, str) or not value.strip() for value in self.expected_routes):
            raise ValidationError({"expected_routes": "Use a list of nonempty category names."})
        if self.expected_material and self.expected_material not in MATERIALS:
            raise ValidationError({"expected_material": "Use a supported material or unknown / unsupported."})
        if self.requires_review is True and self.expected_routes:
            raise ValidationError("A review-required case must not assert an unconditional disposal route.")

    @transaction.atomic
    def save(self, *args, **kwargs):
        locked_run = EvaluationRun.objects.select_for_update().get(pk=self.run_id)
        if locked_run.frozen_at:
            raise ValidationError("Cases in a frozen run cannot be changed.")
        if self.pk:
            previous = type(self).objects.get(pk=self.pk)
            if previous.run_id != self.run_id and (previous.snapshot or previous.run.frozen_at):
                raise ValidationError("A captured case cannot be moved to a different run.")
            if previous.snapshot and (self.snapshot != previous.snapshot or self.snapshot_digest != previous.snapshot_digest or self.source_prediction_id != previous.source_prediction_id or self.captured_at != previous.captured_at):
                raise ValidationError("Captured system output is immutable. Create a new case to evaluate another output.")
            reference_fields = ("expected_material", "expected_routes", "requires_review", "project_eligible", "route_unsafe", "reference_source", "reviewer_qualification", "review_notes", "group_id")
            if any(getattr(self, key) != getattr(previous, key) for key in reference_fields):
                self.reviewed_by = None
                self.reviewed_at = None
                self.reference_revision = previous.reference_revision + 1
        self.full_clean()
        super().save(*args, **kwargs)


class RecommendationJudgment(models.Model):
    case = models.ForeignKey(EvaluationCase, on_delete=models.PROTECT, related_name="recommendation_judgments")
    recommendation_id = models.CharField(max_length=160)
    case_revision = models.PositiveIntegerField(default=1, editable=False)
    material_suitability = models.CharField(max_length=8, choices=RATINGS)
    condition_suitability = models.CharField(max_length=8, choices=RATINGS)
    safety = models.CharField(max_length=8, choices=RATINGS)
    instruction_correctness = models.CharField(max_length=8, choices=RATINGS)
    practicality = models.CharField(max_length=8, choices=RATINGS)
    local_applicability = models.CharField(max_length=8, choices=RATINGS)
    unsafe = models.BooleanField(null=True, blank=True, help_text="Explicit expert judgment. A failed safety criterion is never averaged away.")
    reviewer_qualification = models.TextField()
    notes = models.TextField(help_text="Explain revisions, safety concerns and evidence for this item-condition-project combination.")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, editable=False)
    reviewed_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["case", "recommendation_id"], name="unique_case_recommendation_judgment")]

    @property
    def acceptable(self):
        return self.unsafe is False and all(getattr(self, field) == "pass" for field in CRITERIA)

    def clean(self):
        super().clean()
        if not self.reviewer_qualification.strip() or not self.notes.strip():
            raise ValidationError("Record reviewer expertise and evidence for the judgment.")
        if self.unsafe is None:
            raise ValidationError("Explicitly assess whether this recommendation is unsafe.")
        if self.unsafe and self.safety == "pass":
            raise ValidationError("An unsafe recommendation cannot pass the safety criterion.")
        if self.case_id:
            choices = self.case.snapshot.get("recommendations", [])
            if self.recommendation_id not in {entry["id"] for entry in choices}:
                raise ValidationError("Review only a recommendation actually present in the immutable captured output.")

    @transaction.atomic
    def save(self, *args, **kwargs):
        run_id = EvaluationCase.objects.values_list("run_id", flat=True).get(pk=self.case_id)
        locked_run = EvaluationRun.objects.select_for_update().get(pk=run_id)
        self.case = EvaluationCase.objects.select_related("run").get(pk=self.case_id)
        if self.pk:
            previous = type(self).objects.select_related("case__run").get(pk=self.pk)
            if previous.case_id != self.case_id or previous.recommendation_id != self.recommendation_id:
                raise ValidationError("A recorded judgment cannot be moved to another case or recommendation.")
            if previous.case.run.frozen_at:
                raise ValidationError("Judgments in a frozen run cannot be changed.")
        if locked_run.frozen_at:
            raise ValidationError("Judgments in a frozen run cannot be changed.")
        self.case_revision = self.case.reference_revision
        self.full_clean()
        super().save(*args, **kwargs)
