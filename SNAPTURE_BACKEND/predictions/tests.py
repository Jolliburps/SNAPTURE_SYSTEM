from django.test import TestCase

# Create your tests here.
import json

from django.contrib.auth.models import User
from django.test import TestCase

from accounts.models import Profile

from .models import PredictionRecord
from core.auth import issue_token


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
        self.assertEqual(len(response.json()["recommendations"]), 3)

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
        self.assertEqual(len(payload["recommendation_choices"]), 3)

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
