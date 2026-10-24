import json

from django.contrib import admin
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from core.auth import issue_token
from predictions.models import PredictionRecord
from .models import CRITERIA, EvaluationCase, EvaluationRun, RecommendationJudgment
from .scorecards import adjudicate, capture, classification, freeze, lock_protocol, rate, report


class ScorecardTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.reviewer = User.objects.create_superuser(username="reviewer", email="reviewer@example.com", password="test-pass-123")
        cls.resident = User.objects.create_user(username="resident", password="test-pass-123")

    def make_run(self, name="Controlled test", split="test", dataset="local-v1"):
        run = EvaluationRun.objects.create(name=name, split=split, dataset_version=dataset, protocol="One independent item per case; preset metrics; blinded reference labeling before adjudication.",
                                           separation_notes="Unique physical items and capture groups; no training, tuning or duplicate overlap.", held_out_confirmed=True, created_by=self.reviewer)
        return lock_protocol(run, self.reviewer)

    def make_case(self, run=None, actual="paper", predicted="paper", confidence=.9, input_method="camera", route="Recyclable", requires_review=False, recommendations=None, eligible=False, unsafe=False, checked=True, group=None, model="controlled-model-v1", metadata=None):
        run = run or self.make_run()
        count = EvaluationCase.objects.count() + 1
        record = PredictionRecord.objects.create(user=self.resident, title="Captured item", model_class=predicted, decision=predicted, confidence=confidence, threshold=.8, input_method=input_method, model_version=model,
                    condition="Clean and dry", previous_contents="No chemical contact known", quantity=1, image_quality=metadata or {},
                    assessment={"version": "assessment-v1", "segregation": {"status": "available" if route else "needs_information", "category": route, "instructions": ["Captured instruction"]}}, recommendation_choices=recommendations or [])
        case = EvaluationCase(run=run, reference_id=f"item-{count}", group_id=group or f"physical-{count}", source_prediction=record,
                    expected_material=actual, expected_routes=[] if requires_review else ["Recyclable"], requires_review=requires_review,
                    project_eligible=eligible, route_unsafe=unsafe, reference_source="Controlled reviewer reference and known item condition.",
                    reviewer_qualification="Waste-management subject-matter reviewer (test fixture only)", review_notes="Reference established independently; no disagreement in this controlled test.")
        case.save()
        capture(case)
        if checked:
            adjudicate(case, self.reviewer)
        return case

    def judge(self, case, unsafe=False, safety="pass", **ratings):
        return RecommendationJudgment.objects.create(case=case, recommendation_id="project:v1", reviewed_by=self.reviewer,
                reviewer_qualification="Relevant material and project expertise (test fixture)", notes="Checked actual item, conditions and all captured steps.", unsafe=unsafe,
                **{**dict.fromkeys(CRITERIA, "pass"), "safety": safety, **ratings})

    def test_empty_and_unreviewed_cases_never_become_successful_scores(self):
        run = self.make_run()
        empty = report(run)
        self.assertIsNone(empty["identification"]["macro_f1"])
        self.assertIsNone(empty["segregation"]["correct_route"]["value"])
        self.make_case(run=run, checked=False)
        result = report(run)
        self.assertEqual(result["counts"]["unreviewed"], 1)
        self.assertEqual(result["identification"]["n"], 0)
        with self.assertRaises(ValidationError):
            freeze(run, self.reviewer)

    def test_dataset_material_evidence_is_captured_instead_of_the_object_query(self):
        case=self.make_case(predicted='paper scrap',checked=False,
                            metadata={'raw_material_class':'cardboard','object_source':'whole_image_classifier'})
        self.assertEqual(case.snapshot['raw_material'],'cardboard')
        self.assertEqual(case.snapshot['cohort'],'whole_image')

    def test_precision_recall_macro_and_confusion_math(self):
        result = classification([("paper", "paper"), ("paper", "cardboard"), ("cardboard", "cardboard")])
        rows = {row["label"]: row for row in result["per_material"]}
        self.assertEqual(rows["paper"]["precision"], 1)
        self.assertEqual(rows["paper"]["recall"], .5)
        self.assertAlmostEqual(rows["paper"]["f1"], 2/3)
        self.assertAlmostEqual(result["macro_f1"], 2/3)
        self.assertEqual(sum(map(sum, result["confusion"]["counts"])), 3)
        self.assertIsNone(rows["pete_bottles"]["recall"])
        self.assertFalse(result["all_scope_classes_tested"])

    def test_accepted_accuracy_must_be_read_with_coverage_and_background_errors(self):
        run = self.make_run()
        self.make_case(run=run)
        self.make_case(run=run, actual="unknown_unsupported", predicted="paper", requires_review=True, route=None)
        self.make_case(run=run, confidence=.1, predicted="cardboard")
        result = report(run)["identification"]
        self.assertEqual(result["accepted_correctness"]["value"], .5)
        self.assertAlmostEqual(result["acceptance_coverage"]["value"], 2/3)
        self.assertAlmostEqual(result["review_rate"]["value"], 1/3)
        self.assertEqual(result["unsupported_false_acceptance"]["value"], 1)
        self.assertEqual(sum(map(sum, result["gated_confusion"]["counts"])), 3)

    def test_manual_choices_and_user_corrections_do_not_inflate_camera_scores(self):
        run = self.make_run()
        self.make_case(run=run, input_method="manual")
        wrong = self.make_case(run=run, predicted="cardboard", checked=False)
        # A later correction changes the live prediction but never the captured raw output.
        PredictionRecord.objects.filter(pk=wrong.source_prediction_id).update(decision="paper", answers={"user_confirmed_material": "paper"})
        adjudicate(wrong, self.reviewer)
        result = report(run)
        self.assertEqual(result["counts"]["manual_excluded_from_camera"], 1)
        self.assertEqual(result["identification"]["n"], 1)
        self.assertEqual(result["identification"]["accuracy"]["value"], 0)
        self.assertEqual(result["segregation"]["correct_route"]["denominator"], 2)

    def test_seg_route_review_and_unsafe_outputs_are_separate(self):
        run = self.make_run()
        self.make_case(run=run, route="Wrong route", unsafe=True)
        self.make_case(run=run, requires_review=True, route=None)
        self.make_case(run=run, route=None)
        result = report(run)["segregation"]
        self.assertAlmostEqual(result["correct_route"]["value"], 1/3)
        self.assertAlmostEqual(result["unsafe_guidance"]["value"], 1/3)
        self.assertEqual(result["appropriate_review"]["value"], 1)
        self.assertEqual(result["unnecessary_review"]["value"], .5)

    def test_no_recommendation_judgment_is_not_success_or_failure(self):
        case = self.make_case(recommendations=[{"id": "project:v1", "title": "Captured project"}], eligible=True)
        result = report(case.run)["recommendations"]
        self.assertEqual(result["shown"], 1)
        self.assertEqual(result["unjudged"], 1)
        self.assertIsNone(result["acceptable"]["value"])
        with self.assertRaises(ValidationError):
            freeze(case.run, self.reviewer)

    def test_safety_failure_cannot_be_averaged_away_and_failure_can_be_reported(self):
        case = self.make_case(recommendations=[{"id": "project:v1", "title": "Captured project"}], eligible=True)
        judgment = self.judge(case, unsafe=True, safety="reject")
        self.assertFalse(judgment.acceptable)
        result = report(case.run)["recommendations"]
        self.assertEqual(result["acceptable"]["value"], 0)
        self.assertEqual(result["unsafe"]["value"], 1)
        frozen = freeze(case.run, self.reviewer)
        self.assertEqual(report(frozen)["recommendations"]["unsafe"]["value"], 1)

    def test_eligibility_and_correct_withholding_have_separate_denominators(self):
        run = self.make_run()
        case = self.make_case(run=run, recommendations=[{"id": "project:v1"}], eligible=True)
        self.judge(case)
        self.make_case(run=run, eligible=False)
        self.make_case(run=run, eligible=True)
        result = report(run)["recommendations"]
        self.assertEqual(result["eligible_cases_with_acceptable_idea"]["value"], .5)
        self.assertEqual(result["appropriate_withholding"]["value"], 1)

    def test_reference_edits_invalidate_adjudication_and_old_project_judgments(self):
        case = self.make_case(recommendations=[{"id": "project:v1"}], eligible=True)
        judgment = self.judge(case)
        case.expected_material = "cardboard"
        case.save()
        self.assertIsNone(case.reviewed_at)
        adjudicate(case, self.reviewer)
        self.assertEqual(report(case.run)["recommendations"]["unjudged"], 1)
        judgment.save()  # explicit re-review through the normal save path
        self.assertEqual(report(case.run)["recommendations"]["unjudged"], 0)

    def test_snapshot_immutable_and_survives_deleting_source_scan(self):
        case = self.make_case()
        snapshot = json.loads(json.dumps(case.snapshot))
        case.source_prediction.delete()
        case.refresh_from_db()
        self.assertEqual(case.snapshot, snapshot)
        case.snapshot["raw_material"] = "cardboard"
        with self.assertRaises(ValidationError):
            case.save()

    def test_frozen_report_and_references_cannot_be_edited(self):
        case = self.make_case()
        frozen = freeze(case.run, self.reviewer)
        self.assertTrue(report(frozen)["run"]["frozen"])
        case.review_notes = "Changed reference"
        with self.assertRaises(ValidationError):
            case.save()
        frozen.name = "Changed run"
        with self.assertRaises(ValidationError):
            frozen.save()

    def test_recorded_validation_overlap_and_repeated_items_block_final_freeze(self):
        validation = self.make_run(split="validation")
        self.make_case(run=validation, group="shared-item")
        test = self.make_run()
        self.make_case(run=test, group="shared-item")
        with self.assertRaisesMessage(ValidationError, "overlap"):
            freeze(test, self.reviewer)
        duplicate_run = self.make_run(dataset="another-version")
        self.make_case(run=duplicate_run, group="duplicate")
        self.make_case(run=duplicate_run, group="duplicate")
        with self.assertRaisesMessage(ValidationError, "physical-item"):
            freeze(duplicate_run, self.reviewer)

    def test_missing_reference_and_review_permission_are_not_accepted(self):
        case = self.make_case(checked=False)
        with self.assertRaises(PermissionError):
            adjudicate(case, self.resident)
        case.reference_source = ""
        case.save()
        with self.assertRaises(ValidationError):
            adjudicate(case, self.reviewer)

    def test_protocol_must_be_locked_before_capture_and_cannot_be_rewritten(self):
        case = self.make_case()
        run = case.run
        run.protocol = "Post-hoc favorable acceptance criteria"
        with self.assertRaises(ValidationError):
            run.save()
        unlocked = EvaluationRun.objects.create(name="Unlocked", dataset_version="new", protocol="Defined", created_by=self.reviewer)
        draft = EvaluationCase(run=unlocked, reference_id="new-item", group_id="new-item", source_prediction=case.source_prediction)
        draft.save()
        with self.assertRaisesMessage(ValidationError, "Lock"):
            capture(draft)

    def test_unknown_or_contradictory_recommendation_judgments_rejected(self):
        case = self.make_case(recommendations=[{"id": "project:v1"}])
        with self.assertRaises(ValidationError):
            self.judge(case, unsafe=True, safety="pass")
        judgment = self.judge(case)
        judgment.recommendation_id = "not-shown"
        with self.assertRaises(ValidationError):
            judgment.save()

    def test_proportion_interval_handles_zero_one_and_no_samples(self):
        self.assertIsNone(rate(0, 0)["value"])
        self.assertGreaterEqual(rate(0, 1)["ci95"][0], 0)
        self.assertLessEqual(rate(1, 1)["ci95"][1], 1)
        self.assertLess(rate(1, 1)["ci95"][0], 1)

    def test_changed_snapshots_are_excluded_and_mixed_models_cannot_be_frozen(self):
        run = self.make_run()
        case = self.make_case(run=run)
        changed = {**case.snapshot, "raw_material": "cardboard"}
        EvaluationCase.objects.filter(pk=case.pk).update(snapshot=changed)
        result = report(run)
        self.assertEqual(result["counts"]["invalid_snapshots"], 1)
        self.assertEqual(result["identification"]["n"], 0)
        other = self.make_run(dataset="version-two")
        self.make_case(run=other, model="model-one")
        self.make_case(run=other, model="model-two")
        with self.assertRaisesMessage(ValidationError, "one model version"):
            freeze(other, self.reviewer)

    def test_frozen_project_judgments_and_identity_are_immutable(self):
        case = self.make_case(recommendations=[{"id": "project:v1"}])
        judgment = self.judge(case)
        freeze(case.run, self.reviewer)
        judgment.safety = "reject"
        with self.assertRaises(ValidationError):
            judgment.save()

    def test_capture_rejects_malformed_source_and_final_protocol_requires_attestation(self):
        case = self.make_case()
        bad = EvaluationCase(run=case.run, reference_id="malformed", group_id="malformed", source_prediction=case.source_prediction)
        bad.save()
        PredictionRecord.objects.filter(pk=bad.source_prediction_id).update(recommendation_choices=[{"title": "No ID"}])
        bad.source_prediction.refresh_from_db()
        with self.assertRaises(ValidationError):
            capture(bad)
        run = EvaluationRun.objects.create(name="Not held out", split="test", dataset_version="unverified", protocol="Defined", separation_notes="Not checked yet", created_by=self.reviewer)
        with self.assertRaisesMessage(ValidationError, "held-out"):
            lock_protocol(run, self.reviewer)

    def test_api_is_read_only_admin_scoped_anonymous_and_csv_exportable(self):
        case = self.make_case()
        url = f"/api/evaluations/{case.run_id}/"
        self.assertEqual(self.client.get(url).status_code, 401)
        resident = {"HTTP_AUTHORIZATION": f"Bearer {issue_token(self.resident)}"}
        self.assertEqual(self.client.get(url, **resident).status_code, 403)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {issue_token(self.reviewer)}"}
        response = self.client.get(url, **headers)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("resident", response.content.decode())
        self.assertNotIn("reviewer@example.com", response.content.decode())
        self.assertEqual(response["Cache-Control"], "no-store")
        csv = self.client.get(url + "?format=csv", **headers)
        self.assertEqual(csv.status_code, 200)
        self.assertIn("numerator,denominator", csv.content.decode())
        self.assertEqual(self.client.post(url, **headers).status_code, 405)
        self.assertEqual(self.client.get("/api/evaluations/999999/", **headers).status_code, 404)
        self.assertEqual(self.client.get("/api/evaluations/", **headers).json()["runs"][0]["id"], case.run_id)

    def test_django_admin_scorecard_and_session_exports_render(self):
        run = self.make_run()
        self.client.force_login(self.reviewer)
        url = reverse("admin:evaluations_scorecard", args=[run.id])
        self.assertContains(self.client.get(url), "No adjudicated cases yet")
        self.assertEqual(self.client.get(url + "?format=csv").status_code, 200)
        self.assertFalse(admin.site._registry[EvaluationRun].has_delete_permission(None, run))
