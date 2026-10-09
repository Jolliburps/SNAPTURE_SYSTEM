"""Development CORS middleware for a phone connecting over the LAN."""

import logging
from time import perf_counter

from django.http import HttpResponse


activity_logger = logging.getLogger("snapture.activity")

ACTIVITY_NAMES = {
    ("register", "POST"): "account_register",
    ("login", "POST"): "sign_in",
    ("logout", "POST"): "sign_out",
    ("password-reset-request", "POST"): "password_reset_requested",
    ("password-reset-confirm", "POST"): "password_reset_confirmed",
    ("me", "GET"): "account_opened",
    ("me", "PATCH"): "profile_updated",
    ("profile-picture", "POST"): "profile_photo_updated",
    ("admin-overview", "GET"): "admin_dashboard_opened",
    ("admin-prediction-detail", "GET"): "admin_scan_opened",
    ("materials", "GET"): "materials_browsed",
    ("prediction-list", "GET"): "scan_history_opened",
    ("prediction-create", "POST"): "object_scanned",
    ("prediction-clear", "DELETE"): "scan_history_cleared",
    ("prediction-saved", "GET"): "saved_scans_opened",
    ("prediction-detail", "GET"): "scan_opened",
    ("prediction-detail", "PATCH"): "scan_details_updated",
    ("prediction-detail", "DELETE"): "scan_deleted",
    ("recommendation-select", "POST"): "recommendation_selected",
    ("material-questions", "GET"): "material_questions_opened",
    ("projects", "GET"): "projects_opened",
    ("projects", "POST"): "project_started",
    ("project-step", "PATCH"): "project_step_updated",
    ("dataset-counts", "GET"): "dataset_counts_opened",
    ("dataset-upload", "POST"): "dataset_image_uploaded",
}


class ActivityLogMiddleware:
    """Log safe, readable API activity to the backend terminal."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS" or not request.path.startswith("/api/"):
            return self.get_response(request)
        started = perf_counter()
        response = self.get_response(request)
        route = getattr(getattr(request, "resolver_match", None), "url_name", None)
        if route == "health":
            return response
        action = ACTIVITY_NAMES.get((route, request.method), "api_request")
        user = getattr(request, "api_user", None)
        user_id = getattr(request, "activity_user_id", None) or getattr(user, "id", None)
        activity_logger.info(
            "user_id=%s action=%s outcome=%s status=%d duration_ms=%d",
            user_id if user_id is not None else "anonymous",
            action,
            "success" if response.status_code < 400 else "failed",
            response.status_code,
            round((perf_counter() - started) * 1000),
        )
        return response


class LocalCorsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method == "OPTIONS":
            response = HttpResponse(status=204)
        else:
            response = self.get_response(request)
        origin = request.headers.get("Origin")
        if origin:
            response["Access-Control-Allow-Origin"] = origin
            response["Vary"] = "Origin"
        response["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Requested-With"
        response["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
        return response
