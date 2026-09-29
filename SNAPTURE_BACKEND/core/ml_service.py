"""Lazy bridge from Django to the existing TensorFlow inference module."""

from __future__ import annotations

import sys
from pathlib import Path

from django.conf import settings

from .materials import SCOPE_LABELS, material_info

_predictor = None
_startup_error: str | None = None


def _load_predictor():
    global _predictor, _startup_error
    if _predictor is not None or _startup_error is not None:
        return _predictor
    ml_dir = Path(getattr(settings, "SNAPTURE_ML_DIR", "")).resolve()
    if str(ml_dir) not in sys.path:
        sys.path.insert(0, str(ml_dir))
    try:
        from scripts.inference import ModelPredictor

        _predictor = ModelPredictor()
    except (FileNotFoundError, OSError, ValueError, ImportError) as error:
        _startup_error = str(error)
    return _predictor


def model_status() -> dict[str, object]:
    predictor = _load_predictor()
    if predictor is None:
        return {"loaded": False, "error": _startup_error}
    return {
        "loaded": True,
        "classes": predictor.labels,
        "threshold": predictor.confidence_threshold,
        "model_version": predictor.model_version,
        "generic_classes_need_verification": sorted(predictor.generic_classes),
    }


def predict_image(image_bytes: bytes) -> dict[str, object]:
    predictor = _load_predictor()
    if predictor is None:
        raise RuntimeError(f"Model is not ready: {_startup_error}")
    result = predictor.predict_bytes(image_bytes)
    decision = str(result["decision"])
    # Defense in depth: never trust a stale/legacy predictor to expose a raw
    # class outside the seven thesis categories.
    if decision not in SCOPE_LABELS:
        decision = "unknown_unsupported"
        result = {
            **result,
            "decision": decision,
            "needs_verification": True,
            "unsupported_class": True,
        }
    info = material_info(decision)
    return {
        **result,
        "label": decision,
        "model_class": result["class"],
        "title": info["title"],
        "preparation": info["preparation"],
        "reuse_options": info.get("reuse_options", []),
    }
