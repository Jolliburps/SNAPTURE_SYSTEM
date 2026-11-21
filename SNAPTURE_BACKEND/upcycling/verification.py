"""Fail-closed project evidence checks against immutable, sourced criteria.

Deployment validation metadata enables a purpose; it is not itself an accuracy
claim. No built-in model can verify craft steps or final products.
"""
import logging
from django.conf import settings
from django.utils.module_loading import import_string

VERSION = 'project-verification-v1'


def strict(project):
    from .workflow import VERSION as CAMERA_VERSION
    return project.reference.get('workflow_version') == CAMERA_VERSION


def step_criteria(project):
    if not project.reference.get('suitability_requirements_source'):
        return []
    values = project.reference.get('suitability_requirements', {}).get('checkpoint_criteria', [])
    if (not isinstance(values, list) or len(values) != len(project.steps) or not values
            or any(not isinstance(v, str) or not v.strip() for v in values)):
        return []
    return [{'id': f'step_{i}', 'instruction': value.strip()} for i, value in enumerate(values)]


def approval(purpose):
    adapter = getattr(settings, 'SNAPTURE_VISUAL_ASSESSOR', '')
    value = getattr(settings, 'SNAPTURE_VISUAL_ASSESSOR_VALIDATION', {})
    return value if (adapter and isinstance(value, dict) and
                     isinstance(value.get('model'), str) and value['model'].strip() and
                     isinstance(value.get('purposes'),list) and purpose in value['purposes'] and
                     isinstance(value.get('evidence_source'), str) and value['evidence_source'].strip()) else None


def capabilities(project):
    available = bool(step_criteria(project) and approval('project_step'))
    final_available=bool(final_criteria(project) and approval('project_final'))
    return {'step_available': available, 'final_available': final_available,
            'manual_confirmation_available': manual_confirmation_available(project, available, final_available),
            'final_reason':'' if final_available else 'Separate final-product checking requires sourced final criteria and an approved project_final assessor.',
            'reason': '' if available else 'Validated step checking and complete project-specific checkpoint criteria are required. Photos cannot certify strength or safety.'}


def manual_confirmation_available(project, step_available, final_available):
    from .workflow import inspection_first
    return bool(
        (not step_available or not final_available)
        and strict(project) and project.reference.get('photo_workflow')
        and project.source_prediction_id and inspection_first(project.source_prediction)
        and step_criteria(project) and final_criteria(project)
    )


def final_criteria(project):
    values=project.reference.get('suitability_requirements',{}).get('final_criteria',[])
    if (not project.reference.get('suitability_requirements_source') or not isinstance(values,list) or not values
            or any(not isinstance(v,str) or not v.strip() for v in values)):
        return []
    return [{'id':f'final_{i}','instruction':value.strip()} for i,value in enumerate(values)]


def check(image, project, purpose, criteria, **context):
    """Validate the entire adapter response; derive success server-side."""
    pending = {'status': 'unavailable', 'validated': False, 'verdict': 'unable_to_verify',
               'feedback': 'Automatic verification is unavailable. This evidence does not unlock the next step.',
               'criteria': [], 'schema_version': 1, 'purpose': purpose}
    authorized = approval(purpose)
    if not authorized or not criteria:
        return pending
    try:
        raw = import_string(settings.SNAPTURE_VISUAL_ASSESSOR)(
            image=image, purpose=purpose, criteria=criteria,
            project_title=project.title, project_steps=list(project.steps), **context)
        if not isinstance(raw, dict) or type(raw.get('schema_version')) is not int or raw['schema_version'] != 1 or raw.get('purpose') != purpose or raw.get('model') != authorized['model']:
            raise ValueError('Invalid verification identity or schema.')
        quality = raw.get('quality')
        if not isinstance(quality, dict) or type(quality.get('usable')) is not bool or not isinstance(quality.get('guidance'), str):
            raise ValueError('Missing image quality guidance.')
        feedback = raw.get('feedback')
        if not isinstance(feedback, str) or not feedback.strip():
            raise ValueError('Missing evidence feedback.')
        rows = raw.get('criteria')
        if not isinstance(rows, list) or len(rows) != len(criteria):
            raise ValueError('Incomplete criterion results.')
        expected = {row['id'] for row in criteria}
        seen = set()
        cleaned = []
        for row in rows:
            allowed={'met','unmet','not_assessable'} | ({'missing'} if purpose=='project_final' else set())
            if not isinstance(row, dict) or row.get('id') not in expected or row['id'] in seen or row.get('status') not in allowed or not isinstance(row.get('evidence'), str) or not row['evidence'].strip():
                raise ValueError('Invalid criterion evidence.')
            seen.add(row['id'])
            cleaned.append({'id': row['id'], 'status': row['status'], 'evidence': row['evidence'][:1500]})
        verdict = ('retake' if not quality['usable'] else
                   'unable_to_verify' if any(row['status'] == 'not_assessable' for row in cleaned) else
                   'needs_correction' if any(row['status'] in {'unmet','missing'} for row in cleaned) else 'verified')
        return {'status': 'available', 'validated': True, 'verdict': verdict,
                'feedback': (quality['guidance'] if not quality['usable'] and quality['guidance'].strip() else feedback)[:2000],
                'criteria': cleaned, 'model': raw['model'], 'validation_reference': authorized['evidence_source'],
                'quality': quality, 'schema_version': 1, 'purpose': purpose, 'verification_version': VERSION}
    except Exception:
        logging.getLogger(__name__).exception('Project verification failed closed')
        return {**pending, 'feedback': 'The checker did not return complete, valid evidence. Adjust the view or retry later; progress remains unchanged.'}


def assess_final(image, project, **context):
    result=check(image,project,'project_final',final_criteria(project),**context)
    code={'verified':'meets_requirements','needs_correction':'needs_improvement'}.get(result['verdict'],'unable_to_assess')
    if code=='needs_improvement' and any(c['status']=='missing' for c in result['criteria']):code='incomplete'
    titles={'meets_requirements':'Meets Visible Project Requirements','needs_improvement':'Needs Improvement',
            'incomplete':'Incomplete','unable_to_assess':'Unable to Assess'}
    feedback=result['feedback'] if result['status']=='available' else 'Final-product checking is unavailable or incomplete. The project remains In Progress. Sourced final criteria and a validated assessor are required.'
    return {**result,'verdict':code,'title':titles[code],'feedback':feedback,
            'limits':'Visible criteria only; not certification of strength, functionality or safety.'}
