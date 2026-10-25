"""Short, conditional next actions. Intent/condition reports are not model labels.

The interview percentages describe a waste audit, not class priors or confidence.
No local acceptance, compost safety or project approval is inferred from a photo.
"""
VERSION = 'item-actions-v1'
CHOICES = {'keep', 'discard', 'recover'}
CONDITIONS = {'Clean and dry', 'Needs cleaning', 'Damaged or cracked', 'Moldy or contaminated', 'Not sure'}
EPA = {'title':'US EPA: Common recyclables', 'url':'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables'}
COMPOST = {'title':'US EPA: Composting at home', 'url':'https://www.epa.gov/recycle/composting-home'}
ELECTRONICS = {'title':'US EPA: Electronics donation and recycling', 'url':'https://www.epa.gov/recycle/electronics-donation-and-recycling'}
INTERVIEW = {'title':'CESD interview excerpt supplied by the project team', 'status':'interview_reference; not a current acceptance list'}
COMPOSITION = [
    {'key':'biodegradable','label':'Biodegradable','reported_share':52},
    {'key':'recyclable','label':'Recyclable','reported_share':18},
    {'key':'diversion','label':'Residual with possible diversion','reported_share':16},
    {'key':'special','label':'Special / hazardous handling','reported_share':4},
    {'key':'residual','label':'Residual','reported_share':10},
]


def confirmed_framed_material(item):
    """A user-reported material can unlock ideas, not an AI object identity.

    This exception only applies to the single user-framed material fallback.
    Weak detector boxes and legacy mixed-photo classifications still need review.
    Condition, resin and hazard checks remain the responsibility of the route.
    """
    from core.materials import SCOPE_LABELS
    record = item.prediction
    data, answers = record.image_quality or {}, record.answers or {}
    return bool(data.get('object_source') == 'whole_image_classifier' and
                data.get('selected_for_disposal') is True and
                (item.scene.quality or {}).get('single_item', {}).get('enabled') is True and
                record.decision in SCOPE_LABELS and
                answers.get('user_confirmed_material') == record.decision and
                answers.get('assessment_checked_at') and item.scene.items.count() == 1)


def tentative_object(item):
    from .scene_detector import HUMAN_NAMES, conflicting_query, DISPLAY_THRESHOLD, textile_review_reason
    data = item.prediction.image_quality or {}
    if item.name in HUMAN_NAMES:
        return True
    if confirmed_framed_material(item):
        return False
    competing = conflicting_query({'name':item.name,'score':item.score,'alternatives':data.get('alternatives',[])})
    return bool(not data.get('user_object_name') and item.prediction.input_method != 'manual' and
            (item.score < DISPLAY_THRESHOLD or competing or textile_review_reason({'name':item.name,'score':item.score,'box':item.box}) or
             data.get('detection_filter',{}).get('status') == 'review' or item.name == 'unfamiliar discarded object' or
             data.get('object_source') == 'whole_image_classifier'))


def automatic_route(item, prediction):
    """Scope selects a workflow, not a bin or permission to reuse/discard."""
    from core.materials import SCOPE_LABELS
    from .disposal_workflow import special_kind
    record = item.prediction
    material = (prediction.get('assessment') or {}).get('material', {})
    answers = record.answers or {}
    special = (bool(special_kind(record)) or record.previous_contents == 'Chemical or cleaning product' or
               answers.get('contamination') == 'Chemical contamination' or answers.get('reported_category') == 'C' or
               answers.get('other_material') == 'Battery / electronic item')
    action = 'recover' if material.get('label') in SCOPE_LABELS and not special else 'discard'
    resin = {'pete_bottles':'PET/PETE code 1', 'hdpe_containers':'HDPE code 2'}
    confirmed = material.get('status') == 'user_selected' and (
        material.get('label') not in resin or answers.get('resin_mark') == resin[material['label']])
    needs_review = tentative_object(item)
    confirmation_required = action == 'recover' and (not confirmed or not answers.get('assessment_checked_at') or
                                                    record.condition != 'Clean and dry' or needs_review)
    return {'enabled':record.image_quality.get('automatic_routing') is True, 'action':action, 'needs_review':needs_review,
            'confirmation_required':confirmation_required,
            'label':'Check object first' if needs_review else ('Recycling / upcycling — confirm material' if confirmation_required else 'Recycling / upcycling ideas') if action == 'recover' else 'Disposal guidance',
            'note':'Outside the seven project materials does not mean residual waste. Follow the appropriate collection route.' if action == 'discard' else
                   'Confirm the material and condition before choosing an idea.' if confirmation_required else
                   'Ideas use the material and condition you confirmed. Check suitability and local acceptance.'}


def advice(item, prediction, handling):
    from .disposal_workflow import special_kind, HAZARD_SOURCE
    from core.materials import SCOPE_LABELS
    record = item.prediction
    data = record.image_quality or {}
    automatic = data.get('automatic_routing') is True
    route = automatic_route(item, prediction) if automatic else None
    action = route['action'] if automatic and data.get('selected_for_disposal') else data.get('item_action')
    condition = record.condition or 'Not sure'
    assessment = prediction.get('assessment') or {}
    material = assessment.get('material', {})
    label = material.get('label', 'unknown_unsupported')
    name = (data.get('user_object_name') or item.name).casefold()
    original = item.name.casefold()
    names = {name, original}
    electronic = special_kind(record) == 'electronics'
    answers = record.answers or {}
    hazardous = (bool(special_kind(record)) or record.previous_contents == 'Chemical or cleaning product'
                 or answers.get('contamination') == 'Chemical contamination'
                 or answers.get('reported_category') == 'C'
                 or answers.get('other_material') == 'Battery / electronic item')
    glass = any('glass' in value or 'jalous' in value for value in names)
    hygiene = any(any(word in value for word in ('diaper','sanitary napkin','sanitary pad')) for value in names)
    organic = any(any(word in value for word in ('food scrap','fruit peel','vegetable scrap','dry leaf','banana peel','sinigang')) for value in names)
    diversion = any(any(word in value for word in ('bubble wrap','tarpaulin','plastic bag','plastic wrapper','plastic sachet')) for value in names)
    container = any(any(word in value for word in ('metal can','aluminum can','aluminium can','plastic bottle','plastic jug','plastic container')) for value in names)
    tentative = tentative_object(item)
    unsafe = condition in {'Damaged or cracked','Moldy or contaminated'}
    confirmed = material.get('status') == 'user_selected'
    sources = [EPA]
    group = 'unconfirmed'
    suggestion = 'review' if tentative else 'keep' if (electronic or name in {'towel','wallet','comb'}) and not unsafe else 'discard' if hygiene or organic or hazardous else 'recover' if label in SCOPE_LABELS or glass or diversion or container else 'review'
    title, steps, caution, status = 'Choose an action', [], '', 'choose_action'
    if action == 'keep':
        title, status = 'Before keeping it', 'condition_check'
        if hazardous:
            steps = ['Check whether it is working and undamaged.', 'Do not open the casing or handle a leaking/swollen battery.', 'If damaged, keep away from people and ask for special collection.'] if electronic else ['Check the product label and condition.', 'Keep the original container closed if safe.', 'If leaking or damaged, keep people away and ask CESD for help.']
            caution = 'Do not wash electronics or unknown chemical containers.'
            sources = [ELECTRONICS] if electronic else [HAZARD_SOURCE]
        elif glass and unsafe:
            steps = ['Do not keep cracked glass for ordinary use.', 'Keep fragments away from children.', 'Ask your collector how to package it safely.']
        elif hygiene or organic:
            steps = ['Keep this waste separate from belongings and recyclables.', 'Use a covered container while awaiting collection.', 'Check the discard guidance; this is not advice to eat or reuse it.']
        elif unsafe:
            steps = ['Do not use the damaged or moldy item.', 'Keep it separate from clean belongings.', 'Check repair or the appropriate collection route first.']
        elif condition == 'Needs cleaning':
            steps = ['Identify its material and any residue first.', 'Clean only as its care label allows; never rinse unknown chemicals.', 'Dry fully, inspect, then store safely.']
        elif condition == 'Clean and dry':
            steps = ['Check for damage, residue and sharp parts.', 'Keep dry and follow its care label.', 'Store away from food unless food-contact suitability is known.']
        else:
            steps = ['Check its condition and original contents.', 'Choose a condition below or ask for help.', 'Do not clean or reuse unknown contaminated material.']
    elif action in {'discard','recover'}:
        title, status = ('Before discarding it' if action == 'discard' else 'Recycle / upcycle'), 'conditional_guidance'
        if hazardous:
            group, title = 'special', 'Separate handling'
            steps = ['Keep separate from household waste and recycling.', 'Do not open, puncture, burn or rinse it.', 'Ask your barangay or CESD for an accepting service.']
            sources = [ELECTRONICS] if electronic else [HAZARD_SOURCE]
        elif glass:
            group, title = 'special', 'Glass: separate handling'
            steps = ['Do not break or crush it yourself.', 'Keep bottles separate from window/jalousie glass.', 'Confirm the receiving collector and safe packaging first.']
            caution = 'Glass is not automatically hazardous; the interview calls for a separate local route.'
            sources = [EPA, INTERVIEW]
        elif hygiene:
            group = 'residual'
            steps = ['Wrap used diapers or sanitary pads securely.', 'Keep separate from compost and recycling.', 'Use the barangay residual collection route; wash hands afterward.']
            sources = [INTERVIEW]
        elif organic:
            group = 'biodegradable'
            steps = ['Remove plastic and other non-food packaging.', 'Keep scraps in a covered container.', 'Compost suitable plant scraps, or confirm organics collection.']
            caution = 'Do not assume meat, oily soup or mixed cooked food is suitable for backyard compost.'
            sources = [COMPOST, INTERVIEW]
        elif diversion:
            group = 'diversion'
            steps = ['Keep dry and separate if free of dangerous residue.', 'Ask whether a current diversion program accepts this exact material.', 'If not accepted, use the barangay-advised residual route.']
            caution = 'No buyer, sale price or collection partnership is confirmed here.'
            sources = [EPA, INTERVIEW]
        elif confirmed and label in SCOPE_LABELS and not unsafe:
            group = 'recyclable'
            steps = ['Keep separate from food and hazardous waste.', 'Follow the material preparation below.', 'Confirm collector acceptance; use only a matching reviewed project.']
            if label in {'paper','cardboard'}:
                steps[1] = 'Keep dry; remove tape, plastic and personal information.'
            elif label == 'fabric_scraps':
                steps[1] = 'Follow the care label, dry fully and remove pins or sharp fittings.'
            elif label == 'dry_untreated_wood_scraps':
                steps[1] = 'Confirm untreated wood and safe removal of hardware; do not burn it.'
            elif label == 'coconut_shells':
                steps[1] = 'Keep dry and separate; do not cut or drill without a reviewed procedure.'
            else:
                steps[1] = 'Read the resin mark and contents; only rinse known safe food/beverage containers.'
            if label in {'fabric_scraps','dry_untreated_wood_scraps','coconut_shells'}:
                group = 'diversion'
                caution = 'Reuse potential does not mean this material is accepted in the recycling bin.'
        elif container and not unsafe:
            group = 'recyclable'
            steps = ['Check the material mark and original contents.', 'Only empty/rinse known safe food or drink containers; dry them.', 'Confirm that a collector accepts this exact material.']
            caution = 'The photo does not confirm the plastic resin, hidden residue or local acceptance.'
        else:
            steps = ['Confirm the material and check for contamination.', 'Keep it separate; do not guess a bin.', 'Use Review item or ask your barangay for the receiving route.']
            status = 'needs_information'
        if tentative and not hazardous and not glass:
            group, status = 'unconfirmed', 'needs_information'
            title = 'Check the object first'
            steps = ['The object needs a closer check.', 'Retake a clearer photo or correct the object name.', 'Do not choose a bin from this guess alone.']
    projects = []
    if action == 'recover' and condition == 'Clean and dry' and not unsafe and not hazardous and not glass and not tentative:
        projects = handling.get('recommendations', [])
        if not projects and (confirmed or record.confidence >= record.threshold):
            projects = assessment.get('upcycling', {}).get('suggested_ideas', [])
    if automatic and action == 'recover' and route['confirmation_required']:
        projects = []
        if not hazardous and not tentative:
            status = 'needs_information'
            title = 'Confirm before recycling / upcycling'
            steps = ['Check the material and condition using Confirm item details.',
                     'Only clean, dry and suitable material can be used for a project.']
    return {'version':VERSION, 'chosen_action':action, 'condition':condition,
            'suggested_action':route['action'] if automatic else suggestion,
            'suggestion_note':route['note'] if automatic else 'Suggestion only; you decide what to keep or discard.',
            'title':title, 'steps':steps[:3], 'caution':caution, 'status':status,
            'waste_group':group, 'group_basis':'conditional object/material guidance; local acceptance not verified',
            'projects':projects, 'sources':sources,
            'composition_note':'52/18/16/4/10 are interview-reported composition shares, not detection confidence or bin probabilities.'}
