"""Run SNAPTURE inference on one local image."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from inference import ModelPredictor
except ImportError:  # Supports: python -m scripts.predict_image
    from scripts.inference import ModelPredictor


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Classify one image with the trained SNAPTURE model."
    )
    parser.add_argument("image", type=Path, help="Path to an image file")
    args = parser.parse_args()

    try:
        predictor = ModelPredictor()
        result = predictor.predict_path(args.image)
    except (FileNotFoundError, ValueError, OSError) as error:
        print(
            json.dumps(
                {"error": str(error)},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 2

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
