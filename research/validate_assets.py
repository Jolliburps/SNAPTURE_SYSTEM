"""Validate draft artifact completeness, NOT evidence quality or expert approval."""
import json
from pathlib import Path
from urllib.parse import urlparse

TARGETS = {'pete_bottles','hdpe_containers','cardboard','paper','fabric_scraps','dry_untreated_wood_scraps'}
FIELDS = {'id','target_material','title','description','required_condition','pre_handling_steps','materials_and_tools',
          'safety_notes_and_PPE','step_by_step','expected_result','difficulty','time_required','estimated_cost',
          'do_not_use_if','end_of_life','sources','verification_status','reviewer','last_reviewed'}

def validate_library(library):
    seen, targets = set(), set()
    for idea in library['ideas']:
        if FIELDS-set(idea): raise ValueError(f"Missing fields: {sorted(FIELDS-set(idea))}")
        if idea['id'] in seen or idea['target_material'] not in TARGETS: raise ValueError('Duplicate ID or unsupported target')
        seen.add(idea['id']); targets.add(idea['target_material'])
        if idea['verification_status'] not in {'VERIFIED','UNVERIFIED'}: raise ValueError('Unknown review status')
        for source in idea['sources']:
            if not {'name','url','date','section'}.issubset(source) or not source['section']: raise ValueError('Incomplete source trace')
            if urlparse(source['url']).scheme != 'https' or not urlparse(source['url']).hostname: raise ValueError('Invalid source URL')
        if idea['verification_status'] == 'VERIFIED':
            if not all((idea['reviewer'],idea['last_reviewed'],idea['step_by_step'],idea['sources'])): raise ValueError('Verification cannot be asserted without a reviewer and process')
        elif not idea.get('verification_gap'): raise ValueError('An unverified draft must explain its gap')
    if targets != TARGETS: raise ValueError('Provide a candidate for all six targets')
    return len(seen)

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    library = json.loads((root/'upcycling_library.json').read_text(encoding='utf-8'))
    count = validate_library(library)
    registry = json.loads((root/'dataset_registry.json').read_text(encoding='utf-8'))
    print(f"Validated {count} draft idea records and {len(registry['datasets'])} dataset registry records. No publication or training performed.")
