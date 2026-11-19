"""Conservative prototype project dimensions; not consultant-validated specifications."""
from decimal import Decimal, InvalidOperation
# width/height of each usable piece in cm; containers use capacity in ml.
RULES = {
 'paper_craft':(1,2,2), 'paper_gift_wrap':(1,21,29.7), 'paper_organizer':(2,21,29.7),
 'cardboard_craft':(1,5,5), 'cardboard_organizer':(2,20,15), 'cardboard_divider':(1,30,20),
 'fabric_cleaning_cloth':(1,15,15), 'fabric_patchwork':(4,5,5), 'fabric_pouch':(2,20,15),
 'coconut_craft':(2,3,3), 'coconut_bowl':(1,8,4), 'coconut_planter':(1,10,5),
 'wood_craft':(1,5,3), 'wood_marker':(1,10,2),
 'pete_planter':(1,500,0), 'pete_organizer':(1,500,0), 'pete_seed_set':(3,250,0),
 'hdpe_planter':(1,1000,0), 'hdpe_storage':(1,1000,0), 'hdpe_scoop':(1,1000,0),
}
# A generic shelf has no defined load/assembly specification; do not infer suitability from dimensions.
def number(value):
    try:
        result=Decimal(str(value))
        return float(result) if result.is_finite() and 0 < result <= 100000 else None
    except (InvalidOperation, ValueError, TypeError): return None

def fit(record, idea):
    rule=RULES.get(idea['id'])
    if not rule: return False, 'No defined size specification is available for this project.'
    count,w,h=rule
    a=record.answers or {}
    if not record.quantity or record.quantity<count: return False, f'Needs at least {count} usable piece(s) or container(s).'
    if record.condition not in {'Clean and dry','Torn or crumpled, clean and dry','Clean dry usable scraps'}:
        return False, 'Prepare and check the material condition first.'
    if record.decision in {'pete_bottles','hdpe_containers'}:
        capacity=number(a.get('usable_capacity_ml'))
        if not capacity or capacity<w: return False, f'Needs a container of at least {w} ml.'
        if a.get('usable_form')!='Intact': return False, 'Needs an intact container.'
    else:
        width,height=number(a.get('usable_width_cm')),number(a.get('usable_height_cm'))
        if not width or not height or not ((width>=w and height>=h) or (width>=h and height>=w)):
            return False, f'Needs each usable piece to measure at least {w} x {h} cm.'
        if idea['id'] in {'paper_gift_wrap','paper_organizer','cardboard_organizer','cardboard_divider','fabric_pouch','coconut_bowl','coconut_planter'} and a.get('usable_form')!='Intact':
            return False, 'Needs intact, firm material; choose a piece-based craft instead.'
    return True, f'Prototype minimum: {count} item(s), '+(f'{w} ml each.' if h==0 else f'{w} x {h} cm per piece.')

def filter_ideas(record,ideas):
    return [{**idea,'fit_note':reason,'fit_basis':'Prototype dimensions; domain review pending'} for idea in ideas for ok,reason in [fit(record,idea)] if ok]
