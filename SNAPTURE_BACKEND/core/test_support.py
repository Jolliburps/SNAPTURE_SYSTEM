"""Synthetic reviewer fixtures for isolated test databases ONLY."""
def expert_project_fixtures():
    from django.contrib.auth.models import User
    from .models import Guidance
    from .content import digest
    reviewer, _ = User.objects.get_or_create(username='synthetic-content-reviewer')
    for entry in Guidance.objects.filter(kind='project'):
        entry.review_level = 'expert_reviewed'
        entry.reviewed_by = reviewer
        entry.review_note = 'SYNTHETIC TEST FIXTURE, not real expert approval.'
        entry.content_digest = digest(entry)
        entry.save()
