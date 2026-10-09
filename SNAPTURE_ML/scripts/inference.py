"""Shared model-loading and inference utilities for SNAPTURE."""

from __future__ import annotations

import json
import os
from io import BytesIO
from pathlib import Path
from typing import Any

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


PROJECT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_PATH = PROJECT_DIR / "models" / "snapture_baseline.keras"
DEFAULT_LABELS_PATH = PROJECT_DIR / "models" / "labels.json"
DEFAULT_CONFIG_PATH = PROJECT_DIR / "models" / "model_config.json"
DEFAULT_IMAGE_SIZE = (224, 224)
DEFAULT_CONFIDENCE_THRESHOLD = 0.60
DEFAULT_UNSUPPORTED_CLASSES = {"glass", "trash"}
DEFAULT_GENERIC_CLASSES = {"plastic", "metal"}

# These are the only labels that may be shown as a final identification in
# SNAPTURE.  The current baseline model still contains generic labels such as
# ``glass`` and ``plastic``; those labels are useful for diagnostics, but they
# are outside the thesis scope and must never be presented as a supported
# material to a user.
SCOPE_CLASSES = frozenset(
    {
        "pete_bottles",
        "hdpe_containers",
        "cardboard",
        "paper",
        "fabric_scraps",
        "coconut_shells",
        "dry_untreated_wood_scraps",
    }
)


def _normalise_label(value: str) -> str:
    """Convert common folder/model label spellings to scope identifiers."""

    normalised = "_".join(value.strip().lower().replace("-", "_").split())
    aliases = {
        "pete": "pete_bottles",
        "pete_bottle": "pete_bottles",
        "pete_bottle_container": "pete_bottles",
        "hdpe": "hdpe_containers",
        "hdpe_container": "hdpe_containers",
        "fabric": "fabric_scraps",
        "coconut_shell": "coconut_shells",
        "wood": "dry_untreated_wood_scraps",
        "dry_untreated_wood": "dry_untreated_wood_scraps",
        "dry_wood_scraps": "dry_untreated_wood_scraps",
    }
    return aliases.get(normalised, normalised)


def _environment_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        parsed = float(value)
    except ValueError as error:
        raise ValueError(f"{name} must be a number, got {value!r}.") from error
    if not 0.0 <= parsed <= 1.0:
        raise ValueError(f"{name} must be between 0 and 1, got {parsed}.")
    return parsed


def _unsupported_classes(labels: list[str]) -> set[str]:
    configured = os.getenv("SNAPTURE_UNSUPPORTED_CLASSES")
    if configured is None:
        configured_set = DEFAULT_UNSUPPORTED_CLASSES
    else:
        configured_set = {
            value.strip().lower()
            for value in configured.split(",")
            if value.strip()
        }
    return configured_set.intersection({label.lower() for label in labels})


class ModelPredictor:
    """Loads the trained Keras model and applies one consistent inference path."""

    def __init__(
        self,
        model_path: Path | None = None,
        labels_path: Path | None = None,
        config_path: Path | None = None,
    ) -> None:
        configured_dir = os.getenv("SNAPTURE_MODEL_DIR")
        selected_dir = Path(configured_dir) if configured_dir else None
        if selected_dir is not None and not selected_dir.is_absolute():
            selected_dir = PROJECT_DIR / selected_dir
        default_model = selected_dir / "snapture_baseline.keras" if selected_dir else os.getenv("SNAPTURE_MODEL_PATH") or DEFAULT_MODEL_PATH
        default_labels = selected_dir / "labels.json" if selected_dir else os.getenv("SNAPTURE_LABELS_PATH") or DEFAULT_LABELS_PATH
        default_config = selected_dir / "model_config.json" if selected_dir else os.getenv("SNAPTURE_CONFIG_PATH") or DEFAULT_CONFIG_PATH
        self.model_path = Path(
            model_path or default_model
        )
        self.labels_path = Path(
            labels_path or default_labels
        )
        self.config_path = Path(
            config_path or default_config
        )

        if not self.model_path.is_file():
            raise FileNotFoundError(f"Trained model not found: {self.model_path}")
        if not self.labels_path.is_file():
            raise FileNotFoundError(f"Model labels not found: {self.labels_path}")

        with self.labels_path.open("r", encoding="utf-8") as file:
            labels = json.load(file)

        if not isinstance(labels, list) or not labels or not all(
            isinstance(label, str) and label.strip() for label in labels
        ):
            raise ValueError("labels.json must contain a non-empty list of strings.")

        self.labels = [label.strip() for label in labels]
        self.config = self._load_config()
        self.image_size = self._read_image_size()
        self.confidence_threshold = _environment_float(
            "SNAPTURE_CONFIDENCE_THRESHOLD",
            float(
                self.config.get(
                    "confidence_threshold", DEFAULT_CONFIDENCE_THRESHOLD
                )
            ),
        )
        configured_class_thresholds = self.config.get("class_confidence_thresholds", {})
        if not isinstance(configured_class_thresholds, dict):
            raise ValueError("class_confidence_thresholds must be an object.")
        self.class_confidence_thresholds = {
            _normalise_label(label): float(value)
            for label, value in configured_class_thresholds.items()
        }
        if any(not 0.0 <= value <= 1.0 for value in self.class_confidence_thresholds.values()):
            raise ValueError("Class confidence thresholds must be between 0 and 1.")
        self.unsupported_classes = {
            _normalise_label(label) for label in _unsupported_classes(self.labels)
        }
        self.scope_classes = set(SCOPE_CLASSES)
        configured_generic = os.getenv("SNAPTURE_GENERIC_CLASSES")
        self.generic_classes = (
            {
                _normalise_label(value)
                for value in configured_generic.split(",")
                if value.strip()
            }
            if configured_generic is not None
            else DEFAULT_GENERIC_CLASSES
        )
        self.model_version = str(self.config.get("model_version", "local"))
        self.experimental_model = self.config.get("training_data_verified") is False

        # The training script places MobileNetV2 preprocessing inside the model.
        # Therefore inference must pass raw RGB pixels in the 0-255 range.
        self.model = tf.keras.models.load_model(self.model_path)

    def _load_config(self) -> dict[str, Any]:
        if not self.config_path.is_file():
            return {}
        with self.config_path.open("r", encoding="utf-8") as file:
            config = json.load(file)
        if not isinstance(config, dict):
            raise ValueError("model_config.json must contain a JSON object.")
        return config

    def _read_image_size(self) -> tuple[int, int]:
        configured = self.config.get("image_size", list(DEFAULT_IMAGE_SIZE))
        if (
            not isinstance(configured, list)
            or len(configured) != 2
            or not all(isinstance(value, int) and value > 0 for value in configured)
        ):
            raise ValueError("model_config.json image_size must be [height, width].")
        return int(configured[0]), int(configured[1])

    def _prepare_image(self, image: Image.Image) -> np.ndarray:
        resized = image.convert("RGB").resize(
            (self.image_size[1], self.image_size[0])
        )
        image_array = np.asarray(resized, dtype=np.float32)
        return np.expand_dims(image_array, axis=0)

    def predict_image(self, image: Image.Image) -> dict[str, Any]:
        image_array = self._prepare_image(image)
        scores = self.model.predict(image_array, verbose=0)[0]

        best_index = int(np.argmax(scores))
        best_class = self.labels[best_index]
        confidence = float(scores[best_index])
        normalized_class = _normalise_label(best_class)
        in_scope = normalized_class in self.scope_classes
        threshold = max(
            self.confidence_threshold,
            self.class_confidence_thresholds.get(normalized_class, 0.0),
        )

        verification_reasons: list[str] = []
        if confidence < threshold:
            verification_reasons.append("confidence_below_threshold")
        if not in_scope:
            # Any class outside the seven thesis categories (including glass,
            # metal, plastic, and trash) is deliberately treated as unknown.
            verification_reasons.append("out_of_scope_class")
        elif normalized_class in self.unsupported_classes:
            verification_reasons.append("unsupported_class")
        if in_scope and normalized_class in self.generic_classes:
            verification_reasons.append("generic_class_requires_material_review")

        if verification_reasons:
            decision = "unknown_unsupported"
        else:
            # Return the canonical scope identifier so material guidance and
            # the API use one stable label even if the model uses spaces or
            # hyphens in its labels file.
            decision = normalized_class

        top_indices = np.argsort(scores)[::-1][: min(3, len(self.labels))]
        alternatives = [
            {
                "class": self.labels[int(index)],
                "confidence": round(float(scores[int(index)]), 6),
            }
            for index in top_indices
        ]

        return {
            "class": best_class,
            "confidence": round(confidence, 6),
            "decision": decision,
            "threshold": threshold,
            "unsupported_class": not in_scope or normalized_class in self.unsupported_classes,
            "needs_verification": bool(verification_reasons),
            "verification_reasons": verification_reasons,
            "alternatives": alternatives,
            "model_version": self.model_version,
            "experimental_model": self.experimental_model,
        }

    def predict_bytes(self, image_bytes: bytes) -> dict[str, Any]:
        if not image_bytes:
            raise ValueError("The uploaded image is empty.")
        try:
            with Image.open(BytesIO(image_bytes)) as image:
                return self.predict_image(image)
        except (UnidentifiedImageError, OSError) as error:
            raise ValueError("The supplied file is not a valid image.") from error

    def predict_path(self, image_path: Path) -> dict[str, Any]:
        path = Path(image_path)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Image not found: {path}")
        try:
            with Image.open(path) as image:
                return self.predict_image(image)
        except (UnidentifiedImageError, OSError) as error:
            raise ValueError(f"The supplied file is not a valid image: {path}") from error
