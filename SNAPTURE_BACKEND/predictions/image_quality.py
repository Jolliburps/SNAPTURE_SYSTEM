"""Conservative image-quality signals, not a photo-safety certification."""
import math
import numpy as np
from PIL import Image, ImageOps


def oriented_image(data):
    from io import BytesIO
    with Image.open(BytesIO(data)) as image:
        if min(image.size) < 64 or image.width * image.height > 25_000_000:
            raise ValueError("Use an image at least 64 pixels wide and high and at most 25 megapixels.")
        image.load()
        return ImageOps.exif_transpose(image).convert('RGB')


def frame_bounds(image, frame=None):
    """Map a center-cover camera preview guide to the EXIF-oriented photo."""
    if frame is None:
        return (0, 0, image.width, image.height)
    if not isinstance(frame, dict):
        raise ValueError('Invalid camera frame.')
    try:
        aspect = float(frame['aspect'])
        x, y, w, h = [float(frame[key]) for key in ('x', 'y', 'width', 'height')]
    except (KeyError, TypeError, ValueError):
        raise ValueError('Invalid camera frame.')
    if not all(math.isfinite(v) for v in (aspect, x, y, w, h)) or not .15 <= aspect <= 6 or min(x, y) < 0 or min(w, h) <= 0 or x + w > 1 or y + h > 1:
        raise ValueError('Invalid camera frame.')
    visible_w = min(image.width, image.height * aspect)
    visible_h = min(image.height, image.width / aspect)
    left, top = (image.width - visible_w) / 2, (image.height - visible_h) / 2
    bounds = (round(left + x * visible_w), round(top + y * visible_h), round(left + (x+w) * visible_w), round(top + (y+h) * visible_h))
    if bounds[2]-bounds[0] < 32 or bounds[3]-bounds[1] < 32:
        raise ValueError('Camera frame is too small.')
    return bounds


def quality_report(image, boxes=(), single=False):
    small = image.copy()
    small.thumbnail((640, 640))
    gray = np.asarray(small.convert('L'), dtype=np.float32)
    mean, contrast = float(gray.mean()), float(gray.std())
    lap = -4*gray[1:-1,1:-1]+gray[:-2,1:-1]+gray[2:,1:-1]+gray[1:-1,:-2]+gray[1:-1,2:]
    sharpness = float(lap.var())
    flags = []
    if mean < 48 and float((gray < 60).mean()) > .65:
        flags.append({'code':'dark', 'message':'This photo appears dark. Add light or try flash, then retake it.'})
    elif contrast > 14 and sharpness < 14:
        flags.append({'code':'blur', 'message':'Detail appears soft. Hold the camera steady, tap to focus and retake if the item is unclear.'})
    if single and len(boxes) > 1:
        flags.append({'code':'multiple_items','message':'Several items were detected. Use mixed-items mode or photograph one item separately.'})
    if any(min(box[0],box[1],1-box[2],1-box[3]) < .012 for box in boxes):
        flags.append({'code':'edge_item','message':'A detected item touches the guide edge and may be cut off. Leave a little space around it.'})
    if len(boxes) > 8:
        flags.append({'code':'crowded','message':'Many items are close together. Spread them out to reduce hidden or merged detections.'})
    if boxes:
        outside = np.ones(gray.shape,dtype=bool)
        for x1,y1,x2,y2 in boxes:
            outside[round(y1*gray.shape[0]):round(y2*gray.shape[0]),round(x1*gray.shape[1]):round(x2*gray.shape[1])] = False
        edges = np.abs(np.diff(gray,axis=1)) > 32
        background = outside[:,:-1]
        if background.mean() > .3 and background.any() and edges[background].mean() > .3:
            flags.append({'code':'busy_background','message':'The background has many edges. Try a plainer surface if items were missed or confused.'})
    return {'version':'heuristics-v1','flags':flags,'metrics':{'brightness':round(mean,1),'contrast':round(contrast,1),'laplacian_variance':round(sharpness,1)},
            'limitations':'Heuristic checks can miss blur, clutter, hidden objects or cut-off items. No warning is not a guarantee of image quality.'}
