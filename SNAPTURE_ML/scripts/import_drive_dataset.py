"""Download the public Drive candidate batch into the seven local class folders.

Run with --refresh-index to retrieve the folder listing from Google Drive.
The listing is cached as data/_source_manifest.json for resumable downloads.

These files are unverified candidates, not the approved scope_dataset.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import threading
import time
from urllib.parse import parse_qs, urlparse

from PIL import Image
import requests


DATA_DIR = Path(__file__).resolve().parents[1] / "data"
FOLDER_URL = "https://drive.google.com/drive/folders/1d2lEtxa-SsTKfjz2ENlTqgVDa739pkyO"
SOURCE_MANIFEST = DATA_DIR / "_source_manifest.json"
FAILURES_FILE = DATA_DIR / "_download_failures.json"
IMPORT_MAP = DATA_DIR / "_import_map.json"
ROOT_LABELS = {
    "pet bottles": "pete_bottles",
    "HDPE containers": "hdpe_containers",
    "Cardboard": "cardboard",
    "paper": "paper",
    "fabrics": "fabric_scraps",
    "coconut_shells": "coconut_shells",
    "wood_scraps_raw": "dry_untreated_wood_scraps",
}
THREAD_LOCAL = threading.local()


def session() -> requests.Session:
    if not hasattr(THREAD_LOCAL, "session"):
        THREAD_LOCAL.session = requests.Session()
    return THREAD_LOCAL.session


def destination(item: dict[str, str]) -> Path:
    source = PurePosixPath(item["path"])
    parts = source.parts
    if len(parts) < 2 or any(part in ("", ".", "..") for part in parts):
        raise ValueError(f"Unsafe Drive path: {item['path']!r}")
    if parts[0] not in ROOT_LABELS or source.suffix.lower() not in (".jpg", ".csv"):
        raise ValueError(f"Unexpected Drive item: {item['path']!r}")
    if not item["url"].startswith("https://drive.google.com/uc?id="):
        raise ValueError(f"Unexpected Drive URL for {item['path']!r}")
    return DATA_DIR / ROOT_LABELS[parts[0]] / Path(*parts[1:])


def download(item: dict[str, str], target: Path) -> str:
    if target.is_file() and target.stat().st_size > 0:
        return "skipped"
    target.parent.mkdir(parents=True, exist_ok=True)
    partial = target.with_name(target.name + ".part")
    drive_id = parse_qs(urlparse(item["url"]).query).get("id", [None])[0]
    if not drive_id:
        raise ValueError("Drive URL has no file ID")
    url = f"https://drive.google.com/uc?export=download&id={drive_id}"
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with session().get(url, stream=True, timeout=(20, 90)) as response:
                response.raise_for_status()
                content_type = response.headers.get("content-type", "").lower()
                if "text/html" in content_type:
                    raise RuntimeError("Drive returned an HTML page instead of the file")
                with partial.open("wb") as output:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            output.write(chunk)
            if partial.stat().st_size == 0:
                raise RuntimeError("Drive returned an empty file")
            if target.suffix.lower() == ".jpg":
                with Image.open(partial) as image:
                    image.verify()
            os.replace(partial, target)
            return "downloaded"
        except (OSError, requests.RequestException, RuntimeError) as error:
            last_error = error
            partial.unlink(missing_ok=True)
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Download failed after 4 attempts: {last_error}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--limit", type=int, help="Download only the first N items")
    parser.add_argument("--refresh-index", action="store_true", help="Fetch the folder listing again")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")

    if args.refresh_index or not SOURCE_MANIFEST.exists():
        result = subprocess.run(
            [sys.executable, "-m", "gdown", "--json", "--no-cookies", FOLDER_URL],
            check=True, capture_output=True, text=True, encoding="utf-8",
        )
        fetched_items = json.loads(result.stdout)
        if not isinstance(fetched_items, list) or not fetched_items:
            raise ValueError("Google Drive returned no folder items")
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        SOURCE_MANIFEST.write_text(
            json.dumps(fetched_items, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    items = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    if not isinstance(items, list):
        raise ValueError("Source manifest must be a JSON array")
    jobs = []
    seen: set[Path] = set()
    for item in items:
        target = destination(item)
        if target in seen:
            drive_id = item["url"].split("=", 1)[1]
            if not drive_id.replace("-", "").replace("_", "").isalnum():
                raise ValueError(f"Unexpected Drive ID for {item['path']!r}")
            target = target.with_name(f"{target.stem}__{drive_id}{target.suffix}")
        if target in seen:
            raise ValueError(f"Multiple Drive items map to {target}")
        seen.add(target)
        jobs.append((item, target))
    IMPORT_MAP.write_text(
        json.dumps(
            [{"source_path": item["path"], "local_path": str(target.relative_to(DATA_DIR))}
             for item, target in jobs],
            indent=2,
        ),
        encoding="utf-8",
    )
    if args.limit is not None:
        jobs = jobs[: args.limit]

    counts = {"downloaded": 0, "skipped": 0, "failed": 0}
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(download, item, target): item for item, target in jobs}
        for completed, future in enumerate(as_completed(futures), 1):
            item = futures[future]
            try:
                counts[future.result()] += 1
            except Exception as error:
                counts["failed"] += 1
                failures.append({"path": item["path"], "error": str(error)})
            if completed % 100 == 0 or completed == len(jobs):
                print(f"{completed}/{len(jobs)}: {counts}", flush=True)

    if failures:
        FAILURES_FILE.write_text(json.dumps(failures, indent=2), encoding="utf-8")
    elif FAILURES_FILE.exists():
        FAILURES_FILE.unlink()
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
