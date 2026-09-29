"""Shared SNAPTURE material scope and safety-aware guidance."""

from __future__ import annotations

SCOPE_LABELS = (
    "pete_bottles",
    "hdpe_containers",
    "cardboard",
    "paper",
    "fabric_scraps",
    "coconut_shells",
    "dry_untreated_wood_scraps",
)

MATERIALS = {
    "pete_bottles": {
        "title": "PETE bottle",
        "short_title": "PETE",
        "description": "A polyethylene terephthalate bottle, commonly used for water and beverage containers.",
        "examples": ["Water bottles", "Soft-drink bottles", "Clear beverage bottles"],
        "preparation": [
            "Empty the bottle completely.",
            "Rinse and dry it before reuse or recycling.",
            "Remove the cap and label when local recycling rules require it.",
        ],
        "recycling": "Sort with PET/PETE materials where your local collection service accepts them.",
        "disposal": "If it is contaminated or not accepted locally, use the appropriate waste collection service.",
    },
    "hdpe_containers": {
        "title": "HDPE container",
        "short_title": "HDPE",
        "description": "A high-density polyethylene container used for household and personal-care products.",
        "examples": ["Shampoo bottles", "Detergent containers", "Sturdy household containers"],
        "preparation": [
            "Empty the container completely.",
            "Wash and dry it before reuse or recycling.",
            "Use only for non-food storage unless independently verified food-safe.",
        ],
        "recycling": "Sort with HDPE materials where your local collection service accepts them.",
        "disposal": "If it is heavily contaminated or not accepted locally, use the appropriate waste collection service.",
    },
    "cardboard": {
        "title": "Cardboard",
        "short_title": "Cardboard",
        "description": "Clean, dry cardboard material suitable for reuse or local recycling.",
        "examples": ["Shipping boxes", "Cereal boxes", "Paperboard packaging"],
        "preparation": [
            "Flatten the cardboard.",
            "Remove wet, moldy, or heavily contaminated portions.",
            "Remove tape and plastic parts when practical.",
        ],
        "recycling": "Keep clean and dry cardboard separate from food-contaminated or wax-coated material.",
        "disposal": "Place unusable pieces in the appropriate local waste stream; do not burn them.",
    },
    "paper": {
        "title": "Paper",
        "short_title": "Paper",
        "description": "Clean, dry paper material that may be reused for crafts or recycled locally.",
        "examples": ["Office paper", "School paper", "Paper bags"],
        "preparation": [
            "Remove wet or heavily contaminated parts.",
            "Keep the paper dry.",
            "Separate tape, plastic, and metal attachments.",
        ],
        "recycling": "Keep clean, dry paper separate and follow your local paper collection rules.",
        "disposal": "Use the local waste stream when the paper is wet, moldy, or heavily contaminated.",
    },
    "fabric_scraps": {
        "title": "Fabric scraps",
        "short_title": "Fabric",
        "description": "Small pieces of fabric that can be repurposed when their condition is suitable.",
        "examples": ["Clothing offcuts", "Old cotton pieces", "Textile remnants"],
        "preparation": [
            "Remove pins, buttons, and other sharp attachments.",
            "Wash and dry the fabric when appropriate.",
            "Separate heavily contaminated or moldy pieces.",
        ],
        "recycling": "Donate or send clean textile scraps to a local textile recovery program when available.",
        "disposal": "Bag moldy or contaminated fabric and follow local disposal guidance.",
    },
    "coconut_shells": {
        "title": "Coconut shell",
        "short_title": "Coconut shell",
        "description": "A cleaned coconut shell that may be used for craft or garden projects.",
        "examples": ["Coconut halves", "Shell pieces", "Clean coconut husk craft pieces"],
        "preparation": [
            "Remove all remaining coconut flesh.",
            "Wash and dry the shell completely.",
            "Sand or cover sharp edges before handling.",
        ],
        "recycling": "Use a local organic-material or craft collection option when one is available.",
        "disposal": "Dispose of shell pieces through the appropriate local organic or solid-waste service.",
    },
    "dry_untreated_wood_scraps": {
        "title": "Dry untreated wood scrap",
        "short_title": "Wood",
        "description": "A dry wood piece without visible paint, preservative, or chemical treatment.",
        "examples": ["Untreated offcuts", "Small clean boards", "Wooden craft scraps"],
        "preparation": [
            "Confirm that the wood is dry and untreated.",
            "Remove nails, staples, and other sharp hardware.",
            "Sand splinters and use protection when cutting.",
        ],
        "recycling": "Send clean untreated scraps to a local wood-recovery or reuse program where available.",
        "disposal": "Do not burn painted or treated wood; use the appropriate local collection service.",
    },
    "unknown_unsupported": {
        "title": "Unidentified or unsupported object",
        "short_title": "Unsupported",
        "description": "The available evidence is not enough for a supported material decision.",
        "examples": [],
        "preparation": [
            "Do not reuse or modify the object based only on this result.",
            "Handle it cautiously.",
            "Use the appropriate local disposal or collection service.",
        ],
        "recycling": "Do not place it in a recycling stream based only on this result.",
        "disposal": "Use the appropriate local disposal or collection service.",
    },
}


def material_info(label: str) -> dict:
    """Return safe fallback guidance for any model output."""

    return MATERIALS.get(label, MATERIALS["unknown_unsupported"])


def public_materials() -> list[dict]:
    # Import lazily to avoid the recommendations -> materials import cycle.
    from .recommendations import CATALOG

    return [
        {
            "label": label,
            **MATERIALS[label],
            "upcycling": CATALOG.get(label, []),
            "model_status": (
                "Available for educational guidance; training data is still being collected."
                if label not in {"cardboard", "paper"}
                else "Educational guidance is available; verify model results before acting."
            ),
        }
        for label in SCOPE_LABELS
    ]
