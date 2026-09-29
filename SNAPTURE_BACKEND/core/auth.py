"""Small bearer-token layer for the local React Native client."""

from __future__ import annotations

import hashlib
import secrets
from functools import wraps

from django.http import JsonResponse

from accounts.models import ApiToken


def issue_token(user) -> str:
    raw_token = secrets.token_urlsafe(32)
    ApiToken.objects.create(
        user=user,
        token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
    )
    return raw_token


def user_from_request(request):
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    raw_token = header.removeprefix("Bearer ").strip()
    if not raw_token:
        return None
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    token = ApiToken.objects.select_related("user", "user__profile").filter(
        token_hash=token_hash
    ).first()
    if token is None:
        return None
    token.touch()
    return token.user


def require_api_user(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        user = user_from_request(request)
        if user is None:
            return JsonResponse({"detail": "Authentication required."}, status=401)
        request.api_user = user
        return view(request, *args, **kwargs)

    return wrapped


def require_api_admin(view):
    @wraps(view)
    @require_api_user
    def wrapped(request, *args, **kwargs):
        user = request.api_user
        profile = getattr(user, "profile", None)
        if not user.is_staff and (profile is None or profile.role != "admin"):
            return JsonResponse({"detail": "Administrator access required."}, status=403)
        return view(request, *args, **kwargs)

    return wrapped
