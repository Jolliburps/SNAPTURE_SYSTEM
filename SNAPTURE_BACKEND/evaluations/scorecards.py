"""Deterministic metrics. No composite accuracy, fabricated labels, or publication side effects."""
import hashlib
import json
import math
from collections import Counter

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from core.materials import SCOPE_LABELS
from .models import CRITERIA, MATERIALS, EvaluationCase, EvaluationRun


def digest(snapshot):
    return hashlib.sha256(json.dumps(snapshot, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def capture(case):
    """Copy the actual stored output once, without refreshing rules or copying user identity/images."""
    if case.snapshot:
        raise ValidationError("Output is already captured; create another case rather than overwriting history.")
    if not case.run.protocol_locked_at:
        raise ValidationError("Lock the predefined evaluation protocol before capturing outputs.")
    record = case.source_prediction
    if record is None:
        raise ValidationError("Choose an actual prediction record to capture.")
    assessment = record.assessment or {}
    if not isinstance(assessment, dict) or not isinstance(record.answers, dict) or not isinstance(record.recommendation_choices, list):
        raise ValidationError("The stored assessment and recommendations have an invalid format.")
    choices = record.recommendation_choices
    if any(not isinstance(entry, dict) or not isinstance(entry.get("id"), str) or not entry["id"].strip() for entry in choices) or len({entry["id"] for entry in choices}) != len(choices):
        raise ValidationError("Captured recommendations must have unique, nonempty IDs.")
    if not isinstance(assessment.get("segregation", {}), dict):
        raise ValidationError("The stored segregation output has an invalid format.")
    raw = record.model_class if record.model_class in MATERIALS else "unknown_unsupported"
    scene_item = getattr(record, "scene_item", None)
    snapshot = {
        "schema": "snapture-evaluation-v1", "prediction_reference": f"scan-{record.id:04d}",
        "input_method": record.input_method, "cohort": "manual" if record.input_method == "manual" else "detected_crop" if scene_item else "whole_image",
        "model_version": record.model_version, "assessment_version": assessment.get("version", ""),
        "raw_material": raw, "confidence": record.confidence, "threshold": record.threshold,
        "accepted": record.input_method != "manual" and raw in SCOPE_LABELS and record.confidence >= record.threshold,
        "context": {"condition": record.condition, "previous_contents": record.previous_contents, "quantity": record.quantity,
                    **{key: value for key, value in (record.answers or {}).items() if key in {"resin_mark", "wood_treatment", "paper_surface", "user_confirmed_material"}}},
        "segregation": assessment.get("segregation", {}),
        "project_status": assessment.get("upcycling", {}).get("status", "unknown"),
        "recommendations": record.recommendation_choices,
    }
    try:
        for key in ("confidence", "threshold"):
            if not isinstance(snapshot[key], (int, float)) or not math.isfinite(snapshot[key]) or not 0 <= snapshot[key] <= 1:
                raise ValueError("Invalid score")
        snapshot_digest = digest(snapshot)
    except (ValueError, TypeError) as error:
        raise ValidationError("The stored prediction cannot be safely captured.") from error
    case.snapshot = snapshot
    case.snapshot_digest = snapshot_digest
    case.captured_at = timezone.now()
    case.save()
    return case


@transaction.atomic
def adjudicate(case, user):
    if not user.has_perm("evaluations.review_evaluationcase"):
        raise PermissionError("Evaluation review permission is required.")
    case.full_clean()
    if not case.snapshot or digest(case.snapshot) != case.snapshot_digest:
        raise ValidationError("Capture an intact system output first.")
    if not all((case.expected_material, case.reference_source.strip(), case.reviewer_qualification.strip(), case.review_notes.strip())):
        raise ValidationError("Provide the actual material, reference evidence, reviewer expertise and adjudication notes.")
    if any(value is None for value in (case.requires_review, case.project_eligible, case.route_unsafe)):
        raise ValidationError("Explicitly assess review necessity, project eligibility and unsafe segregation guidance.")
    if not case.requires_review and not case.expected_routes:
        raise ValidationError("Supply at least one acceptable route for an answerable case.")
    # Persist valid reference edits first; their revision invalidates older ratings.
    # Only then stamp this explicit re-adjudication.
    case.save()
    case.reviewed_by = user
    case.reviewed_at = timezone.now()
    case.save()


def rate(numerator, denominator):
    """A proportion and Wilson 95% interval; no data means null, never 100%."""
    if not denominator:
        return {"numerator": numerator, "denominator": 0, "value": None, "ci95": None}
    p = numerator / denominator
    z = 1.959963984540054
    divisor = 1 + z*z / denominator
    center = (p + z*z/(2*denominator))/divisor
    half = z*math.sqrt(p*(1-p)/denominator + z*z/(4*denominator**2))/divisor
    return {"numerator": numerator, "denominator": denominator, "value": p, "ci95": [max(0, center-half), min(1, center+half)]}


def classification(pairs):
    labels = list(MATERIALS)
    matrix = [[sum(actual == a and predicted == p for actual, predicted in pairs) for p in labels] for a in labels]
    rows = []
    for i, label in enumerate(labels):
        tp, support, predicted_count = matrix[i][i], sum(matrix[i]), sum(row[i] for row in matrix)
        precision = tp / predicted_count if predicted_count else 0.0
        recall = tp / support if support else 0.0
        f1 = 2*precision*recall/(precision+recall) if precision+recall else 0.0
        rows.append({"label": label, "support": support, "predicted_count": predicted_count, "precision": precision if predicted_count else None,
                     "recall": recall if support else None, "f1": f1 if support or predicted_count else None})
    represented = [row["f1"] for row in rows if row["f1"] is not None]
    return {"n": len(pairs), "per_material": rows, "macro_f1": sum(represented)/len(represented) if represented else None,
            "macro_definition": "Unweighted mean over labels present in references or predictions; absent labels are not evidence of performance.",
            "all_scope_classes_tested": all(any(actual == key for actual, _ in pairs) for key in SCOPE_LABELS),
            "accuracy": rate(sum(actual == predicted for actual, predicted in pairs), len(pairs)),
            "confusion": {"actual_labels": labels, "predicted_labels": labels, "counts": matrix}}


def report(run):
    if run.frozen_at:
        return run.frozen_report
    cases = list(run.cases.prefetch_related("recommendation_judgments"))
    intact = [case for case in cases if case.snapshot and digest(case.snapshot) == case.snapshot_digest]
    checked = [case for case in intact if case.reviewed_at and case.reviewed_by_id]
    camera = [case for case in checked if case.snapshot["input_method"] == "camera"]
    accepted = [case for case in camera if case.snapshot["accepted"]]
    unsupported = [case for case in camera if case.expected_material == "unknown_unsupported"]
    pairs = [(case.expected_material, case.snapshot["raw_material"]) for case in camera]
    gate_labels = list(MATERIALS) + ["needs_review"]
    gate_pairs = [(case.expected_material, case.snapshot["raw_material"] if case.snapshot["accepted"] else "needs_review") for case in camera]
    identifiable = [case for case in checked if not case.requires_review]
    uncertain = [case for case in checked if case.requires_review]
    def has_route(case):
        output = case.snapshot["segregation"]
        return output.get("status") == "available" and bool(output.get("category"))
    def correct_route(case):
        return not has_route(case) if case.requires_review else has_route(case) and case.snapshot["segregation"]["category"] in case.expected_routes
    shown = sum(len(case.snapshot["recommendations"]) for case in checked)
    def current_judgments(case):
        return [entry for entry in case.recommendation_judgments.all() if entry.case_revision == case.reference_revision]
    judgments = [judgment for case in checked for judgment in current_judgments(case)
                 if judgment.recommendation_id in {entry["id"] for entry in case.snapshot["recommendations"]}]
    fully_judged = [case for case in checked if len(case.snapshot["recommendations"]) == len(current_judgments(case))]
    eligible = [case for case in fully_judged if case.project_eligible]
    ineligible = [case for case in fully_judged if not case.project_eligible]
    warnings = ["This scorecard measures recorded cases; it is not model training, CESD endorsement or a guarantee of safety.",
                "Acceptance here means the raw model confidence gate, not user confirmation, a final bin decision or project approval.",
                "A reviewer attestation is not an automatic dataset-leakage audit. Related items must remain in one split.",
                "Detected-crop classification excludes missed objects. Bounding-box mAP, full-scene recall and detection accuracy are not measured without independent box annotations.",
                "CVI validates checklist relevance, not these system predictions. No CVI or ranking score is fabricated."]
    if not checked:
        warnings.append("No adjudicated cases yet. No accuracy or recommendation-validity claim can be made.")
    groups = Counter(case.group_id for case in cases)
    if any(value > 1 for value in groups.values()):
        warnings.append("Related item groups are repeated. Wilson intervals assume independent items; use one case per physical-item group before freezing.")
    versions = sorted({case.snapshot["model_version"] for case in camera})
    if len(versions) > 1:
        warnings.append("Multiple model versions are mixed. Create a separate run per model before freezing or comparing results.")
    if camera and any(not version.strip() for version in versions):
        warnings.append("Some camera outputs have no model version. They cannot support a traceable final report.")
    return {
        "run": {"id": run.id, "name": run.name, "split": run.split, "dataset_version": run.dataset_version,
                "held_out_confirmed": run.held_out_confirmed, "protocol_locked": bool(run.protocol_locked_at), "frozen": False, "model_versions": versions},
        "counts": {"total": len(cases), "independent_groups": len(groups), "captured": len(intact), "adjudicated": len(checked), "unreviewed": len(cases)-len(checked), "invalid_snapshots": len(cases)-len(intact), "manual_excluded_from_camera": sum(case.snapshot["input_method"] == "manual" for case in checked)},
        "identification": {**classification(pairs), "cohorts": {cohort: classification([(case.expected_material, case.snapshot["raw_material"]) for case in camera if case.snapshot["cohort"] == cohort]) for cohort in ("whole_image", "detected_crop")},
            "acceptance_coverage": rate(len(accepted), len(camera)), "accepted_correctness": rate(sum(case.expected_material == case.snapshot["raw_material"] for case in accepted), len(accepted)),
            "review_rate": rate(len(camera)-len(accepted), len(camera)), "unsupported_false_acceptance": rate(sum(case.snapshot["accepted"] for case in unsupported), len(unsupported)),
            "gated_confusion": {"actual_labels": list(MATERIALS), "predicted_labels": gate_labels, "counts": [[sum(actual == a and predicted == p for actual, predicted in gate_pairs) for p in gate_labels] for a in MATERIALS]}},
        "segregation": {"correct_route": rate(sum(correct_route(case) for case in checked), len(checked)),
            "unsafe_guidance": rate(sum(case.route_unsafe for case in checked), len(checked)),
            "appropriate_review": rate(sum(not has_route(case) for case in uncertain), len(uncertain)),
            "unnecessary_review": rate(sum(not has_route(case) for case in identifiable), len(identifiable))},
        "recommendations": {"shown": shown, "judged": len(judgments), "unjudged": shown-len(judgments),
            "acceptable": rate(sum(item.acceptable for item in judgments), len(judgments)),
            "unsafe": rate(sum(item.unsafe for item in judgments), len(judgments)),
            "judgment_coverage": rate(len(judgments), shown),
            "eligible_cases_with_acceptable_idea": rate(sum(any(item.acceptable for item in current_judgments(case)) for case in eligible), len(eligible)),
            "appropriate_withholding": rate(sum(not case.snapshot["recommendations"] for case in ineligible), len(ineligible)),
            "criterion_pass_rates": {key: rate(sum(getattr(item, key) == "pass" for item in judgments), len(judgments)) for key in CRITERIA},
            "ranking": "Not measured: current ideas are not a fixed-k evaluated ranking. No Precision@k or nDCG claim."},
        "warnings": warnings,
    }


@transaction.atomic
def lock_protocol(run, user):
    if not user.has_perm("evaluations.review_evaluationcase"):
        raise PermissionError("Evaluation review permission is required.")
    run = EvaluationRun.objects.select_for_update().get(pk=run.pk)
    if run.protocol_locked_at:
        return run
    if not run.protocol.strip() or not run.dataset_version.strip() or not run.separation_notes.strip():
        raise ValidationError("Define sampling, criteria, dataset version and separation procedure first.")
    if run.split == "test" and not run.held_out_confirmed:
        raise ValidationError("Confirm held-out separation for a final-test protocol.")
    run.protocol_locked_at = timezone.now()
    run.save()
    return run


@transaction.atomic
def freeze(run, user):
    if not user.has_perm("evaluations.review_evaluationcase"):
        raise PermissionError("Evaluation review permission is required.")
    run = EvaluationRun.objects.select_for_update().get(pk=run.pk)
    if run.frozen_at:
        return run
    if not run.protocol_locked_at:
        raise ValidationError("Lock the predefined protocol first.")
    result = report(run)
    if not result["counts"]["adjudicated"] or result["counts"]["unreviewed"] or result["recommendations"]["unjudged"]:
        raise ValidationError("Review every captured case and every shown recommendation before freezing.")
    if not run.protocol.strip() or not run.dataset_version.strip():
        raise ValidationError("Define the protocol and dataset version first.")
    if len(result["run"]["model_versions"]) > 1:
        raise ValidationError("Use one model version per evaluation run.")
    if any(not version.strip() for version in result["run"]["model_versions"]):
        raise ValidationError("Every evaluated camera output needs an identified model version.")
    if result["counts"]["independent_groups"] != result["counts"]["total"]:
        raise ValidationError("Use one evaluation case per physical-item group before freezing this scorecard.")
    if run.split == "test":
        if not run.held_out_confirmed or not run.separation_notes.strip():
            raise ValidationError("Document and confirm held-out separation before final-test reporting.")
        groups = run.cases.values_list("group_id", flat=True)
        if EvaluationCase.objects.filter(run__dataset_version=run.dataset_version, run__split="validation", group_id__in=groups).exists():
            raise ValidationError("Test item groups overlap a recorded validation run for this dataset version.")
    run.frozen_at = timezone.now()
    result["run"]["frozen"] = True
    result["run"]["frozen_at"] = run.frozen_at.isoformat()
    run.frozen_report = result
    run.save()
    return run
