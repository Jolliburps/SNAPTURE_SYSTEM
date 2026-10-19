"""Smoke-test the selected checkpoint with images from each local category.

These images may overlap training, so this is not a held-out accuracy test.
No dataset files, accounts, or prediction history are changed.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

from scripts.inference import ModelPredictor, SCOPE_CLASSES


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-class", type=int, default=3)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.per_class < 1:
        parser.error("--per-class must be positive")
    root = Path(__file__).resolve().parents[1]
    predictor = ModelPredictor()
    if not SCOPE_CLASSES.issubset(set(predictor.labels)):
        raise ValueError("The selected checkpoint does not contain all six active materials.")
    rng = random.Random(20261014)
    observations = []
    for label in sorted(SCOPE_CLASSES):
        paths = sorted(p for p in (root / "data" / label).rglob("*")
                       if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"})
        if not paths:
            raise ValueError(f"No local samples for {label}")
        for path in rng.sample(paths, min(args.per_class, len(paths))):
            result = predictor.predict_path(path)
            observations.append({"folder_label": label, "image": str(path.relative_to(root)), **result})
            print(f"{label}: predicted={result['class']} confidence={result['confidence']:.3f} decision={result['decision']}", flush=True)
    report = {
        "purpose": "Runtime smoke test only; samples may overlap training and labels remain unreviewed",
        "model_path": str(predictor.model_path.relative_to(root)),
        "model_version": predictor.model_version,
        "classes": predictor.labels,
        "threshold": predictor.confidence_threshold,
        "experimental_model": predictor.experimental_model,
        "sample_count": len(observations),
        "observations": observations,
    }
    if args.output:
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Completed {len(observations)} predictions across the six active folders. This is not an accuracy evaluation.")


if __name__ == "__main__":
    main()
