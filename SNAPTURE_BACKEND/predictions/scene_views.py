import json
import logging
import re
import time
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from PIL import UnidentifiedImageError, Image

from core.auth import require_api_user
from core.assessment import refresh
from core.materials import material_info
from .models import ScanScene, SceneItem, PredictionRecord
from .image_quality import oriented_image, frame_bounds, quality_report
from . import scene_detector
from .photo_privacy import privacy_copy, jpeg_bytes
from .material_classifier import classify_material, classify_detected_material
from core.ml_service import model_status

logger = logging.getLogger(__name__)


def routing(prediction):
    assessment = prediction['assessment']
    if not assessment:
        return {'key':'review','label':'No saved assessment','reason':'No assessment snapshot was saved for this older item. Its original detector result is shown without a bin assignment.'}
    segregation = assessment['segregation']
    if prediction['previous_contents'] == 'Chemical or cleaning product':
        return {'key':'special','label':'Special handling','reason':'Reported chemical contact. Keep separate and ask CESD for instructions.'}
    if segregation['status'] == 'available' and segregation['category'] and segregation['category'].lower() in {'recyclable','potentially recyclable - confirm local acceptance'}:
        return {'key':'recyclable','label':'Potentially recyclable','reason':'Matches published guidance and your answers; confirm local acceptance.'}
    return {'key':'review','label':'Needs review','reason':'Material, condition or a local disposal rule is not confirmed. Not automatically residual waste.'}


def serialize_scene(scene, saved=False):
    from .views import _serialize
    from .disposal_workflow import describe, handling
    items = []
    stored = {item.id:item for item in scene.items.select_related('prediction').order_by('id') if item.prediction}
    # Deduplication happens during detection. Do not re-suppress saved/confirmed objects.
    cleaned = [
        {'source_id':item.id,'name':item.name,'score':item.score,'box':item.box,
         'user_confirmed':item.prediction.answers.get('user_confirmed_material') == item.prediction.decision and item.prediction.decision != 'unknown_unsupported'}
        for item in stored.values()]
    for row in cleaned:
        item = stored[row['source_id']]
        prediction = _serialize(item.prediction, saved=saved)
        group = ('special' if 'battery' in item.name else 'biodegradable' if 'food' in item.name or 'leaf' in item.name else 'non_biodegradable' if 'wrapper' in item.name or 'fabric' in item.name else 'recyclable' if any(word in item.name for word in ('bottle','container','cardboard','paper','can')) else 'review')
        route = routing(prediction)
        verified = bool(prediction['assessment'] and prediction['assessment']['material']['status']=='user_selected')
        background = item.name in scene_detector.BACKGROUND_NAMES and not verified
        identifier = prediction['waste_identifier'] or {'category':'UNIDENTIFIED','needs_confirmation':True}
        identifier['box'] = item.box
        low = identifier['needs_confirmation']
        whole_photo = item.prediction.image_quality.get('object_source') == 'whole_image_classifier'
        draw = not whole_photo
        display_group = 'special' if identifier['category']=='C' else 'review' if identifier['category']=='UNIDENTIFIED' else {'A':'biodegradable','B1':'recyclable','B2':'non_biodegradable'}.get(identifier['category'],'review')
        reason = ('The complete photo was classified. Object locations were not detected; use one item per photo.' if whole_photo else 'Possible background object. Not included in waste sorting unless you identify it as a discarded item.' if background else 'Low detector score. Review this item before sorting.' if low else 'The region is too broad for a clear object box. Review it separately.' if row.get('ambiguous_large') else route['reason'])
        workflow = (item.prediction.image_quality or {}).get('handling_snapshot') if saved else None
        workflow = workflow or handling(item, prediction)
        items.append({'id':item.id,'box':row['box'],'name':item.name,'score':item.score,'prediction':prediction,'route':route,'suggested_group':group,
                      'display_box':draw,'display_group':display_group,'low_confidence':low,'background':background,'review_reason':reason,
                      'waste_identifier':identifier, 'identification':describe(item, prediction), 'handling':workflow})
    flags = [flag for flag in scene.quality.get('flags',[]) if flag['code'] not in {'edge_item','crowded'}]
    frame = scene.frame or [0,0,1,1]
    drawn = [item for item in items if item['display_box']]
    if any(min(abs(item['box'][0]-frame[0]),abs(item['box'][1]-frame[1]),abs(frame[2]-item['box'][2]),abs(frame[3]-item['box'][3])) < .012 for item in drawn):
        flags.append({'code':'edge_item','message':'A detected item touches the edge of the analyzed photo and may be cut off. Leave space around it if it is incomplete.'})
    if len(drawn)>8:
        flags.append({'code':'crowded','message':'Several item regions overlap or crowd this photo. Spread the items out for clearer detection.'})
    return {'id':scene.id,'image_url':scene.image.url if scene.image else '', 'created_at':scene.created_at.isoformat(),'width':scene.width,'height':scene.height,'frame':scene.frame,
            'status':scene.status,'error':scene.error,'quality':{**scene.quality,'flags':flags},'items':items,'truncated':scene.truncated,
            'display_threshold':scene_detector.DISPLAY_THRESHOLD,'suppressed_count':len(stored)-len(items),
            'background_objects':scene.quality.get('background_objects',[]),
            'disposal_selection':scene.quality.get('disposal_selection', {'confirmed':False,'item_ids':[]}),
            'detector':scene.quality.get('identification_mode', 'OWL-ViT base patch32, experimental zero-shot'),
            'limitations':'Boxes are model suggestions. Hidden, small or unfamiliar objects may be missed or mislabeled. Review every item; not all objects are guaranteed to be detected.'}


@require_api_user
@require_http_methods(['GET'])
def capabilities(request):
    model = model_status()
    return JsonResponse({'available':scene_detector.available() or model['loaded'],'experimental':True,'maximum_items':30,
                         'object_queries':[name for name, _ in scene_detector.PROMPTS],
                         'object_detection_available':scene_detector.available(),
                         'material_confidence_available':model['loaded'],'material_model':model,
                         'disposal_selection_required':True})


@csrf_exempt
@require_api_user
@require_http_methods(['POST','GET'])
def scenes(request):
    if request.method == 'GET':
        return JsonResponse({'scenes':[serialize_scene(scene, saved=True) for scene in ScanScene.objects.filter(user=request.api_user)[:20]]})
    request_id = str(request.POST.get('request_id',''))
    if not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}',request_id):
        return JsonResponse({'detail':'A valid request ID is required.'},status=400)
    existing = ScanScene.objects.filter(user=request.api_user,request_id=request_id).first()
    if existing:
        return JsonResponse({'scene':serialize_scene(existing)},status=200)
    uploaded = request.FILES.get('image')
    if uploaded is None or not (uploaded.content_type or '').startswith('image/'):
        return JsonResponse({'detail':'Choose a readable image.'},status=415)
    if uploaded.size > 12*1024*1024:
        return JsonResponse({'detail':'Choose an image smaller than 12 MB.'},status=413)
    try:
        image = oriented_image(uploaded.read())
        frame = frame_bounds(image,json.loads(request.POST.get('frame','null')))
    except (ValueError,OSError,UnidentifiedImageError,Image.DecompressionBombError):
        return JsonResponse({'detail':'The image or guide frame is invalid. Retake or choose another photo.'},status=400)
    detector_available = scene_detector.available()
    if not detector_available and not model_status()['loaded']:
        return JsonResponse({'detail':'The dataset-trained identification model is unavailable. Ask the administrator to restore the model runtime, or choose a material manually.'},status=503)
    if not scene_detector.inference_lock.acquire(blocking=False):
        return JsonResponse({'detail':'Another image is being analyzed. Try again in a moment.'},status=429)
    scene = None
    crop_files = []
    committed = False
    started = time.monotonic()
    try:
        protected, privacy = privacy_copy(image)
        scene = ScanScene(user=request.api_user,request_id=request_id,width=image.width,height=image.height,
                          frame=[frame[0]/image.width,frame[1]/image.height,frame[2]/image.width,frame[3]/image.height])
        if protected is not None:
            scene.image.save(f'{uuid4().hex}.jpg',ContentFile(jpeg_bytes(protected)),save=False)
        scene.save()
        focused = image.crop(frame)
        protected_focused = protected.crop(frame) if protected is not None else None
        if detector_available:
            rows, truncated = scene_detector.detect(focused)
        else:
            # This is classification of the complete photo, not a detected box.
            material = classify_material(focused)
            rows, truncated = [{'name':material_info(material['label'])['title'],
                                'material':material['label'], 'score':0, 'box':[0,0,1,1],
                                'source':'whole_image_classifier', 'material_prediction':material}], False
        background = [row for row in rows if row['name'] in scene_detector.BACKGROUND_NAMES]
        quality = quality_report(focused,[row['box'] for row in rows] if detector_available else [])
        quality['photo_privacy'] = privacy
        quality['identification_mode'] = 'object detection with dataset-trained material classification' if detector_available else 'whole-photo dataset-trained material classification; object locations are not detected'
        quality['background_objects'] = [{'name':name,'count':sum(row['name']==name for row in background)} for name in sorted({row['name'] for row in background})]
        with transaction.atomic():
            for row in rows:
                bx = row['box']
                crop_box = [round(bx[0]*focused.width),round(bx[1]*focused.height),round(bx[2]*focused.width),round(bx[3]*focused.height)]
                material = row.get('material_prediction') or classify_detected_material(focused.crop(crop_box), row)
                label = material['label']
                record = PredictionRecord(user=request.api_user,model_class=row['name'],decision=label,
                    title=material_info(label)['title'],confidence=material.get('confidence', 0),threshold=material.get('threshold', 1),
                    model_version=material.get('model_version', 'material-model-unavailable'),
                    image_quality={'alternatives':row.get('alternatives',[]), 'material_prediction':material,
                                   'object_source':row.get('source', 'model'),
                                   'raw_material_class':material.get('raw_class', 'unknown_unsupported')})
                refresh(record)
                if protected_focused is not None:
                    record.image.save(f'{uuid4().hex}.jpg',ContentFile(jpeg_bytes(protected_focused.crop(crop_box))),save=False)
                    crop_files.append((record.image.storage,record.image.name))
                record.save()
                global_box = [(frame[0]+bx[0]*focused.width)/image.width,(frame[1]+bx[1]*focused.height)/image.height,
                              (frame[0]+bx[2]*focused.width)/image.width,(frame[1]+bx[3]*focused.height)/image.height]
                SceneItem.objects.create(scene=scene,box=global_box,name=row['name'],score=row['score'],prediction=record)
            scene.quality = quality; scene.truncated = truncated; scene.status = 'complete'
            scene.save(update_fields=['quality','truncated','status'])
        committed = True
        logger.info('scene_created id=%s user_id=%s items=%s duration_ms=%s',scene.id,request.api_user.id,len(rows),round((time.monotonic()-started)*1000))
        return JsonResponse({'scene':serialize_scene(scene)},status=201)
    except Exception:
        logger.exception('scene_detection_failed user_id=%s',request.api_user.id)
        if not committed:
            for storage,name in crop_files:
                storage.delete(name)
        if scene and scene.pk:
            scene.status = 'failed'; scene.error = 'Detection could not complete. Try another photo or choose a material manually.'
            scene.save(update_fields=['status','error'])
        return JsonResponse({'detail':'Detection could not complete. Try another photo or choose a material manually.'},status=503)
    finally:
        scene_detector.inference_lock.release()


@csrf_exempt
@require_api_user
@require_http_methods(['GET','DELETE'])
def scene_detail(request, scene_id):
    scene = ScanScene.objects.filter(user=request.api_user,pk=scene_id).first()
    if not scene:
        return JsonResponse({'detail':'Scan not found.'},status=404)
    if request.method == 'DELETE':
        if scene.status == 'processing':
            return JsonResponse({'detail':'Wait for analysis to finish before deleting this scan.'},status=409)
        for item in scene.items.select_related('prediction'):
            if item.prediction:
                item.prediction.image.delete(save=False); item.prediction.delete()
        scene.image.delete(save=False); scene.delete()
        return JsonResponse({'deleted':True})
    return JsonResponse({'scene':serialize_scene(scene, saved=request.GET.get('history') == '1')})


@csrf_exempt
@require_api_user
@require_http_methods(['POST'])
def add_region(request, scene_id):
    """A human-marked missed object, never reported as a model detection."""
    import math
    scene = ScanScene.objects.filter(pk=scene_id, user=request.api_user).first()
    if not scene:
        return JsonResponse({'detail':'Scan not found.'}, status=404)
    if scene.status != 'complete':
        return JsonResponse({'detail':'Wait until analysis has finished.'}, status=409)
    try:
        payload = json.loads(request.body)
        box = payload['box']
        key = payload['request_id']
        if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{8,80}', key): raise ValueError()
        if not isinstance(box, list) or len(box) != 4 or any(type(v) not in (int,float) or not math.isfinite(v) or not 0 <= v <= 1 for v in box): raise ValueError()
        if box[2]-box[0] < .02 or box[3]-box[1] < .02: raise ValueError()
    except (ValueError, TypeError, KeyError, UnicodeDecodeError):
        return JsonResponse({'detail':'Mark two opposite corners within the photo.'}, status=400)
    with transaction.atomic():
        scene = ScanScene.objects.select_for_update().get(pk=scene.pk)
        if scene.items.filter(prediction__image_quality__manual_box_request=key).exists():
            return JsonResponse({'scene':serialize_scene(scene)})
        if scene.items.count() >= 60:
            return JsonResponse({'detail':'This scan has reached its review limit. Take a separate photo.'}, status=400)
        if not scene.image:
            return JsonResponse({'detail':'A privacy-safe photo is required to mark another item. Try a new scan.'}, status=409)
        with scene.image.open('rb') as source:
            image = oriented_image(source.read())
        image, _ = privacy_copy(image)
        if image is None:
            return JsonResponse({'detail':'The photo cannot yet be displayed safely. Try again later.'}, status=503)
        crop = image.crop((round(box[0]*image.width),round(box[1]*image.height),round(box[2]*image.width),round(box[3]*image.height)))
        encoded = BytesIO(); crop.save(encoded,format='JPEG',quality=90)
        record = PredictionRecord(user=request.api_user,model_class='human-marked unidentified object',decision='unknown_unsupported',
            title='Unidentified object',confidence=0,threshold=.55,model_version='manual-region-v1',input_method='manual',image_quality={'manual_box_request':key})
        refresh(record)
        record.image.save(f'{uuid4().hex}.jpg',ContentFile(encoded.getvalue()),save=False)
        try:
            record.save()
            SceneItem.objects.create(scene=scene,box=box,name='Unidentified object',score=0,prediction=record)
        except Exception:
            record.image.delete(save=False)
            raise
    return JsonResponse({'scene':serialize_scene(scene)},status=201)


@csrf_exempt
@require_api_user
@require_http_methods(['POST'])
def disposal_selection(request, scene_id):
    """Explicit full selection, owner scoped; never changes a model prediction."""
    from .disposal_workflow import snapshot
    from django.utils import timezone
    try:
        payload = json.loads(request.body)
        if not isinstance(payload, dict): raise ValueError()
        ids, corrections = payload.get('item_ids'), payload.get('object_names', {})
        if (not isinstance(ids, list) or not ids or len(ids) > 60 or
            any(type(value) is not int or value < 1 for value in ids) or len(set(ids)) != len(ids)):
            raise ValueError()
        if not isinstance(corrections, dict) or any(
            not str(key).isdigit() or str(int(key)) != str(key) or not isinstance(value, str) or len(value.strip()) > 120 or
            any(ord(char) < 32 for char in value) for key, value in corrections.items()
        ): raise ValueError()
    except (ValueError, TypeError, UnicodeDecodeError):
        return JsonResponse({'detail':'Select at least one item and use object names of at most 120 characters.'}, status=400)
    with transaction.atomic():
        scene = ScanScene.objects.select_for_update().filter(pk=scene_id, user=request.api_user).first()
        if not scene: return JsonResponse({'detail':'Scan not found.'}, status=404)
        if scene.status != 'complete':
            return JsonResponse({'detail':'Wait for detection to finish.'}, status=409)
        items = list(scene.items.select_related('prediction'))
        allowed = {item.id for item in items if item.prediction and item.prediction.user_id == request.api_user.id}
        if not set(ids).issubset(allowed) or not {int(key) for key in corrections}.issubset(allowed):
            return JsonResponse({'detail':'Choose items belonging to this scan.'}, status=400)
        for item in items:
            if not item.prediction: continue
            record = item.prediction
            metadata = {**record.image_quality, 'selected_for_disposal':item.id in ids}
            if str(item.id) in corrections:
                metadata['user_object_name'] = corrections[str(item.id)].strip()
            record.image_quality = metadata
            snapshot(record)
            record.save(update_fields=['image_quality'])
        scene.quality = {**scene.quality, 'disposal_selection':{
            'confirmed':True, 'item_ids':sorted(ids), 'confirmed_at':timezone.now().isoformat(),
        }}
        scene.save(update_fields=['quality'])
    return JsonResponse({'scene':serialize_scene(scene, saved=True)})
