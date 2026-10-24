"""Synthetic browser-test fixtures; never runs against the normal dev database."""
import json
import os
import secrets
import sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / 'SNAPTURE_BACKEND'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'admin_config.e2e_settings'
import django
django.setup()
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management import call_command
from accounts.models import Profile
from cesd.models import Activity, Announcement, Material, Policy, Schedule, StaffAccess

assert str(settings.DATABASES['default']['NAME']) == str(ROOT / '.local' / 'e2e.sqlite3')
call_command('migrate', verbosity=0)
Activity.objects.all().delete()
Announcement.objects.all().delete()
Material.objects.all().delete()
Policy.objects.all().delete()
Schedule.objects.all().delete()
StaffAccess.objects.all().delete()
User.objects.all().delete()
password = secrets.token_urlsafe(24)
for access, name in [('owner', 'Andrea Reyes'), ('staff', 'Maria Santos')]:
    user = User.objects.create_user(f'{access}@example.test', email=f'{access}@example.test', password=password, is_staff=True)
    Profile.objects.create(user=user, display_name=name, role='admin')
    StaffAccess.objects.create(user=user, access=access)
(settings.LOCAL / 'e2e-credentials.json').write_text(json.dumps({'owner': 'owner@example.test', 'staff': 'staff@example.test', 'password': password}), encoding='utf-8')
print('Isolated browser-test database ready. Credentials are random and local only.')
