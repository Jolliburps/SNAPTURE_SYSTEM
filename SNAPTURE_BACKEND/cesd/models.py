import uuid
from pathlib import Path
from django.conf import settings
from django.db import models
from django.utils import timezone


def upload_path(instance, filename):
    return f'cesd/{uuid.uuid4().hex}{Path(filename).suffix.lower()}'


class StaffAccess(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='cesd_access')
    access = models.CharField(max_length=10, choices=[('owner', 'Account Owner'), ('staff', 'Staff')], default='staff')
    department = models.CharField(max_length=120, default='CESD Bacoor')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['access'], condition=models.Q(access='owner'), name='one_cesd_owner')]


class TrackedRecord(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        abstract = True


class PublishedRecord(TrackedRecord):
    # Unknown historical publication dates deliberately remain NULL.
    published_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        previous_status = type(self).objects.filter(pk=self.pk).values_list('status', flat=True).first() if self.pk else None
        if self.status == 'Published' and previous_status != 'Published':
            self.published_at = timezone.now()
            if kwargs.get('update_fields') is not None:
                kwargs['update_fields'] = {*kwargs['update_fields'], 'published_at'}
        super().save(*args, **kwargs)


class Policy(PublishedRecord):
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=120)
    effective_date = models.DateField()
    description = models.TextField()
    content = models.TextField()
    status = models.CharField(max_length=20, choices=[('Draft', 'Draft'), ('Published', 'Published')], default='Draft')
    attachment = models.FileField(upload_to=upload_path, blank=True)


class Material(PublishedRecord):
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=120)
    description = models.TextField()
    material_type = models.CharField(max_length=20, choices=[('PDF Guide', 'PDF Guide'), ('Infographic', 'Infographic'), ('Video', 'Video')])
    status = models.CharField(max_length=20, choices=[('Draft', 'Draft'), ('Published', 'Published')], default='Draft')
    attachment = models.FileField(upload_to=upload_path)


class Schedule(TrackedRecord):
    waste_type = models.CharField(max_length=20, choices=[(x, x) for x in ['Recyclable', 'Biodegradable', 'Residual']])
    barangay = models.CharField(max_length=120)
    collection_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=[(x, x) for x in ['Scheduled', 'Completed', 'Cancelled']], default='Scheduled')


class Announcement(PublishedRecord):
    title = models.CharField(max_length=160)
    category = models.CharField(max_length=120, default='Announcement')
    description = models.TextField()
    status = models.CharField(max_length=20, choices=[('Draft', 'Draft'), ('Published', 'Published')], default='Draft')


class LegacyImport(models.Model):
    """Idempotence ledger for importing the former isolated CESD database."""
    source = models.CharField(max_length=64)
    model = models.CharField(max_length=100)
    source_id = models.PositiveBigIntegerField()
    target_id = models.PositiveBigIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['source', 'model', 'source_id'], name='unique_cesd_import')]


class Activity(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=80)
    record_type = models.CharField(max_length=40)
    record_id = models.CharField(max_length=40)
    record_label = models.CharField(max_length=180)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp', '-pk']
