from django.test import TestCase

# Create your tests here.
import json
import tempfile
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image

from accounts.models import Profile

from .models import PredictionRecord
from core.auth import issue_token
from core.materials import SCOPE_LABELS, material_info


class SevenCategoryCameraApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="camera-test@example.com", password="test-pass-123")
        self.token = issue_token(self.user)
        temporary_media = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_media.cleanup)
        media_override = self.settings(MEDIA_ROOT=temporary_media.name)
        media_override.enable()
        self.addCleanup(media_override.disable)

    def test_uploaded_scan_uses_all_seven_categories_with_prototype_labels(self):
        photo = BytesIO()
        Image.new("RGB", (80, 80), "green").save(photo, format="JPEG")
        photo_bytes = photo.getvalue()
        for label in SCOPE_LABELS:
            with self.subTest(label=label), patch("predictions.views.predict_image") as predict:
                predict.return_value = {
                    "decision": label, "model_class": label, "title": material_info(label)["title"],
                    "confidence": 0.91, "threshold": 0.8,
                    "model_version": "snapture-mobilenetv2-scope-candidate-unverified-v1",
                }
                response = self.client.post(
                    "/api/predictions/create/",
                    {"image": SimpleUploadedFile("camera.jpg", photo_bytes, content_type="image/jpeg")},
                    HTTP_AUTHORIZATION=f"Bearer {self.token}",
                )
                self.assertEqual(response.status_code, 201)
                predict.assert_called_once_with(photo_bytes)
                payload = response.json()["prediction"]
                self.assertEqual(payload["decision"], label)
                self.assertEqual(payload["threshold"], 0.8)
                self.assertTrue(payload["experimental_model"])
                if label in {"pete_bottles", "hdpe_containers"}:
                    self.assertTrue(payload["needs_verification"])
                    self.assertEqual(payload["recommendation_choices"], [])
                else:
                    self.assertEqual(payload["recommendation_choices"], [])


class PredictionQuestionnaireTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="user@example.com", email="user@example.com", password="pass12345")
        Profile.objects.create(user=self.user)
        self.token = issue_token(self.user)
        self.record = PredictionRecord.objects.create(
            user=self.user,
            model_class="paper",
            decision="paper",
            title="Paper",
            confidence=0.85,
        )

    def test_questionnaire_refreshes_recommendations(self):
        response = self.client.patch(
            f"/api/predictions/{self.record.id}/",
            data=json.dumps({
                "quantity": "5",
                "condition": "Clean and dry",
                "previous_contents": "Other / unknown",
                "available_materials": "glue",
                "answers": {"quantity": "5"},
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["prediction"]["quantity"], 5)
        self.assertEqual(response.json()["recommendations"], [])

    def test_resin_code_confirmation_unlocks_a_supported_guide(self):
        self.record.decision = "unknown_unsupported"
        self.record.model_class = "plastic"
        self.record.title = "Unidentified or unsupported object"
        self.record.save(update_fields=["decision", "model_class", "title"])
        response = self.client.patch(
            f"/api/predictions/{self.record.id}/",
            data=json.dumps({
                "answers": {"follow_up": "PET/PETE code 1"},
            }),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()["prediction"]
        self.assertEqual(payload["decision"], "pete_bottles")
        self.assertEqual(payload["recommendation_choices"], [])
        self.assertEqual(payload["raw_model_class"], "plastic")
        self.assertFalse(payload["needs_verification"])

    def test_confident_plastic_still_requires_a_resin_code(self):
        self.record.decision = "pete_bottles"
        self.record.model_class = "pete_bottles"
        self.record.confidence = 0.99
        self.record.save()
        response = self.client.patch(
            f"/api/predictions/{self.record.id}/", data=json.dumps({"quantity": 1}),
            content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        payload = response.json()["prediction"]
        self.assertTrue(payload["needs_verification"])
        self.assertEqual(payload["recommendation_choices"], [])

    def test_readable_code_can_correct_a_confident_plastic_guess(self):
        self.record.decision = "pete_bottles"
        self.record.model_class = "pete_bottles"
        self.record.save()
        response = self.client.patch(
            f"/api/predictions/{self.record.id}/", data=json.dumps({"answers": {"follow_up": "HDPE code 2"}}),
            content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        payload = response.json()["prediction"]
        self.assertEqual(payload["decision"], "hdpe_containers")
        self.assertEqual(payload["raw_model_class"], "pete_bottles")
        self.assertFalse(payload["needs_verification"])
        self.assertEqual(payload["recommendation_choices"], [])

    def test_unknown_plastic_code_does_not_unlock_recommendations(self):
        self.record.decision = "hdpe_containers"
        self.record.model_class = "hdpe_containers"
        self.record.save()
        response = self.client.patch(
            f"/api/predictions/{self.record.id}/", data=json.dumps({"answers": {"follow_up": "Not sure"}}),
            content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        payload = response.json()["prediction"]
        self.assertEqual(payload["decision"], "unknown_unsupported")
        self.assertTrue(payload["needs_verification"])
        self.assertEqual(payload["recommendation_choices"], [])

    def test_out_of_scope_model_label_is_serialized_as_unidentified(self):
        self.record.decision = "glass"
        self.record.model_class = "glass"
        self.record.title = "Glass"
        self.record.save(update_fields=["decision", "model_class", "title"])
        response = self.client.get(
            f"/api/predictions/{self.record.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()["prediction"]
        self.assertEqual(payload["decision"], "unknown_unsupported")
        self.assertEqual(payload["label"], "unknown_unsupported")
        self.assertEqual(payload["model_class"], "unknown_unsupported")
        self.assertEqual(payload["raw_model_class"], "glass")
        self.assertEqual(payload["title"], "Unidentified or unsupported object")
        self.assertTrue(payload["needs_verification"])

    def test_candidate_scan_is_labeled_as_a_prototype_result(self):
        self.record.model_version = "snapture-mobilenetv2-scope-candidate-unverified-v1"
        self.record.save(update_fields=["model_version"])
        response = self.client.get(
            f"/api/predictions/{self.record.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()["prediction"]
        self.assertEqual(payload["decision"], "paper")
        self.assertEqual(payload["title"], "Paper (prototype result)")
        self.assertTrue(payload["experimental_model"])

    def test_user_can_delete_only_their_own_history(self):
        other = User.objects.create_user(username="other@example.com", email="other@example.com", password="pass12345")
        Profile.objects.create(user=other)
        other_record = PredictionRecord.objects.create(
            user=other,
            model_class="paper",
            decision="paper",
            title="Paper",
            confidence=0.7,
        )
        response = self.client.delete(
            f"/api/predictions/{other_record.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 404)
        self.assertTrue(PredictionRecord.objects.filter(id=other_record.id).exists())
        response = self.client.delete(
            f"/api/predictions/{self.record.id}/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(PredictionRecord.objects.filter(id=self.record.id).exists())

    def test_user_can_clear_their_history_without_affecting_other_users(self):
        other = User.objects.create_user(username="other@example.com", email="other@example.com", password="pass12345")
        Profile.objects.create(user=other)
        other_record = PredictionRecord.objects.create(
            user=other,
            model_class="paper",
            decision="paper",
            title="Paper",
            confidence=0.7,
        )
        response = self.client.delete(
            "/api/predictions/clear/",
            HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(PredictionRecord.objects.filter(user=self.user).exists())
        self.assertTrue(PredictionRecord.objects.filter(id=other_record.id).exists())


class ProjectApiTests(TestCase):
    def setUp(self):
        from django.core.management import call_command
        from core.models import Guidance
        from core.content import digest
        call_command("seed_reference_guidance", verbosity=0)
        entry = Guidance.objects.get(key="cardboard-craft-base")
        entry.key = "cardboard_organizer"
        entry.title = "Drawer organizer"
        entry.instructions = ["Measure the cardboard.", "Fold the dividers."]
        entry.content_digest = digest(entry)
        entry.save()
        self.user = User.objects.create_user(username="builder@example.com", email="builder@example.com", password="pass12345")
        self.token = issue_token(self.user)
        self.record = PredictionRecord.objects.create(
            user=self.user, model_class="cardboard", decision="cardboard", title="Cardboard", confidence=0.88,
            selected_recommendation="cardboard_organizer:v1",
            condition="Clean and dry", previous_contents="No chemical contact known", quantity=1,
            answers={"paper_surface": "Plain uncoated material without personal details"},
            recommendation_choices=[{
                "id": "cardboard_organizer:v1", "title": "Drawer organizer", "summary": "Make a drawer divider.",
                "materials": ["Dry cardboard", "Glue"], "steps": ["Measure the cardboard.", "Fold the dividers."],
                "safety_note": "Use tools carefully.",
            }],
        )

    def _post(self):
        return self.client.post(
            "/api/projects/", data=json.dumps({"prediction_id": self.record.id}),
            content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}",
        )

    def test_saved_recommendation_stays_unstarted_until_explicit_post(self):
        history = self.client.get("/api/predictions/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()
        self.assertEqual(history["total_count"], 1)
        saved = self.client.get("/api/predictions/saved/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()
        self.assertEqual([row["id"] for row in saved["predictions"]], [self.record.id])
        self.assertEqual(self.client.get("/api/projects/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()["projects"], [])
        started = self._post()
        self.assertEqual(started.status_code, 201)
        project = started.json()["project"]
        self.assertEqual(project["status"], "active")
        self.assertEqual(project["progress_percent"], 0)
        self.assertEqual(project["steps"], ["Measure the cardboard.", "Fold the dividers."])
        self.assertEqual(self._post().status_code, 200)
        self.assertEqual(len(self.client.get("/api/projects/", HTTP_AUTHORIZATION=f"Bearer {self.token}").json()["projects"]), 1)

        step_url = f"/api/projects/{project['id']}/steps/0/"
        step = self.client.patch(step_url, data=json.dumps({"completed": True}), content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.assertEqual(step.json()["project"]["progress_percent"], 50)
        self.assertEqual(step.json()["project"]["status"], "active")
        complete = self.client.patch(f"/api/projects/{project['id']}/steps/1/", data=json.dumps({"completed": True}), content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {self.token}")
        self.assertEqual(complete.json()["project"]["status"], "completed")
        self.assertEqual(complete.json()["project"]["progress_percent"], 100)

    def test_project_access_is_user_scoped(self):
        project_id = self._post().json()["project"]["id"]
        other = User.objects.create_user(username="other@example.com", email="other@example.com", password="pass12345")
        other_token = issue_token(other)
        self.assertEqual(self.client.get("/api/projects/", HTTP_AUTHORIZATION=f"Bearer {other_token}").json()["projects"], [])
        response = self.client.patch(f"/api/projects/{project_id}/steps/0/", data=json.dumps({"completed": True}), content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {other_token}")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.client.post("/api/projects/", data=json.dumps({"prediction_id": self.record.id}), content_type="application/json", HTTP_AUTHORIZATION=f"Bearer {other_token}").status_code, 404)
