"""Report missing project inputs without inventing or publishing requirements."""
import json
from django.core.management.base import BaseCommand
from core.recommendations import CATALOG
from upcycling.cloud_vision import CONDITION_VALUES
from upcycling.models import ProjectRequirement, validate_requirements


class Command(BaseCommand):
    help = 'Report requirement completeness. Does not modify or publish records.'

    def handle(self, *args, **options):
        records = {r.recommendation_id: r for r in ProjectRequirement.objects.all()}
        report = []
        for material, ideas in CATALOG.items():
            for idea in ideas:
                row = records.get(idea['id'])
                missing = []
                spec = row.specification if row else {}
                if not row: missing.append('draft record')
                if not row or not row.published: missing.append('publication after review')
                if not row or not row.source.strip(): missing.append('source')
                for field in ('minimum_quantity', 'conditions', 'dimensions', 'tools', 'additional_materials', 'safety', 'checkpoint_criteria', 'final_criteria'):
                    if field not in spec: missing.append(field)
                for field in CONDITION_VALUES:
                    if not spec.get('visible_characteristics', {}).get(field): missing.append('visual acceptance: ' + field)
                if len(spec.get('checkpoint_criteria', [])) != len(idea['steps']): missing.append('checkpoint count must match steps')
                for field in ('conditions', 'safety', 'final_criteria'):
                    if not spec.get(field): missing.append('nonempty ' + field)
                try: validate_requirements(spec)
                except Exception: missing.append('valid specification schema')
                report.append({'id': idea['id'], 'material': material, 'missing': list(dict.fromkeys(missing))})
        self.stdout.write(json.dumps(report, indent=2))
