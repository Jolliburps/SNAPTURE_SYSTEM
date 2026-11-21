"""Actionable feedback for reported answers, never a claim of AI verification."""

def assessment_feedback(record, facts, blocked=''):
    notices=[]
    def add(code,title,message):
        notices.append({'code':code,'title':title,'message':message})
    condition=facts.get('condition')
    if blocked:
        add('separate_handling','This item is not cleared for upcycling',blocked+' Changing only the condition to clean and dry does not resolve a reported chemical history or other handling restriction.')
    if condition=='Needs cleaning':
        if blocked:
            add('needs_cleaning','Cleaning is not clearance','Do not treat cleaning as a way to remove the reported handling restriction. Review the item history before proceeding.')
        else:
            extra={
                'paper':'Keep paper dry; do not wash it.',
                'cardboard':'Keep cardboard dry; do not soak it. Drying does not restore lost strength or remove contamination.',
                'dry_untreated_wood_scraps':'Confirm untreated history before any preparation; do not sand or cut unknown wood.',
            }.get(record.decision,'Use the applicable material preparation instructions only after confirming its previous contents are safe.')
            add('needs_cleaning','Preparation needed',extra+' After preparation, reassess the item and update its actual condition. A new photo can document the change; the app does not automatically mark it clean and dry.')
    elif condition=='Damaged or cracked':
        add('damage','Damage needs a project-specific check','Check the remaining usable shape, size and strength against the selected project. Damage is accepted only when that project explicitly permits it; it does not automatically mean usable or unusable.')
    elif condition=='Moldy or contaminated':
        add('contamination','Do not start a household upcycling project','Keep this item separate. Do not select clean and dry just to unlock a project; cleaning alone does not establish that contaminated material is suitable.')
    elif condition in {'Clean and dry','Torn or crumpled, clean and dry','Clean dry usable scraps'}:
        add('condition_reported','Condition recorded from your answer',f'You reported: {condition}. This is not AI verification. Material identity, previous contents, quantity and the selected project requirements must still pass before starting.')
    else:
        add('condition_unknown','Condition still needs confirmation','Inspect the item and provide its actual condition. Another photo may document unclear areas, but it does not resolve uncertainty while automatic condition checking is unavailable.')
    history=facts.get('previous_contents')
    if history not in {'Water or beverage','Food or oil','No chemical contact known','Chemical or cleaning product'}:
        add('history_unknown','Previous contents are uncertain','Confirm what the item held or contacted. A photo or high material confidence cannot establish its chemical history.')
    elif history=='Food or oil' and not blocked:
        add('food_history','Check the reported food or oil contact','Food or oil history alone is not confirmation of current contamination. Assess any remaining residue and follow applicable preparation guidance; actual oil or grease contamination can exclude the item.')
    if record.decision in {'pete_bottles','hdpe_containers'}:
        expected={'pete_bottles':'PET/PETE code 1','hdpe_containers':'HDPE code 2'}[record.decision]
        mark=facts.get('resin_mark')
        if mark!=expected:
            add('resin_mark','Check the recycling code',f'This category requires {expected}. '+('The selected code does not confirm this material. Review the category and the actual marking.' if mark in {'Another code','PET/PETE code 1','HDPE code 2'} else 'Read the actual marking; do not guess from appearance.'))
    if record.decision=='dry_untreated_wood_scraps' and facts.get('wood_treatment')!='Known untreated and free of paint, mold and hardware':
        add('wood_history','Confirm the wood history','Unknown treatment history needs confirmation. Painted, treated, moldy or hardware-containing pieces are excluded from the current household projects.')
    return notices
