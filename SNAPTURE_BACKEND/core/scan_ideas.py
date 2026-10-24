"""Original educational catalog suggestions for a recognized scan material."""
from .materials import SCOPE_LABELS
from .recommendations import build_recommendations


def scan_ideas(record):
    from predictions.disposal_workflow import special_kind

    label = record.decision
    answers = record.answers if isinstance(record.answers, dict) else {}
    confirmed = answers.get('user_confirmed_material') == label
    if label not in SCOPE_LABELS or (not confirmed and record.confidence < record.threshold):
        return []
    if (special_kind(record) or record.previous_contents == 'Chemical or cleaning product'
            or record.condition in {'Moldy or contaminated', 'Damaged or cracked'}
            or answers.get('contamination') in {'Oil or grease', 'Mold or biological waste', 'Chemical contamination'}
            or answers.get('other_material') == 'Battery / electronic item'
            or answers.get('reported_category') in {'A', 'B2', 'C'}):
        return []
    if label == 'dry_untreated_wood_scraps' and answers.get('wood_treatment') in {'Paint, treatment, nails, or mold', 'Yes'}:
        return []
    return [
        {**idea, 'basis':'educational_catalog', 'material':label}
        for idea in build_recommendations(label, record.quantity, record.condition,
                                          record.previous_contents, record.available_materials)
    ]
