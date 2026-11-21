"""Explicit human-confirmed workflow, separate from validated AI assessment.

This path documents a user's inspection and work. It never publishes unreviewed
requirements, invents a physical limit, or returns AI verification.
"""
from copy import deepcopy
from core.recommendations import CATALOG

MODE = 'human_assisted'
ALLOWED = {'paper': 'paper_craft', 'cardboard': 'cardboard_craft'}
NOTICE = 'Human-assisted mode: inspection and completion are user-confirmed, not AI-verified or certified safe.'


def enabled(record):
    from .workflow import enabled as camera_enabled
    details = (record.image_quality or {}).get('scan_details') or {}
    return camera_enabled(record) and details.get('assessment_mode') == MODE and details.get('human_assisted_acknowledged') is True


def project_enabled(project):
    from .workflow import VERSION
    return project.reference.get('workflow_version') == VERSION and (
        project.reference.get('assessment_mode') == MODE or project.reference.get('verification_mode') == MODE
    )


def verdict(record, projects=None):
    from .assessment import facts_for
    from .matching import safety_block
    from .workflow import material_review
    facts = facts_for(record)
    quality = record.image_quality or {}
    state = quality.get('workflow') or {}
    def result(code, title, reason, action):
        return {'code': code, 'title': title, 'reason': reason, 'next_action': action,
                'can_start': code == 'suitable', 'blocking_reasons': [] if code == 'suitable' else [reason],
                'basis': 'user_confirmed', 'ai_verified': False}
    hazard = safety_block(record, facts)
    evidence = [quality.get('visual_assessment') or {}, *[v.observations.get('condition', {}) for v in (record.additional_views.all() if record.pk else [])]]
    concerning = {'mold','mould','suspected mold','oil','chemical contamination','mold or biological waste','oil or grease'}
    if hazard or state.get('hazard_history') or facts.get('moisture_cause') in {'Oil','Chemical'} or any(
        o.get('field') == 'visible_contamination' and o.get('value','').lower() in concerning
        for e in evidence for o in e.get('observations', []) if o.get('certainty') == 'clear'):
        return result('for_disposal','For Disposal / Special Handling',hazard or 'Reported exposure or concerning visual evidence excludes this material.', 'Do not use it; obtain appropriate separate-handling advice.')
    review = material_review(record, facts)
    if review:
        return result('unsupported', *review)
    reassessment=state.get('reassessment_view_id')
    latest=record.additional_views.filter(pk=reassessment).first() if reassessment and record.pk else None
    if latest:evidence=[latest.observations.get('condition',{})]
    wet = any(o.get('field') == 'wet_appearance' and o.get('value','').lower() in {'wet','damp','visible moisture','yes'} for e in evidence for o in e.get('observations',[]) if o.get('certainty') == 'clear')
    dirt = any(o.get('field')=='visible_contamination' and o.get('value','').lower() in {'ordinary dirt','removable dirt','dirt','dust'} for e in evidence for o in e.get('observations',[]) if o.get('certainty')=='clear')
    if facts.get('moisture_cause') == 'Unknown':
        return result('assessment_pending','Assessment Pending','The cause of moisture is unresolved.', 'Do not use questionable material; clarify its exposure history.')
    if facts.get('condition') == 'Needs cleaning' or wet or dirt or (state.get('preparation_required') and not (state.get('preparation_completed') and state.get('reassessed'))) or (facts.get('moisture_cause') == 'Water' and not (state.get('preparation_completed') and state.get('reassessed'))):
        return result('requires_preparation','Requires Preparation','Preparation and a fresh inspection are required.', 'Clean/dry only appropriate material, submit updated evidence, and inspect it again. Hazardous history remains blocked.')
    if record.decision not in ALLOWED:
        return result('no_suitable_project','No Suitable Project Available','The human-assisted path currently supports only the paper and cardboard craft activities.', 'Use the assessed workflow for other materials; do not treat missing activities as disposal advice.')
    if facts.get('condition') not in {'Clean and dry','Torn or crumpled, clean and dry','Clean dry usable scraps'}:
        return result('assessment_pending','Assessment Pending','The usable portions must be reported clean and dry.', 'Inspect the remaining portions. Significant damage requires project-specific advice; do not guess suitability.')
    if facts.get('previous_contents') not in {'No chemical contact known','Water or beverage','Food or oil'}:
        return result('assessment_pending','Assessment Pending','Known material history is missing.', 'Confirm previous contents and known exposure; appearance does not establish chemical history.')
    if not state.get('human_condition_confirmed'):
        return result('assessment_pending','Assessment Pending','Your condition inspection has not been confirmed.', 'Confirm your own inspection. This is not an AI assessment.')
    if not state.get('safety_acknowledged') or not state.get('inspection_confirmed') or state.get('usable_quantity') is None:
        return result('assessment_pending','Assessment Pending','Inspection, safety acknowledgment, and usable quantity are required.', 'Read the notice, inspect every piece, and record the usable quantity.')
    if not state['usable_quantity']:
        return result('no_suitable_project','No Suitable Project Available','No usable pieces remain.', 'Separate questionable pieces and seek appropriate material guidance.')
    if projects is not None and not any(p.get('can_start') for p in projects):
        return result('assessment_pending','Assessment Pending','Confirm the selected craft requirements.', 'Check tools, additional materials, and that the inspected pieces suit your chosen design.')
    return result('suitable','Suitable based on your inspection',NOTICE, 'Proceed only with the inspected pieces and suitable tools; retain photos as documentation.')


def suggestions(record):
    from .assessment import facts_for
    facts = facts_for(record)
    rows = []
    for idea in CATALOG.get(record.decision, []):
        if idea['id'] != ALLOWED.get(record.decision):
            continue
        checks = facts.get('project_checks', {}).get(idea['id'], {})
        missing = [f'{name.replace("_", " ")} confirmation' for name in ('tools','additional_materials','safety') if checks.get(name) is not True]
        specification = {
            'minimum_quantity': 1, 'dimensions': {},
            'conditions':['Clean and dry','Torn or crumpled, clean and dry','Clean dry usable scraps'],
            'tools':['Use suitable craft tools and seek supervision where cutting is required.'],
            'additional_materials':deepcopy(idea['materials']),
            'safety':['Inspect all usable portions; exclude mold, suspicious contamination and chemical exposure. Confirm remaining pieces fit your own chosen design; no physical dimensions or strength are certified.'],
            'checkpoint_criteria':deepcopy(idea['steps']),
            'final_criteria':['Confirm that your finished craft follows the chosen design and catalog instructions.'],
        }
        rows.append({**deepcopy(idea),'basis':'human_assisted_catalog','status':'needs_information' if missing else 'suitable',
                     'preliminary':bool(missing),'can_start':not missing,'missing_information':missing,
                     'reasons':[NOTICE],'requirements':specification,'available_quantity':record.quantity,
                     'additional_quantity':0 if record.quantity else 1,
                     'requirements_source':'SNAPTURE built-in educational catalog; user-chosen craft design. Not expert-reviewed physical requirements.',
                     'assessment_mode':MODE})
    decision = verdict(record, rows)
    if decision['code']=='for_disposal' or facts.get('material_scope_report')=='out_of_scope':
        rows=[]
    if not decision['can_start']:
        for row in rows:
            row.update(can_start=False,preliminary=True)
    return {'items':rows,'facts':facts,'fact_sources':{key:'user_reported' for key in facts},
            'outcome':'suitable' if decision['can_start'] else 'needs_information' if rows else 'no_suitable_project',
            'message':decision['reason'],'verdict':decision,'assessment_feedback':[],
            'assessment_mode':MODE,'ai_verified':False}


def confirmation(purpose, confirmed):
    """A user statement, never a model inference or reviewer endorsement."""
    return {'status':'documented','validated':False,'ai_verified':False,'basis':'user_confirmed',
            'verdict':'user_confirmed' if confirmed else 'awaiting_user_confirmation',
            'title':'Photo documented - user confirmed' if confirmed else 'Photo documented - confirmation needed',
            'feedback':NOTICE if confirmed else 'Review your photographed work and explicitly confirm the instruction was followed.',
            'criteria':[],'purpose':purpose,'confirmation_version':'human-confirmation-v1'}


def condition_record(record,image,**context):
    if enabled(record):return {'status':'documented','validated':False,'basis':'user_reported','observations':[],'message':NOTICE}
    from .workflow import enabled as camera_enabled
    from .verification import approval
    if camera_enabled(record) and not approval('condition'):
        return {'status':'unavailable','validated':False,'observations':[],
                'message':'Automatic condition assessment is pending until a validated checker is available.'}
    from .assessment import observe
    return observe(image,**context)
