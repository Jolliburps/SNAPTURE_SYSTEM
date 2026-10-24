import csv
import io
import json
import secrets
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from django.conf import settings
from django.contrib.auth.models import User
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.utils import timezone
from PIL import Image
from accounts.models import Profile
from core.auth import issue_token
from .forms import BARANGAYS
from .models import Activity, Material, Policy, Schedule, StaffAccess


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend', MEDIA_ROOT=settings.LOCAL / 'test-media')
class CesdTests(TestCase):
    def setUp(self):
        self.password = secrets.token_urlsafe(24)
        self.owner = self.account('owner', 'owner')
        self.staff = self.account('staff', 'staff')
        self.resident = User.objects.create_user('resident@example.test', email='resident@example.test', password=self.password)
        Profile.objects.create(user=self.resident, display_name='Resident', barangay='Molino 1')
        self.client.force_login(self.owner)

    def account(self, name, access):
        user = User.objects.create_user(f'{name}@example.test', email=f'{name}@example.test', password=self.password, is_staff=True)
        Profile.objects.create(user=user, display_name=name.title(), role='admin')
        StaffAccess.objects.create(user=user, access=access)
        return user

    def test_interactive_owner_bootstrap(self):
        from unittest.mock import patch
        from django.core.management import call_command, CommandError
        with self.assertRaises(CommandError):
            call_command('create_cesd_owner', stdout=io.StringIO())
        StaffAccess.objects.filter(access='owner').delete()
        with patch('builtins.input', side_effect=['bootstrap@example.test', 'CESD Owner']), patch('cesd.management.commands.create_cesd_owner.getpass', return_value=secrets.token_urlsafe(24)):
            call_command('create_cesd_owner', stdout=io.StringIO())
        owner = User.objects.get(email='bootstrap@example.test')
        self.assertEqual(owner.cesd_access.access, 'owner')
        self.assertTrue(owner.has_usable_password())
        self.assertFalse(owner.is_superuser)

    def post(self, path, data, client=None, method='post'):
        return getattr(client or self.client, method)(f'/api/cesd/{path}', json.dumps(data), content_type='application/json')

    def policy(self, **changes):
        return Policy.objects.create(updated_by=self.owner, title='Segregation', category='Guidelines', effective_date='2026-10-01', description='Short description', content='Sort waste.', **changes)

    def test_authentication_and_csrf(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.get('/api/cesd/me/').status_code, 401)
        self.assertEqual(self.post('login/', {'email': self.owner.email, 'password': self.password}, client).status_code, 403)
        csrf = client.get('/api/cesd/csrf/').json()['csrf']
        response = client.post('/api/cesd/login/', json.dumps({'email': self.owner.email, 'password': self.password}), content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(client.cookies[settings.SESSION_COOKIE_NAME]['httponly'])
        self.assertEqual(client.get('/api/cesd/me/').json()['user']['access'], 'owner')
        self.assertEqual(self.post('login/', {'email': self.resident.email, 'password': self.password}).status_code, 401)

    def test_staff_cannot_manage_accounts_or_audit(self):
        self.client.force_login(self.staff)
        for path in ['staff/', 'activity/']:
            self.assertEqual(self.client.get(f'/api/cesd/{path}').status_code, 403)
        self.assertEqual(self.post('staff/', {'name': 'Injected', 'access': 'owner'}).status_code, 403)
        self.assertEqual(self.post(f'staff/{self.owner.pk}/', {}, method='patch').status_code, 403)
        self.assertEqual(self.client.get('/api/cesd/policies/').status_code, 200)
        token = issue_token(self.staff)
        self.assertEqual(self.client.get('/api/auth/admin/overview/', HTTP_AUTHORIZATION=f'Bearer {token}').status_code, 403)

    def test_legacy_credentials_and_registration_cannot_bypass_staff_flow(self):
        original_username = self.staff.username
        self.staff.email = 'new-address@example.test'
        self.staff.save(update_fields=['email'])
        for email in [original_username, self.staff.email]:
            response = self.client.post('/api/auth/login/', json.dumps({'email': email, 'password': self.password}), content_type='application/json')
            self.assertEqual(response.status_code, 403)
        response = self.client.post('/api/auth/register/', json.dumps({'email': self.staff.email, 'password': self.password}), content_type='application/json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(User.objects.filter(email=self.staff.email).count(), 1)

    def test_activating_pending_staff_prepares_setup_mail(self):
        data = {'name': 'Pending Staff', 'email': 'pending@example.test', 'department': 'CESD Bacoor', 'status': 'Deactivated'}
        response = self.post('staff/', data)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)
        data['status'] = 'Active'
        self.assertEqual(self.post(f'staff/{response.json()["user"]["id"]}/', data, method='patch').status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

    def test_staff_setup_and_single_use_password_link(self):
        data = {'name': 'New Staff', 'email': 'new@example.test', 'department': 'CESD Bacoor', 'status': 'Active'}
        response = self.post('staff/', data)
        self.assertEqual(response.status_code, 201, response.content)
        created = User.objects.get(email=data['email'])
        self.assertFalse(created.has_usable_password())
        link = next(line for line in mail.outbox[0].body.splitlines() if line.startswith('http'))
        query = {k: v[0] for k, v in parse_qs(urlparse(link).query).items()}
        query['password'] = secrets.token_urlsafe(24)
        self.client.logout()
        self.assertEqual(self.post('password/confirm/', query).status_code, 200)
        self.assertEqual(self.post('password/confirm/', query).status_code, 400)
        self.assertEqual(self.post('login/', {'email': data['email'], 'password': query['password']}).status_code, 200)

    def test_deactivation_revokes_sessions_and_bearer_tokens(self):
        staff_client = Client()
        staff_client.force_login(self.staff)
        token = issue_token(self.staff)
        data = {'name': 'Staff', 'email': self.staff.email, 'department': 'CESD Bacoor', 'status': 'Deactivated'}
        self.assertEqual(self.post(f'staff/{self.staff.pk}/', data, method='patch').status_code, 200)
        self.assertEqual(staff_client.get('/api/cesd/policies/').status_code, 401)
        self.assertEqual(staff_client.get('/api/collection/?month=2026-10', HTTP_AUTHORIZATION=f'Bearer {token}').status_code, 401)
        data['status'] = 'Active'
        self.assertEqual(self.post(f'staff/{self.staff.pk}/', data, method='patch').status_code, 200)
        self.assertEqual(staff_client.get('/api/cesd/me/').status_code, 401)

    def test_residents_unchanged_and_owner_protected(self):
        data = {'name': 'Hijack', 'email': self.resident.email, 'department': 'CESD', 'status': 'Active'}
        self.assertEqual(self.post('staff/', data).status_code, 400)
        self.assertFalse(StaffAccess.objects.filter(user=self.resident).exists())
        self.assertEqual(self.post(f'staff/{self.owner.pk}/', data, method='patch').status_code, 404)
        self.assertEqual(self.client.post('/api/auth/password-reset/request/', json.dumps({'email': self.owner.email}), content_type='application/json').json().get('reset_token'), None)

    def test_profile_update_and_email_password_check(self):
        self.client.force_login(self.staff)
        data = {'name': 'Updated Name', 'email': 'changed@example.test'}
        self.assertEqual(self.post('me/', data, method='patch').status_code, 400)
        data['current_password'] = self.password
        response = self.post('me/', data, method='patch')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['name'], 'Updated Name')
        self.assertTrue(Activity.objects.filter(actor=self.staff, action='Updated own profile').exists())

    def test_policies_persist_filter_paginate_and_publish(self):
        data = {'title': 'Policy One', 'category': 'Guidelines', 'effective_date': '2026-10-01', 'description': 'Description', 'content': 'Policy text', 'status': 'Draft'}
        response = self.client.post('/api/cesd/policies/', data)
        self.assertEqual(response.status_code, 201, response.content)
        pk = response.json()['record']['id']
        visitor = Client()
        self.assertNotIn(f'cesd-policy-{pk}', [r['key'] for r in visitor.get('/api/learning/').json()['entries']])
        data['status'] = 'Published'
        self.assertEqual(self.client.post(f'/api/cesd/policies/{pk}/', data).status_code, 200)
        self.assertIn(f'cesd-policy-{pk}', [r['key'] for r in visitor.get('/api/learning/').json()['entries']])
        self.assertEqual(self.client.get('/api/cesd/policies/?search=one&category=Guidelines&status=Published').json()['count'], 1)
        self.assertEqual(self.client.get(f'/api/cesd/policies/{pk}/').json()['record']['updated_by'], 'Owner')
        for i in range(11):
            Policy.objects.create(updated_by=self.owner, **{**data, 'title': f'Extra {i}'})
        self.assertEqual(len(self.client.get('/api/cesd/policies/?page=2').json()['results']), 2)

    def test_upload_validation_private_files_and_replacement(self):
        data = {'title': 'Learning', 'category': 'Recycling', 'description': 'Steps', 'material_type': 'PDF Guide', 'status': 'Draft'}
        bad = self.client.post('/api/cesd/materials/', {**data, 'attachment': SimpleUploadedFile('bad.pdf', b'not pdf')})
        self.assertEqual(bad.status_code, 400)
        response = self.client.post('/api/cesd/materials/', {**data, 'attachment': SimpleUploadedFile('guide.pdf', b'%PDF-1.4\n%%EOF')})
        self.assertEqual(response.status_code, 201, response.content)
        row = Material.objects.get()
        file_url = response.json()['record']['file_url']
        visitor = Client()
        self.assertEqual(visitor.get(file_url).status_code, 404)
        self.assertEqual(visitor.get('/protected-media/' + row.attachment.name).status_code, 404)
        response = self.client.get(file_url)
        self.assertEqual(response.status_code, 200)
        response.close()
        partial = self.client.get(file_url, HTTP_RANGE='bytes=0-4')
        self.assertEqual(partial.status_code, 206)
        self.assertEqual(b''.join(partial.streaming_content), b'%PDF-')
        partial.close()
        self.assertEqual(self.client.get(file_url, HTTP_RANGE='bytes=999-').status_code, 416)
        self.assertEqual(visitor.get('/protected-media/profile_pictures/../cesd/' + row.attachment.name.split('/')[-1]).status_code, 404)
        data['status'] = 'Published'
        self.assertEqual(self.client.post(f'/api/cesd/materials/{row.pk}/', data).status_code, 200)
        response = visitor.get(file_url)
        self.assertEqual(response.status_code, 200)
        response.close()
        image = io.BytesIO()
        Image.new('RGB', (8, 8)).save(image, format='PNG')
        data['material_type'] = 'Infographic'
        self.assertEqual(self.client.post(f'/api/cesd/materials/{row.pk}/', data).status_code, 400)
        response = self.client.post(f'/api/cesd/materials/{row.pk}/', {**data, 'attachment': SimpleUploadedFile('image.png', image.getvalue(), content_type='image/png')})
        self.assertEqual(response.status_code, 200, response.content)
        row.refresh_from_db()
        self.assertTrue(row.attachment.name.endswith('.png'))
        # Remove only test-created files, all contained by the admin test directory.
        for file in Path(settings.MEDIA_ROOT).glob('cesd/*'):
            file.unlink()

    def test_upload_limits_video_formats_and_legacy_media(self):
        from .forms import validate_upload
        from django.core.exceptions import ValidationError
        file = SimpleUploadedFile('large.pdf', b'%PDF-1.4')
        file.size = 21 * 1024 * 1024
        with self.assertRaises(ValidationError):
            validate_upload(file, 'PDF Guide')
        with self.assertRaises(ValidationError):
            validate_upload(SimpleUploadedFile('script.svg', b'<svg/>'), 'Infographic')
        with self.assertRaises(ValidationError):
            validate_upload(SimpleUploadedFile('fake.mp4', b'not a video'), 'Video')
        validate_upload(SimpleUploadedFile('container.mp4', b'\x00\x00\x00\x18ftypmp42' + b'\x00' * 20), 'Video')
        root = Path(settings.MEDIA_ROOT)
        photo = root / 'profile_pictures' / 'fixture.png'
        photo.parent.mkdir(parents=True, exist_ok=True)
        Image.new('RGB', (8, 8)).save(photo)
        response = self.client.get('/protected-media/profile_pictures/fixture.png')
        self.assertEqual(response.status_code, 200)
        response.close()
        photo.unlink()

    def test_schedule_contract_validation_and_weekday(self):
        data = {'waste_type': 'Recyclable', 'barangay': 'Molino 1', 'collection_date': '2026-10-02', 'start_time': '08:00', 'end_time': '12:00', 'notes': 'At curb', 'status': 'Scheduled'}
        response = self.client.post('/api/cesd/schedules/', data)
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['record']['day'], 'Friday')
        self.assertEqual(self.client.post('/api/cesd/schedules/', {**data, 'barangay': 'Molino'}).status_code, 400)
        self.assertEqual(self.client.post('/api/cesd/schedules/', {**data, 'end_time': '07:00'}).status_code, 400)
        self.assertEqual(self.client.get('/api/cesd/schedules/?month=2026-11').json()['count'], 0)
        token = issue_token(self.resident)
        entries = self.client.get('/api/collection/?month=2026-10', HTTP_AUTHORIZATION=f'Bearer {token}').json()['entries']
        self.assertEqual(entries[0]['date'], '2026-10-02')
        Schedule.objects.update(status='Cancelled')
        self.assertEqual(self.client.get('/api/collection/?month=2026-10', HTTP_AUTHORIZATION=f'Bearer {token}').json()['entries'][0]['status'], 'Cancelled')
        self.assertEqual(len(BARANGAYS), 47)

    def test_report_counts_range_status_and_safe_csv(self):
        self.policy(status='Published')
        self.policy(status='Draft')
        Policy.objects.filter(pk=Policy.objects.first().pk).update(title='=HYPERLINK("example")')
        day = timezone.localdate().isoformat()
        url = f'/api/cesd/reports/?start={day}&end={day}&type=policies'
        result = self.client.get(url).json()
        self.assertEqual(result['count'], 2)
        self.assertEqual(result['counts']['policies_statuses'], {'Draft': 1, 'Published': 1})
        rows = list(csv.DictReader(io.StringIO(self.client.get(url + '&format=csv').content.decode('utf-8-sig'))))
        self.assertEqual(len(rows), 2)
        self.assertTrue(rows[0]['title'].startswith("'="))
        self.assertEqual(self.client.get('/api/cesd/reports/?start=2020-01-01&end=2020-01-01').json()['count'], 0)
        self.assertEqual(self.client.get('/api/cesd/reports/?start=2026-10-21&end=2026-10-01').status_code, 400)
