"""Load independently evaluated scan cutoffs. Missing evidence means review."""
import hashlib
import json
import math

from django.conf import settings

from .scene_detector import FILTER_VERSION, MODEL_DIR, PROMPTS

# Proposed deployment criterion, not a measured SNAPTURE result.
MIN_JOINT_PRECISION_LOWER_BOUND = .90


def _valid_cutoff(value):
    return type(value) in (int, float) and math.isfinite(value) and 0 < value <= 1


def _has_precision_evidence(entry):
    accepted, correct = entry.get('test_accepted'), entry.get('test_correct')
    if type(accepted) is not int or type(correct) is not int or not 0 <= correct <= accepted or not accepted:
        return False
    # Lower end of the two-sided 95% Wilson interval for joint correctness.
    z = 1.959963984540054
    p = correct / accepted
    lower = (p + z*z/(2*accepted) - z*math.sqrt(p*(1-p)/accepted + z*z/(4*accepted*accepted))) / (1 + z*z/accepted)
    return lower >= MIN_JOINT_PRECISION_LOWER_BOUND


def approved_cutoffs(model_version, query, material):
    if not isinstance(model_version, str) or not model_version or not isinstance(query, str):
        return None
    path = settings.SNAPTURE_ML_DIR / 'models' / 'scan_confidence_policy.json'
    try:
        raw = path.read_bytes()
        policy = json.loads(raw)
    except (OSError, ValueError):
        return None
    if not isinstance(policy, dict) or (
        policy.get('schema') != 'snapture-scan-confidence-v1' or
        policy.get('detector') != MODEL_DIR.name or
        policy.get('filter_version') != FILTER_VERSION or
        policy.get('queries') != [name for name, _ in PROMPTS] or
        policy.get('model_version') != model_version
    ):
        return None
    tuning, test = policy.get('validation_reference'), policy.get('test_reference')
    if not all(isinstance(ref, str) and ref.strip() for ref in (tuning, test)) or tuning.strip() == test.strip():
        return None
    entries = policy.get('entries')
    if not isinstance(entries, list):
        return None
    matching = [entry for entry in entries if isinstance(entry, dict)
                and entry.get('query') == query and entry.get('material') == material]
    if len(matching) != 1:
        return None
    entry = matching[0]
    if not all(_valid_cutoff(entry.get(key)) for key in ('object_cutoff', 'material_cutoff')) or not _has_precision_evidence(entry):
        return None
    return {**entry, 'digest': hashlib.sha256(raw).hexdigest()}
