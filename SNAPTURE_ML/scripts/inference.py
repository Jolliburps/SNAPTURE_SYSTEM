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
        self.model_path = Path(
            model_path or os.getenv("SNAPTURE_MODEL_PATH", DEFAULT_MODEL_PATH)
        )
        self.labels_path = Path(
            labels_path or os.getenv("SNAPTURE_LABELS_PATH", DEFAULT_LABELS_PATH)
        )
        self.config_path = Path(
            config_path or os.getenv("SNAPTURE_CONFIG_PATH", DEFAULT_CONFIG_PATH)
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
        self.unsupported_classes = _unsupported_classes(self.labels)

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
        normalized_class = best_class.lower()

        if (
            confidence < self.confidence_threshold
            or normalized_class in self.unsupported_classes
        ):
            decision = "unknown_unsupported"
        else:
            decision = best_class

        return {
            "class": best_class,
            "confidence": round(confidence, 6),
            "decision": decision,
            "threshold": self.confidence_threshold,
            "unsupported_class": normalized_class in self.unsupported_classes,
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
