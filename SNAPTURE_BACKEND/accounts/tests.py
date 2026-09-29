from django.test import TestCase

# Create your tests here.
import json

from django.contrib.auth.models import User
from django.test import TestCase

from core.auth import issue_token
from predictions.models import PredictionRecord

from .models import Profile


class AdminAuthenticationApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin",
            email="admin@snapture.local",
            password="snapture@2026",
            is_staff=True,
            is_superuser=True,
        )
        Profile.objects.create(user=self.admin, role="admin", display_name="SNAPTURE Administrator")

    def test_admin_can_login_with_username_and_open_overview(self):
        login = self.client.post(
            "/api/auth/login/",
            data=json.dumps({"email": "admin", "password": "snapture@2026"}),
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["user"]["role"], "admin")
        token = login.json()["token"]

        overview = self.client.get("/api/auth/admin/overview/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["admin_count"], 1)

    def test_admin_overview_is_anonymized_until_detail_is_requested(self):
        user = User.objects.create_user(username="user@example.com", email="user@example.com", password="pass12345")
        Profile.objects.create(user=user)
        record = PredictionRecord.objects.create(
            user=user,
            model_class="paper",
            decision="paper",
            title="Paper",
            confidence=0.81,
        )
        token = issue_token(self.admin)
        overview = self.client.get("/api/auth/admin/overview/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(overview.status_code, 200)
        summary = overview.json()["recent_predictions"][0]
        self.assertEqual(summary["reference"], f"scan-{record.id:04d}")
        self.assertNotIn("user_email", summary)
        detail = self.client.get(
            f"/api/auth/admin/predictions/{record.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["user_id"], user.id)

    def test_regular_user_cannot_open_admin_overview(self):
        user = User.objects.create_user(username="user@example.com", email="user@example.com", password="pass12345")
        Profile.objects.create(user=user)
        token = issue_token(user)
        response = self.client.get("/api/auth/admin/overview/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(response.status_code, 403)


class AuthenticationApiTests(TestCase):
    def test_register_me_and_logout(self):
        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps({"email": "user@example.com", "password": "pass12345"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        token = response.json()["token"]

        me = self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["user"]["role"], "regular")

        logout = self.client.post("/api/auth/logout/", HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}").status_code, 401)
