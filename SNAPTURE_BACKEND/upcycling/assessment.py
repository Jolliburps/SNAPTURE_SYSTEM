"""Explicitly sourced facts; visual model absence never becomes a clean bill."""
import logging
from django.conf import settings
from django.utils.module_loading import import_string

VISIBLE={'damage','deformation','wet_appearance','visible_contamination','shape','usable_portions','structural_appearance'}
USER_FIELDS=VISIBLE | {'condition','previous_contents','wood_treatment','resin_mark','object_type','quantity','goal','dimensions','project_checks','moisture_cause','safety_acknowledged','inspection_confirmed','usable_quantity','preparation_completed','human_condition_confirmed','material_scope_report'}


def comparable_observation_values(field, values):
    values = set(values)
    # A close-up can show a portion of the same item that an overview shows in full.
    if field == 'usable_portions' and values == {'whole item visible', 'partial portions visible'}:
        return {'whole item visible'}
    return values


def observe(image, **context):
    adapter=getattr(settings,'SNAPTURE_VISUAL_ASSESSOR','')
    if not adapter:return {'status':'unavailable','observations':[], 'message':'Visual condition assessment is unavailable. Confirm the relevant details.'}
    try:
        result=import_string(adapter)(image=image,**context)
        if not isinstance(result,dict) or not isinstance(result.get('model'),str) or not result['model'].strip():raise ValueError('Missing model identity')
        observations=result.get('observations',[])
        if not isinstance(observations,list):raise ValueError('Invalid observations')
        cleaned=[]
        for item in observations:
            if not isinstance(item,dict) or item.get('field') not in VISIBLE or not isinstance(item.get('value'),str):raise ValueError('Unsupported visual claim')
            cleaned.append({'field':item['field'],'value':item['value'][:160],'source':'ai_observed','model':result['model'][:160],'certainty':item.get('certainty') if item.get('certainty') in {'clear','uncertain'} else 'uncertain', 'evidence':str(item.get('evidence',''))[:1500]})
        approval=getattr(settings,'SNAPTURE_VISUAL_ASSESSOR_VALIDATION',{})
        validated=isinstance(approval,dict) and approval.get('model')==result['model'] and context.get('purpose') in approval.get('purposes',[]) and bool(approval.get('evidence_source'))
        output={'status':'available','observations':cleaned,'model':result['model'][:160],'validated':validated,'validation_reference':approval.get('evidence_source') if validated else None}
        if context.get('purpose')=='project_step':
            output['step_status']=result.get('step_status') if result.get('step_status') in {'matches','needs_correction','retake'} else 'retake'
            feedback=result.get('feedback')
            if not isinstance(feedback,str) or not feedback.strip():
                output['step_status']='retake';feedback='The visual checker did not provide usable evidence feedback. Take another photo or retry later.'
            output['feedback']=feedback[:1000]
        return output
    except Exception:
        logging.getLogger(__name__).exception('Visual assessor unavailable')
        return {'status':'unavailable','observations':[],'message':'Visual checking failed. No condition was assumed.'}

def validate_facts(value):
    if not isinstance(value,dict) or set(value)-USER_FIELDS:raise ValueError('Use supported assessment fields.')
    result={}
    for key,item in value.items():
        if key in {'safety_acknowledged','inspection_confirmed','preparation_completed','human_condition_confirmed'}:
            if type(item) is not bool:raise ValueError('Use true or false for confirmations.')
            result[key]={'value':item,'source':'user_confirmed'}
        elif key=='usable_quantity':
            if type(item) is not int or not 0<=item<=100000:raise ValueError('Usable quantity must be a whole number from 0 to 100000.')
            result[key]={'value':item,'source':'user_confirmed'}
        elif key=='material_scope_report':
            if item not in ('glass','metal','out_of_scope'):raise ValueError('Choose glass, metal, or another out-of-scope item.')
            result[key]={'value':item,'source':'user_reported'}
        elif key=='moisture_cause':
            if item not in {'Water','Oil','Chemical','Unknown'}:raise ValueError('Choose a known moisture cause or Unknown.')
            result[key]={'value':item,'source':'user_reported'}
        elif key=='project_checks':
            if not isinstance(item,dict) or len(item)>100:raise ValueError('Invalid project confirmations.')
            for project,checks in item.items():
                if not isinstance(project,str) or len(project)>160 or not isinstance(checks,dict) or set(checks)-{'tools','additional_materials','safety'} or any(type(v) is not bool for v in checks.values()):raise ValueError('Invalid project confirmations.')
            result[key]={'value':item,'source':'user_confirmed'}
        elif key=='dimensions':
            if not isinstance(item,dict) or set(item)-{'length','width','height','diameter','thickness','capacity'}:raise ValueError('Use supported dimensions in millimeters or capacity in milliliters.')
            if any(type(v) not in (int,float) or not 0<v<100000 for v in item.values()):raise ValueError('Measurements must be finite, positive millimeter values.')
            result[key]={'value':item,'source':'user_provided_measurement'}
        elif key=='quantity':
            if type(item) is not int or not 1<=item<=100000:raise ValueError('Quantity must be a whole number from 1 to 100000.')
            result[key]={'value':item,'source':'user_confirmed'}
        else:
            if not isinstance(item,str) or len(item)>160:raise ValueError('Assessment answers must be text under 160 characters.')
            if key=='condition':
                from core.assessment import CONDITIONS
                if item not in [*CONDITIONS,'Torn or crumpled, clean and dry','Clean dry usable scraps']:raise ValueError('Choose a listed condition.')
            if key=='previous_contents':
                from core.assessment import CONTENTS
                if item not in CONTENTS:raise ValueError('Choose a listed previous-contents answer.')
            result[key]={'value':item.strip(),'source':'user_confirmed'}
    return result

def facts_for(record):
    stored=(record.answers or {}).get('suitability_facts',{})
    facts={key:row['value'] for key,row in stored.items() if isinstance(row,dict) and 'value' in row}
    facts['condition']=record.condition
    facts['previous_contents']=record.previous_contents
    for key in ('wood_treatment','resin_mark'):
        if key in (record.answers or {}):facts[key]=record.answers[key]
    facts['quantity']=record.quantity
    item=getattr(record,'scene_item',None)
    if ('object_type' not in facts and item and (record.image_quality or {}).get('detection_filter',{}).get('status')=='accepted'
            and (record.image_quality or {}).get('object_source')!='whole_image_classifier'):
        facts['object_type']=item.name
    observations=[*(record.image_quality or {}).get('visual_assessment',{}).get('observations',[])]
    for view in (record.additional_views.all() if record.pk else []):observations.extend(view.observations.get('condition',{}).get('observations',[]))
    from .workflow import enabled, inspection_first
    if enabled(record):
        for field in VISIBLE - {'shape'}:facts.pop(field,None)
        views=list(record.additional_views.all()) if record.pk else []
        evidence=[(record.image_quality or {}).get('visual_assessment',{}),*[v.observations.get('condition',{}) for v in views]]
        reassessment=(record.image_quality or {}).get('workflow',{}).get('reassessment_view_id')
        latest=next((v for v in views if v.pk==reassessment),None)
        if latest:evidence=[latest.observations.get('condition',{})]
        observations=[o for e in evidence if e.get('status')=='available' and e.get('validated') for o in e.get('observations',[])]
    for field in VISIBLE:
        rows=[r for r in observations if r.get('field')==field]
        if field not in facts and rows and all(r.get('certainty')=='clear' for r in rows):
            values=comparable_observation_values(field,(r.get('value') for r in rows))
            if len(values)==1:
                facts[field]=next(iter(values))
    details = (record.image_quality or {}).get('scan_details') or {}
    if details.get('inspection_report') and record.condition!='Moldy or contaminated':
        # A user's absence report records an inspection, not a model observation.
        facts['condition']=''
        if facts.get('wet_appearance')=='dry' and facts.get('visible_contamination')=='none visible':
            damage=facts.get('damage')
            deformation=facts.get('deformation')
            structure=facts.get('structural_appearance')
            if damage=='major damage' or deformation=='deformed' or structure=='damaged appearance':
                facts['condition']='Damaged or cracked'
            elif structure=='intact appearance' and (damage=='minor tears or creases' or deformation=='creased'):
                facts['condition']='Torn or crumpled, clean and dry'
            elif damage=='none visible' and deformation=='none visible' and structure=='intact appearance':
                facts['condition']='Clean and dry'
        if inspection_first(record) and not facts['condition']:
            if details['inspection_report']=='none_seen':
                facts.update(condition='Clean and dry',inspection_condition_basis='user_reported')
            elif details.get('reported_concern')=='minor_damage':
                facts.update(condition='Torn or crumpled, clean and dry',inspection_condition_basis='user_reported')
    return facts

def visual_summary(record):
    primary=(record.image_quality or {}).get('visual_assessment',{'status':'not_assessed','observations':[]})
    views=list(record.additional_views.all())
    observations=[*primary.get('observations',[])]
    conflicts=[]
    view_warnings={}
    from .workflow import MATERIAL_RULE, accepted_material
    material=(record.image_quality or {}).get('material_prediction',{})
    primary_label=accepted_material((record.image_quality or {}).get('primary_material_prediction',{}))
    for view in views:
        observations.extend(view.observations.get('condition',{}).get('observations',[]))
        material_view=view.observations.get('material',{})
        if view.observations.get('purpose')=='closeup':continue
        if material.get('combination_rule')==MATERIAL_RULE:
            label=accepted_material(material_view)
            different=bool(label and primary_label and label!=primary_label)
        else:
            different=material_view.get('label') not in {None,record.decision}
        if different:
            warning=f'{view.view.title()} view has a different or uncertain material suggestion.'
            conflicts.append(warning)
            view_warnings[view.pk]=[warning]
    values={}
    for row in observations:values.setdefault(row['field'],set()).add(row['value'])
    conflicts.extend(f'Conflicting {key.replace("_"," ")} observations.' for key,items in values.items()
                     if len(comparable_observation_values(key,items))>1)
    photos=(record.image_quality or {}).get('result_snapshot',{}).get('photos',[])
    primary_view=photos[0].get('view') if photos else None
    from .workflow import inspection_first, verdict
    condition_evidence=[primary,*[v.observations.get('condition',{}) for v in views if v.observations.get('purpose')!='interior']]
    if inspection_first(record) and not ((record.image_quality or {}).get('scan_details') or {}).get('capture_mode'):
        condition_evidence=[v.observations.get('condition',{}) for v in views if v.observations.get('purpose')=='closeup']
    reassessment=(record.image_quality or {}).get('workflow',{}).get('reassessment_view_id')
    latest=next((v for v in views if v.pk==reassessment),None)
    if latest:condition_evidence=[latest.observations.get('condition',{})]
    required={'damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'}
    condition_available=bool(condition_evidence) and all(e.get('status')=='available' and e.get('validated') and required.issubset({o.get('field') for o in e.get('observations',[]) if o.get('certainty')=='clear'}) for e in condition_evidence)
    from .human_assisted import enabled as human_enabled
    return {'human_assisted':human_enabled(record),'verdict':verdict(record),'scan_details':record.image_quality.get('scan_details'),
            'workflow':record.image_quality.get('workflow',{}),'capability':{'condition_assessment':'available' if condition_available else 'unavailable'},
            'primary':primary,'primary_view':primary_view,'observations':observations,'conflicts':conflicts,
            'views':[{'id':v.pk,'view':'close-up' if v.observations.get('purpose')=='closeup' else v.view,'image_url':f'/api/upcycling/media/view/{v.pk}/' if v.image else None,'same_item_confirmed':v.same_item_confirmed,'observations':v.observations,'warnings':view_warnings.get(v.pk,[])} for v in views],
            'facts':(record.answers or {}).get('suitability_facts',{}),
            'limits':'Appearance cannot establish chemical history, treatment, strength, or exact physical dimensions.'}


def verified_photo_steps(project):
    """Consecutive evidence must satisfy its project's explicit verification mode."""
    from .verification import strict, VERSION
    from .human_assisted import project_enabled
    if project_enabled(project):
        matched=set(project.step_photos.filter(assessment__basis='user_confirmed',assessment__verdict='user_confirmed',assessment__confirmation_version='human-confirmation-v1').values_list('step_index',flat=True))
        if project.reference.get('verification_mode'):
            matched.update(project.step_photos.filter(
                status='ai_matches', assessment__verification_version=VERSION,
                assessment__validated=True, assessment__verdict='verified',
            ).values_list('step_index', flat=True))
        result=[]
        for index in range(len(project.steps)):
            if index not in matched:break
            result.append(index)
        return result
    evidence=project.step_photos.filter(status='ai_matches')
    if strict(project):
        evidence=evidence.filter(assessment__verification_version=VERSION,assessment__validated=True,assessment__verdict='verified')
    matched=set(evidence.values_list('step_index',flat=True))
    result=[]
    for index in range(len(project.steps)):
        if index not in matched:break
        result.append(index)
    return result
