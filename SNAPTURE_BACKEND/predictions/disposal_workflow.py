"""Disposal intent is a user report, never model ground truth or project approval.

Stored in existing JSON fields; read historical assessments without re-inference
or consulting a newer project's catalogue. Scores stay detection-only for OWL.
"""
from core.materials import SCOPE_LABELS, material_info

VERSION = 'disposal-workflow-v1'
ELECTRONICS = {'mobile phone', 'cellphone', 'phone', 'smartphone', 'wristwatch', 'watch',
               'computer keyboard', 'computer monitor', 'computer mouse', 'laptop computer',
               'electronic waste', 'smartwatch'}
HAZARDS = {'battery', 'fluorescent light bulb', 'syringe', 'paint can'}
GLASS = {'glass', 'glass bottle', 'glass jar', 'glass bottle or glass jar',
         'broken glass', 'window glass', 'jalousie glass'}
ELECTRONICS_SOURCE = {'title': 'US EPA: Electronics donation and recycling',
                      'url': 'https://www.epa.gov/recycle/electronics-donation-and-recycling'}
HAZARD_SOURCE = {'title': 'US EPA: Household hazardous waste',
                 'url': 'https://www.epa.gov/hw/household-hazardous-waste-hhw'}


def special_kind(record):
    metadata = record.image_quality if isinstance(record.image_quality, dict) else {}
    names = {record.model_class.casefold(), metadata.get('user_object_name', '').casefold()}
    # Glass is a precautionary waste route in SNAPTURE, outside DIY upcycling.
    if names & GLASS or (record.answers or {}).get('other_material') == 'Glass':
        return 'glass'
    return 'electronics' if names & ELECTRONICS else 'hazard' if names & HAZARDS else None


def describe(item, prediction):
    record = item.prediction
    metadata = record.image_quality if isinstance(record.image_quality, dict) else {}
    assessment = prediction.get('assessment') or {}
    material = assessment.get('material', {})
    label = material.get('label', 'unknown_unsupported')
    reported = material.get('status') == 'user_selected'
    high_confidence = material.get('status') == 'model_high_confidence'
    resin = {'pete_bottles':'PET/PETE code 1', 'hdpe_containers':'HDPE code 2'}
    confirmed = (reported or high_confidence) and (label not in resin or record.answers.get('resin_mark') == resin[label])
    plastic = 'plastic' in item.name or label in {'pete_bottles', 'hdpe_containers'}
    # OWL prompt -> material is not a separately scored material classifier.
    display_material = ('Plastic — subtype unconfirmed' if plastic and not confirmed else material_info(label)['title'] if label in SCOPE_LABELS
                        else 'Plastic — subtype unconfirmed' if plastic else 'Material unconfirmed')
    manual = record.input_method == 'manual'
    evidence = metadata.get('material_prediction', {})
    classified = evidence.get('status') == 'classified'
    whole_photo = metadata.get('object_source') == 'whole_image_classifier'
    return {
        'object_prediction': {'name': item.name, 'confidence': None if manual or whole_photo else item.score,
                              'source': 'user_marked_region' if manual else 'whole_image_classifier' if whole_photo else 'model',
                              'score_kind': 'whole-photo classification; no object detection score' if whole_photo else 'uncalibrated detection score, not accuracy'},
        'user_object_name': metadata.get('user_object_name', ''),
        'material_prediction': {'label': label, 'title': display_material,
                                'confidence': evidence.get('confidence') if classified and label in SCOPE_LABELS and evidence.get('label') == label else None,
                                'status': 'user_reported' if reported and confirmed else 'model_high_confidence' if high_confidence else 'model_suggested' if classified and label in SCOPE_LABELS else 'uncertain' if label in SCOPE_LABELS or plastic else 'unsupported',
                                'basis': 'user report, not AI verification' if confirmed else evidence.get('basis', 'material evidence unconfirmed; no independent material score')},
        'ai_waste_category': None,  # No independently trained waste-category classifier.
        'waste_category_hypothesis': (prediction.get('waste_identifier') or {}).get('suggested_category', 'UNIDENTIFIED'),
        'waste_category_basis': 'object-label routing rule, not an independent AI prediction',
        'selected_for_disposal': metadata.get('selected_for_disposal') is True,
    }


def handling(item, prediction):
    """Choose a supported route, never promote a selection to a material label."""
    record = item.prediction
    description = describe(item, prediction)
    assessment = prediction.get('assessment') or {}
    answers = record.answers or {}
    electronic = special_kind(record) == 'electronics'
    special = (bool(special_kind(record)) or record.previous_contents == 'Chemical or cleaning product'
               or answers.get('other_material') == 'Battery / electronic item'
               or answers.get('reported_category') == 'C' or answers.get('contamination') == 'Chemical contamination'
               or (prediction.get('waste_identifier') or {}).get('category') == 'C')
    upcycling = assessment.get('upcycling', {})
    recommendations = []
    route, title, explanation, instructions, sources = (
        'screening_pending', 'Review item screening',
        'Complete the material and condition checks before requesting project recommendations.',
        ['Keep it separate until its material and an accepting local collection route are known. Ask your barangay or CESD; no receiving location is verified here.'], [])
    if not description['selected_for_disposal']:
        route, title = 'not_selected', 'Not selected for disposal'
        explanation, instructions, recommendations = 'No waste-handling action requested for this object.', [], []
    elif special:
        route, title = 'special_handling', 'Requires special handling'
        explanation = 'Possible electronics or hazardous item. This precaution is not a confirmed material or hazard identification.'
        instructions = (['Do not place a suspected battery-containing device in ordinary household garbage or recycling.',
                         'If the device still works, consider repair or donation. Before handing it over, remove personal data when safe.',
                         'Do not dismantle the device or remove a built-in battery. Ask your barangay or CESD for an accepting electronics collection service.']
                        if electronic else ['Do not open, empty, rinse, mix, burn or repurpose a suspected hazardous item.',
                                            'Avoid leaking containers and exposed sharps. Ask your barangay or CESD for item-specific collection instructions.'])
        sources = [ELECTRONICS_SOURCE if electronic else HAZARD_SOURCE]
        recommendations = []
    elif (prediction.get('screening') or assessment.get('screening') or {}).get('status') == 'eligible':
        route, title = 'eligible', 'Passed item screening'
        explanation = 'The item passes screening. Request recommendations separately to check project suitability. This is not a safety certification.'
        instructions = ['Request recommendations to check whether a project fits your screened item.']
        sources = []
    elif description['material_prediction']['status'] == 'unsupported' and record.model_class not in {'human-marked unidentified object', 'unfamiliar discarded object'}:
        explanation = 'This recognized object is outside the supported upcycling database. No verified method is available; do not force it into another material category.'
        recommendations = []
    elif (description['material_prediction']['status'] not in {'user_reported', 'model_high_confidence'}
          or upcycling.get('status') == 'needs_information'):
        route, title = 'requires_information', 'Requires more information'
        explanation = ('Read the resin code on the actual item before selecting PET/PETE or HDPE.'
                       if 'Plastic' in description['material_prediction']['title'] else
                       'Confirm the material and only the details needed for an available handling rule or project.')
        instructions = ['Use Review item to check the material. Choose Not sure when you cannot confirm it.']
        recommendations = []
    else:
        recommendations = []
    return {**description, 'version': VERSION, 'route': route, 'title': title, 'explanation': explanation,
            'instructions': instructions, 'sources': sources, 'upcycling_eligible': route == 'eligible',
            'recommendations': recommendations, 'verification_status': 'screened_only' if route == 'eligible' else 'no_project_approval',
            'source_checked_on': '2026-10-22'}


def snapshot(record):
    """Refresh only after an explicit write; never rewrite saved scans on GET."""
    item = getattr(record, 'scene_item', None)
    if item is None:
        return
    from .views import _serialize
    from .item_actions import advice, automatic_route
    if record.image_quality.get('automatic_routing') and record.image_quality.get('selected_for_disposal'):
        record.image_quality = {**record.image_quality, 'item_action':automatic_route(item, _serialize(record, saved=True))['action']}
    # _serialize reads assessment snapshots; does not call this function.
    record.image_quality = {**record.image_quality, 'handling_snapshot': handling(item, _serialize(record, saved=True))}
    record.image_quality['action_snapshot'] = advice(item, _serialize(record, saved=True), record.image_quality['handling_snapshot'])
