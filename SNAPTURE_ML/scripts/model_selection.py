"""Resolve the active checkpoint without overwriting legacy model artifacts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Mapping


def resolve_model_paths(model_dir: Path, environment: Mapping[str, str]) -> tuple[Path, Path, Path]:
    model_dir = model_dir.resolve()
    configured_dir = environment.get("SNAPTURE_MODEL_DIR")
    if configured_dir:
        selected = Path(configured_dir)
        if not selected.is_absolute():
            selected = model_dir.parent / selected
        return (selected / "snapture_baseline.keras", selected / "labels.json", selected / "model_config.json")

    defaults = (model_dir / "snapture_baseline.keras", model_dir / "labels.json", model_dir / "model_config.json")
    overrides = tuple(environment.get(name) for name in (
        "SNAPTURE_MODEL_PATH", "SNAPTURE_LABELS_PATH", "SNAPTURE_CONFIG_PATH"
    ))
    # Explicit checkpoint overrides keep their original legacy fallback behavior.
    if any(overrides):
        return tuple(Path(value) if value else default for value, default in zip(overrides, defaults))

    selection = model_dir / "active_model.json"
    if not selection.is_file():
        return defaults
    payload = json.loads(selection.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema_version") != 1:
        raise ValueError("active_model.json must be an object with schema_version 1.")
    paths = []
    for key in ("model", "labels", "config"):
        value = payload.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"active_model.json requires a {key} path.")
        relative = Path(value)
        if relative.is_absolute():
            raise ValueError("Active model paths must be relative to the models directory.")
        path = (model_dir / relative).resolve()
        if not path.is_relative_to(model_dir):
            raise ValueError("Active model paths cannot leave the models directory.")
        if not path.is_file():
            raise FileNotFoundError(f"Active model {key} file is missing: {path}")
        paths.append(path)
    return tuple(paths)
