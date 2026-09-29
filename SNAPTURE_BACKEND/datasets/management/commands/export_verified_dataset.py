"""Export administrator-verified dataset images into the ML scope folders."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from core.materials import SCOPE_LABELS

from datasets.models import DatasetImage


class Command(BaseCommand):
    help = (
        "Copy only administrator-verified dataset images to "
        "SNAPTURE_ML/data/scope_dataset."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=Path,
            default=None,
            help="Destination dataset root (defaults to SNAPTURE_ML/data/scope_dataset).",
        )

    def handle(self, *args, **options):
        output = options["output"]
        if output is None:
            output = Path(settings.SNAPTURE_ML_DIR) / "data" / "scope_dataset"
        output = output.resolve()
        output.mkdir(parents=True, exist_ok=True)

        for label in SCOPE_LABELS:
            (output / label).mkdir(parents=True, exist_ok=True)

        records = DatasetImage.objects.filter(review_status="verified").order_by("id")
        manifest: list[dict[str, object]] = []
        hashes: dict[str, str] = {}
        counts = {label: 0 for label in SCOPE_LABELS}
        skipped = 0

        for record in records:
            if record.label not in counts or not record.image:
                skipped += 1
                continue
            source = Path(record.image.path)
            if not source.is_file():
                skipped += 1
                continue
            digest = hashlib.sha256(source.read_bytes()).hexdigest()
            if digest in hashes:
                manifest.append(
                    {
                        "record_id": record.id,
                        "label": record.label,
                        "status": "duplicate_skipped",
                        "duplicate_of": hashes[digest],
                    }
                )
                continue

            suffix = source.suffix.lower() or ".jpg"
            filename = f"admin_{record.id}{suffix}"
            destination = output / record.label / filename
            shutil.copy2(source, destination)
            relative = str(destination.relative_to(output))
            hashes[digest] = relative
            counts[record.label] += 1
            manifest.append(
                {
                    "record_id": record.id,
                    "label": record.label,
                    "filename": relative,
                    "status": "exported",
                    "reviewed_at": record.reviewed_at.isoformat()
                    if record.reviewed_at
                    else None,
                }
            )

        (output / "labels.json").write_text(
            json.dumps(list(SCOPE_LABELS), indent=2) + "\n", encoding="utf-8"
        )
        (output / "verified_manifest.json").write_text(
            json.dumps(
                {
                    "source": "SNAPTURE_BACKEND datasets.DatasetImage",
                    "verified_only": True,
                    "counts": counts,
                    "skipped": skipped,
                    "records": manifest,
                },
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        self.stdout.write(self.style.SUCCESS(f"Exported verified dataset to {output}"))
        self.stdout.write(json.dumps({"counts": counts, "skipped": skipped}, indent=2))
