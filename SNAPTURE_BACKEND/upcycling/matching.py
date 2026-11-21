"""Progressive, per-project matching. Preliminary ideas are never clearance."""
from copy import deepcopy,copy
from core.recommendations import CATALOG
from core.materials import SCOPE_LABELS
from core.project_sizes import CATALOG_FIT, estimated_dimensions
from .catalog_requirements import CATALOG_SOURCE, GUIDE_UPDATES
from .models import ProjectRequirement, InventoryLot
from .assessment import facts_for

UNKNOWN={None,'','Not sure','Unknown','Other / unknown'}

def apply_catalog_fit(spec, design):
    merged = {**spec, 'minimum_quantity': max(spec.get('minimum_quantity', 1), design['minimum_quantity'])}
    dimensions = deepcopy(spec.get('dimensions', {}))
    for name, bounds in design['dimensions'].items():
        limits = dimensions.setdefault(name, {})
        if 'minimum' in bounds:
            limits['minimum'] = max(limits.get('minimum', 0), bounds['minimum'])
        if 'maximum' in bounds:
            limits['maximum'] = min(limits.get('maximum', bounds['maximum']), bounds['maximum'])
    merged['dimensions'] = dimensions
    if design.get('shapes'):
        merged['shapes'] = design['shapes']
    return merged

def catalog(record):
    ideas=deepcopy(CATALOG.get(record.decision,[]))
    from core.tutorial_media import catalog_photos, PHOTOS
    for idea in ideas:
        idea['basis']='educational_catalog'
        if idea['id'] in PHOTOS:idea['photos']=catalog_photos(idea['id'])
    from core.content import published_guidance
    for entry in published_guidance(record.decision,kinds=('project',)):
        if entry.review_level!='expert_reviewed' or not entry.reviewed_by_id:continue
        ideas.append({'id':f'{entry.key}:v{entry.version}','title':entry.title,'summary':entry.summary,
                      'materials':entry.materials,'steps':entry.instructions,'safety_note':entry.warnings,
                      'review':{'source':entry.source,'digest':entry.content_digest,'review_level':entry.review_level},
                      '_published_requirements':entry.requirements,'_minimum_quantity':entry.minimum_quantity})
    return ideas

def safety_block(record,facts):
    from predictions.disposal_workflow import special_kind
    if facts.get('material_scope_report') in {'glass','metal'}:
        return 'You reported glass or metal. This material requires separate handling under SNAPTURE’s project rules.'
    if special_kind(record) or (record.answers or {}).get('reported_category') in {'A','B2','C'}:return 'This item requires separate handling; no upcycling project is cleared.'
    if facts.get('previous_contents')=='Chemical or cleaning product' or facts.get('condition')=='Moldy or contaminated':return 'Known chemical exposure or contamination excludes these household projects.'
    if (record.answers or {}).get('contamination') in {'Chemical contamination','Mold or biological waste','Oil or grease'}:return 'The reported contamination requires separate handling.'
    if record.decision=='dry_untreated_wood_scraps' and facts.get('wood_treatment') in {'Paint, treatment, nails, or mold','Yes'}:return 'Treated, painted, moldy or hardware-containing wood is not cleared.'
    return ''

def evaluate_requirements(spec, facts, *, require_visual_evidence=True):
    missing=[];failed=[]
    for key,field in (('object_types','object_type'),('shapes','shape'),('conditions','condition')):
        allowed=spec.get(key,[])
        if not allowed:continue
        value=facts.get(field)
        if value in UNKNOWN:missing.append(field)
        elif value not in allowed:failed.append(f'{field.replace("_"," ").title()} does not meet this project requirement.')
    for name,limits in spec.get('dimensions',{}).items():
        value=facts.get('dimensions',{}).get(name)
        if value is None:missing.append(name+(' in mL' if name=='capacity' else ' in mm'))
        elif value<limits.get('minimum',0) or value>limits.get('maximum',100000):failed.append(f'{name.title()} is outside this project’s allowed range.')
    for field,allowed in spec.get('visible_characteristics',{}).items():
        if facts.get(field) in UNKNOWN:
            if require_visual_evidence:missing.append(field)
        elif facts[field] not in allowed:failed.append(f'{field.replace("_"," ").title()} does not meet this project requirement.')
    return missing,failed

def _suggestions(record,goal='',use_inventory=False):
    from core.assessment import CONDITIONS,CONTENTS
    facts=facts_for(record)
    blocked=safety_block(record,facts)
    if record.decision not in SCOPE_LABELS:
        evidence=(record.image_quality or {}).get('material_prediction',{})
        candidate=evidence.get('raw_class')
        if candidate in SCOPE_LABELS and evidence.get('status')!='not_applicable' and not blocked:
            proposed=copy(record);proposed.decision=candidate
            result=suggestions(proposed,goal,use_inventory)
            for row in result['items']:
                row.update(can_start=False,preliminary=True,status='needs_information')
                row['missing_information']=list(dict.fromkeys(['material confirmation',*row['missing_information']]))
                row['reasons']=['Possible material match only. Confirm or correct the material before proceeding.']
            result.update(outcome='needs_information',message=f'Unconfirmed {candidate.replace("_"," ")} suggestion. These ideas are preliminary; confirm or correct the material.',material_suggestion=candidate)
            return result
        name=record.model_class.lower()
        return {'items':[],'outcome':'no_suitable_project','message':'Keep broken glass separate and follow the local sharps-handling guidance.' if 'glass' in name else 'Material identity is uncertain or outside the supported categories. Correct it or use separate handling guidance.','assessment_required':True}
    if blocked:return {'items':[],'outcome':'no_suitable_project','message':blocked,'assessment_required':True}
    from .workflow import enabled, inspection_first
    scan = (record.image_quality or {}).get('scan_details') or {}
    estimate = estimated_dimensions(record.decision, scan.get('approximate_size', ''))
    reuse_scan_size = inspection_first(record)
    if reuse_scan_size and estimate:
        facts = {**facts, 'dimensions': {**facts.get('dimensions', {}), **estimate}}
    # Inspection-first accepts a documented inspection. Keep enforcing any
    # validated observations that are available for the same material.
    require_visual_evidence = not (reuse_scan_size and facts.get('inspection_condition_basis') == 'user_reported')
    estimated_facts = facts if reuse_scan_size else {**facts, 'dimensions': {**estimate, **facts.get('dimensions', {})}}
    configured={r.recommendation_id:r for r in ProjectRequirement.objects.filter(material=record.decision,published=True)}
    rows=[]
    for idea in catalog(record):
        requirement=configured.get(idea['id'])
        spec=deepcopy(requirement.specification) if requirement else {}
        if requirement and requirement.source.startswith(CATALOG_SOURCE):
            idea.update(deepcopy(GUIDE_UPDATES.get(idea['id'], {})))
            idea['safety_note'] = ' '.join(spec.get('safety', []))
        if not requirement and '_published_requirements' in idea:
            spec={'minimum_quantity':idea['_minimum_quantity'],'conditions':idea['_published_requirements'].get('condition',[])}
        reviewed_spec = spec
        design = CATALOG_FIT.get(idea['id'])
        if design and (not requirement or inspection_first(record)):
            spec = apply_catalog_fit(spec, design)
        missing,failed=evaluate_requirements(spec,facts,require_visual_evidence=require_visual_evidence)
        size_missing,size_failures=evaluate_requirements({'dimensions':spec.get('dimensions',{})},estimated_facts)
        failed.extend(reason for reason in size_failures if reason not in failed)
        missing=list(missing)
        if enabled(record):
            for key in ('minimum_quantity','conditions','dimensions','tools','additional_materials','safety','checkpoint_criteria','final_criteria','visible_characteristics'):
                if key not in reviewed_spec:missing.append('published requirement: '+key.replace('_',' '))
            if inspection_first(record) and not spec.get('dimensions'):
                missing.append('published per-piece size or capacity limits')
            for field in ('damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'):
                allowed=spec.get('visible_characteristics',{}).get(field)
                if not isinstance(allowed,list) or not allowed or any(not isinstance(v,str) or not v.strip() for v in allowed):
                    missing.append('reviewed visual acceptance: '+field.replace('_',' '))
            for key in ('conditions','safety','checkpoint_criteria','final_criteria'):
                values=spec.get(key)
                if not isinstance(values,list) or not values or any(not isinstance(v,str) or not v.strip() for v in values):
                    missing.append('nonempty reviewed '+key.replace('_',' '))
            if len(spec.get('checkpoint_criteria',[]))!=len(idea.get('steps',[])):
                missing.append('one reviewed checkpoint criterion for every project step')
            if not (requirement and requirement.source.strip()):
                missing.append('published source for complete physical and verification requirements')
        if not requirement and '_published_requirements' not in idea:missing.append('published project-specific suitability requirements')
        requires_project_review = any(item.startswith(('published ', 'reviewed visual acceptance:', 'nonempty reviewed ', 'one reviewed checkpoint')) for item in missing)
        if '_published_requirements' in idea:
            for field,allowed in idea['_published_requirements'].items():
                if facts.get(field) in UNKNOWN:missing.append(field)
                elif facts[field] not in allowed:failed.append(f'{field.replace("_"," ")} does not match published guidance.')
        checks=facts.get('project_checks',{}).get(idea['id'],{})
        for key in ('tools','additional_materials','safety'):
            if spec.get(key) and not checks.get(key):missing.append(key.replace('_',' ')+' confirmation')
        if (record.answers or {}).get('user_confirmed_material')!=record.decision:
            from core.assessment import high_confidence_scan_material
            if not enabled(record) and not high_confidence_scan_material(record):missing.append('material confirmation')
        if record.additional_views.exists() and not (record.image_quality or {}).get('combined_material'):
            from .assessment import visual_summary
            if visual_summary(record)['conflicts'] and (record.answers or {}).get('user_confirmed_material')!=record.decision:
                missing.append('material confirmation after conflicting views')
        if facts.get('condition') not in [*CONDITIONS,'Torn or crumpled, clean and dry','Clean dry usable scraps'] or facts.get('condition') in UNKNOWN:missing.append('condition')
        if facts.get('previous_contents') not in CONTENTS[:3]:missing.append('previous contents / chemical contact')
        if record.decision in {'pete_bottles','hdpe_containers'} and facts.get('resin_mark')!={'pete_bottles':'PET/PETE code 1','hdpe_containers':'HDPE code 2'}[record.decision]:missing.append('resin mark')
        if record.decision=='dry_untreated_wood_scraps' and facts.get('wood_treatment')!='Known untreated and free of paint, mold and hardware':missing.append('untreated wood history')
        if facts.get('condition') in {'Needs cleaning','Not sure'}:missing.append('clean and dry usable material')
        if facts.get('condition')=='Damaged or cracked' and not spec.get('conditions'):missing.append('project-specific damage acceptance')
        quantity=facts.get('quantity')
        if use_inventory:
            quantity=0
            for lot in InventoryLot.objects.filter(user=record.user,material=record.decision,confirmed=True):
                lm,lf=evaluate_requirements(spec,lot.attributes)
                # Pool only lots that meet this project's checks and share known safe history.
                safe_history=not safety_block(record,lot.attributes)
                if record.decision=='dry_untreated_wood_scraps' and lot.attributes.get('wood_treatment')!='Known untreated and free of paint, mold and hardware':safe_history=False
                if lot.attributes.get('condition')=='Damaged or cracked' and 'Damaged or cracked' not in spec.get('conditions',[]):safe_history=False
                if record.decision in {'pete_bottles','hdpe_containers'} and lot.attributes.get('resin_mark')!={'pete_bottles':'PET/PETE code 1','hdpe_containers':'HDPE code 2'}[record.decision]:safe_history=False
                if not lm and not lf and safe_history and lot.attributes.get('condition') not in UNKNOWN | {'Needs cleaning','Moldy or contaminated'} and lot.attributes.get('previous_contents') not in UNKNOWN and lot.attributes.get('previous_contents')!='Chemical or cleaning product':quantity+=lot.quantity-lot.consumed
        required=spec.get('minimum_quantity',1)
        if spec.get('maximum_quantity') and quantity and quantity>spec['maximum_quantity']:
            # Extra stock is not a reason to reject a project; allocate at most the maximum.
            quantity=spec['maximum_quantity']
        if quantity is None:missing.append('usable quantity')
        deficit=max(0,required-(quantity or 0)) if quantity is not None else None
        physical_mismatch=bool(size_failures or deficit or (reuse_scan_size and size_missing))
        state='not_suitable' if failed else 'needs_information' if missing else 'more_materials' if deficit else 'suitable'
        public={k:v for k,v in idea.items() if not k.startswith('_')}
        rows.append({**public,'status':state,'preliminary':state!='suitable','can_start':state=='suitable',
                     'missing_information':list(dict.fromkeys(missing)),'reasons':failed or [f'Matches {record.title}; requirements checked against confirmed information.' if state=='suitable' else 'Potential project; confirm its listed requirements before starting.'],
                     'requirements':spec,'available_quantity':quantity,'additional_quantity':deficit,'physical_mismatch':physical_mismatch,
                     'requires_project_review':requires_project_review,
                     'requirements_source':requirement.source if requirement else (idea.get('review') or {}).get('source'),
                     'goal_match':bool(goal and goal in spec.get('goals',[]))})
    rank={'suitable':0,'more_materials':1,'needs_information':2,'not_suitable':3}
    rows.sort(key=lambda row:(not row['goal_match'],rank[row['status']]))
    outcome=next((s for s in ('suitable','more_materials','needs_information') if any(row['status']==s for row in rows)),'no_suitable_project')
    return {'items':rows,'outcome':outcome,'message':{'suitable':'Suitable projects found. Check tools and safety requirements.','more_materials':'Collect additional compatible materials for these projects.','needs_information':'Preliminary ideas are available. Confirm the missing requirements.','no_suitable_project':'No current project fits. Review other project types, collect suitable material, or consult separate recycling guidance.'}[outcome],
            'facts':facts,'fact_sources':{key:'item_details' if key=='dimensions' and reuse_scan_size and estimate else ((record.answers or {}).get('suitability_facts',{}).get(key) or {}).get('source','ai_observed' if key in {'object_type','shape','damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'} else 'user_reported') for key in facts},
            'quantity_basis':'confirmed inventory lots' if use_inventory else 'reported usable quantity'}


def suggestions(record,goal='',use_inventory=False):
    from .human_assisted import enabled as human_enabled, suggestions as human_suggestions
    if human_enabled(record):return human_suggestions(record)
    from .feedback import assessment_feedback
    result=_suggestions(record,goal,use_inventory)
    facts=facts_for(record)
    result.setdefault('facts',facts)
    result['assessment_feedback']=assessment_feedback(record,facts,safety_block(record,facts))
    from .workflow import enabled,inspection_first,verdict
    if enabled(record):
        for key in ('damage','deformation','wet_appearance','visible_contamination','usable_portions','structural_appearance'):
            if key in facts:result.setdefault('fact_sources',{})[key]='ai_observed'
        if inspection_first(record):
            result['items']=[idea for idea in result.get('items',[]) if not idea['physical_mismatch'] and idea['status']!='not_suitable']
            if not result['items']:result['outcome']='no_suitable_project'
        decision=verdict(record,result.get('items',[]))
        result['verdict']=decision
        if not decision['can_start']:
            for idea in result.get('items',[]):
                idea.update(can_start=False,preliminary=True)
            result['message']=decision['reason']
        if decision['code']=='for_disposal' or facts.get('material_scope_report')=='out_of_scope':
            result['items']=[]
            result['outcome']='no_suitable_project'
    return result
