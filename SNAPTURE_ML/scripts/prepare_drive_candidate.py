"""Build an experimental, duplicate-free view of the imported Drive images.

Original files in data/<class>/ are never changed. Hard links keep the prepared
view small on disk. Conflicting exact images across labels are excluded entirely.
The output remains unverified and must not replace data/scope_dataset.
"""

from __future__ import annotations

from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path


ML_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ML_DIR / "data"
OUTPUT_DIR = DATA_DIR / "candidates" / "drive_20261006"
LABELS = json.loads((DATA_DIR / "labels.json").read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    groups: dict[str, list[tuple[str, Path]]] = defaultdict(list)
    for label in LABELS:
        for path in sorted((DATA_DIR / label).rglob("*.jpg")):
            groups[sha256(path)].append((label, path))

    counts: Counter[str] = Counter()
    records: list[dict[str, str]] = []
    for digest, entries in sorted(groups.items()):
        labels = {label for label, _ in entries}
        conflicting = len(labels) > 1
        for index, (label, source) in enumerate(entries):
            relative = source.relative_to(DATA_DIR)
            record = {"source": relative.as_posix(), "sha256": digest}
            if conflicting:
                record["status"] = "conflicting_labels"
            elif index:
                record["status"] = "duplicate"
            else:
                record["status"] = "included_unverified"
                target = OUTPUT_DIR / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    if not target.samefile(source):
                        raise FileExistsError(f"Prepared path has different content: {target}")
                else:
                    target.hardlink_to(source)
            counts[record["status"]] += 1
            records.append(record)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "labels.json").write_text(
        json.dumps(LABELS, indent=2) + "\n", encoding="utf-8"
    )
    (OUTPUT_DIR / "preparation_manifest.json").write_text(
        json.dumps(records, indent=2) + "\n", encoding="utf-8"
    )
    print(dict(counts))
    print(f"Prepared candidate: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
