"""Import only the manually inspected reference edition, never arbitrary file instructions."""
import hashlib
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from core.cesd_sources import NOTE, SOURCE_HASHES, information
from core.content import digest
from core.models import Guidance


class Command(BaseCommand):
    help = "Verify the CESD source folder and import source-checked educational extracts (not expert approval)."

    def add_arguments(self, parser):
        parser.add_argument("--source-dir", required=True)

    @transaction.atomic
    def handle(self, *args, **options):
        root = Path(options["source_dir"]).resolve()
        for name, expected in SOURCE_HASHES.items():
            target = root / name
            if not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest() != expected:
                raise CommandError(f"Source missing or changed: {name}. Review the new edition before importing.")
        created = 0
        for values in information():
            if Guidance.objects.filter(key=values["key"]).exists():
                continue  # Never reactivate a withdrawn entry or overwrite a reviewed version.
            now = timezone.now()
            entry = Guidance(**values, kind="information", review_level="source_checked", review_note=NOTE,
                             state="published", reviewed_at=now, published_at=now)
            entry.content_digest = digest(entry)
            entry.full_clean()
            entry.save()
            created += 1
        self.stdout.write(self.style.SUCCESS(f"Verified {len(SOURCE_HASHES)} source files. Added {created} CESD-based educational entries; no classifier or collection dates changed."))
