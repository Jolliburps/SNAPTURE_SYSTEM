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


def screen_and_request(test, record, auth):
    """Exercise the new explicit flow when a project fixture needs ready material."""
    import json
    from core.assessment import WOOD
    answers = {'material_confirmation': record.decision, 'contamination': 'None known', 'moisture': 'Dry',
               'wood_treatment': WOOD[0], 'paper_surface': 'Plain uncoated material without personal details'}
    resin = {'pete_bottles': 'PET/PETE code 1', 'hdpe_containers': 'HDPE code 2'}
    if record.decision in resin: answers['resin_mark'] = resin[record.decision]
    response = test.client.patch(f'/api/predictions/{record.id}/', json.dumps({
        'condition': record.condition or 'Clean and dry', 'previous_contents': 'No chemical contact known',
        'quantity': record.quantity or 1, 'answers': answers}), content_type='application/json', **auth)
    test.assertEqual(response.status_code, 200, response.content)
    test.assertEqual(response.json()['prediction']['recommendation_choices'], [])
    requested = test.client.post(f'/api/predictions/{record.id}/recommendations/', **auth)
    test.assertEqual(requested.status_code, 200, requested.content)
    record.refresh_from_db()
    return requested.json()['recommendations']
