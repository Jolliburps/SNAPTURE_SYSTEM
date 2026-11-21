"""Resident-owned APIs; organization review permissions are scoped memberships."""
import hashlib
import json
import re
from functools import wraps
from uuid import uuid4
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.db import transaction
from django.http import JsonResponse, FileResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.csrf import csrf_exempt
from core.auth import user_from_request
from core.materials import SCOPE_LABELS, MATERIALS
from predictions.models import PredictionRecord, UserProject
from predictions.image_quality import oriented_image
from predictions.photo_privacy import jpeg_bytes
from .models import AdditionalView, InventoryLot, StepPhoto, FinalProductAssessment, CompletedProject, MaterialUsage, Organization, Membership, Program, Submission
from .assessment import observe,validate_facts,facts_for,visual_summary,verified_photo_steps
from .matching import suggestions,safety_block
from .human_assisted import project_enabled as human_project, condition_record, confirmation, NOTICE as HUMAN_NOTICE

class Problem(Exception):
    def __init__(self,message,status=400):self.message=message;self.status=status

def endpoint(methods):
    def decorate(fn):
        @csrf_exempt
        @wraps(fn)
        def wrapped(request,*args,**kwargs):
            user=user_from_request(request)
            if not user or not user.is_active:return JsonResponse({'detail':'Authentication required.'},status=401)
            if request.method not in methods:return JsonResponse({'detail':'Method not allowed.'},status=405)
            request.actor=user
            try:return JsonResponse(fn(request,*args,**kwargs))
            except Problem as error:return JsonResponse({'detail':error.message},status=error.status)
            except (ValueError,TypeError,ValidationError,OverflowError) as error:return JsonResponse({'detail':str(error)},status=400)
        return wrapped
    return decorate

def body(request):
    if len(request.body)>100000:raise Problem('Request is too large.')
    value=json.loads(request.body or '{}')
    if not isinstance(value,dict):raise Problem('Expected an object.')
    return value

def owned(model,user,pk):
    if type(pk) is not int:raise Problem('A valid record ID is required.')
    row=model.objects.filter(user=user,pk=pk).first()
    if not row:raise Problem('Record not found.',404)
    return row

def picture(request):
    upload=request.FILES.get('image')
    if not upload or not (upload.content_type or '').startswith('image/'):raise Problem('Choose an image.')
    if upload.size>12*1024*1024:raise Problem('Choose an image smaller than 12 MB.')
    try:return oriented_image(upload.read())
    except Exception:raise Problem('Choose a readable image under 25 megapixels.')

def save_image(field,image):
    field.save(uuid4().hex+'.jpg',ContentFile(jpeg_bytes(image)),save=False)

def integer(value,minimum=1,maximum=100000):
    if type(value) is not int or not minimum<=value<=maximum:raise Problem(f'Use a whole number from {minimum} to {maximum}.')
    return value

def text(value,limit=2000):
    if not isinstance(value,str) or len(value)>limit:raise Problem(f'Use text of at most {limit} characters.')
    return value.strip()

def lot_row(lot):
    return {'id':lot.pk,'prediction_id':lot.prediction_id,'material':lot.material,'object_type':lot.object_type,
            'quantity':lot.quantity,'consumed':lot.consumed,'available':lot.quantity-lot.consumed,'attributes':lot.attributes,'confirmed':lot.confirmed}

def completion_row(row):
    return {'id':row.pk,'project_id':row.project_id,'name':row.name,'image_url':f'/api/upcycling/media/completion/{row.pk}/',
            'materials':row.materials,'description':row.description,'feedback':row.feedback,'completed_at':row.completed_at.isoformat(),
            'final_assessment':row.final_assessment,
            'verification_status':row.verification_status,'usage':[{'lot_id':u.lot_id,'quantity':u.quantity,'material':u.lot.material} for u in row.usage.select_related('lot')]}

def final_row(row):
    return {'id':row.pk,'image_url':f'/api/upcycling/media/final/{row.pk}/','created_at':row.created_at.isoformat(),**row.assessment}


def project_row(project):
    from predictions.project_views import _serialize
    from .verification import capabilities as verification_capabilities, step_criteria, strict
    photos=list(project.step_photos.all())
    completion=CompletedProject.objects.filter(project=project).first()
    return {**_serialize(project),'photo_workflow':bool(project.reference.get('photo_workflow')),
            'verification_capabilities':{'human_assisted':True,'step_available':False,'final_available':False,'reason':HUMAN_NOTICE} if human_project(project) else verification_capabilities(project) if strict(project) else None, 'step_criteria':step_criteria(project),
            'final_assessments':[final_row(row) for row in project.final_assessments.all()],
            'step_photos':[{'id':p.pk,'step_index':p.step_index,'image_url':f'/api/upcycling/media/step/{p.pk}/','status':p.status,'assessment':p.assessment} for p in photos],
            'completion_record':completion_row(completion) if completion else None}

@endpoint(['GET'])
def capabilities(request):
    exclusions={'pete_bottles':'Glass, unknown resin and chemical containers are not PET clearance.',
        'hdpe_containers':'Unknown resin, multilayer packaging and chemical history require separate review.',
        'paper':'Mold, chemical contamination and unsuitable coatings are excluded from relevant projects.',
        'cardboard':'Heavily contaminated or moldy board is excluded. Usable dry portions depend on the project.',
        'fabric_scraps':'Unknown contamination and mixed layers require confirmation. Small pieces may be pooled only when compatible.',
        'dry_untreated_wood_scraps':'Painted, treated, moldy wood, sawdust and hardware require separate assessment.',
        'coconut_shells':'Sharp or unstable fragments require preparation and project-specific checks.'}
    from django.conf import settings
    return {'detector':'TensorFlow/MobileNetV2 material classification; object detection disabled',
            'visual_assessor_configured':bool(getattr(settings,'SNAPTURE_VISUAL_ASSESSOR','')),
            'scope':[{'label':s,'title':MATERIALS[s]['title'],'examples':MATERIALS[s]['examples'],'exclusions':exclusions[s]} for s in SCOPE_LABELS]}

@endpoint(['GET','PATCH','POST'])
def assessment(request,prediction_id):
    record=owned(PredictionRecord,request.actor,prediction_id)
    if request.method=='PATCH':
        incoming=validate_facts(body(request).get('facts',{}))
        with transaction.atomic():
            record=PredictionRecord.objects.select_for_update().get(pk=record.pk)
            from .workflow import enabled,inspection_first,remember_hazards
            remember_hazards(record,incoming)
            previous=(record.answers or {}).get('suitability_facts',{})
            workflow=dict(record.image_quality.get('workflow',{}))
            confirmations={'safety_acknowledged','inspection_confirmed','usable_quantity','preparation_completed','project_checks','human_condition_confirmed'}
            if inspection_first(record):
                confirmations.update({'resin_mark', 'wood_treatment', 'shape', 'object_type'})
            if 'project_checks' in incoming:
                current_checks = previous.get('project_checks', {}).get('value', {})
                submitted_checks = incoming['project_checks']['value']
                incoming['project_checks']['value'] = {
                    **current_checks,
                    **{key: {**current_checks.get(key, {}), **checks} for key, checks in submitted_checks.items()},
                }
            changed={key for key,row in incoming.items() if key not in confirmations and previous.get(key,{}).get('value')!=row['value']}
            if 'usable_quantity' in incoming and workflow.get('usable_quantity')!=incoming['usable_quantity']['value']:
                workflow['inspection_confirmed']=False
            if changed:workflow.update(inspection_confirmed=False,human_condition_confirmed=False)
            if changed & {'condition','previous_contents','moisture_cause','material_scope_report'}:
                workflow.update(reassessed=False,preparation_completed=False,reassessment_view_id=None)
            for key in ('safety_acknowledged','inspection_confirmed','usable_quantity','preparation_completed','moisture_cause','human_condition_confirmed'):
                if key in incoming:workflow[key]=incoming[key]['value']
            if incoming.get('condition',{}).get('value')=='Needs cleaning' or incoming.get('moisture_cause',{}).get('value')=='Water':
                workflow['preparation_required']=True
            if enabled(record):
                details=record.image_quality.get('scan_details')
                usable=workflow.get('usable_quantity')
                if usable is not None and not details:raise Problem('Start a new scan and provide size and quantity before confirming inspection.')
                if usable is not None and usable>details['quantity']:raise Problem('Usable quantity cannot exceed the original item count.')
                if workflow.get('inspection_confirmed') and (not workflow.get('safety_acknowledged') or usable is None):raise Problem('Acknowledge the notice and provide usable quantity before confirming inspection.')
                record.image_quality={**record.image_quality,'workflow':workflow}
                if usable is not None:record.quantity=usable
            record.answers={**record.answers,'suitability_facts':{**previous,**incoming}}
            if 'condition' in incoming:record.condition=incoming['condition']['value']
            if 'previous_contents' in incoming:record.previous_contents=incoming['previous_contents']['value']
            if 'quantity' in incoming and not enabled(record):record.quantity=incoming['quantity']['value']
            for key in ('wood_treatment','resin_mark'):
                if key in incoming:record.answers[key]=incoming[key]['value']
            record.save(update_fields=['answers','condition','previous_contents','quantity','image_quality'])
    if request.method=='POST':
        if request.FILES:
            purpose=request.POST.get('purpose','material_view')
            if purpose not in {'material_view','closeup','reassessment'}:raise Problem('Choose a material view, condition close-up or reassessment photo.')
            if purpose=='reassessment' and request.POST.get('full_item_confirmed')!='true':raise Problem('Show the complete prepared item and confirm full-item reassessment.')
            view=request.POST.get('view','side')
            if view not in {'front','back','side','top','bottom'}:raise Problem('Choose a supported view.')
            request_id=request.POST.get('request_id','')
            if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',request_id):raise Problem('A valid photo request ID is required.')
            if request.POST.get('same_item_confirmed')!='true':raise Problem('Confirm this is another view of the same item.')
            if purpose=='reassessment' and not record.image_quality.get('workflow',{}).get('preparation_completed'):raise Problem('Confirm preparation before requesting reassessment.')
            row=AdditionalView.objects.filter(prediction=record,request_id=request_id).first()
            if not row:
                if record.additional_views.count()>=12:raise Problem('This item already has 12 additional views.')
                image=picture(request)
                observations={'purpose':purpose,'condition':condition_record(record,image,purpose='condition',material=record.decision,view=view)}
                if purpose!='closeup':
                    from predictions.material_classifier import classify_material
                    try:observations['material']=classify_material(image)
                    except (RuntimeError,ValueError,ImportError,OSError):observations['material']={'status':'unavailable'}
                from .workflow import enabled,combine_material
                saved=None
                try:
                    with transaction.atomic():
                        record=PredictionRecord.objects.select_for_update().get(pk=record.pk)
                        if not record.additional_views.filter(request_id=request_id).exists():
                            if record.additional_views.count()>=12:raise Problem('This item already has 12 additional views.')
                            workflow=dict(record.image_quality.get('workflow',{}))
                            if purpose=='reassessment' and not workflow.get('preparation_completed'):
                                raise Problem('Confirm preparation before requesting reassessment.')
                            saved=AdditionalView(prediction=record,request_id=request_id,view=view,same_item_confirmed=True,observations=observations)
                            save_image(saved.image,image)
                            saved.save()
                            if enabled(record):
                                workflow.update(inspection_confirmed=False,human_condition_confirmed=False,
                                                reassessed=purpose=='reassessment',reassessment_view_id=saved.pk if purpose=='reassessment' else None)
                                record.image_quality={**record.image_quality,'workflow':workflow}
                                if purpose=='closeup' and record.condition!='Moldy or contaminated':
                                    # A newly photographed concern needs a fresh condition report.
                                    stored=dict(record.answers.get('suitability_facts',{}))
                                    stored.pop('condition',None)
                                    record.answers={**record.answers,'suitability_facts':stored}
                                    record.condition='Not sure'
                                combine_material(record)
                except Exception:
                    if saved and saved.image:saved.image.delete(save=False)
                    raise
        else:
            if not record.image:raise Problem('No saved item image is available.')
            with record.image.open('rb') as source:image=oriented_image(source.read())
            record.image_quality={**record.image_quality,'visual_assessment':condition_record(record,image,purpose='condition',material=record.decision,view='primary')}
            record.save(update_fields=['image_quality'])
    from core.assessment import refresh
    if request.method!='GET':
        refresh(record);record.save(update_fields=['assessment','recommendation_choices'])
    from predictions.views import _serialize
    summary=visual_summary(record)
    from .workflow import enabled
    if enabled(record):summary['verdict']=suggestions(record).get('verdict',summary['verdict'])
    return {'assessment':summary,'prediction':_serialize(record)}

@endpoint(['GET','POST'])
def project_suggestions(request,prediction_id):
    record=owned(PredictionRecord,request.actor,prediction_id)
    goal=request.GET.get('goal','')[:160]
    use_inventory=request.GET.get('inventory')=='true'
    result=suggestions(record,goal,use_inventory)
    if request.method=='GET':return result
    payload=body(request)
    selected=next((r for r in result['items'] if r['id']==payload.get('recommendation_id')),None)
    if not selected or not selected['can_start']:raise Problem('Confirm the project-specific requirements before starting.',409)
    from predictions.project_views import _project_values
    values=_project_values(record,selected)
    values['reference']={**values['reference'],'photo_workflow':True,'suitability_requirements':selected['requirements'],'material_label':record.decision}
    project,_=UserProject.objects.get_or_create(user=request.actor,source_prediction=record,recommendation_id=selected['id'],defaults=values)
    return {'project':project_row(project)}

@endpoint(['GET','POST'])
def inventory(request):
    if request.method=='POST':
        value=body(request);quantity=integer(value.get('quantity'))
        record=owned(PredictionRecord,request.actor,value['prediction_id']) if value.get('prediction_id') else None
        material=record.decision if record else value.get('material')
        if material not in SCOPE_LABELS:raise Problem('Choose a supported material.')
        if record and InventoryLot.objects.filter(prediction=record).exists():raise Problem('This scanned item is already in your collection. Adjust its existing quantity.',409)
        if record and safety_block(record,facts_for(record)):raise Problem('This item is not cleared for the upcycling collection.')
        attrs=facts_for(record) if record else {k:v['value'] for k,v in validate_facts(value.get('attributes',{})).items()}
        attrs.pop('quantity',None)
        if record:
            _,created=InventoryLot.objects.get_or_create(prediction=record,defaults={'user':request.actor,'material':material,'quantity':quantity,'object_type':text(value.get('object_type',''),120),'attributes':attrs})
            if not created:raise Problem('This scanned item is already in your collection.',409)
        else:
            InventoryLot.objects.create(user=request.actor,material=material,quantity=quantity,object_type=text(value.get('object_type',''),120),attributes=attrs)
    rows=InventoryLot.objects.filter(user=request.actor)
    return {'lots':[lot_row(lot) for lot in rows]}

@endpoint(['PATCH','DELETE'])
@transaction.atomic
def inventory_detail(request,lot_id):
    lot=InventoryLot.objects.select_for_update().filter(pk=lot_id,user=request.actor).first()
    if not lot:raise Problem('Collection record not found.',404)
    if request.method=='DELETE':
        if lot.consumed or lot.materialusage_set.exists():raise Problem('Used materials are retained in completed-project history.',409)
        lot.delete();return {'deleted':True}
    value=body(request)
    if 'quantity' in value:
        quantity=integer(value['quantity'],0)
        if quantity<lot.consumed:raise Problem('Total quantity cannot be less than material already consumed.')
        lot.quantity=quantity
    if 'attributes' in value:
        lot.attributes={**lot.attributes,**{k:v['value'] for k,v in validate_facts(value['attributes']).items()}}
    lot.save()
    return {'lot':lot_row(lot)}

@endpoint(['GET'])
def project_detail(request,project_id):return {'project':project_row(owned(UserProject,request.actor,project_id))}


@endpoint(['POST'])
@transaction.atomic
def enable_project_confirmation(request, project_id):
    from .human_assisted import MODE
    from .verification import capabilities

    project = UserProject.objects.select_for_update().filter(pk=project_id, user=request.actor).first()
    if not project:
        raise Problem('Project not found.', 404)
    if body(request).get('acknowledged') is not True:
        raise Problem('Confirm that your photos will document your own inspection.')
    if human_project(project):
        return {'project': project_row(project)}
    if CompletedProject.objects.filter(project=project).exists() or not capabilities(project)['manual_confirmation_available']:
        raise Problem('Manual confirmation is unavailable for this project.', 409)
    project.reference = {**project.reference, 'verification_mode': MODE}
    project.save(update_fields=['reference', 'updated_at'])
    return {'project': project_row(project)}

@endpoint(['GET'])
def inventory_prediction(request,lot_id):
    lot=owned(InventoryLot,request.actor,lot_id)
    if not lot.prediction_id:raise Problem('This collection entry has no saved scan. Scan a representative item first.',404)
    from predictions.views import _serialize
    return {'prediction':_serialize(lot.prediction)}

@endpoint(['GET'])
def saved_result(request,prediction_id):
    record=owned(PredictionRecord,request.actor,prediction_id)
    snapshot=record.image_quality.get('result_snapshot')
    if not snapshot:return {'snapshot':None,'legacy':True}
    return {'snapshot':snapshot,'legacy':False}

@endpoint(['POST'])
@transaction.atomic
def step_photo(request,project_id,step_index):
    project=UserProject.objects.select_for_update().filter(pk=project_id,user=request.actor).first()
    if not project:raise Problem('Project not found.',404)
    if not project.reference.get('photo_workflow'):raise Problem('This older project uses its original checklist.')
    if CompletedProject.objects.filter(project=project).exists():raise Problem('Completed project evidence is locked.',409)
    if step_index<0 or step_index>=len(project.steps) or any(i not in verified_photo_steps(project) for i in range(step_index)):raise Problem('Submit the earlier step photos first.')
    if request.content_type=='application/json':
        step_payload=body(request)
        photo_id=integer(step_payload.get('confirm_photo_id') if human_project(project) else step_payload.get('recheck_photo_id'))
        saved=project.step_photos.filter(pk=photo_id,step_index=step_index).first()
        if not saved:raise Problem('Step photo not found.',404)
        if saved.status not in {'submitted','retake'} or saved.assessment.get('status')=='available':raise Problem('Take a new photo showing the requested correction.')
        with saved.image.open('rb') as source:image=oriented_image(source.read())
        digest=saved.digest
    else:
        image=picture(request);digest=hashlib.sha256(jpeg_bytes(image)).hexdigest()
    from .verification import strict, check, step_criteria
    if strict(project) and StepPhoto.objects.filter(project__user=request.actor,digest=digest).exclude(project=project).exists():
        raise Problem('This image was already submitted to another project. Show the current project and step.',409)
    existing=project.step_photos.filter(digest=digest).first()
    if existing:
        if existing.step_index!=step_index:raise Problem('Take a new photo showing this step. The same image was already used.')
        if existing.status not in {'submitted','retake'} or existing.assessment.get('status')=='available':
            return {'project':project_row(project)}
    if step_index in verified_photo_steps(project):raise Problem('This completed step photo is locked to preserve the project history.',409)
    criteria=project.reference.get('suitability_requirements',{}).get('checkpoint_criteria',[])
    if human_project(project):
        confirmed=request.POST.get('step_confirmed')=='true' if request.content_type!='application/json' else step_payload.get('confirm_photo_id') is not None
        assessment=confirmation('project_step',confirmed)
    elif strict(project):
        snapshots=step_criteria(project)
        assessment=check(image,project,'project_step',snapshots[step_index:step_index+1],
                         step_index=step_index, instruction=project.steps[step_index],
                         previous_photos=list(project.step_photos.filter(step_index__lt=step_index,status='ai_matches').values('id','step_index','image')))
    else:
        assessment=observe(image,purpose='project_step',instruction=project.steps[step_index],project_title=project.title,
                           checkpoint_criterion=criteria[step_index] if step_index<len(criteria) else None,
                           previous_photos=list(project.step_photos.filter(step_index__lt=step_index,status__in=['submitted','ai_matches','reviewer_accepted']).values('step_index','image')))
    # Unavailable checking never unlocks the next step.
    status='submitted' if human_project(project) else 'retake'
    if assessment['status']=='available':
        if strict(project):
            status={'verified':'ai_matches','needs_correction':'needs_correction','retake':'retake'}.get(assessment.get('verdict'),'retake')
        else:
            status={'matches':'ai_matches','needs_correction':'needs_correction','retake':'retake'}.get(assessment.get('step_status'),'retake')
    if existing:
        row=existing;row.status=status;row.assessment=assessment
        row.save(update_fields=['status','assessment'])
    else:
        row=StepPhoto(project=project,step_index=step_index,digest=digest,status=status,assessment=assessment)
        save_image(row.image,image)
        try:row.save()
        except Exception:row.image.delete(save=False);raise
    if status=='ai_matches' or (human_project(project) and assessment.get('verdict')=='user_confirmed'):
        project.completed_steps=verified_photo_steps(project)
        project.reference={**project.reference,'_progress_started_at':project.reference.get('_progress_started_at') or timezone.now().isoformat()}
        project.save(update_fields=['completed_steps','reference','updated_at'])
    return {'project':project_row(project)}

@endpoint(['POST'])
@transaction.atomic
def final_product(request,project_id):
    project=UserProject.objects.select_for_update().filter(pk=project_id,user=request.actor).first()
    if not project:raise Problem('Project not found.',404)
    from .verification import strict,assess_final
    if not strict(project) and not human_project(project):raise Problem('This older project retains its original completion workflow.',409)
    if CompletedProject.objects.filter(project=project).exists():raise Problem('Completed project evidence is locked.',409)
    if not project.steps or len(verified_photo_steps(project))!=len(project.steps):raise Problem('Complete the required evidence and confirmation for every project step before submitting the finished product.',409)
    if request.content_type=='application/json':
        saved=project.final_assessments.filter(pk=integer(body(request).get('recheck_assessment_id'))).first()
        if not saved:raise Problem('Final-product evidence not found.',404)
        if saved.assessment.get('verdict')!='unable_to_assess' or saved.assessment.get('status')=='available':raise Problem('Submit a new view showing the requested improvement.',409)
        with saved.image.open('rb') as source:image=oriented_image(source.read())
        digest=saved.digest
    else:
        image=picture(request);digest=hashlib.sha256(jpeg_bytes(image)).hexdigest()
    if StepPhoto.objects.filter(project__user=request.actor,digest=digest).exists():raise Problem('Take a separate whole-product photo; this image was used as step evidence.',409)
    if FinalProductAssessment.objects.filter(project__user=request.actor,digest=digest).exclude(project=project).exists():raise Problem('Show this finished project; the image was used in another project.',409)
    existing=project.final_assessments.filter(digest=digest).first()
    if existing and existing.assessment.get('status')=='available':return {'project':project_row(project)}
    assessment=confirmation('project_final',request.POST.get('final_confirmed')=='true') if human_project(project) else assess_final(image,project,
        previous_photos=list(project.step_photos.filter(status='ai_matches').values('id','step_index','image')),
        additional_final_views=list(project.final_assessments.values('id','image')))
    if existing:
        existing.assessment=assessment;existing.save(update_fields=['assessment'])
    else:
        row=FinalProductAssessment(project=project,digest=digest,assessment=assessment)
        save_image(row.image,image)
        try:row.save()
        except Exception:row.image.delete(save=False);raise
    return {'project':project_row(project)}


@endpoint(['GET','POST'])
@transaction.atomic
def completions(request):
    if request.method=='POST':
        value=body(request)
        project=UserProject.objects.select_for_update().filter(pk=value.get('project_id'),user=request.actor).first()
        if not project:raise Problem('Project not found.',404)
        existing=CompletedProject.objects.filter(project=project).first()
        if existing:return {'completion':completion_row(existing),'project':project_row(project)}
        if not project.steps or len(verified_photo_steps(project))!=len(project.steps):raise Problem('Every step needs its required photo and confirmation before saving the finished project.')
        from .verification import strict,VERSION as VERIFICATION_VERSION
        final=None
        if human_project(project):
            final=project.final_assessments.first()
            if not final or final.assessment.get('verdict')!='user_confirmed' or final.assessment.get('confirmation_version')!='human-confirmation-v1':
                raise Problem('Submit a new whole-product photo and explicitly confirm your own inspection before completion.',409)
        elif strict(project):
            final=project.final_assessments.first()
            if not final or final.assessment.get('verdict')!='meets_requirements' or not final.assessment.get('validated') or final.assessment.get('verification_version')!=VERIFICATION_VERSION:
                raise Problem('A separate finished-product assessment must meet the visible project requirements before completion.',409)
        photo=final or project.step_photos.filter(step_index=len(project.steps)-1,status='ai_matches').first()
        if not photo:raise Problem('A finished-output photo is required. Complete this project through the photo workflow.')
        usage=value.get('usage',[])
        if not isinstance(usage,list) or len(usage)>100:raise Problem('Use a list of material quantities.')
        lots={}
        for item in usage:
            if not isinstance(item,dict):raise Problem('Invalid material usage.')
            qty=integer(item.get('quantity'));lot_id=integer(item.get('lot_id'))
            if lot_id in lots:raise Problem('List each collection record once.')
            lot=InventoryLot.objects.select_for_update().filter(pk=lot_id,user=request.actor).first()
            if not lot or qty>lot.quantity-lot.consumed:raise Problem('Insufficient collected material. Refresh your inventory.',409)
            lots[lot_id]=(lot,qty)
        materials=value.get('materials',[])
        if not isinstance(materials,list) or not 1<=len(materials)<=100:raise Problem('List the materials and quantities actually used.')
        for material in materials:
            if not isinstance(material,dict) or not text(material.get('name',''),160):raise Problem('Each material needs a name.')
            integer(material.get('quantity'))
        completed_at=parse_datetime(value['completed_at']) if value.get('completed_at') else timezone.now()
        if not completed_at or timezone.is_naive(completed_at) or completed_at>timezone.now():raise Problem('Use a valid completion time with timezone, not a future date.')
        name=text(value.get('name',project.title),160)
        if not name:raise Problem('Provide a project name.')
        row=CompletedProject(project=project,user=request.actor,name=name,materials=materials,
                             description=text(value.get('description','')),feedback=text(value.get('feedback','')),completed_at=completed_at,
                             final_assessment=final.assessment if final else {},
                             verification_status='user_confirmed' if human_project(project) else 'ai_checked' if all(project.step_photos.filter(step_index=i,status='ai_matches').exists() for i in range(len(project.steps))) else 'photo_documented')
        with photo.image.open('rb') as source:row.image.save(uuid4().hex+'.jpg',ContentFile(source.read()),save=False)
        try:row.save()
        except Exception:row.image.delete(save=False);raise
        for lot,qty in lots.values():
            MaterialUsage.objects.create(completion=row,lot=lot,quantity=qty)
            lot.consumed+=qty;lot.save(update_fields=['consumed','updated_at'])
        return {'completion':completion_row(row),'project':project_row(project)}
    return {'completions':[completion_row(row) for row in CompletedProject.objects.filter(user=request.actor).select_related('project').order_by('-completed_at')]}

def program_row(p):
    return {'id':p.pk,'organization_id':p.organization_id,'organization':p.organization.name,'title':p.title,'description':p.description,'eligibility':p.eligibility,
            'guidelines':p.guidelines,'accepted_materials':p.accepted_materials,'criteria':p.criteria,'starts_at':p.starts_at.isoformat(),'ends_at':p.ends_at.isoformat(),'awards':p.awards,'status':p.status}

def submission_row(row):
    return {'id':row.pk,'program_id':row.program_id,'project':completion_row(row.completion),'program':row.snapshot,'status':row.status,
            'scores':row.scores,'feedback':row.feedback,'recognition':row.recognition,'reviewer':row.reviewer.get_full_name() or row.reviewer.username if row.reviewer else None,
            'total':sum(row.scores.values()) if row.status=='rated' else None,'submitted_at':row.submitted_at.isoformat()}

@endpoint(['GET'])
def community(request):
    now=timezone.now()
    membership=Membership.objects.filter(user=request.actor,organization__active=True).select_related('organization')
    return {'programs':[program_row(p) for p in Program.objects.filter(status='published',organization__active=True,starts_at__lte=now,ends_at__gte=now).select_related('organization')],
            'review_programs':[program_row(p) for p in Program.objects.filter(organization__memberships__user=request.actor,organization__active=True).exclude(status='draft').select_related('organization').distinct()],
            'memberships':[{'organization_id':m.organization_id,'name':m.organization.name,'role':m.role} for m in membership],
            'submissions':[submission_row(s) for s in Submission.objects.filter(completion__user=request.actor).select_related('completion','reviewer')]}

@endpoint(['GET','POST'])
@transaction.atomic
def program_submissions(request,program_id):
    program=Program.objects.select_for_update().select_related('organization').filter(pk=program_id,organization__active=True).first()
    if not program:raise Problem('Program not found.',404)
    member=Membership.objects.filter(user=request.actor,organization=program.organization).exists()
    if request.method=='GET':
        if not member:raise Problem('Organization reviewer access required.',403)
        return {'submissions':[submission_row(s) for s in program.submissions.select_related('completion','reviewer')]}
    value=body(request)
    if value.get('eligibility_confirmed') is not True:raise Problem('Confirm that you meet the published eligibility and submission requirements.')
    now=timezone.now()
    if program.status!='published' or not program.starts_at<=now<=program.ends_at:raise Problem('Program is not open.',409)
    completion=owned(CompletedProject,request.actor,value.get('completion_id'))
    labels={u.lot.material for u in completion.usage.select_related('lot')}
    label=completion.project.reference.get('material_label')
    if label:labels.add(label)
    if program.accepted_materials and (not labels or not labels.issubset(set(program.accepted_materials))):raise Problem('Recorded project materials do not meet this program’s accepted categories.')
    row,_=Submission.objects.get_or_create(program=program,completion=completion,defaults={'snapshot':program_row(program)})
    return {'submission':submission_row(row)}

@endpoint(['PATCH'])
@transaction.atomic
def review_submission(request,submission_id):
    row=Submission.objects.select_for_update().select_related('completion','program','reviewer').filter(pk=submission_id).first()
    if not row:raise Problem('Submission not found.',404)
    if not Membership.objects.filter(user=request.actor,organization=row.program.organization,organization__active=True).exists():raise Problem('Organization reviewer access required.',403)
    if row.completion.user_id==request.actor.pk:raise Problem('You cannot review your own submission.',403)
    if row.status!='submitted':raise Problem('This official review is already recorded.',409)
    value=body(request);status=value.get('status')
    if status not in {'rated','rejected'}:raise Problem('Choose rated or rejected.')
    scores=value.get('scores',{})
    if status=='rated':
        criteria=row.snapshot['criteria']
        if not isinstance(scores,dict) or set(scores)!={c['name'] for c in criteria}:raise Problem('Score each published criterion exactly once.')
        for criterion in criteria:integer(scores[criterion['name']],0,criterion['maximum'])
    feedback=text(value.get('feedback',''))
    if not feedback:raise Problem('Provide feedback explaining the review.')
    row.status=status;row.scores=scores if status=='rated' else {};row.feedback=feedback
    row.recognition=text(value.get('recognition',''),160);row.reviewer=request.actor;row.reviewed_at=timezone.now();row.save()
    return {'submission':submission_row(row)}

def media(request,kind,pk):
    user=user_from_request(request)
    if not user and request.user.is_authenticated:user=request.user
    if not user or not user.is_active:return JsonResponse({'detail':'Authentication required.'},status=401)
    model={'view':AdditionalView,'step':StepPhoto,'final':FinalProductAssessment,'completion':CompletedProject}.get(kind)
    row=model.objects.filter(pk=pk).first() if model else None
    owner=(row.prediction.user_id if kind=='view' else row.project.user_id if kind in {'step','final'} else row.user_id) if row else None
    allowed=owner==user.pk
    if row and kind=='completion' and not allowed:
        allowed=Submission.objects.filter(completion=row,program__organization__memberships__user=user,program__organization__active=True).exists()
    if not row or not row.image or not(allowed or user.is_superuser):return JsonResponse({'detail':'Photo not found.'},status=404)
    response=FileResponse(row.image.open('rb'),content_type='image/jpeg');response['Cache-Control']='private, no-store'
    return response
