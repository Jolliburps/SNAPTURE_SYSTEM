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

logger = logging.getLogger(__name__)


def routing(prediction):
    assessment = prediction['assessment']
    segregation = assessment['segregation']
    if prediction['previous_contents'] == 'Chemical or cleaning product':
        return {'key':'special','label':'Special handling','reason':'Reported chemical contact. Keep separate and ask CESD for instructions.'}
    if segregation['status'] == 'available' and segregation['category'] and segregation['category'].lower() in {'recyclable','potentially recyclable - confirm local acceptance'}:
        return {'key':'recyclable','label':'Potentially recyclable','reason':'Matches published guidance and your answers; confirm local acceptance.'}
    return {'key':'review','label':'Needs review','reason':'Material, condition or a local disposal rule is not confirmed. Not automatically residual waste.'}


def serialize_scene(scene):
    from .views import _serialize
    items = []
    stored = {item.id:item for item in scene.items.select_related('prediction').order_by('id') if item.prediction}
    cleaned, suppressed = scene_detector.clean_detections([
        {'source_id':item.id,'name':item.name,'score':item.score,'box':item.box,
         'user_confirmed':item.prediction.answers.get('user_confirmed_material') == item.prediction.decision and item.prediction.decision != 'unknown_unsupported'}
        for item in stored.values()])
    for row in cleaned:
        item = stored[row['source_id']]
        prediction = _serialize(item.prediction)
        group = ('special' if 'battery' in item.name else 'biodegradable' if 'food' in item.name or 'leaf' in item.name else 'non_biodegradable' if 'wrapper' in item.name or 'fabric' in item.name else 'recyclable' if any(word in item.name for word in ('bottle','container','cardboard','paper','can')) else 'review')
        route = routing(prediction)
        verified = prediction['assessment']['material']['status']=='user_selected'
        background = row.get('background',False) and not verified
        low = item.score < scene_detector.DISPLAY_THRESHOLD and not verified
        draw = not background and not row.get('ambiguous_large') and (verified or not low)
        display_group = 'special' if route['key']=='special' else 'review' if background or low or row.get('ambiguous_large') else route['key'] if route['key']!='review' else group
        reason = ('Possible background object. Not included in waste sorting unless you identify it as a discarded item.' if background else 'Low detector score. Review this item before sorting.' if low else 'The region is too broad for a clear object box. Review it separately.' if row.get('ambiguous_large') else route['reason'])
        items.append({'id':item.id,'box':row['box'],'name':item.name,'score':item.score,'prediction':prediction,'route':route,'suggested_group':group,
                      'display_box':draw,'display_group':display_group,'low_confidence':low,'background':background,'review_reason':reason})
    flags = [flag for flag in scene.quality.get('flags',[]) if flag['code'] not in {'edge_item','crowded'}]
    frame = scene.frame or [0,0,1,1]
    drawn = [item for item in items if item['display_box']]
    if any(min(abs(item['box'][0]-frame[0]),abs(item['box'][1]-frame[1]),abs(frame[2]-item['box'][2]),abs(frame[3]-item['box'][3])) < .012 for item in drawn):
        flags.append({'code':'edge_item','message':'A detected item touches the guide edge and may be cut off. Leave space around it if it is incomplete.'})
    if len(drawn)>8:
        flags.append({'code':'crowded','message':'Several item regions overlap or crowd this photo. Spread the items out for clearer detection.'})
    return {'id':scene.id,'image_url':scene.image.url,'width':scene.width,'height':scene.height,'frame':scene.frame,
            'status':scene.status,'error':scene.error,'quality':{**scene.quality,'flags':flags},'items':items,'truncated':scene.truncated or suppressed,
            'display_threshold':scene_detector.DISPLAY_THRESHOLD,'suppressed_count':len(stored)-len(items),
            'background_objects':scene.quality.get('background_objects',[]),
            'detector':'OWL-ViT base patch32, experimental zero-shot',
            'limitations':'Boxes are model suggestions. Hidden, small or unfamiliar objects may be missed or mislabeled. Review every item; not all objects are guaranteed to be detected.'}


@require_api_user
@require_http_methods(['GET'])
def capabilities(request):
    return JsonResponse({'available':scene_detector.available(),'experimental':True,'maximum_items':30})


@csrf_exempt
@require_api_user
@require_http_methods(['POST','GET'])
def scenes(request):
    if request.method == 'GET':
        return JsonResponse({'scenes':[serialize_scene(scene) for scene in ScanScene.objects.filter(user=request.api_user)[:20]]})
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
    if not scene_detector.available():
        return JsonResponse({'detail':'Automatic detection is unavailable. Choose a material manually or ask the administrator to install the detector.'},status=503)
    if not scene_detector.inference_lock.acquire(blocking=False):
        return JsonResponse({'detail':'Another image is being analyzed. Try again in a moment.'},status=429)
    scene = None
    crop_files = []
    committed = False
    started = time.monotonic()
    try:
        scene = ScanScene(user=request.api_user,request_id=request_id,width=image.width,height=image.height,
                          frame=[frame[0]/image.width,frame[1]/image.height,frame[2]/image.width,frame[3]/image.height])
        encoded = BytesIO(); image.save(encoded,format='JPEG',quality=90)
        scene.image.save(f'{uuid4().hex}.jpg',ContentFile(encoded.getvalue()),save=False)
        scene.save()
        focused = image.crop(frame)
        rows, truncated = scene_detector.detect(focused)
        background = [row for row in rows if row['name'] in scene_detector.BACKGROUND_NAMES]
        rows = [row for row in rows if row['name'] not in scene_detector.BACKGROUND_NAMES]
        quality = quality_report(focused,[row['box'] for row in rows])
        quality['background_objects'] = [{'name':name,'count':sum(row['name']==name for row in background)} for name in sorted({row['name'] for row in background})]
        with transaction.atomic():
            for row in rows:
                bx = row['box']
                crop_box = [round(bx[0]*focused.width),round(bx[1]*focused.height),round(bx[2]*focused.width),round(bx[3]*focused.height)]
                crop = BytesIO(); focused.crop(crop_box).save(crop,format='JPEG',quality=90)
                record = PredictionRecord(user=request.api_user,model_class=row['name'],decision=row['material'],
                    title=material_info(row['material'])['title'],confidence=row['score'],threshold=.1,
                    model_version='owlvit-scene-candidate-unverified-v1')
                refresh(record)
                record.image.save(f'{uuid4().hex}.jpg',ContentFile(crop.getvalue()),save=False)
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
    return JsonResponse({'scene':serialize_scene(scene)})
