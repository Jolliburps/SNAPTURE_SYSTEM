"""User-reported exposure history, independent of visible dryness."""
CAUSES = ['Clean water', 'Food or drink', 'Oil or grease', 'Chemical or cleaning product', 'Floodwater, sewage or animal waste', 'Not sure']
def preparation_block(record):
    answers = record.answers if isinstance(record.answers, dict) else {}
    cause = answers.get('wetness_cause')
    needs = record.condition == 'Needs cleaning' or answers.get('moisture') == 'Wet'
    if needs and not cause:
        return 'Choose what made the material wet or dirty before preparation.'
    if cause in CAUSES[2:]:
        return 'Drying does not remove this reported contamination or establish suitability. Keep it separate and check appropriate handling guidance.'
    if cause == 'Food or drink' and record.decision not in {'pete_bottles','hdpe_containers','coconut_shells'}:
        return 'Food or drink exposure is not covered by the preparation guide for this material. Do not start an upcycling project.'
    return ''
