from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo
from django.contrib.auth.models import User
from django.db import DatabaseError
from django.test import TestCase
from django.utils import timezone
from accounts.models import Profile
from .models import Announcement, Material, Policy, Schedule, StaffAccess


class DashboardTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user('dashboard-staff')
        Profile.objects.create(user=self.staff, display_name='Dashboard Staff', role='admin')
        StaffAccess.objects.create(user=self.staff)
        self.client.force_login(self.staff)

    def content(self, model=Policy, status='Draft'):
        fields = dict(title='Saved content', category='Guidelines', description='Description', status=status, updated_by=self.staff)
        if model == Policy:
            fields.update(effective_date='2026-10-01', content='Policy text')
        elif model == Material:
            fields.update(material_type='PDF Guide', attachment='test.pdf')
        return model.objects.create(**fields)

    def dashboard(self, month):
        response = self.client.get('/api/cesd/dashboard/', {'month': month})
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_month_lengths_and_exact_local_boundaries(self):
        zone = ZoneInfo('Asia/Manila')
        for month, days in [('2024-02', 29), ('2025-02', 28), ('2026-04', 30), ('2026-10', 31), ('2026-12', 31)]:
            with self.subTest(month=month):
                Policy.objects.all().delete()
                Material.objects.all().delete()
                Announcement.objects.all().delete()
                Schedule.objects.all().delete()
                start = datetime.fromisoformat(month + '-01').replace(tzinfo=zone)
                end = start + timedelta(days=days)
                for stamp in [start - timedelta(microseconds=1), start, end - timedelta(microseconds=1), end]:
                    for model in [Policy, Material, Announcement]:
                        published = self.content(model, 'Published')
                        model.objects.filter(pk=published.pk).update(published_at=stamp, updated_at=stamp)
                        draft = self.content(model)
                        model.objects.filter(pk=draft.pk).update(updated_at=stamp)
                    Schedule.objects.create(updated_by=self.staff, waste_type='Recyclable', barangay='Molino 1', collection_date=stamp.date(), start_time='08:00', end_time='12:00')
                data = self.dashboard(month)
                self.assertEqual(data['counts'], {'policies': 2, 'materials': 2, 'announcements': 2, 'drafts': 6, 'schedules': 2})
                self.assertEqual(data['end'], month + '-' + str(days))
                self.assertEqual(data['timezone'], 'Asia/Manila')
                self.assertEqual(len(data['drafts']), 3)
                self.assertEqual(len(data['policies']), 3)
                self.assertTrue(all(row['updated_by'] == 'Dashboard Staff' for row in data['drafts']))
                self.assertEqual(data['drafts'], sorted(data['drafts'], key=lambda r: (r['updated_at'], r['id'], r['type']), reverse=True))
                self.assertTrue(all(row['status'] == 'Scheduled' for row in data['schedules']))

    def test_publication_transitions_and_unknown_history(self):
        for model in [Policy, Material]:
            row = self.content(model)
            self.assertIsNone(row.published_at)
            stamp = datetime(2026, 10, 1, tzinfo=ZoneInfo('Asia/Manila'))
            with patch('cesd.models.timezone.now', return_value=stamp):
                row.status = 'Published'
                row.save()
            self.assertEqual(row.published_at, stamp)
            row.title = 'Edited after publication'
            row.save()
            self.assertEqual(row.published_at, stamp)
            self.assertEqual(self.dashboard('2026-10')['counts']['policies' if model == Policy else 'materials'], 1)
            model.objects.filter(pk=row.pk).update(published_at=None)
            row.refresh_from_db()
            row.save()
            self.assertIsNone(row.published_at)
            row.status = 'Draft'
            row.save()
            row.status = 'Published'
            row.save()
            self.assertIsNotNone(row.published_at)
            model.objects.filter(pk=row.pk).update(published_at=None)
        data = self.dashboard('2026-10')
        self.assertEqual(data['unknown_publication_dates'], 2)
        self.assertEqual(data['counts']['policies'], 0)
        self.assertEqual(data['counts']['materials'], 0)

    def test_defaults_empty_validation_and_permissions(self):
        response = self.client.get('/api/cesd/dashboard/')
        self.assertEqual(response.json()['month'], timezone.localdate().strftime('%Y-%m'))
        self.assertEqual(response.json()['counts'], dict(policies=0, materials=0, announcements=0, schedules=0, drafts=0))
        for month in ['2026-13', '2026-2', 'invalid', '0000-01', '9999-12']:
            self.assertEqual(self.client.get('/api/cesd/dashboard/', {'month': month}).status_code, 400)
        self.client.logout()
        self.assertEqual(self.client.get('/api/cesd/dashboard/').status_code, 401)
        resident = User.objects.create_user('dashboard-resident')
        self.client.force_login(resident)
        self.assertEqual(self.client.get('/api/cesd/dashboard/').status_code, 403)

    def test_database_failure_is_not_zero(self):
        client = self.client_class(raise_request_exception=False)
        client.force_login(self.staff)
        with patch('cesd.views.Policy.objects.select_related', side_effect=DatabaseError('Unavailable')):
            self.assertEqual(client.get('/api/cesd/dashboard/?month=2026-10').status_code, 500)
