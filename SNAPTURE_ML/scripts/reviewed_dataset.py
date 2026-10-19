"""Prepare physically grouped, permission-reviewed six-material training data.

No image is approved by its folder name or by a previous model prediction.
"""
import argparse
import hashlib
import json
import random
import shutil
import zipfile
from pathlib import Path

LABELS = ["pete_bottles", "hdpe_containers", "cardboard", "paper", "fabric_scraps", "dry_untreated_wood_scraps"]
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def inventory(root):
    return {"schema_version": 1, "note": "Unreviewed inventory only. Supply physical-item/session group, reviewer and permission before training.",
            "records": [{"path": str(path.resolve()), "label": label, "group": "", "reviewed": False,
                         "reviewed_by": "", "permission": ""}
                        for label in LABELS for path in sorted((root / label).rglob("*"))
                        if path.is_file() and path.suffix.lower() in EXTENSIONS]}


def prepare(manifest, output):
    from PIL import Image
    data = json.loads(manifest.read_text(encoding="utf-8"))
    records = data.get("records", [])
    if not records:
        raise ValueError("The review manifest has no records.")
    if output.exists() and any(output.iterdir()):
        raise ValueError("Use a new empty output directory; existing datasets are never overwritten.")
    checked, hashes, groups = [], {}, {}
    for row in records:
        if row.get("label") not in LABELS:
            raise ValueError("Manifest includes an unsupported category (coconut shells are excluded).")
        if row.get("reviewed") is not True or any(not str(row.get(key, "")).strip() for key in ("group", "reviewed_by", "permission")):
            raise ValueError("Every included image needs explicit review, reviewer, permission and a physical-item/session group.")
        path = Path(row["path"])
        if not path.is_absolute():
            path = manifest.parent / path
        if not path.is_file():
            raise ValueError(f"Missing image: {path}")
        with Image.open(path) as image:
            image.verify()
        fingerprint = sha256(path)
        if fingerprint in hashes:
            raise ValueError(f"Duplicate image: {path} and {hashes[fingerprint]}")
        hashes[fingerprint] = path
        group = row["group"].strip()
        if group in groups and groups[group] != row["label"]:
            raise ValueError("A physical-item/session group spans conflicting labels. Review it before splitting.")
        groups[group] = row["label"]
        checked.append((row, path, fingerprint, group))
    assignment = {}
    rng = random.Random(42)
    for label in LABELS:
        label_groups = sorted(group for group, group_label in groups.items() if group_label == label)
        if len(label_groups) < 3:
            raise ValueError(f"{label} needs at least three distinct reviewed groups to form train/val/test; more are needed for credible evaluation.")
        rng.shuffle(label_groups)
        test_count = max(1, round(len(label_groups) * 0.15))
        val_count = max(1, round(len(label_groups) * 0.15))
        for index, group in enumerate(label_groups):
            assignment[group] = "test" if index < test_count else "val" if index < test_count + val_count else "train"
    output.mkdir(parents=True, exist_ok=True)
    exported = []
    for row, path, fingerprint, group in checked:
        destination = output / assignment[group] / row["label"] / (fingerprint + path.suffix.lower())
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, destination)
        exported.append({**row, "path": destination.relative_to(output).as_posix(), "sha256": fingerprint, "split": assignment[group]})
    (output / "labels.json").write_text(json.dumps(LABELS, indent=2) + "\n", encoding="utf-8")
    (output / "reviewed_split_manifest.json").write_text(json.dumps({"schema_version": 1, "records": exported}, indent=2) + "\n", encoding="utf-8")
    return exported


def validate_prepared(root):
    path = root / "reviewed_split_manifest.json"
    if not path.is_file():
        raise ValueError("A reviewed, physically grouped split manifest is required. Use reviewed_dataset.py prepare first, or explicitly mark an unverified experiment.")
    rows = json.loads(path.read_text(encoding="utf-8")).get("records", [])
    if not rows:
        raise ValueError("Empty reviewed split manifest.")
    group_splits, seen, covered = {}, set(), set()
    actual = {file.resolve() for split in ("train", "val", "test") for file in (root / split).rglob("*") if file.is_file() and file.suffix.lower() in EXTENSIONS}
    for row in rows:
        file = (root / row["path"]).resolve()
        if not file.is_relative_to(root.resolve()) or file not in actual:
            raise ValueError("Manifest image is missing or leaves the dataset directory.")
        if row.get("reviewed") is not True or any(not str(row.get(key, "")).strip() for key in ("group", "permission", "reviewed_by")):
            raise ValueError("Image review metadata is incomplete.")
        relative = file.relative_to(root.resolve())
        if len(relative.parts) != 3 or relative.parts[:2] != (row["split"], row["label"]) or row["label"] not in LABELS:
            raise ValueError("Manifest split/label disagrees with the dataset path.")
        fingerprint = sha256(file)
        if fingerprint != row["sha256"] or fingerprint in seen:
            raise ValueError("A reviewed image changed or a duplicate entered the dataset.")
        seen.add(fingerprint)
        previous = group_splits.setdefault(row["group"], row["split"])
        if previous != row["split"]:
            raise ValueError("The same physical item/session appears in multiple splits.")
        covered.add(file)
    if covered != actual:
        raise ValueError("The dataset includes images without review metadata.")
    return len(rows)


def package(root, destination):
    validate_prepared(root)
    if destination.exists():
        raise ValueError("Choose a new archive filename; an existing archive will not be overwritten.")
    scripts = Path(__file__).parent
    with zipfile.ZipFile(destination, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        for file in root.rglob("*"):
            if file.is_file():
                archive.write(file, "dataset/" + file.relative_to(root).as_posix())
        for name in ("train_model.py", "reviewed_dataset.py"):
            archive.write(scripts / name, "scripts/" + name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("operation", choices=["inventory", "prepare", "validate", "package"])
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    if args.operation == "inventory":
        if args.output is None or args.output.exists():
            parser.error("Provide a new --output review-manifest filename.")
        payload = inventory(args.input)
        args.output.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        print("Unreviewed records:", len(payload["records"]))
    elif args.operation == "prepare":
        if args.output is None:
            parser.error("Provide a new --output dataset directory.")
        print("Prepared reviewed images:", len(prepare(args.input, args.output)))
    elif args.operation == "validate":
        print("Verified grouped image records:", validate_prepared(args.input))
    else:
        if args.output is None:
            parser.error("Provide a new --output zip filename.")
        package(args.input, args.output)
        print("Private local training bundle:", args.output)


if __name__ == "__main__":
    main()
