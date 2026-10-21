"""Local face redaction only. Originals are never written by this module."""
import base64
import hashlib
import math
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse, JsonResponse
from django.utils._os import safe_join
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from core.auth import require_api_user
from .image_quality import oriented_image

VERSION = 'face-v1'
MODEL_SHA256 = '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'


class PrivacyError(Exception):
    pass


def detect_faces(image):
    """Use a fresh CPU detector per request (no shared mutable input size)."""
    try:
        import cv2
        model = Path(settings.SNAPTURE_ML_DIR) / 'models/privacy/face_detection_yunet_2023mar.onnx'
        if hashlib.sha256(model.read_bytes()).hexdigest() != MODEL_SHA256:
            raise PrivacyError('The face privacy model is missing or invalid.')
        # Item crops can be smaller than full camera uploads. Upscale those
        # for the face detector, while bounding inference memory for large photos.
        scale = min(1280 / max(image.size), max(1., 64 / min(image.size)))
        size = tuple(max(1, round(value * scale)) for value in image.size)
        pixels = cv2.cvtColor(np.asarray(image.resize(size)), cv2.COLOR_RGB2BGR)
        detector = cv2.FaceDetectorYN.create(str(model), '', size, .6, .3, 5000)
        _, faces = detector.detect(pixels)
        return [] if faces is None else [[float(value) / scale for value in row[:4]] for row in faces]
    except Exception as error:
        raise PrivacyError('Face privacy processing is unavailable.') from error


def redact_image(image):
    image = image.convert('RGB')
    boxes = detect_faces(image)
    if not isinstance(boxes, list):
        raise PrivacyError('The face detector returned invalid regions.')
    protected = image.copy()
    for row in boxes:
        if not isinstance(row, (list, tuple, np.ndarray)) or len(row) != 4 or not all(isinstance(value, (int, float)) and math.isfinite(value) for value in row):
            raise PrivacyError('The face detector returned invalid coordinates.')
        x, y, width, height = row
        if width <= 0 or height <= 0:
            raise PrivacyError('The face detector returned an invalid face size.')
        # Include forehead, cheeks and chin, not just facial landmarks.
        left, top = max(0, math.floor(x - .2 * width)), max(0, math.floor(y - .3 * height))
        right, bottom = min(image.width, math.ceil(x + 1.2 * width)), min(image.height, math.ceil(y + 1.2 * height))
        if right <= left or bottom <= top:
            raise PrivacyError('The face region lies outside the image.')
        region = protected.crop((left, top, right, bottom))
        region = region.resize((8, 8), Image.Resampling.BOX).resize(region.size, Image.Resampling.NEAREST)
        region = region.filter(ImageFilter.GaussianBlur(max(12, min(region.size) * .15)))
        protected.paste(region, (left, top))
    return protected, len(boxes)


def privacy_copy(image):
    """Failure hides the photo, but must not prevent waste inference/results."""
    try:
        protected, count = redact_image(image)
        return protected, {'status': 'processed', 'faces_blurred': count, 'version': VERSION}
    except Exception:
        return None, {'status': 'unavailable', 'message': 'The photo cannot yet be displayed safely. Item results remain available.', 'version': VERSION}


def jpeg_bytes(image):
    output = BytesIO()
    image.save(output, format='JPEG', quality=90)  # No original EXIF/GPS metadata.
    return output.getvalue()


@csrf_exempt
@require_api_user
@require_http_methods(['POST'])
def preview(request):
    uploaded = request.FILES.get('image')
    if not uploaded or not (uploaded.content_type or '').startswith('image/') or uploaded.size > 12 * 1024 * 1024:
        return JsonResponse({'detail': 'Choose an image smaller than 12 MB.'}, status=400)
    try:
        image = oriented_image(uploaded.read())
        protected, count = redact_image(image)
        protected.thumbnail((1024, 1024))
        # Preview stays in memory. No raw or preview file is persisted here.
        uri = 'data:image/jpeg;base64,' + base64.b64encode(jpeg_bytes(protected)).decode('ascii')
        response = JsonResponse({'preview_uri': uri, 'faces_blurred': count, 'version': VERSION})
        response['Cache-Control'] = 'no-store'
        return response
    except PrivacyError:
        return JsonResponse({'detail': 'The photo cannot yet be displayed safely. Retry the privacy check or analyze without a photo preview.'}, status=503)
    except (ValueError, OSError, Image.DecompressionBombError):
        return JsonResponse({'detail': 'Choose a readable photo.'}, status=400)
    except Exception:
        return JsonResponse({'detail': 'The photo cannot yet be displayed safely. Retry the privacy check or analyze without a photo preview.'}, status=503)


@require_http_methods(['GET', 'HEAD'])
def protected_media(request, path):
    """Protect legacy scan URLs as well; never fall through to raw static files.

    Production hosting must route these paths here, not alias MEDIA_ROOT.
    Existing random scan URLs are retained; this is not a new auth mechanism.
    """
    try:
        source = Path(safe_join(str(settings.MEDIA_ROOT), path))
        data = source.read_bytes()
        key = 'scan-privacy:' + VERSION + ':' + hashlib.sha256(data).hexdigest()
        encoded = cache.get(key)
        if encoded is None:
            # Do not apply the camera-upload minimum size to saved item crops.
            with Image.open(BytesIO(data)) as original:
                if original.width * original.height > 25_000_000:
                    raise PrivacyError('Image is too large for safe display.')
                original.load()
                image = ImageOps.exif_transpose(original).convert('RGB')
            protected, _ = redact_image(image)
            encoded = jpeg_bytes(protected)
            if len(encoded) <= 2 * 1024 * 1024:
                cache.set(key, encoded, 60)
        response = HttpResponse(b'' if request.method == 'HEAD' else encoded, content_type='image/jpeg')
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-SNAPTURE-Photo-Privacy'] = VERSION
        return response
    except FileNotFoundError:
        return HttpResponse('Photo unavailable.', status=404)
    except Exception:
        # A detector/file failure must never expose the original as a fallback.
        return HttpResponse('Photo cannot yet be displayed safely.', status=503)
