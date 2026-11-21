"""One detected item, optional additional views, and immutable historical output."""
from copy import deepcopy
import json
from django.core.files.base import ContentFile
from .models import AdditionalView
from .assessment import observe,visual_summary
from .matching import suggestions,safety_block
from predictions.image_quality import oriented_image,frame_bounds
from predictions.photo_privacy import jpeg_bytes,privacy_copy
from uuid import uuid4

VIEWS=('front','back','side','left','right','top','bottom','inside')
ALL_SIDES={'front','back','left','right','top','bottom'}
CONTAINER_VIEWS=('back','left','right','top','bottom')
MATERIAL_VIEWS={
    'pete_bottles': CONTAINER_VIEWS,
    'hdpe_containers': CONTAINER_VIEWS,
    'paper': ('back',),
    'fabric_scraps': ('back',),
    'cardboard': ('back','side'),
    'dry_untreated_wood_scraps': ('back','side','bottom'),
    'coconut_shells': ('side','bottom'),
}
INTERIOR_MATERIALS={'pete_bottles','hdpe_containers','cardboard','coconut_shells'}

class MissingScanViews(ValueError):
    pass


def capture_plan(material):
    return {'views': MATERIAL_VIEWS.get(material, ('back',)), 'inside': material in INTERIOR_MATERIALS}


def validate_capture_plan(material, primary, views):
    plan=capture_plan(material)
    required=set(plan['views'])
    submitted={name for name,_image,purpose in views if purpose!='closeup'}
    allowed=required | ({'inside'} if plan['inside'] else set())
    if primary!='front' or not required <= submitted <= allowed:
        raise MissingScanViews('Complete the required photos shown for this material. The inside photo is optional when offered.')


def parse_session(request, details=None):
    names=json.loads(request.POST.get('view_names','[]'))
    frames=json.loads(request.POST.get('view_frames','[]'))
    files=request.FILES.getlist('additional_views')
    concern=request.FILES.getlist('concern_photo')
    expects_concern=(details or {}).get('inspection_report')=='concern_photo'
    if bool(concern)!=expects_concern:raise ValueError('Provide at least one close-up when you report a concern.')
    if 'concern_frames' in request.POST:
        concern_frames=json.loads(request.POST['concern_frames'])
    else:
        concern_frames=[json.loads(request.POST.get('concern_frame','null'))] if concern else []
    if not isinstance(concern_frames,list) or len(concern)!=len(concern_frames):
        raise ValueError('Provide a guide frame for each close-up.')
    primary=request.POST.get('primary_view','front')
    if primary not in VIEWS:raise ValueError('Choose a supported primary view.')
    if not isinstance(names,list) or not isinstance(frames,list):raise ValueError('Invalid scan views.')
    if len(names)!=len(files) or len(frames)!=len(files):raise ValueError('Invalid scan views.')
    is_session=any(key in request.POST for key in ('primary_view','view_names','view_frames','same_item_confirmed'))
    if is_session and request.POST.get('same_item_confirmed')!='true':raise ValueError('Confirm all photos show the same physical item.')
    guided=(details or {}).get('capture_mode')=='material-guided-v1'
    if primary=='inside' or (not guided and 'inside' in names):
        raise MissingScanViews('Take an inside photo only when the guided scan asks for one.')
    if any(not isinstance(n,str) or n not in VIEWS for n in names) or len(files)>(6 if guided else 5) or len(set(names+[primary]))!=len(names)+1:raise ValueError('Invalid scan views.')
    if (details or {}).get('capture_mode')=='all-sides-v1' and (primary!='front' or set([primary,*names])!=ALL_SIDES):
        raise MissingScanViews('Take photos of the front, back, left, right, top and bottom before checking this item.')
    result=[]
    for name,frame,upload in zip(names,frames,files):
        if name not in VIEWS or upload.size>12*1024*1024 or not (upload.content_type or '').startswith('image/'):raise ValueError('Choose valid item photos under 12 MB.')
        image=oriented_image(upload.read());bounds=frame_bounds(image,frame)
        result.append((name,image.crop(bounds),'interior' if name=='inside' else 'material_view'))
    for upload,frame in zip(concern,concern_frames):
        if upload.size>12*1024*1024 or not (upload.content_type or '').startswith('image/'):
            raise ValueError('Choose a valid close-up under 12 MB.')
        image=oriented_image(upload.read())
        result.append(('side',image.crop(frame_bounds(image,frame)),'closeup'))
    return result,primary

def attach(record,views,saved_files=None):
    from predictions.material_classifier import classify_material
    from .human_assisted import condition_record
    from .workflow import inspection_first
    guided_photos=bool((record.image_quality.get('scan_details') or {}).get('capture_mode'))
    for index,(name,image,purpose) in enumerate(views):
        observations={'purpose':purpose}
        if purpose=='closeup' or not inspection_first(record) or guided_photos:
            observations['condition']=condition_record(record,image,purpose='condition',material=record.decision,view='close-up' if purpose=='closeup' else name)
            if purpose=='interior':
                condition=observations['condition']
                observations['condition']={**condition,'observations':[
                    item for item in condition.get('observations', [])
                    if item.get('field') in {'damage','wet_appearance','visible_contamination'}
                ]}
        if purpose=='material_view':
            try:observations['material']=classify_material(image)
            except (RuntimeError,ValueError,OSError,ImportError):observations['material']={'label':'unknown_unsupported','status':'unavailable'}
        key=f'concern_{index}' if purpose=='closeup' else name
        row=AdditionalView(prediction=record,request_id=f'session_{record.pk}_{key}',view=name,same_item_confirmed=True,observations=observations)
        protected=privacy_copy(image)[0] if guided_photos else image
        if protected is not None:
            row.image.save(uuid4().hex+'.jpg',ContentFile(jpeg_bytes(protected)),save=False)
            if saved_files is not None:saved_files.append((row.image.storage,row.image.name))
        row.save()

def classification(record):
    from .workflow import enabled,verdict
    if enabled(record):
        decision=verdict(record)
        material=(record.image_quality.get('material_prediction') or {})
        if decision['code']=='unsupported' and material.get('status')=='not_applicable':
            return {**decision, 'kind':'disposal', 'reason':material.get('basis') or decision['reason'],
                    'next_action':'Keep it separate and ask your barangay or CESD how to sort or dispose of this item.'}
        return {**decision,'kind':'hazardous' if decision['code']=='for_disposal' else 'unsupported' if decision['code']=='unsupported' else 'supported'}
    from .assessment import facts_for
    from core.materials import SCOPE_LABELS
    from predictions.disposal_workflow import special_kind
    from core.waste_taxonomy import FINE_CLASSES
    facts=facts_for(record)
    answers=record.answers or {}
    names={record.model_class.casefold(), str((record.image_quality or {}).get('user_object_name','')).casefold()}
    hazard=bool(special_kind(record) or names & {'metal','metal can','chemical','chemical container'}
                or answers.get('other_material')=='Metal'
                or FINE_CLASSES.get(record.model_class,('',None))[0]=='C'
                or record.previous_contents=='Chemical or cleaning product'
                or facts.get('previous_contents')=='Chemical or cleaning product'
                or facts.get('condition')=='Moldy or contaminated'
                or answers.get('reported_category')=='C'
                or answers.get('contamination') in {'Chemical contamination','Mold or biological waste','Oil or grease'})
    if hazard:return {'kind':'hazardous','reason':'Hazardous ? not eligible for upcycling. Glass, metal, chemical contents, and hazardous contamination require separate handling under SNAPTURE policy.'}
    evidence=(record.image_quality or {}).get('material_prediction',{})
    uncertain=(evidence.get('status') in {'needs_review','conflicting_evidence','unavailable','not_applicable'}
               or ((record.image_quality or {}).get('detection_filter') or {}).get('status')=='review'
               or (record.input_method!='manual' and record.confidence < record.threshold))
    if record.decision not in SCOPE_LABELS or uncertain:
        return {'kind':'unsupported','reason':'This scan did not confirm an item in the seven supported categories.'}
    return {'kind':'supported','reason':safety_block(record,facts)}


def freeze(record,primary_view='front'):
    """Create once; user-requested new assessments never rewrite this snapshot."""
    if record.image_quality.get('result_snapshot'):return record.image_quality['result_snapshot']
    from predictions.views import _serialize
    item=getattr(record,'scene_item',None)
    summary=visual_summary(record)
    result={'version':'scan-session-v1','prediction':_serialize(record),'visual':summary,
            'suggestions':suggestions(record),'classification':classification(record),'object':item.name if item else record.model_class,
            'photos':[{'view':primary_view,'image_url':item.scene.image.url if item and item.scene.image else (record.image.url if record.image else None)},*summary['views']]}
    if result['classification']['kind']!='supported':result['suggestions']={'items':[],'outcome':'no_suitable_project','message':result['classification']['reason'],'facts':{}}
    result=json.loads(json.dumps(result,default=str))
    record.image_quality={**record.image_quality,'result_snapshot':deepcopy(result)};record.save(update_fields=['image_quality'])
    return result
