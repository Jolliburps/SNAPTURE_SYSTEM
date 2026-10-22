"""Read-only ideas, separate from expert-approved item recommendations."""
from .content import published_guidance

PENDING = {
    'coconut_shells': ('Coconut shell reuse ideas', 'No qualified, reviewed shell-cleaning, cutting or drilling project is currently published. Detailed instructions remain unavailable pending review.'),
    'pete_bottles': ('Beverage bottle seed container', 'The cutting and drainage procedure still needs qualified safety review. Do not cut or puncture a bottle from this concept.'),
    'hdpe_containers': ('Beverage jug for watering ornamental plants', 'The container history and material-specific instructions still need review. Never repurpose chemical or unknown-content containers.'),
    'cardboard': ('Reuse an intact box for a non-food gift', 'No source-checked or expert-reviewed instructions are currently published for this material.'),
    'paper': ('Paper wrapping for a non-food gift', 'No source-checked or expert-reviewed instructions are currently published for this material.'),
    'fabric_scraps': ('Reuse a fabric offcut for dusting', 'No source-checked or expert-reviewed instructions are currently published for this material.'),
    'dry_untreated_wood_scraps': ('Untreated wood reuse ideas', 'Construction, joining and tool procedures need qualified safety review. No cutting, drilling or construction guide is published here.'),
}


def idea_references(label):
    projects = [entry for entry in published_guidance(label) if entry.kind == 'project']
    references = [{
        'id': f'reference:{entry.key}:v{entry.version}', 'title': entry.title,
        'summary': entry.summary, 'materials': entry.materials, 'steps': entry.instructions,
        'safety_note': entry.warnings, 'source': entry.source, 'review_note': entry.review_note,
        'status': 'source_checked', 'can_start': False,
        'conditions': [f'{key.replace("_", " ").capitalize()}: {", ".join(values)}' for key, values in entry.requirements.items()],
    } for entry in projects if entry.review_level == 'source_checked']
    if projects:
        return references
    title, reason = PENDING[label]
    return [{'id': f'pending:{label}', 'title': title, 'summary': reason,
             'status': 'awaiting_review', 'can_start': False,
             'steps': [], 'materials': [], 'conditions': [], 'source': '',
             'review_note': 'Concept only. No expert or CESD approval is claimed.',
             'safety_note': 'Instructions are withheld until the material-specific procedure has been reviewed.'}]
