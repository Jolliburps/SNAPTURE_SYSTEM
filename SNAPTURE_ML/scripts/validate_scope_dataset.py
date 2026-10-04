"""Validate active SNAPTURE scope images without changing the dataset."""

from pathlib import Path
from collections import Counter
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1] / "data" / "scope_dataset"
LABELS = [
    "pete_bottles",
    "hdpe_containers",
    "cardboard",
    "paper",
    "fabric_scraps",
    "coconut_shells",
    "dry_untreated_wood_scraps",
]
EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

total = 0
bad = []
sizes = Counter()
for label in LABELS:
    folder = ROOT / label
    files = sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in EXTENSIONS)
    print(f"{label}: {len(files)} images")
    for path in files:
        total += 1
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                sizes[image.size] += 1
        except (OSError, UnidentifiedImageError, ValueError) as exc:
            bad.append((str(path), str(exc)))

print(f"total_images: {total}")
print(f"unique_sizes: {len(sizes)}")
print(f"corrupt_images: {len(bad)}")
if bad:
    for path, error in bad[:20]:
        print(f"BAD: {path} :: {error}")
    raise SystemExit(1)
