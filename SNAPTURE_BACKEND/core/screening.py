"""Project-independent screening and transport redaction; never generate ideas."""
from copy import deepcopy

VERSION = 'screening-v1'
PROJECT_ARRAYS = {'recommendations', 'recommendation_choices', 'suggested_ideas',
                  'upcycling_ideas', 'upcycle_ideas', 'projects'}


def without_projects(value):
    if isinstance(value, dict):
        result = {key: ([] if key in PROJECT_ARRAYS else without_projects(item))
                  for key, item in value.items() if key != 'recommendation_request'}
        # Historical reference snapshots can also contain concrete reuse ideas.
        guidance = result.get('management_guidance')
        if isinstance(guidance, dict):
            guidance['sections'] = [section for section in guidance.get('sections', [])
                                    if section.get('key') != 'recovery']
        return result
    if isinstance(value, list):
        return [without_projects(item) for item in value]
    return deepcopy(value)


def evaluate(record, material, pending, reasons):
    from upcycling.workflow import enabled,verdict
    if enabled(record):
        decision=verdict(record)
        status={'suitable':'eligible','requires_preparation':'needs_preparation','unsupported':'unsupported','for_disposal':'ineligible'}.get(decision['code'],'needs_information')
        return {'version':'camera-assessment-v2','status':status,'eligible':decision['can_start'],
                'reasons':[decision['reason']],'missing_information':decision['blocking_reasons']}

    from .assessment import WOOD, CONTENTS
    from .waste_taxonomy import FINE_CLASSES
    from .materials import SCOPE_LABELS
    from predictions.disposal_workflow import special_kind
    answers = record.answers or {}
    missing = list(pending)
    if record.previous_contents not in CONTENTS[:3]: missing.append('previous_contents')
    resin = {'pete_bottles': 'PET/PETE code 1', 'hdpe_containers': 'HDPE code 2'}
    if record.decision in resin and answers.get('resin_mark') != resin[record.decision]: missing.append('resin_mark')
    hazard = (FINE_CLASSES.get(record.model_class, ('', None))[0] == 'C' or special_kind(record) or record.previous_contents == 'Chemical or cleaning product'
              or answers.get('contamination') in {'Chemical contamination', 'Oil or grease', 'Mold or biological waste'}
              or answers.get('other_material') == 'Battery / electronic item'
              or answers.get('reported_category') in {'A', 'B2', 'C'})
    damaged = (record.condition in {'Damaged or cracked', 'Moldy or contaminated'} or
               record.decision == 'dry_untreated_wood_scraps' and answers.get('wood_treatment') in {WOOD[1], 'Yes'})
    if answers.get('reported_category') not in {None, 'B1'}:
        missing.append('reported_category')
    identity_ready = material['status'] in {'user_selected', 'model_high_confidence'}
    if (record.image_quality or {}).get('item_action') in {'keep', 'discard'} and not (record.image_quality or {}).get('automatic_routing'):
        missing.append('recovery_intention')
    if not identity_ready:
        missing.append('material_confirmation')
    if not answers.get('assessment_checked_at'):
        missing.append('condition_review')
    if record.decision == 'dry_untreated_wood_scraps' and answers.get('wood_treatment') != WOOD[0]:
        missing.append('wood_treatment')
    item = getattr(record, 'scene_item', None)
    if item:
        from predictions.item_actions import tentative_object
        if tentative_object(item):
            missing.append('object_confirmation')
    from predictions.item_actions import project_condition_ready
    condition_ready = project_condition_ready(record)
    needs_preparation = (record.condition == 'Needs cleaning' or answers.get('moisture') == 'Wet'
                         or answers.get('contamination') == 'Food residue that can be removed')
    if hazard or damaged:
        status = 'ineligible'
    elif record.decision not in SCOPE_LABELS:
        status = 'unsupported'
    elif identity_ready and needs_preparation:
        status = 'needs_preparation'
    elif missing or not condition_ready or answers.get('contamination') != 'None known' or answers.get('moisture') != 'Dry':
        status = 'needs_information'
    else:
        status = 'eligible'
    explanations = {
        'eligible': 'This item passes material and condition screening. Request recommendations to check whether a project fits.',
        'needs_information': 'Confirm the material and complete the condition and safety checks before proceeding.',
        'needs_preparation': 'Complete the applicable material preparation, then reassess the condition.',
        'ineligible': 'The reported condition or exposure excludes this item from the prototype upcycling flow.',
        'unsupported': 'This item is outside the seven supported material categories.'}
    return {'version': VERSION, 'status': status, 'eligible': status == 'eligible',
            'reasons': list(dict.fromkeys([explanations[status], *reasons])),
            'missing_information': list(dict.fromkeys(missing))}
