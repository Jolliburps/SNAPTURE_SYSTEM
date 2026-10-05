import json
from io import BytesIO
from tempfile import TemporaryDirectory

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

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

    @override_settings(DEBUG=True)
    def test_password_reset_request_and_confirm(self):
        user = User.objects.create_user(username="reset@example.com", email="reset@example.com", password="oldpass123")
        Profile.objects.create(user=user)
        request = self.client.post(
            "/api/auth/password-reset/request/",
            data=json.dumps({"email": "reset@example.com"}),
            content_type="application/json",
        )
        self.assertEqual(request.status_code, 200)
        reset_token = request.json().get("reset_token")
        self.assertTrue(reset_token)

        confirm = self.client.post(
            "/api/auth/password-reset/confirm/",
            data=json.dumps({"email": "reset@example.com", "token": reset_token, "password": "newpass123"}),
            content_type="application/json",
        )
        self.assertEqual(confirm.status_code, 200)
        self.assertEqual(
            self.client.post(
                "/api/auth/login/",
                data=json.dumps({"email": "reset@example.com", "password": "newpass123"}),
                content_type="application/json",
            ).status_code,
            200,
        )

    def test_barangay_is_optional_and_can_be_updated_without_changing_auth(self):
        response = self.client.post(
            "/api/auth/register/",
            data=json.dumps({"email": "resident@example.com", "password": "pass12345", "display_name": "Resident", "barangay": "Sample Barangay"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["user"]["barangay"], "Sample Barangay")
        token = response.json()["token"]

        updated = self.client.patch(
            "/api/auth/me/",
            data=json.dumps({"barangay": "Updated Barangay"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["user"]["barangay"], "Updated Barangay")
        self.assertEqual(updated.json()["user"]["display_name"], "Resident")
        self.assertEqual(self.client.get("/api/auth/me/", HTTP_AUTHORIZATION=f"Bearer {token}").json()["user"]["barangay"], "Updated Barangay")

        invalid = self.client.patch(
            "/api/auth/me/",
            data=json.dumps({"barangay": "x" * 121}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(Profile.objects.get(user__username="resident@example.com").barangay, "Updated Barangay")

    def test_display_name_and_profile_photo_update_without_changing_login_identity(self):
        user = User.objects.create_user(username="owner@example.com", email="owner@example.com", password="pass12345")
        token = issue_token(user)
        headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"}
        bad_name = self.client.patch("/api/auth/me/", data=json.dumps({"display_name": " "}), content_type="application/json", **headers)
        self.assertEqual(bad_name.status_code, 400)
        updated = self.client.patch("/api/auth/me/", data=json.dumps({"display_name": "New Name"}), content_type="application/json", **headers)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["user"]["display_name"], "New Name")
        user.refresh_from_db()
        self.assertEqual(user.username, "owner@example.com")
        self.assertEqual(user.email, "owner@example.com")

        picture = BytesIO()
        Image.new("RGB", (8, 8), "green").save(picture, format="PNG")
        with TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            upload = SimpleUploadedFile("avatar.png", picture.getvalue(), content_type="image/png")
            response = self.client.post("/api/auth/me/photo/", data={"image": upload}, **headers)
            self.assertEqual(response.status_code, 200)
            self.assertIn("/media/profile_pictures/", response.json()["user"]["profile_picture_url"])
            self.assertEqual(self.client.get("/api/auth/me/", **headers).json()["user"]["profile_picture_url"], response.json()["user"]["profile_picture_url"])
            invalid = self.client.post("/api/auth/me/photo/", data={"image": SimpleUploadedFile("fake.png", b"not an image", content_type="image/png")}, **headers)
            self.assertEqual(invalid.status_code, 400)
