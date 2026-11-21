"""Physical fit, handling, and photo criteria for SNAPTURE's built-in projects."""

from copy import deepcopy

from core.project_sizes import CATALOG_FIT


CATALOG_SOURCE = 'SNAPTURE built-in catalog and per-piece design limits (catalog requirements v1).'
HAND_TOOLS = 'https://www.ccohs.ca/oshanswers/safety_haz/hand_tools/general.html'
WOOD_DUST = 'https://www.hse.gov.uk/construction/healthrisks/hazardous-substances/cutting-and-sanding-wood.htm'

PLASTIC_CUTTING = 'Have a capable adult secure the plastic on a work surface, use a tool suited to the plastic, and cut away from hands and body. Smooth or cover every cut edge.'
CRAFT_CUTTING = 'Use scissors suited to the material on a clear work surface. Keep fingers away from the blades and supervise children.'
SEWING = 'Remove pins and other sharp attachments from the fabric. Put needles away when finished and keep them away from children.'
SHELL = 'Use an already-open, cleaned shell. Set aside cracked or unstable pieces and smooth exposed sharp edges before use.'
WOOD = 'Use sound, dry, untreated pieces that are free of hardware. Use pieces already cut to fit, wear eye protection and control dust when hand-sanding.'


def criteria(*, tools, materials, safety, checkpoints, final, flexible=False, sources=()):
    conditions = ['Clean and dry']
    visible = {
        'damage': ['none visible'],
        'deformation': ['none visible'],
        'wet_appearance': ['dry'],
        'visible_contamination': ['none visible'],
        'usable_portions': ['whole item visible'],
        'structural_appearance': ['intact appearance'],
    }
    if flexible:
        conditions += ['Torn or crumpled, clean and dry', 'Clean dry usable scraps']
        visible['damage'].append('minor tears or creases')
        visible['deformation'].append('creased')
    return {
        'conditions': conditions, 'visible_characteristics': visible,
        'tools': tools, 'additional_materials': materials, 'safety': safety,
        'checkpoint_criteria': checkpoints, 'final_criteria': final,
    }, ' '.join((CATALOG_SOURCE, *sources))


REQUIREMENTS = {
    'pete_planter': criteria(
        tools=['Plastic-cutting hand tool'],
        materials=['Cotton wick', 'Potting mix', 'Small ornamental plant', 'Water', 'Edge covering or sandpaper'],
        safety=[PLASTIC_CUTTING, 'Use a bottle with a stable base and an upper section that sits securely inside it.',
                'Cover the reservoir opening and empty and scrub the reservoir weekly.'],
        checkpoints=['Two bottle sections with smooth or covered cut rims.',
                     'The inverted upper section rests securely in the base and the wick connects both sections.',
                     'The upper section holds the plant and the lower section shows water below the soil holder.'],
        final=['An upright planter with a seated soil holder, a separate water reservoir and a wick.',
               'The water reservoir is covered at the opening.'],
        sources=('https://www.scienceworld.ca/resource/self-watering-planter/', HAND_TOOLS,
                 'https://www.cdc.gov/mosquitoes/mosquito-control/mosquito-control-at-home.html'),
    ),
    'pete_organizer': criteria(
        tools=['Plastic-cutting hand tool'],
        materials=['Edge covering or sandpaper', 'Paint or fabric'],
        safety=[PLASTIC_CUTTING, 'Use the organizer upright for lightweight non-food supplies.'],
        checkpoints=['The bottle label has been removed.', 'The cut opening has a smooth or covered rim.',
                     'The upright organizer holds lightweight supplies.'],
        final=['An upright bottle base with a protected opening for desk supplies.'],
        sources=(HAND_TOOLS,),
    ),
    'pete_seed_set': criteria(
        tools=['Plastic-cutting hand tool'],
        materials=['Edge covering or sandpaper', 'Potting mix', 'Ornamental seeds', 'Labels'],
        safety=[PLASTIC_CUTTING, 'Use bottles with stable bases and keep drainage openings clear.'],
        checkpoints=['At least three bottle bases have protected rims and drainage openings.',
                     'Each prepared base contains potting mix and has been sown.',
                     'The seed starters are grouped upright and individually labeled.'],
        final=['At least three labeled, upright bottle seed starters with protected rims.'],
        sources=(HAND_TOOLS,),
    ),
    'hdpe_planter': criteria(
        tools=['Hand tool suitable for making openings in HDPE'],
        materials=['Potting mix', 'Ornamental plant', 'Edge covering or sandpaper'],
        safety=[PLASTIC_CUTTING, 'Use an upright container with a broad opening and a stable base.'],
        checkpoints=['The original contents have been emptied from the container.',
                     'The clean container has a visible empty interior.',
                     'Drainage openings are visible before filling and the pot is shown upright with a plant.'],
        final=['A stable HDPE pot with a protected rim and an ornamental plant.'],
        sources=(HAND_TOOLS,),
    ),
    'hdpe_storage': criteria(
        tools=[],
        materials=['Label'],
        safety=['Use an intact, stable container with an opening wide enough for the items. Store dry, non-food supplies.'],
        checkpoints=['The empty container interior appears clean and dry.', 'A label identifies the contents.',
                     'Dry non-food supplies sit inside the container.'],
        final=['A labeled, upright container holding non-food supplies.'],
    ),
    'hdpe_small_parts': criteria(
        tools=[],
        materials=['Label'],
        safety=['Check that the lid closes securely. Keep small parts away from young children.'],
        checkpoints=['The container and matching intact lid are visible together.',
                     'The container is labeled for its craft supplies.', 'The lid is seated on the filled container.'],
        final=['A labeled container with an intact, securely seated lid.'],
    ),
    'hdpe_scoop': criteria(
        tools=['HDPE-cutting hand tool', 'Sandpaper'],
        materials=[],
        safety=[PLASTIC_CUTTING, 'Use a rigid one-piece container whose molded handle is intact. Keep the cut away from the handle joint. Use the scoop for garden materials.'],
        checkpoints=['The scoop body and uncut molded handle are visible.',
                     'The entire scoop opening has visibly even, finished edges.',
                     'The scoop holds soil or compost and the handle remains intact.'],
        final=['A garden scoop with a continuous molded handle and a finished rim.'],
        sources=(HAND_TOOLS,),
    ),
    'cardboard_organizer': criteria(
        tools=['Ruler', 'Scissors'], materials=['Craft glue', 'Paper or fabric edge covering'],
        safety=[CRAFT_CUTTING, 'Use board firm enough to hold its shape. Keep the organizer dry and use it for lightweight items.'],
        checkpoints=['A flattened piece of board has measured sections.', 'The cut pieces form tray walls or dividers.',
                     'The joints are reinforced and exposed edges are covered.'],
        final=['A dry organizer with formed compartments, covered edges and connected joints.'],
    ),
    'cardboard_divider': criteria(
        tools=[], materials=['Tape or craft glue', 'Paper edge covering'],
        safety=['Select flat, firm panels that stand securely for a lightweight desk display.'],
        checkpoints=['At least three dry, firm panels have been selected.', 'The panels are joined without visible gaps at the seams.',
                     'The exposed edges are covered and the display stands on a flat surface.'],
        final=['Three or more joined panels forming a freestanding lightweight divider.'],
    ),
    'cardboard_craft': criteria(
        tools=['Pencil', 'Scissors'], materials=[],
        safety=[CRAFT_CUTTING, 'Draw the entire pattern on a firm, flat usable portion.'],
        checkpoints=['The intended outline fits on the usable board.', 'The cut edge follows the intended outline.',
                     'The finished pattern is intact and flat enough to trace.'],
        final=['An intact cardboard pattern with a recognizable outline.'], flexible=True,
    ),
    'paper_gift_wrap': criteria(
        tools=[], materials=['Tape or string'],
        safety=['Use a dry sheet that covers the selected non-food gift. Remove staples and other sharp attachments.'],
        checkpoints=['The sheet has no visible sharp attachments.', 'The sheet is flattened for folding.',
                     'The paper covers the gift and is secured by tape or string.'],
        final=['A wrapped non-food gift with secured folds.'], flexible=True,
    ),
    'paper_organizer': criteria(
        tools=['Ruler'], materials=['Craft glue'],
        safety=['Use stiff paper that holds a fold. Keep the tray dry and use it for lightweight objects.'],
        checkpoints=['The dry sheet or sheets have been selected for folding.', 'The folds form the bottom and sides of the tray.',
                     'A reinforcement is fitted to the tray base.'],
        final=['A folded paper tray with upright sides and a reinforced base.'],
    ),
    'paper_craft': criteria(
        tools=['Scissors'], materials=['Non-toxic craft glue', 'Backing paper if the design needs it'],
        safety=[CRAFT_CUTTING, 'Remove staples and use the clean, dry portions.'],
        checkpoints=['At least three usable paper pieces have been selected.', 'The pieces are laid out in the planned arrangement.',
                     'The pieces are incorporated into a card, collage or learning aid.'],
        final=['A recognizable paper craft using at least three selected pieces.'], flexible=True,
    ),
    'fabric_cleaning_cloth': criteria(
        tools=['Fabric scissors', 'Needle if hemming is needed'], materials=['Thread if hemming is needed'],
        safety=[CRAFT_CUTTING, SEWING, 'Select washable fabric that stays intact during ordinary use.'],
        checkpoints=['The washed, dry fabric is laid flat.', 'The selected cloth is trimmed to a usable section.',
                     'The edges are finished or made from fabric that does not fray.'],
        final=['A dry, intact cleaning cloth with no large holes or loose edge threads.'], flexible=True,
    ),
    'fabric_pouch': criteria(
        tools=['Needle or applicator for fabric adhesive'], materials=['Thread or fabric adhesive'],
        safety=[SEWING, 'Follow the adhesive label if gluing, and let joins set before using the pouch.'],
        checkpoints=['Two dry pieces are arranged so their sides align.', 'The joined edges form a pouch with an opening.',
                     'Small non-food items fit through the opening and sit inside.'],
        final=['A lightweight pouch with closed side seams and an accessible opening.'], flexible=True,
    ),
    'fabric_patchwork': criteria(
        tools=['Needle'], materials=['Thread'],
        safety=[SEWING, 'Use pieces that can hold stitches along the edges.'],
        checkpoints=['At least four suitable dry scraps have been sorted.', 'The scraps are laid out in the desired pattern.',
                     'The adjacent pieces are stitched into one decorative panel.'],
        final=['A decorative panel with at least four pieces joined at their edges.'], flexible=True,
    ),
    'coconut_planter': criteria(
        tools=['Sandpaper'], materials=['Removable inner pot or liner', 'Potting mix', 'Small ornamental plant'],
        safety=[SHELL, 'Choose a half that sits steadily or use a fitted stand. Empty any pooled water after watering.'],
        checkpoints=['The opened shell is free of visible flesh and residue.', 'The shell rim is evenly smoothed.',
                     'An ornamental plant sits in the liner or inner pot.'],
        final=['A lined ornamental plant holder with a finished rim and a stable base.'],
    ),
    'coconut_bowl': criteria(
        tools=['Sandpaper'], materials=['Non-toxic finish if desired'],
        safety=[SHELL, 'Set the bowl on a steady surface. Use it for dry, non-food objects.'],
        checkpoints=['The already-open shell interior is clean and dry.', 'The exposed rim is smooth and continuous.',
                     'The bowl holds dry, non-food objects.'],
        final=['A stable decorative shell bowl with a finished rim.'],
    ),
    'coconut_craft': criteria(
        tools=['Sandpaper'], materials=['Craft adhesive suitable for the shell and backing'],
        safety=[SHELL, 'Work with pieces already sized for the design. Keep small pieces away from young children.'],
        checkpoints=['At least two dry shell pieces are arranged for the craft.', 'The exposed edges are visibly smoothed.',
                     'The pieces are secured in the chosen decoration.'],
        final=['A decoration incorporating two or more attached pieces with finished exposed edges.'],
    ),
    'wood_shelf': criteria(
        tools=['Sandpaper', 'Clamps'], materials=['Wood glue'],
        safety=[WOOD, 'Use two matching supports with full contact on a flat surface. Follow the glue label and allow the joints to cure before using the shelf for lightweight items on a tabletop.'],
        checkpoints=['One dry shelf board and two matching supports are laid out.',
                     'All exposed edges are smoothed and parts fit together without gaps.',
                     'The shelf board and both supports are securely joined and stand upright on a tabletop.'],
        final=['A tabletop riser with a level top, two matching supports and visibly closed joints.'],
        sources=(HAND_TOOLS, WOOD_DUST),
    ),
    'wood_marker': criteria(
        tools=['Sandpaper', 'Marker'], materials=[],
        safety=[WOOD, 'Choose a piece with no splits and a blunt end for placing it in soil.'],
        checkpoints=['The dry wooden pieces are free of hardware.', 'Edges and ends are smoothed.',
                     'The label is readable when the marker is set in soil.'],
        final=['A legible plant marker with smooth edges and a blunt end.'],
        sources=(WOOD_DUST,),
    ),
    'wood_craft': criteria(
        tools=['Sandpaper'], materials=['Non-toxic finish if desired'],
        safety=[WOOD, 'Use the prepared pieces for decorative, non-load-bearing work. Follow the label of any finish.'],
        checkpoints=['Dry, untreated offcuts are selected for the craft.', 'The chosen edges and surfaces are smoothly finished.',
                     'The prepared pieces are laid out or used in a decorative craft.'],
        final=['Prepared wooden pieces with finished edges suitable for a decorative craft.'],
        sources=(WOOD_DUST,),
    ),
}


def project_specification(recommendation_id):
    specification, source = REQUIREMENTS[recommendation_id]
    return deepcopy({**CATALOG_FIT[recommendation_id], **specification}), source


GUIDE_UPDATES = {
    'pete_planter': {
        'summary': 'Turn a clean bottle into a planter with a wick that draws water from a reservoir below.',
        'materials': ['Clean PETE bottle', 'Plastic-cutting hand tool', 'Edge covering or sandpaper',
                      'Cotton wick', 'Potting mix', 'Small ornamental plant', 'Water'],
        'steps': ['Have a capable adult cut the empty bottle into a base and a top. Smooth or cover the cut rims.',
                  'Thread a cotton wick through the bottle neck. Invert the top into the base and check that it sits securely.',
                  'Add water below the neck. Put potting mix and a small plant in the top with the wick in the mix. Cover the opening around the reservoir.'],
    },
    'pete_organizer': {
        'steps': ['Remove the label from the bottle.', 'Have a capable adult cut off the top and cover or smooth the cut rim.',
                  'Decorate the base and stand it upright to store lightweight non-food supplies.'],
    },
    'pete_seed_set': {
        'steps': ['Have a capable adult cut the tops off three clean bottles, finish their rims and make drainage openings in the bases.',
                  'Put potting mix and seeds into each prepared base.',
                  'Label the starters and place them upright where the seedlings can grow.'],
    },
    'coconut_craft': {
        'materials': ['Pre-sized dry shell pieces', 'Sandpaper', 'Craft adhesive'],
        'steps': ['Lay out the dry shell pieces for your decoration.', 'Sand any rough edges on the pieces.',
                  'Secure the pieces to the decoration with suitable craft adhesive and let it set.'],
    },
    'wood_shelf': {
        'summary': 'Build a small freestanding tabletop shelf for lightweight items with three fitted boards.',
        'materials': ['One shelf board', 'Two matching wood supports', 'Sandpaper', 'Wood glue', 'Clamps'],
        'steps': ['Lay out one already-sized shelf board and two matching supports. Check for cracks and hardware.',
                  'Sand exposed edges and dry-fit the parts on a flat tabletop.',
                  'Glue and clamp both supports under the board. Let the glue cure as directed, then check that the shelf sits level without rocking.'],
    },
    'wood_marker': {
        'steps': ['Choose an already-sized piece of dry, untreated wood with no hardware.',
                  'Sand the edges and ends smooth.', 'Write the label and place the marker in the soil.'],
    },
    'wood_craft': {
        'steps': ['Choose dry, untreated pieces already sized for the craft.',
                  'Hand-sand exposed edges and surfaces in a suitable work area.',
                  'Arrange the pieces in the decorative craft. If using a finish, follow the product label.'],
    },
}
