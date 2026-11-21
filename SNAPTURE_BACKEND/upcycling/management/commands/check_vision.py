"""Readiness diagnostics for the configured local or cloud assessor."""
import json
from pathlib import Path
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from PIL import Image
from upcycling.cloud_vision import VisionUnavailable
from upcycling import cloud_vision, local_vision
from upcycling.models import ProjectRequirement


class Command(BaseCommand):
    help = 'Report configured vision readiness without exposing credentials. --image runs one explicit inference probe.'

    def add_arguments(self, parser):
        parser.add_argument('--image', help='Test photo sent to the configured assessor. Cloud inference requires opt-in and incurs charges.')
        parser.add_argument('--local-config', action='store_true', help='Read only vision settings from backend .env for this diagnostic process.')

    def handle(self, *args, **options):
        if options['local_config']:
            path = Path(settings.BASE_DIR) / '.env'
            names = {'OPENAI_API_KEY', 'SNAPTURE_VISION_MODEL', 'SNAPTURE_LOCAL_VISION_MODEL', 'SNAPTURE_VISUAL_ASSESSOR', 'SNAPTURE_CLOUD_PHOTOS_ENABLED', 'SNAPTURE_VISUAL_ASSESSOR_VALIDATION'}
            if not path.is_file(): raise CommandError('Backend .env is missing.')
            for line in path.read_text(encoding='utf-8-sig').splitlines():
                key, sep, value = line.partition('=')
                key = key.strip()
                if sep and key in names:
                    value = value.strip()
                    if key == 'SNAPTURE_CLOUD_PHOTOS_ENABLED': value = value.lower() == 'true'
                    elif key == 'SNAPTURE_VISUAL_ASSESSOR_VALIDATION':
                        try: value = json.loads(value)
                        except ValueError: raise CommandError('Invalid validation metadata JSON.') from None
                    setattr(settings, key, value)
        adapter = settings.SNAPTURE_VISUAL_ASSESSOR
        provider = {'upcycling.local_vision.assess': local_vision, 'upcycling.cloud_vision.assess': cloud_vision}.get(adapter)
        state = provider.configuration_status() if provider else {'provider': 'unconfigured'}
        state['adapter'] = settings.SNAPTURE_VISUAL_ASSESSOR
        state['approval_record_present'] = bool(settings.SNAPTURE_VISUAL_ASSESSOR_VALIDATION)
        state['published_project_requirements'] = ProjectRequirement.objects.filter(published=True).count()
        self.stdout.write(json.dumps(state, indent=2))
        if not options.get('image'):
            return
        if provider is None:
            raise CommandError('No supported assessor is configured. No image was sent.')
        try:
            with Image.open(Path(options['image'])) as image:
                result = provider.assess(image, purpose='condition')
        except (VisionUnavailable, OSError) as error:
            raise CommandError(str(error)) from None
        self.stdout.write(json.dumps(result, indent=2))
        self.stdout.write('Inference probe only. This does not approve a model or alter a scan.')
