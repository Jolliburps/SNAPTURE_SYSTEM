"""Local FastAPI server for SNAPTURE image prediction."""

from __future__ import annotations

import os
import secrets
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

try:
    # Normal package launch: uvicorn scripts.api_server:app
    from .inference import ModelPredictor
except ImportError:  # Supports uvicorn api_server:app --app-dir scripts
    from inference import ModelPredictor  # pyright: ignore[reportMissingImports]


MAX_IMAGE_BYTES = 10 * 1024 * 1024
PROJECT_DIR = Path(__file__).resolve().parents[1]
SCOPE_DATASET_DIR = PROJECT_DIR / "data" / "scope_dataset"
SCOPE_DATASET_LABELS = (
    "pete_bottles",
    "hdpe_containers",
    "cardboard",
    "paper",
    "fabric_scraps",
    "coconut_shells",
    "dry_untreated_wood_scraps",
)
DATASET_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

MATERIAL_INFO: dict[str, dict[str, Any]] = {
    "pete_bottles": {
        "title": "PETE bottle",
        "preparation": [
            "Empty the bottle completely.",
            "Rinse and dry it before reuse or recycling.",
            "Remove the cap and label when the local recycling rules require it.",
        ],
        "reuse_options": [
            "Plant starter pot",
            "Watering container",
            "Non-food organizer",
        ],
    },
    "hdpe_containers": {
        "title": "HDPE container",
        "preparation": [
            "Empty the container completely.",
            "Wash and dry it before reuse or recycling.",
            "Use only for non-food storage unless independently verified food-safe.",
        ],
        "reuse_options": [
            "Plant pot",
            "Tool or craft organizer",
            "Non-food storage container",
        ],
    },
    "paper": {
        "title": "Paper",
        "preparation": [
            "Remove wet or heavily contaminated parts.",
            "Keep the paper dry.",
            "Separate tape, plastic, and metal attachments.",
        ],
        "reuse_options": ["Paper organizer", "Gift wrapping", "Paper craft"],
    },
    "cardboard": {
        "title": "Cardboard",
        "preparation": [
            "Flatten the cardboard.",
            "Remove wet or moldy portions.",
            "Remove tape and plastic parts.",
        ],
        "reuse_options": ["Storage organizer", "Desk divider", "Craft material"],
    },
    "fabric_scraps": {
        "title": "Fabric scraps",
        "preparation": [
            "Remove buttons, pins, and other sharp attachments.",
            "Wash and dry the fabric when appropriate.",
            "Keep synthetic and natural fabrics separated when local rules require it.",
        ],
        "reuse_options": ["Cleaning cloth", "Patchwork material", "Small storage pouch"],
    },
    "coconut_shells": {
        "title": "Coconut shell",
        "preparation": [
            "Remove all remaining coconut flesh.",
            "Wash and dry the shell completely.",
            "Sand or cover sharp edges before handling or reuse.",
        ],
        "reuse_options": ["Plant holder", "Decorative bowl", "Small storage container"],
    },
    "dry_untreated_wood_scraps": {
        "title": "Dry untreated wood scrap",
        "preparation": [
            "Confirm that the wood is dry and untreated.",
            "Remove nails, staples, and other sharp hardware.",
            "Sand splinters and wear appropriate protective equipment when cutting.",
        ],
        "reuse_options": ["Small shelf", "Plant marker", "Craft material"],
    },
    "plastic": {
        "title": "Plastic item",
        "preparation": [
            "Empty the item.",
            "Wash and dry it completely.",
            "Use only for non-food projects unless independently verified food-safe.",
        ],
        "reuse_options": [
            "Plant pot",
            "Organizer",
            "Non-food storage container",
        ],
    },
    "metal": {
        "title": "Metal item",
        "preparation": [
            "Empty and wash the item.",
            "Dry it completely.",
            "Check for sharp edges and rust before handling.",
        ],
        "reuse_options": [
            "Plant container",
            "Desk organizer",
            "Decorative container",
        ],
    },
    "unknown_unsupported": {
        "title": "Unidentified or unsupported object",
        "preparation": [
            "Do not reuse or modify the object based only on this result.",
            "Handle it cautiously.",
            "Use the appropriate local disposal or collection service.",
        ],
        "reuse_options": [],
    },
}

try:
    predictor: ModelPredictor | None = ModelPredictor()
    startup_error: str | None = None
except (FileNotFoundError, ValueError, OSError) as error:
    predictor = None
    startup_error = str(error)

app = FastAPI(title="SNAPTURE Local API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


def _require_dataset_token(token: str | None) -> None:
    """Protect local training-data collection from ordinary app users."""

    expected = os.getenv("SNAPTURE_DATASET_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail=(
                "Dataset capture is disabled. Set SNAPTURE_DATASET_TOKEN in "
                "the backend environment before collecting images."
            ),
        )
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=401, detail="Invalid dataset capture token.")


def _dataset_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for label in SCOPE_DATASET_LABELS:
        folder = SCOPE_DATASET_DIR / label
        counts[label] = sum(
            1
            for path in folder.glob("*")
            if path.is_file() and path.suffix.lower() in DATASET_IMAGE_EXTENSIONS
        )
    return counts


@app.get("/health")
def health() -> dict[str, Any]:
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model is not ready: {startup_error}",
        )

    return {
        "status": "ok",
        "model_loaded": True,
        "classes": predictor.labels,
        "confidence_threshold": predictor.confidence_threshold,
        "model_version": predictor.model_version,
        "generic_classes_need_verification": sorted(predictor.generic_classes),
    }


@app.get("/dataset/counts")
def dataset_counts(
    dataset_token: str | None = Header(
        default=None, alias="X-SNAPTURE-DATASET-TOKEN"
    ),
) -> dict[str, Any]:
    """Return counts for the seven checklist labels during local collection."""

    _require_dataset_token(dataset_token)
    return {
        "labels": list(SCOPE_DATASET_LABELS),
        "counts": _dataset_counts(),
        "dataset_path": str(SCOPE_DATASET_DIR),
    }


@app.post("/dataset/images")
async def save_dataset_image(
    label: str = Form(...),
    file: UploadFile = File(...),
    dataset_token: str | None = Header(
        default=None, alias="X-SNAPTURE-DATASET-TOKEN"
    ),
) -> dict[str, Any]:
    """Save a manually labelled image for later offline model training.

    This endpoint intentionally requires a separate local token and never uses
    the model's prediction as a label.
    """

    _require_dataset_token(dataset_token)
    normalized_label = label.strip().lower()
    if normalized_label not in SCOPE_DATASET_LABELS:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "Choose one of the approved checklist labels.",
                "labels": list(SCOPE_DATASET_LABELS),
            },
        )
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=415, detail="Please upload an image file.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. The maximum size is 10 MB.",
        )

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
            detected_format = (image.format or "JPEG").lower()
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="The supplied file is not a valid image.") from error

    extension = {
        "jpeg": ".jpg",
        "jpg": ".jpg",
        "png": ".png",
        "webp": ".webp",
        "bmp": ".bmp",
    }.get(detected_format, ".jpg")
    destination_dir = SCOPE_DATASET_DIR / normalized_label
    destination_dir.mkdir(parents=True, exist_ok=True)
    filename = f"capture_{uuid.uuid4().hex}{extension}"
    destination = destination_dir / filename
    destination.write_bytes(image_bytes)

    return {
        "saved": True,
        "label": normalized_label,
        "filename": filename,
        "counts": _dataset_counts(),
        "dataset_path": str(SCOPE_DATASET_DIR),
    }


@app.post("/predict")
async def predict(file: UploadFile = File(...)) -> dict[str, Any]:
    if predictor is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model is not ready: {startup_error}",
        )

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=415,
            detail="Please upload an image using multipart/form-data.",
        )

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image is too large. The maximum size is 10 MB.",
        )

    try:
        result = predictor.predict_bytes(image_bytes)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    decision = str(result["decision"])
    if decision not in SCOPE_DATASET_LABELS:
        decision = "unknown_unsupported"
        result = {
            **result,
            "decision": decision,
            "needs_verification": True,
            "unsupported_class": True,
        }
    info = MATERIAL_INFO.get(decision, MATERIAL_INFO["unknown_unsupported"])

    return {
        **result,
        "label": decision,
        "model_class": result["class"],
        "title": info["title"],
        "preparation": info["preparation"],
        "reuse_options": info["reuse_options"],
    }
