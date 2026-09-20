"""Local FastAPI server for SNAPTURE image prediction."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

try:
    from inference import ModelPredictor
except ImportError:  # Supports: uvicorn scripts.api_server:app
    from scripts.inference import ModelPredictor


MAX_IMAGE_BYTES = 10 * 1024 * 1024

MATERIAL_INFO: dict[str, dict[str, Any]] = {
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

    decision = result["decision"]
    info = MATERIAL_INFO.get(decision, MATERIAL_INFO["unknown_unsupported"])

    return {
        **result,
        "label": decision,
        "model_class": result["class"],
        "title": info["title"],
        "preparation": info["preparation"],
        "reuse_options": info["reuse_options"],
    }
