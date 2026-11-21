"""Versioned research visuals for the built-in educational catalog only."""
import json
from copy import deepcopy
from pathlib import Path

from django.http import FileResponse, Http404
from django.views.decorators.http import require_http_methods


CONTENT_ROOT = Path(__file__).resolve().parent / 'data' / 'upcycling'
VERSION = '2026-11-18-v1'
with (CONTENT_ROOT / VERSION / 'photos.json').open(encoding='utf-8') as source:
    PHOTOS = json.load(source)

# Keep older manifests/assets here when adding another content version: saved
# projects keep these URLs rather than looking up the latest catalog.
ASSETS = {
    photo['url'].removeprefix('/api/tutorial-assets/'): photo['sha256']
    for manifest in CONTENT_ROOT.glob('*/photos.json')
    for photos in json.loads(manifest.read_text(encoding='utf-8')).values()
    for photo in [photos['finished'], *photos['steps']]
    if photo.get('url')
}


def catalog_photos(project_id):
    return deepcopy(PHOTOS[project_id])


@require_http_methods(['GET', 'HEAD'])
def tutorial_asset(request, filename):
    # These deliberately public research references are an exact allowlist,
    # independent of MEDIA_ROOT and all private/publication-controlled media.
    if filename not in ASSETS:
        raise Http404('Tutorial photo unavailable.')
    root = CONTENT_ROOT.resolve()
    target = (root / filename).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise Http404('Tutorial photo unavailable.')
    response = FileResponse(target.open('rb'), content_type='image/jpeg')
    response['X-Content-Type-Options'] = 'nosniff'
    response['Cache-Control'] = 'public, max-age=31536000, immutable'
    return response
