"""Explicit recommendation requests bound to an owned record's screening inputs."""
import hashlib
import json
from .assessment import assess


def revision(record):
    item = getattr(record, 'scene_item', None)
    metadata = record.image_quality or {}
    fields = {key: getattr(record, key) for key in ('decision', 'condition', 'previous_contents',
              'answers', 'quantity', 'available_materials', 'model_version', 'confidence', 'threshold', 'input_method')}
    fields['evidence'] = {key: metadata.get(key) for key in ('material_prediction', 'high_confidence_material',
        'object_source', 'detection_filter', 'user_object_name', 'alternatives', 'automatic_routing', 'item_action', 'selected_for_disposal')}
    fields['item'] = {'id': item.id, 'name': item.name, 'score': item.score, 'box': item.box,
                     'single_item': item.scene.quality.get('single_item')} if item else None
    return hashlib.sha256(json.dumps(fields, sort_keys=True, default=str).encode()).hexdigest()


def requested_choices(record):
    screening = assess(record)['screening']
    cache = (record.image_quality or {}).get('recommendation_request') or {}
    if screening['status'] != 'eligible' or cache.get('revision') != revision(record):
        return []
    # Revalidate publication integrity without matching or generating projects.
    from .content import published_guidance
    published = {f'{entry.key}:v{entry.version}': entry.content_digest
                 for entry in published_guidance(record.decision, kinds=('project',))
                 if entry.review_level == 'expert_reviewed' and entry.reviewed_by_id}
    return [choice for choice in cache.get('recommendations', [])
            if choice.get('basis') == 'educational_catalog' or
            published.get(choice.get('id')) == choice.get('review', {}).get('digest')]


def generate(record):
    screening = assess(record)['screening']
    if screening['status'] != 'eligible':
        return screening, []
    assessment = assess(record, include_projects=True)
    reviewed = assessment['upcycling']['recommendations']
    catalog = assessment['upcycling']['suggested_ideas']
    choices = list({idea['id']: idea for idea in [*reviewed, *catalog]}.values())
    record.image_quality = {**record.image_quality, 'recommendation_request': {
        'revision': revision(record), 'recommendations': choices}}
    record.save(update_fields=['image_quality'])
    return screening, choices
