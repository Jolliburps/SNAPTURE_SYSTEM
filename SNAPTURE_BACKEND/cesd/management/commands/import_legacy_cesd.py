"""Import the former isolated CESD database without replacing resident data."""
import hashlib
import shutil
import sqlite3
from datetime import timezone as datetime_timezone
from contextlib import closing
from pathlib import Path
from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import connections, models, transaction
from django.db.models import Q
from django.utils import timezone
from accounts.models import Profile
from cesd.models import Activity, Announcement, LegacyImport, Material, Policy, Schedule, StaffAccess


class Command(BaseCommand):
    help = 'Preview or import isolated CESD staff/content. --apply backs up both SQLite databases and media first.'

    def add_arguments(self, parser):
        parser.add_argument('--source', type=Path, default=settings.BASE_DIR.parent / 'SNAPTURE_ADMIN/.local/admin.sqlite3')
        parser.add_argument('--source-media', type=Path, default=settings.BASE_DIR.parent / 'SNAPTURE_ADMIN/.local/media')
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **options):
        source = options['source'].resolve()
        target = connections['default'].settings_dict
        if not source.is_file():
            raise CommandError('Source database does not exist.')
        if target['ENGINE'] != 'django.db.backends.sqlite3':
            raise CommandError('This local importer supports SQLite targets only. Import into SQLite before migrating to MySQL.')
        target_path = Path(target['NAME']).resolve()
        if source == target_path:
            raise CommandError('Source and target must be different databases.')
        self.source_key = hashlib.sha256(str(source).casefold().encode()).hexdigest()
        self.source_media = options['source_media'].resolve()
        self.created_files = []
        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as db:
            db.row_factory = sqlite3.Row
            db.execute('BEGIN')
            tables = {r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if 'cesd_staffaccess' not in tables:
                raise CommandError('Source is not a CESD database.')
            # Never silently omit mobile data created in an old isolated service.
            for name in ('predictions_predictionrecord', 'predictions_scanscene', 'predictions_userproject', 'core_guidance', 'core_collectionnotice', 'datasets_datasetimage', 'evaluations_evaluationrun'):
                if name in tables and db.execute(f'SELECT COUNT(*) FROM {name}').fetchone()[0]:
                    raise CommandError(f'Source contains {name} records. A full data migration is required; nothing was imported.')
            users = [dict(r) for r in db.execute('SELECT * FROM auth_user')]
            staff = [dict(r) for r in db.execute('SELECT * FROM cesd_staffaccess')]
            for row in users:
                if self.mapped(User, row['id']):
                    continue
                if User.objects.filter(Q(username__iexact=row['username']) | Q(email__iexact=row['email']) & ~Q(email='')).exists():
                    raise CommandError(f"Source user {row['id']} conflicts with an existing login. Resolve identities before importing; accounts are never automatically promoted or merged.")
            if any(r['access'] == 'owner' and not self.mapped(StaffAccess, r['id']) for r in staff) and StaffAccess.objects.filter(access='owner').exists():
                raise CommandError('A different owner already exists in the shared database.')
            models = (Policy, Material, Schedule, Announcement, Activity)
            rows = {model: [dict(r) for r in db.execute(f'SELECT * FROM {model._meta.db_table}')] if model._meta.db_table in tables else [] for model in models}
            profiles = [dict(r) for r in db.execute('SELECT * FROM accounts_profile')]
            for records, field in [(rows[Policy], 'attachment'), (rows[Material], 'attachment'), (profiles, 'profile_picture')]:
                for row in records:
                    if row.get(field):
                        path = (self.source_media / row[field]).resolve()
                        if not path.is_relative_to(self.source_media) or not path.is_file():
                            raise CommandError('A source attachment is missing or outside the media folder.')
            self.stdout.write('Preview: ' + ', '.join([f'{len(users)} accounts', f'{len(staff)} staff'] + [f'{len(v)} {m._meta.model_name}' for m, v in rows.items()]))
            if not options['apply']:
                self.stdout.write('No changes made. Repeat with --apply after reviewing the preview.')
                return
            backup = settings.BASE_DIR / '.local/backups' / timezone.now().strftime('%Y%m%dT%H%M%S%fZ')
            backup.mkdir(parents=True)
            with closing(sqlite3.connect(backup / 'admin.sqlite3')) as dest:
                db.backup(dest)
            connections['default'].ensure_connection()
            with closing(sqlite3.connect(backup / 'backend.sqlite3')) as dest:
                connections['default'].connection.backup(dest)
            for label, folder in [('admin-media', self.source_media), ('backend-media', Path(settings.MEDIA_ROOT))]:
                if folder.is_dir():
                    shutil.copytree(folder, backup / label)
            self.stdout.write(f'Backups: {backup}')
            try:
                with transaction.atomic():
                    for row in users:
                        self.insert(User, row)
                    for row in profiles:
                        self.insert(Profile, row, {'user_id': self.required(User, row['user_id'])})
                    for row in staff:
                        self.insert(StaffAccess, row, {'user_id': self.required(User, row['user_id'])})
                    for model in (Policy, Material, Schedule, Announcement):
                        for row in rows[model]:
                            self.insert(model, row, {'updated_by_id': self.required(User, row['updated_by_id'])})
                    record_models = {'User': User, 'Policy': Policy, 'Material': Material, 'Schedule': Schedule, 'Announcement': Announcement, 'StaffAccess': StaffAccess}
                    for row in rows[Activity]:
                        changes = {'actor_id': self.required(User, row['actor_id'])}
                        model = record_models.get(row['record_type'])
                        if model and str(row['record_id']).isdigit():
                            changes['record_id'] = str(self.required(model, int(row['record_id'])))
                        self.insert(Activity, row, changes)
            except Exception:
                for path in self.created_files:
                    path.unlink(missing_ok=True)
                raise
            self.stdout.write(self.style.SUCCESS('Imported CESD data into the shared backend. Resident records and source files were preserved. Sign in again to the admin panel.'))

    def mapped(self, model, source_id):
        target_id = LegacyImport.objects.filter(source=self.source_key, model=model._meta.label_lower, source_id=source_id).values_list('target_id', flat=True).first()
        if target_id and not model.objects.filter(pk=target_id).exists():
            raise CommandError('An imported target record was removed; repair the import ledger before retrying.')
        return target_id

    def required(self, model, source_id):
        target_id = self.mapped(model, source_id)
        if not target_id:
            raise CommandError(f'Unmapped source relation: {model._meta.label_lower} {source_id}')
        return target_id

    def insert(self, model, row, changes=None):
        if self.mapped(model, row['id']):
            return
        values = {field.attname: field.to_python(row[field.attname]) for field in model._meta.concrete_fields
            if not field.primary_key and field.attname in row}
        # Django stores SQLite datetimes as naive UTC, regardless of TIME_ZONE.
        for field in model._meta.concrete_fields:
            value = values.get(field.attname)
            if isinstance(field, models.DateTimeField) and value and timezone.is_naive(value):
                values[field.attname] = timezone.make_aware(value, datetime_timezone.utc)
        values.update(changes or {})
        file_field = 'profile_picture' if model == Profile else 'attachment'
        if values.get(file_field):
            source = (self.source_media / str(values[file_field])).resolve()
            folder = 'profile_pictures' if model == Profile else 'cesd'
            relative = Path(folder) / 'imported' / self.source_key / source.relative_to(self.source_media)
            target = Path(settings.MEDIA_ROOT) / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists():
                with target.open('rb') as existing, source.open('rb') as incoming:
                    if hashlib.file_digest(existing, 'sha256').digest() != hashlib.file_digest(incoming, 'sha256').digest():
                        raise CommandError('Imported attachment path conflicts with an existing file.')
            else:
                shutil.copy2(source, target)
                self.created_files.append(target)
            values[file_field] = relative.as_posix()
        obj = model.objects.create(**values)
        # Preserve original publication and audit timestamps despite auto_now/save hooks.
        model.objects.filter(pk=obj.pk).update(**values)
        LegacyImport.objects.create(source=self.source_key, model=model._meta.label_lower, source_id=row['id'], target_id=obj.pk)
