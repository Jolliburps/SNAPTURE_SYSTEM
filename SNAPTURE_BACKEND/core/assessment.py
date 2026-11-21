"""Independent material, segregation and project decisions with explicit unknowns."""
from .content import published_guidance
from .materials import SCOPE_LABELS, material_info

VERSION = "assessment-v3"
PLASTICS = {"pete_bottles", "hdpe_containers"}
UNKNOWN = {"", "Not sure", "Other / unknown", "I do not know"}
CONDITIONS = ["Clean and dry", "Needs cleaning", "Damaged or cracked", "Moldy or contaminated", "Not sure"]
CONTENTS = ["Water or beverage", "Food or oil", "No chemical contact known", "Chemical or cleaning product", "Other / unknown"]
WOOD = ["Known untreated and free of paint, mold and hardware", "Paint, treatment, nails, or mold", "Not sure"]


def question_schema(label):
    from .waste_taxonomy import CONTAMINATION, MOISTURE, OTHER_MATERIALS, CATEGORY_NAMES
    fields = [
        {"id": "condition", "label": "What is the current condition?", "options": CONDITIONS + (["Torn or crumpled, clean and dry"] if label == "paper" else ["Clean dry usable scraps"] if label in {"cardboard", "fabric_scraps"} else []), "required": True},
        {"id": "previous_contents", "label": "What do you know about its previous contents or contact with chemicals?", "options": CONTENTS, "required": True},
    ]
    if label in PLASTICS:
        fields.insert(0, {"id": "resin_mark", "label": "Read the recycling mark on the item. What code can you actually see?", "options": ["PET/PETE code 1", "HDPE code 2", "Another code", "Not sure"], "required": True})
    if label == "dry_untreated_wood_scraps":
        fields.append({"id": "wood_treatment", "label": "What do you know about the wood's history? Appearance alone cannot confirm treatment.", "options": WOOD, "required": True})
    fields.extend([
        {'id': 'contamination', 'label': 'What residue or contamination is present?', 'options': CONTAMINATION, 'required': True},
        {'id': 'moisture', 'label': 'Is the material dry or wet?', 'options': MOISTURE, 'required': True},
    ])
    if label not in SCOPE_LABELS:
        fields.extend([
            {'id': 'other_material', 'label': 'If known, what is the material? This does not enable upcycling.', 'options': OTHER_MATERIALS, 'required': False},
            {'id': 'reported_category', 'label': 'Which group do you believe it belongs to? This is your report, not a verified bin assignment.', 'options': list(CATEGORY_NAMES), 'required': False},
        ])
    return fields


def _trace(entry):
    return {"key": entry.key, "version": entry.version, "source": entry.source,
            "reviewed_at": entry.reviewed_at.isoformat(), "digest": entry.content_digest,
            "review_level": entry.review_level, "review_note": entry.review_note}


def _matches(entry, context):
    return all(context.get(key) not in UNKNOWN and context.get(key) in values for key, values in entry.requirements.items())


def high_confidence_scan_material(record):
    data = record.image_quality or {}
    evidence = data.get('high_confidence_material')
    if (not isinstance(evidence, dict) or record.decision not in SCOPE_LABELS or
            evidence.get('label') != record.decision or data.get('user_object_name')):
        return False

    from predictions.confidence_policy import approved_cutoffs
    policy = approved_cutoffs(record.model_version, evidence.get('query'), record.decision)
    return bool(policy and policy['digest'] == evidence.get('policy_digest'))


def assess(record, *, include_projects=False):
    answers = record.answers if isinstance(record.answers, dict) else {}
    label = record.decision if record.decision in SCOPE_LABELS else "unknown_unsupported"
    confirmed = answers.get("user_confirmed_material") == label and label in SCOPE_LABELS
    high_confidence = high_confidence_scan_material(record)
    identity_ready = confirmed or high_confidence
    identified = label in SCOPE_LABELS and (identity_ready or record.confidence >= record.threshold)
    if "candidate-unverified" in record.model_version and not identity_ready:
        identified = False
    if label in PLASTICS:
        identified = identified and answers.get("resin_mark") == {"pete_bottles": "PET/PETE code 1", "hdpe_containers": "HDPE code 2"}[label]
    context = {**answers, "condition": record.condition, "previous_contents": record.previous_contents}
    fields = question_schema(label)
    if high_confidence and label in {'paper', 'cardboard'}:
        fields.append({'id': 'paper_surface', 'label': 'Check the paper surface and personal details',
                       'options': ['Plain uncoated material without personal details', 'Coated, glossy, or personal details', 'Not sure'], 'required': True})
    if not identity_ready or (confirmed and label in PLASTICS and not high_confidence):
        fields.insert(0, {"id": "material_confirmation", "label": "Select a material only if you can identify it. This is your selection, not an AI confirmation.",
                          "options": list(SCOPE_LABELS) + ["Not sure"], "required": True})
    pending = [field["id"] for field in fields if field.get('required', True) and field["id"] != "material_confirmation" and (context.get(field["id"], "") in UNKNOWN or context.get(field["id"]) not in field["options"])]
    reasons = []
    if not identified:
        reasons.append("Material identity needs confirmation or the item is unsupported.")
    if record.condition in {"Moldy or contaminated", "Damaged or cracked"}:
        reasons.append("The reported condition excludes this item from the prototype's low-risk projects.")
    if record.condition == "Needs cleaning":
        reasons.append("Prepare the item and reassess its condition before selecting a project.")
    if answers.get('contamination') not in {None, 'None known'}:
        reasons.append('Reported residue or contamination must be resolved and reassessed; no reuse ideas are enabled.')
    if answers.get('moisture') == 'Wet':
        reasons.append('Dry the material only when safe, then reassess it. Wet material is not ready for a project.')
    if record.previous_contents == "Chemical or cleaning product":
        reasons.append("Reported chemical contents exclude this item from upcycling in this prototype.")
    from .waste_taxonomy import FINE_CLASSES
    from predictions.disposal_workflow import special_kind
    special = bool(special_kind(record))
    if special or FINE_CLASSES.get(record.model_class, ('', None))[0] == 'C' or answers.get('reported_category') not in {None, 'B1'} or answers.get('other_material') == 'Battery / electronic item':
        reasons.append('Potential special-handling or residual item: no prototype reuse project is enabled.')
    if label == "dry_untreated_wood_scraps" and answers.get("wood_treatment") not in {None, "", "Not sure", WOOD[0]}:
        reasons.append("Wood treatment, mold or hardware has not been ruled out.")
    catalog_entries = published_guidance(label, kinds=None if include_projects else ('segregation', 'information')) if label in SCOPE_LABELS else []
    entries = catalog_entries if identified else []
    rules = [entry for entry in entries if entry.kind == "segregation"]
    matched = [entry for entry in rules if _matches(entry, context)]
    if special or record.previous_contents == 'Chemical or cleaning product' or answers.get('contamination') in {'Chemical contamination', 'Oil or grease', 'Mold or biological waste', 'Not sure'} or answers.get('moisture') == 'Wet' or FINE_CLASSES.get(record.model_class, ('', None))[0] == 'C':
        matched = []
    segregation = {"status": "needs_information" if not identified else "awaiting_review", "category": None,
                   "instructions": [], "explanation": "No applicable reviewed local rule is published for this item.", "sources": []}
    if matched:
        categories = {entry.category for entry in matched}
        segregation = {"status": "available" if len(categories) == 1 else "conflicting_rules",
                       "category": matched[0].category if len(categories) == 1 else None,
                       "instructions": list(dict.fromkeys(line for entry in matched for line in entry.instructions)) if len(categories) == 1 else [],
                       "explanation": ("General public-source guidance; local acceptance must be confirmed. Not CESD approval." if any(entry.review_level == "source_checked" for entry in matched) else "Based on published reviewed guidance and your answers.") if len(categories) == 1 else "Published rules conflict; a content reviewer must resolve this.",
                       "sources": [_trace(entry) for entry in matched]}
    elif rules:
        segregation["status"] = "needs_information" if pending else "no_matching_rule"
        segregation["explanation"] = "No reviewed rule matches the supplied details. Do not infer a disposal category."
    blocked = len(reasons) > (0 if identified else 1)
    eligible = []
    project_status, explanation = 'not_requested', 'Request recommendations after passing screening.'
    if include_projects:
        # A source citation alone is not expert verification of an exact DIY process.
        projects = [entry for entry in catalog_entries if entry.kind == "project" and entry.review_level == 'expert_reviewed' and entry.reviewed_by_id]
        eligible = []
        if identified and identity_ready and not pending and not blocked and record.quantity:
            for entry in projects:
                if _matches(entry, context) and record.quantity >= entry.minimum_quantity:
                    eligible.append({"id": f"{entry.key}:v{entry.version}", "title": entry.title, "summary": entry.summary,
                                     "materials": entry.materials, "steps": entry.instructions, "safety_note": entry.warnings,
                                     "quantity_note": f"Checked against {record.quantity} item(s).", "review": _trace(entry)})
        if blocked:
            project_status, explanation = "withheld", " ".join(reasons)
        elif label in SCOPE_LABELS and not projects:
            project_status, explanation = "awaiting_review", "No expert-reviewed project is published for this material yet. You do not need to answer extra project questions."
        elif not identified or not identity_ready or pending or not record.quantity:
            project_status, explanation = "needs_information", "Confirm the material, relevant history, condition and quantity. Unknown is not a safe answer."
        elif eligible:
            project_status, explanation = "available", "These published projects match the supplied details. This is not a safety certification."
        else:
            project_status, explanation = "not_eligible", "No published project matches these details and quantity."
    safety = None
    if record.previous_contents == "Chemical or cleaning product":
        precautions = next((entry for entry in published_guidance(kinds=('information',)) if entry.key == "cesd-household-hazardous" and entry.kind == "information"), None)
        if precautions:
            safety = {"title": precautions.title, "instructions": precautions.instructions,
                      "explanation": "Based on your reported chemical contact, not a hazard detected by the camera. Ask CESD for item-specific handling instructions.",
                      "sources": [_trace(precautions)]}
    catalog_rules = [entry for entry in catalog_entries if entry.kind == 'segregation']
    sorting_keys = {key for entry in catalog_rules for key in entry.requirements}
    if catalog_rules:
        sorting_keys.update({'condition', 'contamination', 'moisture'})
    if not identity_ready:
        sorting_keys.add('material_confirmation')
    if label in PLASTICS:
        sorting_keys.add('resin_mark')
    if high_confidence:
        sorting_keys.add('paper_surface')
        sorting_keys.update({'condition', 'contamination', 'moisture', 'previous_contents'})
    sorting_keys.update({'condition', 'contamination', 'moisture', 'previous_contents'})
    if label == 'dry_untreated_wood_scraps':
        sorting_keys.add('wood_treatment')
    catalog_projects = [entry for entry in catalog_entries if entry.kind == 'project' and entry.review_level == 'expert_reviewed' and entry.reviewed_by_id]
    result = {
        "version": VERSION,
        "material": {"label": label, "title": material_info(label)["title"], "status": "user_selected" if confirmed else "model_high_confidence" if high_confidence else "model_suggested" if identified else "needs_confirmation",
                     "input_method": record.input_method, "model_confidence": record.confidence, "model_version": record.model_version,
                     "explanation": "A material suggestion is not a segregation result or approval for a project."},
        "questions": fields, "missing_information": pending,
        "segregation": segregation,
        "upcycling": {"status": project_status, "explanation": explanation, "recommendations": eligible},
        "context": context,
        "safety": safety,
        "quick_check": {
            "has_sorting_rule": bool(catalog_rules), "has_reviewed_projects": bool(catalog_projects),
            "sorting_question_ids": [field['id'] for field in fields if field['id'] in sorting_keys],
            "project_question_ids": [field['id'] for field in fields if field.get('required', True)],
            "sorting_complete": segregation['status'] == 'available',
            "user_reviewed": bool(answers.get('assessment_checked_at')),
        },
    }
    from .management_guidance import management_guidance
    from .screening import evaluate
    result['screening'] = evaluate(record, result['material'], pending, reasons)
    result['upcycling']['suggested_ideas'] = []
    if include_projects and result['screening']['eligible']:
        from .scan_ideas import scan_ideas
        result['upcycling']['suggested_ideas'] = scan_ideas(record)
    result['management_guidance'] = management_guidance(result, record.model_class, include_reuse=include_projects)
    return result


def refresh(record):
    record.assessment = assess(record)
    # Screening updates must not erase a saved choice or any project snapshot.
    return record.assessment


def confirm_material(record, answers, provided_keys=None):
    """Accept user reports, never client-provided approval flags or model scores."""
    old = record.answers if isinstance(record.answers, dict) else {}
    selected = answers.get("material_confirmation")
    label = selected if selected in SCOPE_LABELS else None
    resin = answers.get("resin_mark") or answers.get("follow_up")
    if label and label not in PLASTICS:
        resin = None
        answers.pop("resin_mark", None)
        answers.pop("follow_up", None)
    if resin in {"PET/PETE code 1", "HDPE code 2"}:
        label = "pete_bottles" if resin == "PET/PETE code 1" else "hdpe_containers"
        answers["resin_mark"] = resin
    if selected == "Not sure" or (resin in {"Not sure", "Another code"} and (not label or label in PLASTICS)):
        record.decision = "unknown_unsupported"
        answers.pop("user_confirmed_material", None)
    elif label:
        if label != record.decision:
            record.condition = ""
            record.previous_contents = ""
            record.quantity = None
            for key in ("wood_treatment", "paper_surface", "contamination", "moisture", "other_material", "reported_category", "suitability_facts"):
                if key not in (provided_keys or set()):
                    answers.pop(key, None)
        record.decision = label
        answers["user_confirmed_material"] = label
    elif old.get("user_confirmed_material") == record.decision and selected is None:
        answers["user_confirmed_material"] = record.decision
    record.title = material_info(record.decision)["title"]
    record.answers = answers
