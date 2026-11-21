"""Versioned camera assessment policy; evidence never implies chemical safety."""
import json
from core.materials import SCOPE_LABELS, material_info

VERSION = 'camera-assessment-v2'
MATERIAL_RULE = 'main-photo-with-corroboration-v1'
MATERIAL_MINIMUM = .7
RESIN_MARKS = {'pete_bottles': 'PET/PETE code 1', 'hdpe_containers': 'HDPE code 2'}
INSPECTION_POLICY = 'inspection-first-v1'
CONCERN_TYPES = ('minor_damage', 'dirt', 'wet', 'contamination', 'unknown')


def reported_resin_label(evidence, mark):
    label = evidence.get('label')
    if evidence.get('status') == 'user_reported_resin' and label in RESIN_MARKS and mark == RESIN_MARKS[label]:
        return label
    return None


def enabled(record):
    return (record.image_quality or {}).get('workflow_version') == VERSION


def inspection_first(record):
    return enabled(record) and ((record.image_quality or {}).get('scan_details') or {}).get('condition_policy') == INSPECTION_POLICY


def scan_details(raw):
    value = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(value, dict) or set(value) - {'mode', 'quantity', 'approximate_size', 'category_hint', 'assessment_mode', 'human_assisted_acknowledged', 'inspection_report', 'previous_contents', 'moisture_cause', 'usable_quantity', 'condition_policy', 'reported_concern', 'capture_mode'}:
        raise ValueError('Provide scan mode, quantity and approximate size.')
    if value.get('mode') not in ('single', 'batch'):
        raise ValueError('Choose single item or batch.')
    if type(value.get('quantity')) is not int or not 1 <= value['quantity'] <= 100000:
        raise ValueError('Quantity must be a whole number from 1 to 100000.')
    if value['mode'] == 'single' and value['quantity'] != 1:
        raise ValueError('Single-item scans must have quantity 1.')
    if not isinstance(value.get('approximate_size'), str) or not 1 <= len(value['approximate_size'].strip()) <= 160:
        raise ValueError('Provide an approximate size (up to 160 characters).')
    if value.get('category_hint') and value['category_hint'] not in SCOPE_LABELS:
        raise ValueError('Choose a supported category hint.')
    if value.get('assessment_mode','ai') not in ('ai','human_assisted'):
        raise ValueError('Choose AI assessment or human-assisted assessment.')
    if value.get('assessment_mode')=='human_assisted' and value.get('human_assisted_acknowledged') is not True:
        raise ValueError('Acknowledge that human-assisted results are user-confirmed, not AI verified.')
    if 'inspection_report' in value:
        if value['inspection_report'] not in ('none_seen','concern_photo') or value.get('assessment_mode')=='human_assisted':
            raise ValueError('Choose None or submit a close-up for automatic assessment.')
        if value['mode'] != ('batch' if value['quantity'] > 1 else 'single'):
            raise ValueError('Scan mode must match the number of items entered.')
    if 'previous_contents' in value:
        from core.assessment import CONTENTS
        if not value.get('inspection_report') or value['previous_contents'] not in CONTENTS:
            raise ValueError('Choose a listed exposure answer for the inspected item.')
    if 'moisture_cause' in value and (value.get('inspection_report') != 'concern_photo'
            or value['moisture_cause'] not in ('Water','Oil','Chemical','Unknown')):
        raise ValueError('Choose the known cause of moisture for the reported concern.')
    if 'usable_quantity' in value and (value.get('inspection_report') != 'concern_photo'
            or value['mode'] != 'batch' or type(value['usable_quantity']) is not int
            or not 0 <= value['usable_quantity'] <= value['quantity']):
        raise ValueError('Enter a usable batch count between zero and the original quantity.')
    if 'condition_policy' in value:
        report = value.get('inspection_report')
        concern = value.get('reported_concern')
        if value['condition_policy'] != INSPECTION_POLICY or not report or 'previous_contents' not in value:
            raise ValueError('Complete the item inspection before reviewing the scan.')
        if report == 'concern_photo' and (concern not in CONCERN_TYPES
                or (value['mode'] == 'batch' and 'usable_quantity' not in value)
                or (concern == 'wet' and 'moisture_cause' not in value)):
            raise ValueError('Report the photographed concern and the usable count for a batch.')
        if ('reported_concern' in value and report == 'none_seen') or ('moisture_cause' in value and concern != 'wet'):
            raise ValueError('Report only concerns identified during inspection.')
    elif 'reported_concern' in value:
        raise ValueError('Use the item inspection to report a concern.')
    if 'capture_mode' in value and (value['capture_mode'] not in ('all-sides-v1','material-guided-v1') or value.get('condition_policy')!=INSPECTION_POLICY):
        raise ValueError('Use the guided inspection with the required photos.')
    return {**value, 'approximate_size': value['approximate_size'].strip()}


def accepted_material(evidence):
    if not isinstance(evidence, dict):
        return None
    label = evidence.get('label')
    score = evidence.get('confidence', 0)
    threshold = evidence.get('threshold', MATERIAL_MINIMUM)
    if (evidence.get('status') == 'classified' and label in SCOPE_LABELS
            and evidence.get('raw_class') == label and type(score) in (int, float)
            and type(threshold) in (int, float) and 0 <= threshold <= 1
            and max(MATERIAL_MINIMUM, threshold) <= score <= 1):
        return label
    return None


def combine_material(record):
    """A supported main photo is required. Only confident identity views can disagree."""
    quality = record.image_quality or {}
    primary = quality.get('primary_material_prediction', quality.get('material_prediction', {}))
    if not isinstance(primary, dict):
        primary = {}
    views = record.additional_views.all() if record.pk else []
    evidence = [view.observations.get('material', {}) for view in views
                if view.observations.get('purpose') not in {'closeup','interior'}]
    resin_label = reported_resin_label(primary, (record.answers or {}).get('resin_mark'))
    main_label = resin_label or accepted_material(primary)
    corroborating_labels = {label for row in evidence if (label := accepted_material(row))}
    conflict = bool(main_label and corroborating_labels - {main_label})
    score = primary.get('confidence', 0)
    if type(score) not in (int, float) or not 0 <= score <= 1:
        score = 0
    threshold = primary.get('threshold', MATERIAL_MINIMUM)
    if type(threshold) not in (int, float) or not 0 <= threshold <= 1:
        threshold = 1
    threshold = max(MATERIAL_MINIMUM, threshold)
    if conflict:
        status = 'conflicting_evidence'
        basis = 'The reported code conflicts with a confident material view. Check the code and retake the scan.' if resin_label else 'Two confident material views disagree. Retake the main photo with the whole item in frame.'
    elif resin_label:
        status = 'user_reported_resin'
        basis = 'Material based on the recycling code reported by the user.'
    elif main_label:
        status = 'classified'
        basis = 'The main photo identifies a supported material. Condition close-ups and uncertain extra views do not vote on material.'
    else:
        status = primary.get('status') if primary.get('status') in {'unavailable', 'not_applicable'} else 'needs_review'
        basis = primary.get('basis') if status == 'not_applicable' else 'The main photo did not confidently identify a supported material. Retake the main photo if the item is in scope.'
    label = main_label if main_label and not conflict else 'unknown_unsupported'
    combined = {**primary, 'label': label, 'confidence': score, 'threshold': threshold,
                'status': status, 'basis': basis, 'view_count': 1 + len(evidence),
                'combination_rule': MATERIAL_RULE}
    record.image_quality = {**quality, 'primary_material_prediction': primary, 'material_prediction': combined,
                            'combined_material': combined}
    record.decision = label
    record.title = material_info(label)['title'] + (' (user confirmed)' if resin_label and not conflict else '')
    record.confidence = score
    record.threshold = threshold
    from core.assessment import refresh
    refresh(record)
    record.save()


def remember_hazards(record, incoming):
    """A later clean answer must not erase an earlier reported exposure."""
    values = {key: row['value'] for key, row in incoming.items()}
    workflow = dict((record.image_quality or {}).get('workflow', {}))
    hazards = list(workflow.get('hazard_history', []))
    for key, value in [('previous_contents', record.previous_contents), ('condition', record.condition), *values.items()]:
        if value in ('Chemical or cleaning product', 'Moldy or contaminated', 'Chemical contamination', 'Mold or biological waste', 'Oil or grease', 'Oil', 'Chemical'):
            entry = f'{key}: {value}'
            if entry not in hazards: hazards.append(entry)
    scope_report = values.get('material_scope_report')
    if scope_report in {'glass', 'metal'}:
        entry = f'material_scope_report: {scope_report}'
        if entry not in hazards:
            hazards.append(entry)
    workflow['hazard_history'] = hazards
    record.image_quality = {**record.image_quality, 'workflow': workflow}


def material_review(record, facts):
    """Explain why material eligibility is blocked without guessing the cause."""
    material = (record.image_quality or {}).get('material_prediction') or {}
    status = material.get('status')
    if facts.get('material_scope_report') == 'out_of_scope':
        return ('Out of Scope', 'You reported an item outside the seven supported material categories.',
                'Scan an item from one of the supported categories.')
    if status == 'not_applicable':
        return ('Out of Scope', 'This item is outside the seven supported material categories.',
                'Scan an item from one of the supported categories.')
    if status == 'user_reported_resin' and reported_resin_label(material, facts.get('resin_mark')) == record.decision and record.decision in RESIN_MARKS:
        return None
    if (record.decision not in SCOPE_LABELS or status in {'needs_review', 'conflicting_evidence', 'unavailable'}
            or record.confidence < record.threshold):
        if status == 'unavailable':
            return ('Material Check Unavailable', 'Material recognition is unavailable right now.', 'Try again when material recognition is available.')
        reason = (material.get('basis') if status == 'conflicting_evidence' else None)
        return ('Photo Needs Review', reason or 'The photo did not provide enough evidence to confirm the material.',
                'Retake the main photo in good light. Step back if needed and keep the whole item inside the guide.')
    return None


def verdict(record, projects=None):
    from .human_assisted import enabled as human_enabled, verdict as human_verdict
    if human_enabled(record):return human_verdict(record,projects)
    from .assessment import comparable_observation_values, facts_for
    from .matching import safety_block
    facts = facts_for(record)
    quality = record.image_quality or {}
    workflow = quality.get('workflow', {})
    strict = enabled(record)
    guided = inspection_first(record)
    def result(code, title, reason, action, *, required_input=None, can_start=None, basis=None):
        allowed = code == 'suitable' if can_start is None else can_start
        decision = {'code': code, 'title': title, 'reason': reason, 'next_action': action,
                    'can_start': allowed, 'blocking_reasons': [] if allowed else [reason]}
        if required_input:
            decision['required_input'] = required_input
        if basis:
            decision['basis'] = basis
        return decision
    hazard = safety_block(record, facts)
    if hazard or workflow.get('hazard_history'):
        return result('for_disposal', 'For Disposal / Special Handling', hazard or 'A previously reported hazardous exposure remains unresolved.', 'Keep separate; consult CESD or an appropriate local collection service. Do not reuse.')
    if facts.get('moisture_cause') in {'Oil', 'Chemical'}:
        return result('for_disposal', 'For Disposal / Special Handling', 'Oil or chemical moisture was reported.', 'Keep this material out of the activity and seek appropriate handling guidance.')
    evidence = [quality.get('visual_assessment', {}), *[v.observations.get('condition', {}) for v in (record.additional_views.all() if record.pk else [])]]
    if guided:
        evidence = [e for e in evidence if e.get('validated')]
    all_clear = [o for e in evidence for o in e.get('observations', []) if o.get('certainty') == 'clear']
    if any(o.get('field') == 'visible_contamination' and o.get('value', '').lower() in {'mold', 'mould', 'suspected mold', 'oil', 'chemical contamination', 'mold or biological waste', 'oil or grease'} for o in all_clear):
        return result('for_disposal', 'For Disposal / Special Handling', 'Visual evidence flags suspected hazardous contamination.', 'Do not use this material; seek appropriate separate-handling advice.')
    review = material_review(record, facts)
    if review:
        return result('unsupported', *review)
    reassessment=workflow.get('reassessment_view_id')
    if reassessment:
        updated=record.additional_views.filter(pk=reassessment).first()
        if updated:evidence=[updated.observations.get('condition',{})]
    if guided:
        return inspection_verdict(record, facts, workflow, evidence, projects, result)
    clear = [o for e in evidence for o in e.get('observations', []) if o.get('certainty') == 'clear']
    if any(o.get('field') == 'visible_contamination' and o.get('value') == 'suspicious stain' for o in clear):
        return result('assessment_pending', 'Assessment Pending', 'A suspicious stain is visible, but its substance cannot be determined from a photo.', 'Report known exposure and submit a close-up; do not use while the concern is unresolved.', required_input='exposure_and_closeup')
    wet = any(o.get('field') == 'wet_appearance' and o.get('value', '').lower() in {'wet', 'damp', 'visible moisture', 'yes'} for o in clear)
    if record.decision in {'paper', 'cardboard'} and (wet or facts.get('moisture_cause') in {'Water', 'Unknown'}):
        if facts.get('moisture_cause') != 'Water':
            return result('assessment_pending', 'Assessment Pending', 'The cause of the wet area is uncertain.', 'Report the known moisture cause and submit a close-up. An image cannot establish liquid composition.', required_input='moisture_and_closeup')
        if wet or not (workflow.get('preparation_completed') and workflow.get('reassessed')):
            return result('requires_preparation', 'Requires Preparation', 'Water exposure requires drying and a new assessment of usable portions.', 'Dry the material appropriately, then submit updated evidence for reassessment.')
    ordinary_dirt=any(o.get('field')=='visible_contamination' and o.get('value','').lower() in {'ordinary dirt','removable dirt','dirt','dust'} for o in clear)
    if ordinary_dirt or facts.get('condition') == 'Needs cleaning':
        return result('requires_preparation', 'Requires Preparation', 'The reported condition requires preparation.', 'Follow appropriate preparation instructions and submit updated evidence for reassessment.')
    if strict:
        if not quality.get('scan_details'):
            return result('assessment_pending','Assessment Pending','Initial item details have not been provided.','Start a new camera assessment with size, quantity and scan mode.')
        if any(e.get('status') != 'available' or not e.get('validated') or not {'damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'}.issubset({o.get('field') for o in e.get('observations',[]) if o.get('certainty')=='clear'}) for e in evidence):
            return result('assessment_pending', 'Assessment Pending', 'Validated visual condition assessment is unavailable or incomplete.', 'Condition-assessor integration is required. User inspection cannot substitute for AI verification.')
        if facts.get('condition') not in {'Clean and dry','Damaged or cracked','Torn or crumpled, clean and dry','Clean dry usable scraps'}:
            return result('assessment_pending','Assessment Pending','Condition needs clarification.','Provide targeted evidence that shows the relevant condition.', required_input='closeup')
        if facts.get('previous_contents') not in {'Water or beverage','Food or oil','No chemical contact known'}:
            return result('assessment_pending','Assessment Pending','Previous contents or exposure history is unknown.','Confirm known previous contents; appearance cannot establish chemical history.', required_input='exposure')
        values = {}
        for o in clear: values.setdefault(o['field'], set()).add(o['value'])
        if (any(len(comparable_observation_values(field, observed)) > 1 for field, observed in values.items())
                or any(o.get('certainty') != 'clear' for e in evidence for o in e.get('observations', []))):
            return result('assessment_pending', 'Assessment Pending', 'Condition observations disagree or remain uncertain.', 'Submit a targeted close-up or obtain knowledgeable review.', required_input='closeup')
        if workflow.get('preparation_required') and not (workflow.get('preparation_completed') and workflow.get('reassessed')):
            return result('requires_preparation', 'Requires Preparation', 'Preparation needs updated evidence.', 'Submit a reassessment photo after preparation.')
        if not workflow.get('safety_acknowledged') or not workflow.get('inspection_confirmed') or workflow.get('usable_quantity') is None:
            return result('assessment_pending', 'Assessment Pending', 'Inspection and usable quantity have not been confirmed.', 'Read the safety notice, inspect every item, and report the actual usable quantity.', required_input='usable_quantity')
        if not workflow.get('usable_quantity'):
            return result('no_suitable_project', 'No Suitable Project Available', 'No usable items remain in this batch.', 'Separate questionable pieces and seek appropriate material guidance.')
    if projects is not None and not any(p.get('can_start') for p in projects):
        if not projects or all(p.get('status') == 'not_suitable' for p in projects):
            return result('no_suitable_project', 'No Suitable Project Available', 'No existing project fits the available usable material.', 'Review other project types; lack of a catalog match does not mean the material is waste.')
        return result('assessment_pending', 'Assessment Pending', 'Project-specific requirements still need confirmation.', 'Complete the listed size, quantity, history, tools and safety checks.', required_input='project_requirements')
    return result('suitable', 'Suitable for Upcycling', 'The available evidence meets the assessed requirements.', 'Choose a matching project and follow its instructions. This is not safety or strength certification.')


def inspection_verdict(record, facts, workflow, evidence, projects, result):
    from .assessment import comparable_observation_values

    details = record.image_quality['scan_details']
    concern = details.get('reported_concern')
    reassessed = bool(workflow.get('preparation_completed') and workflow.get('reassessed'))
    clear = [(o.get('field'), str(o.get('value', '')).lower()) for e in evidence if e.get('validated')
             for o in e.get('observations', []) if o.get('certainty') == 'clear']
    def review(reason, action, required_input=None):
        return result('condition_review', 'Condition Needs Review', reason, action, required_input=required_input)

    if ('visible_contamination', 'suspicious stain') in clear or (concern == 'unknown' and not facts.get('condition')):
        return review('The photographed concern is unidentified.', 'Keep the affected pieces aside and clarify the concern before reuse.', 'exposure_and_closeup')
    if facts.get('previous_contents') not in {'Water or beverage','Food or oil','No chemical contact known'}:
        return review('Previous contents or exposure are unknown.', 'Confirm the known history before using the item.', 'exposure')

    wet = any(field == 'wet_appearance' and value in {'wet','damp','visible moisture','yes'} for field,value in clear)
    if wet or (concern == 'wet' and not reassessed):
        if facts.get('moisture_cause') != 'Water':
            return review('The cause of moisture is unclear.', 'Keep the affected pieces aside and report the cause if known.', 'moisture_and_closeup')
        return result('requires_preparation', 'Requires Preparation', 'Water exposure was reported.', 'Dry the affected material and submit a new photo before using it.')
    dirt = any(field == 'visible_contamination' and value in {'ordinary dirt','removable dirt','dirt','dust'} for field,value in clear)
    if dirt or (concern == 'dirt' and not reassessed) or (workflow.get('preparation_required') and not reassessed):
        return result('requires_preparation', 'Requires Preparation', 'The affected material needs cleaning or preparation.', 'Prepare the material as appropriate, then submit a new photo.')
    observations = {}
    for field, value in clear:
        observations.setdefault(field, set()).add(value)
    if any(len(comparable_observation_values(field, values)) > 1 for field, values in observations.items()):
        return review('The validated photos show conflicting observations.', 'Submit a clearer photo of the concern before using the item.', 'closeup')
    if not facts.get('condition'):
        return review('The photos and inspection report did not establish a usable condition.', 'Keep the affected pieces aside and submit a clearer view.', 'closeup')
    if not workflow.get('inspection_confirmed') or workflow.get('usable_quantity') is None:
        return review('The usable pieces have not been confirmed.', 'Confirm the inspection and usable count.', 'usable_quantity')
    if not workflow['usable_quantity']:
        return result('no_suitable_project', 'No Suitable Project Available', 'No usable pieces were reported.', 'Keep questionable pieces aside and scan usable pieces separately.')
    if projects is not None and (not projects or all(p.get('status') == 'not_suitable' for p in projects)):
        return result('no_suitable_project', 'No Suitable Project Available', 'No project matches the material, usable size, quantity, and condition you reported.', 'Scan a different item or a set of compatible pieces.')
    needs_project_checks = not projects or not any(p.get('can_start') for p in projects)
    based_on_report = facts.get('inspection_condition_basis') == 'user_reported'
    reason = 'The reported usable pieces passed your inspection.' if based_on_report else 'The assessed condition supports looking for matching projects.'
    return result('suitable','Suitable for Upcycling',reason,
                  'Review the listed project requirements before starting.' if needs_project_checks else 'Choose a matching project.',
                  can_start=not needs_project_checks, required_input='project_requirements' if needs_project_checks else None,
                  basis='user_reported' if based_on_report else 'validated_visual')
