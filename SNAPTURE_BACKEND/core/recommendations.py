"""Rule-based, quantity-aware recommendations for the thesis scope."""

from __future__ import annotations

from .materials import material_info


CATALOG: dict[str, list[dict[str, object]]] = {
    "pete_bottles": [
        {"id": "pete_planter", "title": "Self-watering planter", "summary": "Turn clean bottles into planters for small herbs and seedlings.", "materials": ["Clean PETE bottles", "Scissors", "Soil", "Small plants"], "steps": ["Cut the bottle safely.", "Make drainage holes.", "Add soil and a small plant."]},
        {"id": "pete_organizer", "title": "Desk organizer", "summary": "Cut and decorate bottles for pens, tools, or art supplies.", "materials": ["Clean bottles", "Cutter", "Paint or fabric"], "steps": ["Remove the label.", "Cover or smooth the cut edge.", "Decorate and use for non-food storage."]},
        {"id": "pete_seed_set", "title": "Seed starter set", "summary": "Use multiple containers as labeled starters for herbs and seedlings.", "materials": ["Bottles", "Soil", "Seeds", "Labels"], "steps": ["Prepare several clean containers.", "Add soil and seeds.", "Label and place in a suitable location."]},
    ],
    "hdpe_containers": [
        {"id": "hdpe_planter", "title": "Durable plant pot", "summary": "Reuse a clean HDPE container as a non-food plant pot.", "materials": ["Clean container", "Cutter", "Soil", "Plant"], "steps": ["Remove the original contents.", "Wash and dry the container.", "Create safe drainage and add the plant."]},
        {"id": "hdpe_storage", "title": "Non-food storage bin", "summary": "Organize craft supplies, hardware, or household tools.", "materials": ["Clean container", "Labels"], "steps": ["Clean and dry the container.", "Label its intended use.", "Store non-food items only."]},
        {"id": "hdpe_scoop", "title": "Garden scoop", "summary": "Repurpose a sturdy container into a scoop for soil or compost.", "materials": ["Clean container", "Cutter", "Sandpaper"], "steps": ["Cut away the handle area carefully.", "Smooth all edges.", "Use only for garden materials."]},
    ],
    "cardboard": [
        {"id": "cardboard_organizer", "title": "Drawer organizer", "summary": "Build dividers and trays for desks or drawers.", "materials": ["Dry cardboard", "Ruler", "Glue", "Paper or fabric"], "steps": ["Flatten and measure the pieces.", "Cut and fold the sections.", "Reinforce and cover the edges."]},
        {"id": "cardboard_divider", "title": "Desk divider", "summary": "Create a light divider or display board from clean cardboard.", "materials": ["Cardboard", "Tape or glue", "Decorative paper"], "steps": ["Select dry, strong pieces.", "Join the panels.", "Cover exposed edges."]},
        {"id": "cardboard_craft", "title": "Craft template set", "summary": "Use flat cardboard for reusable patterns and school projects.", "materials": ["Cardboard", "Pencil", "Scissors"], "steps": ["Draw the template.", "Cut carefully.", "Store it for future projects."]},
    ],
    "paper": [
        {"id": "paper_gift_wrap", "title": "Gift wrapping", "summary": "Reuse clean paper for wrapping and paper crafts.", "materials": ["Dry paper", "String", "Tape"], "steps": ["Remove non-paper attachments.", "Flatten the sheet.", "Reuse for wrapping or craft."]},
        {"id": "paper_organizer", "title": "Paper organizer", "summary": "Fold sturdy sheets into trays for notes and small items.", "materials": ["Clean paper", "Ruler", "Glue"], "steps": ["Choose dry sheets.", "Fold along measured lines.", "Reinforce the base."]},
        {"id": "paper_craft", "title": "Paper craft set", "summary": "Create cards, collages, or learning materials from clean paper.", "materials": ["Paper", "Scissors", "Non-toxic glue"], "steps": ["Sort by size and condition.", "Plan the craft.", "Reuse the pieces."]},
    ],
    "fabric_scraps": [
        {"id": "fabric_cleaning_cloth", "title": "Cleaning cloth", "summary": "Use suitable fabric pieces as washable cleaning cloths.", "materials": ["Clean fabric", "Scissors", "Thread"], "steps": ["Wash and dry the fabric.", "Cut away damaged areas.", "Hem loose edges when needed."]},
        {"id": "fabric_pouch", "title": "Small storage pouch", "summary": "Sew or tie pieces into a pouch for small non-food items.", "materials": ["Fabric", "Thread", "Needle or safe adhesive"], "steps": ["Select clean pieces.", "Join the sides securely.", "Keep the pouch for non-food storage."]},
        {"id": "fabric_patchwork", "title": "Patchwork material", "summary": "Combine compatible scraps into a decorative patchwork piece.", "materials": ["Fabric scraps", "Thread", "Needle"], "steps": ["Sort by condition.", "Plan the pattern.", "Join the pieces safely."]},
    ],
    "coconut_shells": [
        {"id": "coconut_planter", "title": "Coconut-shell planter", "summary": "Turn a cleaned shell into a small decorative plant holder.", "materials": ["Clean shell", "Sandpaper", "Soil", "Small plant"], "steps": ["Remove remaining flesh.", "Sand sharp edges.", "Add a liner or plant safely."]},
        {"id": "coconut_bowl", "title": "Decorative bowl", "summary": "Use a smooth shell as a dry decorative holder.", "materials": ["Clean shell", "Sandpaper", "Non-toxic finish"], "steps": ["Clean and dry the shell.", "Smooth the edges.", "Use for dry, non-food items unless independently verified food-safe."]},
        {"id": "coconut_craft", "title": "Natural craft material", "summary": "Use shell pieces for ornaments and classroom craft projects.", "materials": ["Dry shell", "Craft tools", "Protective equipment"], "steps": ["Plan the design.", "Wear protection when cutting.", "Smooth all finished edges."]},
    ],
    "dry_untreated_wood_scraps": [
        {"id": "wood_shelf", "title": "Small shelf", "summary": "Build a simple shelf from dry, untreated pieces that are structurally suitable.", "materials": ["Wood scraps", "Sandpaper", "Fasteners", "Tools"], "steps": ["Check for treatment and damage.", "Remove hardware and sand splinters.", "Assemble securely."]},
        {"id": "wood_marker", "title": "Plant markers", "summary": "Cut safe small pieces into labels for a garden or classroom.", "materials": ["Wood scraps", "Sandpaper", "Marker"], "steps": ["Remove nails and staples.", "Sand all edges.", "Label and place in soil."]},
        {"id": "wood_craft", "title": "Craft material", "summary": "Use small pieces for non-structural craft projects.", "materials": ["Dry wood", "Sandpaper", "Non-toxic finishes"], "steps": ["Confirm the wood is untreated.", "Smooth the surfaces.", "Use protective equipment for cutting."]},
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
