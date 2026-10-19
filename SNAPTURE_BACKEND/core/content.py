"""Content review integrity and explicit publication; no automatic approval."""
import hashlib
import json

from django.core.exceptions import ValidationError
from django.utils import timezone

CONTENT_FIELDS = ("key", "version", "kind", "material", "title", "category", "summary", "instructions", "materials", "requirements", "minimum_quantity", "warnings", "source", "review_note", "review_level")


def digest(entry):
    data = {field: getattr(entry, field) for field in CONTENT_FIELDS}
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def is_publishable(entry):
    try:
        entry.full_clean()
    except ValidationError:
        return False
    return bool(entry.state == "published" and entry.content_digest == digest(entry))


def review(entry, user):
    if not user.has_perm("core.review_guidance"):
        raise PermissionError("Guidance review permission is required.")
    if entry.state != "draft":
        raise ValidationError("Only a draft can enter review. Create a new version for changes.")
    entry.state = "reviewed"
    entry.reviewed_by = user
    entry.reviewed_at = timezone.now()
    entry.content_digest = digest(entry)
    entry.full_clean()
    entry.save()


def publish(entry, user):
    if not user.has_perm("core.review_guidance"):
        raise PermissionError("Guidance publication permission is required.")
    if entry.state != "reviewed" or entry.content_digest != digest(entry):
        raise ValidationError("Review the current content before publishing it.")
    entry.state = "published"
    entry.published_at = timezone.now()
    entry.full_clean()
    entry.save()


def published_guidance(material=None):
    from .models import Guidance
    rows = Guidance.objects.all()
    if material:
        rows = rows.filter(material=material)
    latest = {}
    for entry in rows:
        if entry.key not in latest:
            latest[entry.key] = entry
    return [entry for entry in latest.values() if is_publishable(entry)]


def notice_digest(entry):
    data = [entry.barangay, entry.title, entry.collection_date.isoformat(), entry.description, entry.guidance.content_digest]
    return hashlib.sha256(json.dumps(data, ensure_ascii=True).encode()).hexdigest()


def publish_notice(entry, user):
    if not user.has_perm("core.review_guidance"):
        raise PermissionError("Guidance publication permission is required.")
    if entry.guidance.kind != "information" or not is_publishable(entry.guidance):
        raise ValidationError("Publish the reviewed collection-information source first.")
    entry.published = True
    entry.published_at = timezone.now()
    entry.published_digest = notice_digest(entry)
    entry.full_clean()
    entry.save()
