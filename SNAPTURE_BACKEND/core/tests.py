import json

from django.contrib.auth.models import User
from django.test import TestCase

from .auth import issue_token
from .materials import public_materials


class MaterialGuideTests(TestCase):
    def test_public_materials_expose_all_thesis_categories_and_guidance(self):
        materials = public_materials()
        self.assertEqual(len(materials), 7)
        self.assertTrue(all(item["examples"] is not None for item in materials))
        self.assertTrue(all("upcycling" in item for item in materials))


class ActivityLogTests(TestCase):
    def test_public_activity_logs_action_without_request_contents(self):
        with self.assertLogs("snapture.activity", level="INFO") as captured:
            response = self.client.get("/api/materials/")
        self.assertEqual(response.status_code, 200)
        message = captured.output[0]
        self.assertIn("user_id=anonymous action=materials_browsed outcome=success status=200", message)
        self.assertNotIn("/api/", message)

    def test_sign_in_logs_user_id_without_password(self):
        user = User.objects.create_user(username="activity@example.com", password="private-pass-123")
        with self.assertLogs("snapture.activity", level="INFO") as captured:
            response = self.client.post(
                "/api/auth/login/",
                data=json.dumps({"email": "activity@example.com", "password": "private-pass-123"}),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 200)
        message = captured.output[0]
        self.assertIn(f"user_id={user.id} action=sign_in outcome=success status=200", message)
        self.assertNotIn("activity@example.com", message)
        self.assertNotIn("private-pass-123", message)

    def test_authenticated_activity_logs_user_id(self):
        user = User.objects.create_user(username="activity@example.com", password="private-pass-123")
        token = issue_token(user)
        with self.assertLogs("snapture.activity", level="INFO") as captured:
            response = self.client.get(
                "/api/predictions/",
                HTTP_AUTHORIZATION=f"Bearer {token}",
            )
        self.assertEqual(response.status_code, 200)
        message = captured.output[0]
        self.assertIn(f"user_id={user.id} action=scan_history_opened outcome=success status=200", message)
        self.assertNotIn(token, message)
