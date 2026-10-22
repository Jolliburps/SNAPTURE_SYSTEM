"""Conservative routing vocabulary, not a trained classifier or local acceptance list."""
from .materials import SCOPE_LABELS

CATEGORY_NAMES = {'A': 'Biodegradable', 'B1': 'Recyclable / reusable', 'B2': 'Residual',
                  'C': 'Special / hazardous', 'UNIDENTIFIED': 'Unidentified'}
OTHER_MATERIALS = ['Glass', 'Metal', 'Other plastic', 'Food / plant waste', 'Battery / electronic item',
                   'Composite packaging', 'Other', 'Not sure']
CONTAMINATION = ['None known', 'Food residue that can be removed', 'Oil or grease', 'Mold or biological waste',
                 'Chemical contamination', 'Not sure']
MOISTURE = ['Dry', 'Wet', 'Not sure']
# These are visual hypotheses. Never infer PET/HDPE resin, chemical history or treatment from them.
FINE_CLASSES = {
    'plastic bottle': ('B1', None), 'plastic jug or container': ('B1', None),
    'cardboard box or cardboard scrap': ('B1', 'cardboard'), 'paper scrap': ('B1', 'paper'),
    'cloth or fabric scrap': ('B1', 'fabric_scraps'), 'wood scrap': ('UNIDENTIFIED', 'dry_untreated_wood_scraps'),
    'glass bottle or glass jar': ('B1', None), 'metal can': ('B1', None),
    'food scraps or fruit peel': ('A', None), 'dry leaf': ('A', None),
    'plastic bag or plastic wrapper': ('UNIDENTIFIED', None), 'plastic sachet': ('UNIDENTIFIED', None),
    'disposable diaper': ('B2', None), 'cigarette butt': ('B2', None),
    'battery': ('C', None), 'fluorescent light bulb': ('C', None), 'syringe': ('C', None),
    'paint can': ('C', None), 'electronic waste': ('C', None),
    'unfamiliar discarded object': ('UNIDENTIFIED', None),
}


def identity(record, assessment, box=None):
    from predictions.disposal_workflow import special_kind
    answers = record.answers if isinstance(record.answers, dict) else {}
    category, _ = FINE_CLASSES.get(record.model_class, ('UNIDENTIFIED', None))
    label = assessment['material']['label']
    confirmed = assessment['material']['status'] == 'user_selected'
    reported_category = answers.get('reported_category')
    hazardous = (bool(special_kind(record)) or record.previous_contents == 'Chemical or cleaning product' or answers.get('contamination') == 'Chemical contamination'
                 or FINE_CLASSES.get(record.model_class, ('', None))[0] == 'C' or answers.get('other_material') == 'Battery / electronic item')
    if hazardous:
        category = 'C'
    elif reported_category in CATEGORY_NAMES:
        category = reported_category
    elif record.confidence < .55 or record.input_method == 'manual' or 'unverified' in record.model_version:
        category = 'UNIDENTIFIED'
    # A user's category is a report, not approval or an instruction to unlock projects.
    proposed_category = FINE_CLASSES.get(record.model_class, ('UNIDENTIFIED', None))[0]
    segregation = assessment['segregation']
    if segregation['status'] == 'available' and not hazardous:
        category = 'B1' if segregation['category'] in {'Recyclable', 'Potentially recyclable - confirm local acceptance'} else category
    condition = 'UNKNOWN'
    if record.condition == 'Needs cleaning' or answers.get('moisture') == 'Wet' or answers.get('contamination') == 'Food residue that can be removed':
        condition = 'NEEDS_HANDLING'
    if record.condition == 'Clean and dry' and not assessment['missing_information'] and answers.get('moisture') != 'Wet' and answers.get('contamination') == 'None known':
        condition = 'OK'
    excluded = hazardous or record.condition in {'Moldy or contaminated', 'Damaged or cracked'} or answers.get('contamination') in {'Oil or grease', 'Mold or biological waste', 'Chemical contamination'}
    if label == 'dry_untreated_wood_scraps' and answers.get('wood_treatment') != 'Known untreated and free of paint, mold and hardware':
        excluded = True
    if excluded:
        condition = 'NOT_RECYCLABLE'  # Excluded from this prototype's projects, not a legal landfill ruling.
    gate = bool(confirmed and label in SCOPE_LABELS and condition == 'OK' and not excluded and
                assessment['upcycling']['status'] in {'available', 'awaiting_review', 'not_eligible'})
    candidates = record.image_quality.get('alternatives', []) if isinstance(record.image_quality, dict) else []
    top = [{'label': row['label'], 'score': row['score']} for row in candidates[:3]
           if isinstance(row, dict) and isinstance(row.get('label'), str) and isinstance(row.get('score'), (int, float))]
    general = {
        'status':'reference_only', 'instructions':['Ask your barangay or CESD about an accepting facility and preparation requirements for this exact item. No local drop-off address or acceptance is verified here.'],
        'source':{'name':'US EPA, How Do I Recycle Common Recyclables','url':'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables','section':'Local-program acceptance and material-specific guidance','date':None},
    }
    if category == 'C':
        general = {'status':'precaution_only','instructions':['Do not reuse, open, puncture, burn or mix a suspected hazardous item. Follow its label and contact CESD for item-specific collection instructions. Do not pick up exposed sharps.'],
                   'source':{'name':'US EPA, Household Hazardous Waste','url':'https://www.epa.gov/hw/household-hazardous-waste-hhw','section':'Safe handling and local management options','date':None}}
    return {
        'box': box, 'fine_class': label if confirmed else None, 'visual_suggestion': record.model_class,
        'category': category, 'category_label': CATEGORY_NAMES[category], 'suggested_category': proposed_category,
        'category_basis': 'precaution' if hazardous else 'user_report' if reported_category in CATEGORY_NAMES else 'reviewed_rule' if segregation['status'] == 'available' else 'unconfirmed',
        'target_material': label if confirmed and label in SCOPE_LABELS else 'Other' if answers.get('other_material') not in {None, '', 'Not sure'} else None,
        'confidence': record.confidence, 'score_kind': 'uncalibrated model score, not measured accuracy', 'top_predictions': top,
        'condition': condition, 'condition_note': 'NOT_RECYCLABLE means excluded from prototype reuse; ask CESD for the actual disposal route.',
        'safety_gate_passed': gate, 'needs_confirmation': not confirmed or bool(assessment['missing_information']),
        'handling_steps': ['If there is no chemical or biological contamination, follow the item-specific published cleaning instructions, dry it, then update its condition. Do not clean unknown chemical containers.'] if condition == 'NEEDS_HANDLING' and not hazardous else [],
        'recycle_ideas': segregation['instructions'] if segregation['status'] == 'available' and not hazardous else [],
        'upcycle_ideas': [{**idea, 'verification_status': 'VERIFIED'} for idea in assessment['upcycling']['recommendations']] if gate else [],
        'general_guidance': general,
    }
