"""Versioned educational advice; never changes a bin decision or project eligibility.

New assessments store this payload in the existing JSON snapshot. Older snapshots
can display a clearly identified reference supplement, derived only from that
item's saved material/context, without querying the current guidance catalogue.
"""
VERSION = 'management-reference-v1'
EPA = 'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables'
REUSE = 'https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100047Q.TXT'
BENEFITS = 'https://www.epa.gov/recycle/recycling-basics-and-benefits'
HAZARDS = 'https://www.epa.gov/hw/household-hazardous-waste-hhw'
COMPOST = 'https://www.epa.gov/recycle/composting-home'

# These are conditional general references, not validated DIY project procedures.
MATERIALS = {
    'pete_bottles': {
        'preparation': ['Read the actual PET/PETE code 1 mark. For a known food or beverage bottle accepted by your collector, empty remaining food or drink, rinse or scrape residue, and let it drain dry.', 'Ask the receiver whether to leave caps and labels attached; do not assume that crushing or removing caps is required.'],
        'recovery': ['Keep confirmed clean PETE bottles separate from food waste and other plastics for an accepting collector.', 'Avoid cutting, heating or melting bottles. Cutting-based upcycling concepts are awaiting safety review; no tracked project is enabled by this reference.'],
        'impact': 'Recovering accepted plastic can reduce demand for new raw materials. The resin mark alone does not mean a local collector accepts the item.',
    },
    'hdpe_containers': {
        'preparation': ['Read the actual HDPE code 2 mark and check the original contents. Only for a known food or beverage container accepted by your collector: empty food or drink, remove residue, and let it drain dry.', 'Keep chemical-product containers out of this cleaning and reuse process, even if they have code 2.'],
        'recovery': ['Separate confirmed clean HDPE from other materials and ask an accepting collector about caps and preparation.', 'A known beverage jug may be considered for watering ornamental plants without cutting or modification, only if intact and clean. Never use a chemical or unknown-content jug. This is a reference idea, not an approved project.'],
        'impact': 'Reusing a suitable container can avoid buying another item; recycling accepted HDPE can conserve raw materials.',
    },
    'paper': {
        'preparation': ['For known uncontaminated paper, keep it dry and separate from food scraps. Do not wash paper.', 'Check for coatings, grease, mixed materials and personal details. Ask your collector about coated or shredded paper instead of mixing it with plain paper.'],
        'recovery': ['Use clean plain sheets without personal details for scrap notes or non-food gift wrapping.', 'Offer remaining clean paper to a collector that accepts it. Keep shiny or laminated wrapping separate until acceptance is confirmed.'],
        'impact': 'Reusing paper extends its useful life. Recovered paper can replace some new paper fibre and conserve natural resources.',
    },
    'cardboard': {
        'preparation': ['For known uncontaminated cardboard, remove loose contents and keep it dry. Do not soak it.', 'Flatten an empty box for collection if the receiver requests it. Separate food scraps and ask about food-stained, waxed or mixed-material packaging.'],
        'recovery': ['Reuse an intact clean box for non-food storage or gift packaging before recycling.', 'Plain clean offcuts can be considered for decorative collage; use only suitable craft materials and follow their safety labels.'],
        'impact': 'Using a box again avoids some new packaging. Recycling accepted cardboard recovers useful paper fibre.',
    },
    'fabric_scraps': {
        'preparation': ['For known uncontaminated washable fabric, follow its care label and dry it completely before reuse.', 'Check for pins, sharp attachments, mold and chemical residues. Do not handle contaminated fabric as an ordinary cleaning cloth.'],
        'recovery': ['Use a clean dry offcut to dust a non-food surface; wash it according to its care instructions afterward.', 'Ask a textile recovery or donation program whether it accepts offcuts; do not assume fabric belongs in ordinary paper or plastic recycling.'],
        'impact': 'Reusing suitable cloth can replace disposable wipes and extend the life of an existing material. No waste or carbon saving is measured by this scan.',
    },
    'dry_untreated_wood_scraps': {
        'preparation': ['Check the wood history rather than its appearance. Keep painted, treated, moldy or unknown wood apart from known untreated pieces.', 'Do not cut, sand, drill or remove embedded nails as part of this app reference. Ask CESD about safe handling of bulky or sharp pieces.'],
        'recovery': ['Ask a wood recovery program whether it accepts the exact untreated offcut; no construction project is approved here.', 'Only known untreated wood chips may suit a managed compost system. Do not add painted or treated wood, and do not make chips with tools using this reference.'],
        'impact': 'Recovering suitable wood can extend the use of a resource. Managed composting accepts only suitable inputs, not every wooden object.',
    },
}

# Conditional references for hypotheses already emitted by the existing detector.
# This does not add supported classifier categories or turn a hypothesis into a bin.
OTHER_REFERENCES = {
    'glass bottle or glass jar': {
        'preparation': ['Only for a known intact food or beverage glass container accepted by the receiver: empty food or drink and rinse residue. Ask whether metal lids must be separated.', 'Do not handle broken glass with bare hands or put loose shards in ordinary recycling. Ask the collector how to contain and label broken glass safely.'],
        'recovery': ['Ask whether the receiver accepts this exact glass container. Drinking glasses, ceramics and heat-resistant glass can have different rules.', 'An intact clean jar with known food history may hold non-food small items. Do not reuse chipped or cracked glass.'],
        'impact': 'Accepted glass containers can be used to make new glass products, reducing demand for new raw material.',
    },
    'metal can': {
        'preparation': ['For a known empty food or drink can accepted by the collector, remove food residue. Avoid sharp edges.', 'Do not puncture, crush or empty pressurized cans, paint cans or containers with unknown contents. These need separate instructions.'],
        'recovery': ['Keep accepted clean food or beverage cans separate for metal recovery. Ask the receiver whether flattening or crushing is appropriate.', 'Do not cut a can for a DIY project using this reference; exposed metal edges can cause injury.'],
        'impact': 'Recycling accepted metal recovers a material that would otherwise require new resource extraction.',
    },
    'food scraps or fruit peel': {
        'preparation': ['If these are known fruit or vegetable scraps, separate them from plastic packaging, stickers, glass and chemicals.', 'Store suitable scraps in a closed container while arranging a managed compost method or confirmed collection. Wash hands after handling waste.'],
        'recovery': ['Consider managed composting for known suitable plant scraps. Ask CESD about a method suited to your space.', 'Do not add meat, fish, dairy, oils, pet waste or chemically contaminated material to a basic home compost setup. A photo cannot verify compost suitability.'],
        'impact': 'Composting suitable food scraps can return nutrients to soil and keep organic material out of landfill. No emissions reduction is measured here.',
    },
    'dry leaf': {
        'preparation': ['If these are known uncontaminated leaves, separate plastic, glass and sharp debris without handling unknown hazards.', 'Keep herbicide-treated or diseased plant material out of a basic home compost setup.'],
        'recovery': ['Known suitable dry leaves can supply carbon to a managed compost system. Ask CESD for an appropriate method.', 'Confirm whether your barangay has separate garden-waste collection before placing leaves out for pickup.'],
        'impact': 'Composting suitable garden material can help build soil and reduce material sent for disposal.',
    },
    'plastic bag or plastic wrapper': {
        'preparation': ['Keep clean packaging apart from food scraps, and check whether it is film or a mixed-material wrapper.', 'Do not mix flexible packaging into bottle recycling unless that receiver specifically accepts it. Do not wash unknown or chemical residues.'],
        'recovery': ['Ask whether a confirmed film or packaging collection program accepts this exact packaging. No local acceptance is guaranteed.', 'Reuse a clean intact bag for non-food storage only when its previous contents are known and safe. Do not burn or melt wrappers.'],
        'impact': 'Keeping unaccepted flexible packaging out of bottle recycling helps avoid contamination and sorting problems.',
    },
}


def management_guidance(assessment, model_class=''):
    from .waste_taxonomy import FINE_CLASSES
    material = assessment.get('material', {})
    context = assessment.get('context') if isinstance(assessment.get('context'), dict) else {}
    label = material.get('label')
    hazardous = (context.get('previous_contents') == 'Chemical or cleaning product'
                 or context.get('contamination') == 'Chemical contamination'
                 or context.get('other_material') == 'Battery / electronic item'
                 or context.get('reported_category') == 'C'
                 or FINE_CLASSES.get(model_class, ('', None))[0] == 'C')
    contaminated = (context.get('condition') == 'Moldy or contaminated'
                    or context.get('contamination') in {'Oil or grease', 'Mold or biological waste'})
    damaged = context.get('condition') == 'Damaged or cracked'
    reference = MATERIALS.get(label) or OTHER_REFERENCES.get(model_class)
    known = bool(reference)
    sections = []

    def add(key, title, lines):
        sections.append({'key': key, 'title': title, 'instructions': lines})

    if hazardous:
        add('disposal', 'Disposal Instructions', ['This item may require special handling. Keep it out of ordinary household waste and recycling; contact your barangay or CESD for the appropriate collection instructions.', 'Do not rinse, empty, mix, burn, puncture or repurpose it. Follow the original product label.'])
        add('preparation', 'Preparation Before Disposal', ['If safe, leave the product in its original labeled container. Do not transfer it to a food or drink container.', 'Do not handle leaking containers or exposed sharps; keep people away and seek instructions from local officials.'])
        add('recovery', 'Recycling and Reuse', ['No DIY reuse advice applies to this suspected hazardous item. Ask about an authorized recovery or collection service for the exact product.'])
    elif contaminated or damaged:
        add('disposal', 'Disposal Instructions', ['Keep this damaged or contaminated item separate from clean reusable materials. Ask your barangay or CESD how to collect this exact material and condition; do not assume it is ordinary residual waste.'])
        add('preparation', 'Preparation Before Disposal', ['Do not rinse unknown residues into drains or handle moldy material for reuse. Avoid sharp edges and keep it away from food and clean reusable materials.'])
        add('recovery', 'Recycling and Reuse', ['Reuse ideas are withheld for the reported condition. Ask the receiving service whether any recovery is possible before cleaning or transporting it.'])
    else:
        add('disposal', 'Disposal Instructions', ['Keep this item separate from food waste and suspected hazardous items. Use the existing sorting result above; a material suggestion is not a confirmed bin assignment.', 'If no receiving service accepts it, ask your barangay for its residual or special-collection route. Do not dump it in streets, drains or waterways, or burn it.'])
        if known:
            add('preparation', 'Preparation Before Disposal', reference['preparation'])
            add('recovery', 'Recycling and Reuse', reference['recovery'])
        else:
            add('preparation', 'Preparation Before Disposal', ['Identify the item and its previous contents before cleaning or combining it with other waste. Do not empty unknown contents.'])
            add('recovery', 'Recycling and Reuse', ['No material-specific reuse or recycling procedure is available for this unidentified or unsupported item. Retake a clearer photo or ask your barangay or CESD; do not guess a bin.'])
    safety = ['A photo cannot confirm contamination, previous contents or safe reuse. Do not burn, melt or use unknown material for food, toys or structural work.']
    if not hazardous and not contaminated and not damaged:
        safety.append('Preparation suggestions apply only after you recognize the material and know it has no chemical or biological contamination. If in doubt, keep it separate and ask for help.')
    if context.get('condition') == 'Damaged or cracked':
        safety.append('Do not reuse a cracked or damaged item. Avoid sharp edges and ask the receiving service how it should be safely presented.')
    add('safety', 'Safety Tips', safety)
    impact = ('Keeping hazardous or contaminated material out of ordinary recycling helps protect people and prevents contamination of recoverable materials.' if hazardous or contaminated
              else reference['impact'] if known
              else 'Correct identification helps avoid contaminating recycling. Reduction and safe reuse can conserve resources, but this scan does not measure environmental savings.')
    add('impact', 'Environmental Impact', [impact, 'This is general environmental information, not a measured carbon, energy or waste-saving claim for this item.'])
    add('local', 'Bacoor Collection Guidance', ['Ask your barangay or Bacoor CESD whether a collector, junkshop or recovery facility accepts this exact item and condition. Confirm preparation, collection day and receiving location before taking it there.', 'No current drop-off address, price or pickup schedule is verified by this recommendation. Consult the CESD reference library and your barangay for current instructions.'])
    sources = [
        {'title': 'US EPA: Common recyclables (general guidance, not Bacoor rules)', 'url': EPA},
        {'title': 'US EPA: Consumer handbook (general reuse concepts)', 'url': REUSE},
        {'title': 'US EPA: Recycling basics and benefits', 'url': BENEFITS},
        {'title': 'Bacoor City official website (confirm current services)', 'url': 'https://bacoor.gov.ph/'},
    ]
    if hazardous or contaminated:
        sources.append({'title': 'US EPA: Household hazardous waste precautions', 'url': HAZARDS})
    if label == 'dry_untreated_wood_scraps' or model_class in {'food scraps or fruit peel', 'dry leaf'}:
        sources.append({'title': 'US EPA: Composting at home (suitable and excluded inputs)', 'url': COMPOST})
    notice = 'General reference, not CESD approval or a safety certification. Conditional suggestions do not change the saved classification or unlock a project.'
    if material.get('status') != 'user_selected':
        notice = 'Material identity is not confirmed. Check that the material matches before using these conditional references. ' + notice
    if label not in MATERIALS and model_class in OTHER_REFERENCES:
        notice = f'Reference topic: possible {model_class}. This is not a confirmed material or bin assignment. ' + notice
    return {'version': VERSION, 'material_label': label, 'status': 'precaution_only' if hazardous or contaminated or damaged else 'general_reference',
            'notice': notice,
            'sections': sections, 'sources': sources, 'source_checked_on': '2026-10-21'}
