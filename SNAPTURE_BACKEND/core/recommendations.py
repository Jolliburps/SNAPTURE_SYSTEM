"""Rule-based, quantity-aware recommendations for the thesis scope."""

from __future__ import annotations

from .materials import material_info
from .tutorial_media import catalog_photos


CATALOG: dict[str, list[dict[str, object]]] = {
    "pete_bottles": [
        {"id": "pete_planter", "title": "Self-watering planter", "summary": "Use a clean bottle as a small planter with drainage for herbs or seedlings.", "materials": ["Clean PETE bottles", "Scissors", "Soil", "Small plants"], "steps": ["Carefully cut the bottle to form the planter.", "Make drainage holes in the bottle planter.", "Fill the planter with soil and add a small plant."]},
        {"id": "pete_organizer", "title": "Desk organizer", "summary": "Reuse a cut and decorated bottle to hold pens, small tools or art supplies.", "materials": ["Clean bottles", "Cutter", "Paint or fabric"], "steps": ["Remove the label from the bottle.", "Cover or smooth the cut rim so it has no sharp exposed edge.", "Decorate the bottle and use it to store non-food supplies."]},
        {"id": "pete_seed_set", "title": "Seed starter set", "summary": "Group clean bottle containers into labeled seed starters for herbs and other seedlings.", "materials": ["Bottles", "Soil", "Seeds", "Labels"], "steps": ["Prepare several clean bottle containers for the seed starters.", "Put soil and seeds into each prepared container.", "Label each container and place it where the seedlings can grow."]},
    ],
    "hdpe_containers": [
        {"id": "hdpe_planter", "title": "Durable plant pot", "summary": "Turn a clean HDPE container into a plant pot for non-food use.", "materials": ["Clean container", "Cutter", "Soil", "Plant"], "steps": ["Empty the container of its original contents.", "Wash the container and let it dry.", "Make safe drainage openings, then add soil and the plant."]},
        {"id": "hdpe_storage", "title": "Non-food storage bin", "summary": "Keep craft supplies, hardware or household tools together in a labeled, clean container.", "materials": ["Clean container", "Labels"], "steps": ["Clean the container and let it dry before using it.", "Label the container with the non-food items it will hold.", "Use the labeled container for non-food items only."]},
        {"id": "hdpe_small_parts", "title": "Small parts container", "summary": "Use one small HDPE container with an intact lid to hold beads or other non-food craft supplies that fit through its opening.", "materials": ["Clean small HDPE container with its lid", "Label"], "steps": ["Check that the clean, dry container closes securely.", "Label it for the non-food craft supplies it will hold.", "Put the supplies inside and close the lid."]},
        {"id": "hdpe_scoop", "title": "Garden scoop", "summary": "Cut the handle section from a sturdy, clean HDPE container to make a scoop for soil or compost.", "materials": ["Clean container", "Cutter", "Sandpaper"], "steps": ["Carefully cut out the handle area of the clean container to form the scoop.", "Smooth every cut edge of the scoop before using it.", "Use the finished scoop only for garden materials such as soil or compost."], "photos": catalog_photos("hdpe_scoop")},
    ],
    "cardboard": [
        {"id": "cardboard_organizer", "title": "Drawer organizer", "summary": "Make cardboard dividers and trays to separate small items in a desk or drawer.", "materials": ["Dry cardboard", "Ruler", "Glue", "Paper or fabric"], "steps": ["Flatten the cardboard and measure the pieces for the organizer.", "Cut the sections and fold them into shape.", "Reinforce the sections and cover their exposed edges."]},
        {"id": "cardboard_divider", "title": "Desk divider", "summary": "Join clean cardboard panels into a lightweight desk divider or display board.", "materials": ["Cardboard", "Tape or glue", "Decorative paper"], "steps": ["Choose dry cardboard pieces that are strong enough for the divider.", "Join the selected panels with tape or glue.", "Cover the exposed panel edges."]},
        {"id": "cardboard_craft", "title": "Craft template set", "summary": "Turn flat cardboard into reusable patterns for crafts and school projects.", "materials": ["Cardboard", "Pencil", "Scissors"], "steps": ["Draw the pattern you want to reuse on the cardboard.", "Carefully cut along the drawn outline.", "Keep the finished template for future projects."]},
    ],
    "paper": [
        {"id": "paper_gift_wrap", "title": "Gift wrapping", "summary": "Use a clean, flattened sheet of paper to wrap a gift or make a paper craft.", "materials": ["Dry paper", "String", "Tape"], "steps": ["Remove attachments that are not paper.", "Flatten the paper sheet before using it.", "Use the prepared sheet for wrapping or a paper craft."]},
        {"id": "paper_organizer", "title": "Paper organizer", "summary": "Fold sturdy, clean paper into small trays for notes and other small items.", "materials": ["Clean paper", "Ruler", "Glue"], "steps": ["Select clean, dry sheets for the trays.", "Measure the fold lines and fold the sheets along them.", "Reinforce the base of each folded tray."]},
        {"id": "paper_craft", "title": "Paper craft set", "summary": "Sort clean paper pieces for cards, collages or learning materials.", "materials": ["Paper", "Scissors", "Non-toxic glue"], "steps": ["Sort the paper pieces by their size and condition.", "Plan the card, collage or learning material you want to make.", "Use the selected pieces in the planned craft."]},
    ],
    "fabric_scraps": [
        {"id": "fabric_cleaning_cloth", "title": "Cleaning cloth", "summary": "Prepare suitable fabric offcuts as washable cloths for household cleaning.", "materials": ["Clean fabric", "Scissors", "Thread"], "steps": ["Wash the fabric and let it dry.", "Cut away damaged sections of the fabric.", "Hem any loose edges when needed."]},
        {"id": "fabric_pouch", "title": "Small storage pouch", "summary": "Sew or tie clean fabric pieces into a small pouch for storing non-food items.", "materials": ["Fabric", "Thread", "Needle or safe adhesive"], "steps": ["Choose clean fabric pieces for the pouch.", "Join the sides securely to hold the pouch together.", "Use the finished pouch to store small non-food items."]},
        {"id": "fabric_patchwork", "title": "Patchwork material", "summary": "Join compatible fabric scraps into a decorative patchwork piece.", "materials": ["Fabric scraps", "Thread", "Needle"], "steps": ["Sort the fabric scraps by their condition.", "Arrange the scraps into the pattern you want to make.", "Join the arranged pieces safely with a needle and thread."]},
    ],
    "coconut_shells": [
        {"id": "coconut_planter", "title": "Coconut-shell planter", "summary": "Use a cleaned coconut shell as a small decorative holder for a plant.", "materials": ["Clean shell", "Sandpaper", "Soil", "Small plant"], "steps": ["Remove any remaining coconut flesh from the shell.", "Sand the shell rim to remove sharp edges.", "Add a liner or place the plant safely in the prepared shell."]},
        {"id": "coconut_bowl", "title": "Decorative bowl", "summary": "Use an already-open, cleaned and smoothed coconut shell as a decorative holder for dry, non-food items.", "materials": ["Clean shell", "Sandpaper", "Non-toxic finish"], "steps": ["Clean the already-open shell and let it dry.", "Smooth the shell rim to remove rough or sharp edges.", "Use the bowl for dry, non-food items unless it has been independently verified as food-safe."], "photos": catalog_photos("coconut_bowl")},
        {"id": "coconut_craft", "title": "Natural craft material", "summary": "Prepare dry coconut-shell pieces for ornaments or classroom craft projects.", "materials": ["Dry shell", "Craft tools", "Protective equipment"], "steps": ["Plan the design before working on the shell pieces.", "Wear protective equipment when cutting the shell.", "Smooth all edges of the finished pieces."]},
    ],
    "dry_untreated_wood_scraps": [
        {"id": "wood_shelf", "title": "Small shelf", "summary": "Assemble dry, untreated wood scraps into a small shelf only when the pieces are structurally suitable.", "materials": ["Wood scraps", "Sandpaper", "Fasteners", "Tools"], "steps": ["Check the wood for treatment and damage before using it.", "Remove existing hardware and sand away splinters.", "Assemble the shelf securely with suitable fasteners."]},
        {"id": "wood_marker", "title": "Plant markers", "summary": "Prepare safe small wood scraps as labels for a garden or classroom.", "materials": ["Wood scraps", "Sandpaper", "Marker"], "steps": ["Remove nails and staples from the wood scraps.", "Sand all edges until they are smooth.", "Write the labels on the markers and place them in the soil."]},
        {"id": "wood_craft", "title": "Craft material", "summary": "Prepare small, dry wood pieces for crafts that do not carry structural loads.", "materials": ["Dry wood", "Sandpaper", "Non-toxic finishes"], "steps": ["Confirm that the wood is untreated before using it.", "Smooth the surfaces of the wood pieces.", "Wear protective equipment when cutting the wood for the craft."]},
    ],
}


def build_recommendations(
    label: str,
    quantity: int | None = None,
    condition: str = "",
    previous_contents: str = "",
    available_materials: list[str] | None = None,
) -> list[dict[str, object]]:
    """Return multiple choices and add context without claiming safety certification."""

    options = [dict(item) for item in CATALOG.get(label, [])]
    if condition == "Torn or crumpled, clean and dry":
        options = [item for item in options if label == "paper" and item["id"] == "paper_craft"]
    if condition == "Clean dry usable scraps":
        allowed = {"cardboard": {"cardboard_craft"}, "fabric_scraps": {"fabric_cleaning_cloth", "fabric_patchwork"}}
        options = [item for item in options if item["id"] in allowed.get(label, set())]
    if quantity and quantity > 1:
        quantity_note = f"Designed to use several items (you entered {quantity})."
    elif quantity == 1:
        quantity_note = "Works with one item; repeat the project for more items."
    else:
        quantity_note = "Works with one item or a small batch; adjust the materials to what you have."
    caution = ""
    if "damage" in condition.lower() or "crack" in condition.lower():
        caution = "Inspect damage first; choose only a project that does not require structural strength."
    if previous_contents and any(word in previous_contents.lower() for word in ("chemical", "cleaning")):
        caution = "Do not reuse for food or personal-contact purposes; follow the appropriate disposal guidance."
    if label == "dry_untreated_wood_scraps" and any(
        word in condition.lower()
        for word in ("paint", "treatment", "treated", "varnish", "nail", "mold")
    ):
        caution = "Do not cut or use this wood for a project until paint, treatment, hardware, or mold has been ruled out; use the appropriate local recovery or disposal service."
    for option in options:
        option["quantity_note"] = quantity_note
        option["safety_note"] = caution or "Educational idea only; inspect, clean, and prepare the material appropriately."
    return options


def question_schema(label: str) -> list[dict[str, object]]:
    common = [
        {"id": "quantity", "label": "How many items do you have?", "type": "number", "required": True},
        {"id": "condition", "label": "What is the current condition?", "type": "choice", "options": ["Clean and dry", "Needs cleaning", "Damaged or cracked", "Not sure"], "required": True},
        {"id": "previous_contents", "label": "What was the previous content?", "type": "choice", "options": ["Water or beverage", "Food or oil", "Chemical or cleaning product", "Other / unknown"], "required": True},
        {"id": "available_materials", "label": "What tools or materials do you already have?", "type": "text", "required": False},
    ]
    if label in {"pete_bottles", "hdpe_containers"}:
        common.append({"id": "resin_mark", "label": "Can you see a verified material/resin mark?", "type": "text", "required": False})
    if label == "dry_untreated_wood_scraps":
        common.append({"id": "wood_treatment", "label": "Is the wood visibly painted, stained, or treated?", "type": "choice", "options": ["No", "Yes", "Not sure"], "required": True})
    return common
