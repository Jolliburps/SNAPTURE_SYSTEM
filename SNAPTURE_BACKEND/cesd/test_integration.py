"""Exercise all three interfaces against one isolated test database."""
import json
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase
from django.urls import reverse
from django.utils import timezone

from accounts.models import Profile
from core.auth import issue_token
from predictions.models import PredictionRecord, ScanScene, SceneItem, UserProject
from .models import Activity, Announcement, Material, Policy, Schedule, StaffAccess


class SharedIntegrationTests(TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix='snapture-integration-')
        self.addCleanup(temporary.cleanup)
        override = self.settings(MEDIA_ROOT=temporary.name)
        override.enable()
        self.addCleanup(override.disable)
        self.owner = self.account('integration-owner', 'owner')
        self.staff = self.account('integration-staff', 'staff')
        self.resident = User.objects.create_user('integration-resident')
        Profile.objects.create(user=self.resident, display_name='Private Resident', barangay='Molino 1')
        self.resident_auth = {'HTTP_AUTHORIZATION': f'Bearer {issue_token(self.resident)}'}
        self.technical = User.objects.create_superuser('technical-integration')
        Profile.objects.create(user=self.technical)
        self.client.force_login(self.owner)

    def account(self, name, access):
        user = User.objects.create_user(name, email=f'{name}@example.test', is_staff=True)
        Profile.objects.create(user=user, display_name=name, role='admin')
        StaffAccess.objects.create(user=user, access=access)
        return user

    def policy_fields(self, **changes):
        return {'title': 'Shared policy', 'category': 'Guidelines', 'effective_date': '2026-10-26',
                'description': 'Prepare clean material.', 'content': 'Keep paper dry.', 'status': 'Draft', **changes}

    def admin_url(self, model, operation, pk=None):
        return reverse(f'admin:{model._meta.app_label}_{model._meta.model_name}_{operation}', args=[pk] if pk else [])

    def test_staff_session_opens_both_panels_without_elevating_private_permissions(self):
        self.assertEqual(self.client.get('/api/cesd/me/').status_code, 200)
        self.assertEqual(self.client.get('/admin/').status_code, 200)
        for model in (Policy, Material, Schedule, Announcement):
            self.assertEqual(self.client.get(self.admin_url(model, 'changelist')).status_code, 200)
        for model in (PredictionRecord, ScanScene, SceneItem, UserProject):
            self.assertEqual(self.client.get(self.admin_url(model, 'changelist')).status_code, 403)
        self.assertEqual(self.client.get('/admin/core/guidance/').status_code, 403)
        self.assertFalse(self.owner.is_superuser)
        self.assertFalse(self.owner.user_permissions.exists())

    def test_django_publication_and_web_withdrawal_are_immediately_shared_with_mobile(self):
        response = self.client.post(self.admin_url(Policy, 'add'), self.policy_fields())
        self.assertEqual(response.status_code, 302, response.content)
        policy = Policy.objects.get()
        self.assertEqual(policy.updated_by_id, self.owner.id)
        key = f'cesd-policy-{policy.id}'
        self.assertNotIn(key, [row['key'] for row in Client().get('/api/learning/').json()['entries']])
        self.assertEqual(self.client.get('/api/cesd/policies/').json()['results'][0]['id'], policy.id)
        self.assertEqual(self.client.post(self.admin_url(Policy, 'change', policy.id), self.policy_fields(status='Published')).status_code, 302)
        policy.refresh_from_db()
        self.assertIsNotNone(policy.published_at)
        self.assertIn(key, [row['key'] for row in Client().get('/api/learning/').json()['entries']])
        self.assertTrue(Activity.objects.filter(record_id=str(policy.id), action='Updated policy via Django admin').exists())
        self.assertEqual(self.client.post(f'/api/cesd/policies/{policy.id}/', self.policy_fields()).status_code, 200)
        self.assertNotIn(key, [row['key'] for row in Client().get('/api/learning/').json()['entries']])
        policy.refresh_from_db()
        self.assertEqual(policy.status, 'Draft')

    def test_web_content_is_editable_in_django_and_announcements_reach_home(self):
        data = {'title': 'Shared announcement', 'category': 'Collection', 'description': 'Collection notice.', 'status': 'Draft'}
        response = self.client.post('/api/cesd/announcements/', data)
        self.assertEqual(response.status_code, 201)
        row_id = response.json()['record']['id']
        self.assertEqual(Client().get('/api/announcements/').json()['entries'], [])
        self.assertEqual(self.client.post(self.admin_url(Announcement, 'change', row_id), {**data, 'status': 'Published'}).status_code, 302)
        mobile = Client().get('/api/announcements/').json()['entries']
        self.assertEqual(mobile[0]['id'], str(row_id))
        self.assertEqual(self.client.get('/api/cesd/announcements/').json()['results'][0]['status'], 'Published')

    def test_schedule_validation_barangay_filter_and_cancellation_are_shared(self):
        data = {'waste_type': 'Recyclable', 'barangay': 'Molino 1', 'collection_date': '2026-10-26',
                'start_time': '08:00', 'end_time': '10:00', 'notes': 'Keep dry.', 'status': 'Scheduled'}
        invalid = self.client.post(self.admin_url(Schedule, 'add'), {**data, 'end_time': '07:00'})
        self.assertEqual(invalid.status_code, 200)
        self.assertFalse(Schedule.objects.exists())
        self.assertEqual(self.client.post(self.admin_url(Schedule, 'add'), data).status_code, 302)
        schedule = Schedule.objects.get()
        mobile = Client().get('/api/collection/?month=2026-10', **self.resident_auth).json()['entries']
        self.assertEqual(mobile[0]['id'], f'cesd-schedule-{schedule.id}')
        self.assertEqual(self.client.post(f'/api/cesd/schedules/{schedule.id}/', {**data, 'status': 'Cancelled'}).status_code, 200)
        self.assertEqual(Client().get('/api/collection/?month=2026-10', **self.resident_auth).json()['entries'][0]['status'], 'Cancelled')
        self.resident.profile.barangay = 'Molino 2'
        self.resident.profile.save()
        self.assertEqual(Client().get('/api/collection/?month=2026-10', **self.resident_auth).json()['entries'], [])

    def test_file_validation_protected_preview_and_publication_use_the_same_record(self):
        data = {'title': 'Shared PDF', 'category': 'Recycling', 'description': 'Instructions.', 'material_type': 'PDF Guide', 'status': 'Draft'}
        self.client.post(self.admin_url(Material, 'add'), {**data, 'attachment': SimpleUploadedFile('bad.pdf', b'not a PDF')})
        self.assertFalse(Material.objects.exists())
        self.assertEqual(self.client.post(self.admin_url(Material, 'add'), {**data, 'attachment': SimpleUploadedFile('guide.pdf', b'%PDF-1.4\n%%EOF')}).status_code, 302)
        material = Material.objects.get()
        file_url = reverse('cesd-file', args=['materials', material.id])
        self.assertEqual(Client().get(file_url).status_code, 404)
        form = self.client.get(self.admin_url(Material, 'change', material.id))
        self.assertContains(form, file_url)
        self.client.force_login(self.technical)
        preview = self.client.get(file_url)
        self.assertEqual(preview.status_code, 200)
        preview.close()
        self.assertEqual(self.client.post(self.admin_url(Material, 'change', material.id), {**data, 'status': 'Published'}).status_code, 302)
        published = Client().get(file_url)
        self.assertEqual(published.status_code, 200)
        published.close()
        row = next(row for row in Client().get('/api/learning/').json()['entries'] if row['key'] == f'cesd-material-{material.id}')
        self.assertEqual(row['file_url'], file_url)

    def test_staff_cannot_edit_account_access_or_owner_audit_in_database_panel(self):
        self.client.force_login(self.staff)
        for model in (StaffAccess, Activity):
            self.assertEqual(self.client.get(self.admin_url(model, 'changelist')).status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.get(self.admin_url(StaffAccess, 'changelist')).status_code, 200)
        self.assertEqual(self.client.post(self.admin_url(StaffAccess, 'change', self.staff.cesd_access.id), {'access': 'owner'}).status_code, 403)
        self.staff.cesd_access.refresh_from_db()
        self.assertEqual(self.staff.cesd_access.access, 'staff')
        self.assertEqual(self.client.post(self.admin_url(Policy, 'delete', 999)).status_code, 403)

    def test_private_project_progress_and_admin_aggregates_use_one_database(self):
        prediction = PredictionRecord.objects.create(user=self.resident, title='Private paper scan', model_class='paper', decision='paper', confidence=.9)
        scene = ScanScene.objects.create(user=self.resident, request_id='private-integration-photo', width=100, height=100)
        SceneItem.objects.create(scene=scene, prediction=prediction, name='paper', score=.9, box=[0, 0, 1, 1])
        project = UserProject.objects.create(user=self.resident, source_prediction=prediction, recommendation_id='private-project', title='Private project', material='Paper', steps=['Prepare.', 'Reuse.'], completed_steps=[])
        before = self.client.get('/api/cesd/integration/').json()
        self.assertEqual(before['mobile_activity']['scans'], 1)
        self.assertEqual(before['mobile_activity']['items'], 1)
        self.assertEqual(before['mobile_activity']['projects_active'], 1)
        self.assertNotIn('Private paper scan', json.dumps(before))
        self.assertNotIn('Private Resident', json.dumps(before))
        mobile = Client()
        for step in (0, 1):
            response = mobile.patch(f'/api/projects/{project.id}/steps/{step}/', json.dumps({'completed': True}), content_type='application/json', **self.resident_auth)
            self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.client.get('/api/cesd/integration/').json()['mobile_activity']['projects_completed'], 1)
        month = timezone.localdate().strftime('%Y-%m')
        self.assertEqual(self.client.get(f'/api/cesd/dashboard/?month={month}').json()['mobile_activity']['projects_completed'], 1)
        self.client.force_login(self.technical)
        self.assertContains(self.client.get(self.admin_url(UserProject, 'change', project.id)), 'Private project')
        self.assertEqual(self.client.post(self.admin_url(UserProject, 'change', project.id), {'completed_steps': '[]'}).status_code, 403)
        project.refresh_from_db()
        self.assertEqual(project.completed_steps, [0, 1])

    def test_connection_checks_permissions_and_registered_models_without_exposing_database_path(self):
        result = self.client.get('/api/cesd/integration/')
        self.assertEqual(result.status_code, 200)
        data = result.json()
        self.assertTrue(data['database']['connected'])
        self.assertEqual(data['django_admin_url'], '/admin/')
        self.assertIn('predictions.userproject', data['registered_models'])
        self.assertEqual(len(data['registered_models']), 7)
        self.assertNotIn('db.sqlite3', json.dumps(data))
        self.assertEqual(Client().get('/api/cesd/integration/').status_code, 401)
        resident = Client()
        resident.force_login(self.resident)
        self.assertEqual(resident.get('/api/cesd/integration/').status_code, 403)
        self.assertEqual(resident.get('/admin/').status_code, 302)
        self.client.logout()
        self.assertEqual(self.client.get('/api/cesd/me/').status_code, 401)
        self.assertEqual(self.client.get('/admin/').status_code, 302)
