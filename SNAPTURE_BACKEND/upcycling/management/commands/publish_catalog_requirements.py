"""Publish the versioned specifications for the built-in scan catalog."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.recommendations import CATALOG
from upcycling.catalog_requirements import GUIDE_UPDATES, REQUIREMENTS, project_specification
from upcycling.models import ProjectRequirement


class Command(BaseCommand):
    help = 'Publish the bundled scan project requirements. Preserve customized records.'

    @transaction.atomic
    def handle(self, *args, **options):
        if set(REQUIREMENTS) != {idea['id'] for ideas in CATALOG.values() for idea in ideas}:
            raise CommandError('The requirements must cover the entire built-in catalog.')

        published = 0
        preserved = []
        for material, ideas in CATALOG.items():
            for idea in ideas:
                key = idea['id']
                spec, source = project_specification(key)
                steps = GUIDE_UPDATES.get(key, {}).get('steps', idea['steps'])
                if len(spec['checkpoint_criteria']) != len(steps):
                    raise CommandError(f'{key} needs one checkpoint per project step.')

                row = ProjectRequirement.objects.select_for_update().filter(recommendation_id=key).first()
                if row:
                    draft_source = f"SNAPTURE built-in catalog: {idea['title']}. Physical requirements and safety checks still require source review."
                    draft = {'additional_materials': idea['materials'], 'checkpoint_criteria': idea['steps']}
                    draft_with_final = {**draft, 'final_criteria': [
                        f'Visible outcome of catalog instruction: {step}' for step in idea['steps']
                    ]}
                    if (row.published or row.material != material or row.source != draft_source
                            or row.specification not in (draft, draft_with_final)):
                        preserved.append(key)
                        continue
                    row.specification = spec
                    row.source = source
                    row.published = True
                else:
                    row = ProjectRequirement(recommendation_id=key, material=material, specification=spec,
                                             source=source, published=True)
                row.full_clean()
                row.save()
                published += 1

        self.stdout.write(self.style.SUCCESS(f'Published {published} built-in project requirements.'))
        if preserved:
            self.stdout.write(f'Preserved {len(preserved)} existing records: {", ".join(preserved)}.')
