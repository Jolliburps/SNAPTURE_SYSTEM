import json
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.management import call_command
from django.test import TestCase
from PIL import Image

from core.assessment import assess, refresh
from core.auth import issue_token
from core.content import digest, publish, published_guidance, review
from core.models import Guidance, CollectionNotice
from predictions.models import PredictionRecord


class AssessmentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("assessment@example.com", password="test-pass-123")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {issue_token(self.user)}"}
        call_command("seed_reference_guidance", verbosity=0)
        self.record = PredictionRecord.objects.create(user=self.user, model_class="paper", decision="paper", title="Paper", confidence=0.91, threshold=0.8)

    def patch(self, payload):
        return self.client.patch(f"/api/predictions/{self.record.id}/", json.dumps(payload), content_type="application/json", **self.auth)

    def complete(self, **changes):
        payload = {"quantity": 1, "condition": "Clean and dry", "previous_contents": "No chemical contact known",
                   "answers": {"paper_surface": "Plain uncoated material without personal details"}}
        payload.update(changes)
        return self.patch(payload).json()["prediction"]

    def test_identification_does_not_automatically_approve_project(self):
        value = assess(self.record)
        self.assertEqual(value["upcycling"]["status"], "needs_information")
        self.assertEqual(value["upcycling"]["recommendations"], [])

    def test_unverified_checkpoint_needs_material_confirmation_even_at_high_confidence(self):
        self.record.model_version = "snapture-candidate-unverified-v1"
        self.record.confidence = 0.99
        self.record.save()
        value = self.complete()
        self.assertTrue(value["needs_verification"])
        self.assertEqual(value["recommendation_choices"], [])
        value = self.complete(answers={"material_confirmation": "paper", "paper_surface": "Plain uncoated material without personal details"})
        self.assertEqual(value["assessment"]["material"]["status"], "user_selected")
        self.assertEqual(len(value["recommendation_choices"]), 1)

    def test_complete_paper_path_has_independent_outputs_and_versioned_evidence(self):
        value = self.complete()["assessment"]
        self.assertEqual(value["segregation"]["status"], "available")
        self.assertEqual(value["upcycling"]["status"], "available")
        self.assertIn("not cesd", value["segregation"]["sources"][0]["review_note"].lower())
        self.assertEqual(value["segregation"]["sources"][0]["review_level"], "source_checked")
        self.record.refresh_from_db()
        self.assertEqual(self.record.assessment["version"], "assessment-v1")

    def test_chemicals_mold_damage_and_unknown_history_withhold_project(self):
        for changes in ({"previous_contents": "Chemical or cleaning product"}, {"condition": "Moldy or contaminated"},
                        {"condition": "Damaged or cracked"}, {"previous_contents": "Other / unknown"}, {"condition": "something made up"}):
            with self.subTest(changes=changes):
                self.assertEqual(self.complete(**changes)["recommendation_choices"], [])

    def test_segregation_can_be_available_without_any_published_projects(self):
        Guidance.objects.filter(kind="project").update(state="archived")
        value = self.complete()["assessment"]
        self.assertEqual(value["segregation"]["status"], "available")
        self.assertEqual(value["upcycling"]["status"], "awaiting_review")

    def test_manual_selection_does_not_fabricate_ai_confidence(self):
        response = self.client.post("/api/predictions/manual/", json.dumps({"label": "paper"}), content_type="application/json", **self.auth)
        value = response.json()["prediction"]
        self.assertEqual(response.status_code, 201)
        self.assertEqual(value["confidence"], 0)
        self.assertEqual(value["input_method"], "manual")
        self.assertEqual(value["assessment"]["material"]["status"], "user_selected")

    def test_coconut_is_excluded_but_historical_record_is_preserved(self):
        response = self.client.post("/api/predictions/manual/", json.dumps({"label": "coconut_shells"}), content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 400)
        self.record.decision = "coconut_shells"
        self.record.save()
        self.assertEqual(assess(self.record)["material"]["label"], "unknown_unsupported")
        self.assertTrue(PredictionRecord.objects.filter(pk=self.record.pk).exists())

    def test_unknown_plastic_mark_never_unlocks_a_project(self):
        self.record.decision = "pete_bottles"
        self.record.save()
        result = self.complete(answers={"resin_mark": "Not sure"})
        self.assertEqual(result["recommendation_choices"], [])

    def test_client_cannot_forge_approval_or_confidence(self):
        self.record.confidence = 0.1
        self.record.save()
        value = self.complete(answers={"user_confirmed_material": "paper", "approved": True}, confidence=1)
        self.assertEqual(value["confidence"], 0.1)
        self.assertEqual(value["assessment"]["material"]["status"], "needs_confirmation")

    def test_drafts_and_changed_published_content_are_not_used(self):
        entry = Guidance.objects.filter(kind="project", material="paper").get()
        entry.instructions = ["Modified without review"]
        entry.save()
        self.assertEqual(self.complete()["recommendation_choices"], [])

    def test_archived_recommendation_cannot_be_selected_or_started(self):
        value = self.complete()
        choice = value["recommendation_choices"][0]["id"]
        Guidance.objects.filter(kind="project").update(state="archived")
        url = f"/api/predictions/{self.record.id}/recommendation/"
        response = self.client.post(url, json.dumps({"recommendation_id": choice}), content_type="application/json", **self.auth)
        self.assertEqual(response.status_code, 400)

    def test_scalar_json_and_foreign_account_are_rejected(self):
        self.assertEqual(self.patch([]).status_code, 400)
        outsider = User.objects.create_user("outsider@example.com", password="test-pass-123")
        result = self.client.get(f"/api/predictions/{self.record.id}/", HTTP_AUTHORIZATION=f"Bearer {issue_token(outsider)}")
        self.assertEqual(result.status_code, 404)


class ReviewWorkflowTests(TestCase):
    def test_review_permission_and_review_before_publish(self):
        user = User.objects.create_user("editor", password="test-pass-123")
        entry = Guidance.objects.create(key="test", material="paper", kind="segregation", title="Test", category="Test category",
                                        instructions=["Test only"], source="Synthetic test fixture", review_note="Test reviewer")
        with self.assertRaises(PermissionError):
            review(entry, user)
        user.is_superuser = True
        user.save()
        if hasattr(user, "_perm_cache"):
            del user._perm_cache
        with self.assertRaises(ValidationError):
            publish(entry, user)
        review(entry, user)
        publish(entry, user)
        self.assertEqual(len(published_guidance("paper")), 1)

    def test_seed_is_idempotent(self):
        call_command("seed_reference_guidance", verbosity=0)
        count = Guidance.objects.count()
        call_command("seed_reference_guidance", verbosity=0)
        self.assertEqual(Guidance.objects.count(), count)

    def test_withdrawn_new_version_does_not_resurface_an_old_rule(self):
        call_command("seed_reference_guidance", verbosity=0)
        entry = Guidance.objects.get(key="paper-gift-wrap")
        entry.pk = None
        entry.version = 2
        entry.state = "archived"
        entry.save()
        self.assertFalse(any(row.key == "paper-gift-wrap" for row in published_guidance("paper")))


class CollectionNoticeTests(TestCase):
    def setUp(self):
        from accounts.models import Profile
        self.user = User.objects.create_user("schedule@example.com", password="test-pass-123")
        Profile.objects.create(user=self.user, barangay="Molino 1")
        self.auth = {"HTTP_AUTHORIZATION": f"Bearer {issue_token(self.user)}"}

    def test_no_unverified_dates_are_invented(self):
        result = self.client.get("/api/collection/?month=2026-10", **self.auth)
        self.assertEqual(result.json(), {"entries": [], "status": "unavailable"})

    def test_only_published_unchanged_notice_for_selected_barangay_is_visible(self):
        from datetime import date
        from core.content import publish_notice
        user = User.objects.create_superuser("reviewer", "reviewer@example.com", "test-pass-123")
        source = Guidance.objects.create(key="collection-fixture", kind="information", title="Synthetic schedule", source="Synthetic test only",
                                         instructions=["Synthetic date, not real guidance"], review_note="Synthetic reviewer")
        review(source, user)
        publish(source, user)
        notice = CollectionNotice.objects.create(barangay="Molino 1", title="Synthetic collection", collection_date=date(2026, 10, 20), guidance=source)
        self.assertEqual(self.client.get("/api/collection/?month=2026-10", **self.auth).json()["entries"], [])
        publish_notice(notice, user)
        self.assertEqual(len(self.client.get("/api/collection/?month=2026-10", **self.auth).json()["entries"]), 1)
        notice.description = "Edited without republishing"
        notice.save()
        self.assertEqual(self.client.get("/api/collection/?month=2026-10", **self.auth).json()["entries"], [])

    def test_invalid_month_and_unauthenticated_access(self):
        self.assertEqual(self.client.get("/api/collection/?month=2026-13", **self.auth).status_code, 400)
        self.assertEqual(self.client.get("/api/collection/").status_code, 401)
