"""Create a clean, thesis-scope dataset layout without inventing labels.

The source dataset is the six-class TrashNet dataset.  Only ``cardboard`` and
``paper`` are exact matches for the current SNAPTURE checklist.  Generic
``plastic`` images are deliberately kept in a review bucket because the
checklist requires PETE bottles and HDPE containers, which cannot be inferred
reliably from the source folder name alone.

The command preserves the source dataset and creates hard links when possible
(falling back to regular copies).  Hard links avoid duplicating image bytes on
the same Windows drive while still giving training tools a normal folder
layout.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path
from typing import Iterable


SCOPE_LABELS = [
    "pete_bottles",
    "hdpe_containers",
    "cardboard",
    "paper",
    "fabric_scraps",
    "coconut_shells",
    "dry_untreated_wood_scraps",
]

EXACT_SOURCE_LABELS = {"cardboard", "paper"}
REVIEW_SOURCE_LABELS = {"plastic"}
OUT_OF_SCOPE_SOURCE_LABELS = {"glass", "metal", "trash"}


def image_files(folder: Path) -> Iterable[Path]:
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.suffix.lower() in {
            ".jpg",
            ".jpeg",
            ".png",
            ".bmp",
            ".webp",
        }:
            yield path


def link_or_copy(source: Path, destination: Path) -> str:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        return "existing"

    try:
        os.link(source, destination)
        return "hardlink"
    except (OSError, NotImplementedError):
        shutil.copy2(source, destination)
        return "copy"


def write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def build_dataset(source: Path, destination: Path) -> dict[str, object]:
    if not source.is_dir():
        raise FileNotFoundError(f"Source dataset folder not found: {source}")

    destination.mkdir(parents=True, exist_ok=True)
    for label in SCOPE_LABELS:
        label_dir = destination / label
        label_dir.mkdir(parents=True, exist_ok=True)
        # Keep empty thesis folders visible in Git and on a clean checkout.
        (label_dir / ".gitkeep").touch(exist_ok=True)
    (destination / "needs_manual_review" / "plastic_unclassified").mkdir(
        parents=True, exist_ok=True
    )
    (destination / "out_of_scope").mkdir(parents=True, exist_ok=True)

    manifest: list[dict[str, str]] = []
    counts: dict[str, int] = {label: 0 for label in SCOPE_LABELS}
    counts.update(
        {
            "needs_manual_review/plastic_unclassified": 0,
            "out_of_scope/glass": 0,
            "out_of_scope/metal": 0,
            "out_of_scope/trash": 0,
        }
    )

    for source_label_dir in sorted(path for path in source.iterdir() if path.is_dir()):
        source_label = source_label_dir.name.lower()
        if source_label in EXACT_SOURCE_LABELS:
            target_label = source_label
        elif source_label in REVIEW_SOURCE_LABELS:
            target_label = "needs_manual_review/plastic_unclassified"
        elif source_label in OUT_OF_SCOPE_SOURCE_LABELS:
            target_label = f"out_of_scope/{source_label}"
        else:
            # Keep unexpected source folders visible instead of assigning a
            # category that the model has not been trained to recognize.
            target_label = f"out_of_scope/{source_label}"

        for index, source_file in enumerate(image_files(source_label_dir), start=1):
            filename = f"{source_label}_{index:05d}{source_file.suffix.lower()}"
            destination_file = destination / target_label / filename
            mode = link_or_copy(source_file, destination_file)
            counts[target_label] = counts.get(target_label, 0) + 1
            manifest.append(
                {
                    "source": str(source_file.relative_to(source.parent.parent.parent)),
                    "destination": str(destination_file.relative_to(destination)),
                    "source_label": source_label,
                    "assigned_label": target_label,
                    "transfer": mode,
                    "label_verified": target_label in EXACT_SOURCE_LABELS,
                }
            )

    write_json(destination / "labels.json", SCOPE_LABELS)
    write_json(
        destination / "dataset_manifest.json",
        {
            "source": str(source),
            "scope": "SNAPTURE_Concept_Checklist_Trimmed.docx",
            "labels": SCOPE_LABELS,
            "counts": counts,
            "notes": [
                "Only cardboard and paper are exact labels from the current source dataset.",
                "Plastic images require manual PETE-versus-HDPE review before training.",
                "Glass, metal, and trash are retained as out-of-scope examples.",
                "Empty scope folders must be populated with consented, labeled images before training.",
                "Remove personal information and record the source/license and reviewer for collected images.",
                "Do not put the same physical object or burst sequence in multiple evaluation splits.",
            ],
            "records": manifest,
        },
    )
    readme = (
        "# SNAPTURE scope dataset\n\n"
        "This is the clean dataset path for the seven categories in the SNAPTURE\n"
        "concept checklist. The preparation script never guesses PETE or HDPE\n"
        "labels from a generic `plastic` folder.\n\n"
        "## Scope labels\n\n"
        + "\n".join(f"- `{label}`" for label in SCOPE_LABELS)
        + "\n\n"
        "`cardboard/` and `paper/` contain exact source matches.\n"
        "`needs_manual_review/plastic_unclassified/` contains generic plastic\n"
        "images that must be reviewed and moved into `pete_bottles/` or\n"
        "`hdpe_containers/` only when the material is verified.\n"
        "`out_of_scope/` contains source classes excluded by the checklist.\n\n"
        "Do not train until each intended scope class has enough verified images.\n"
        "Follow `SNAPTURE_ML/DATASET_POLICY.md` for consent, privacy, labeling,\n"
        "quality checks, and train/validation/test split rules.\n\n"
        "Run `python scripts/prepare_scope_dataset.py --help` to regenerate the\n"
        "layout after adding or replacing source data.\n"
    )
    (destination / "README.md").write_text(readme, encoding="utf-8")
    return {"destination": str(destination), "counts": counts, "records": len(manifest)}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("data/raw/trashnet/dataset-resized"),
        help="Existing source dataset folder (default: %(default)s)",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path("data/scope_dataset"),
        help="Clean output folder (default: %(default)s)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    result = build_dataset(args.source, args.destination)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
