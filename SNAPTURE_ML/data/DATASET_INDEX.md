# Local recognition data — 25 October 2026

Canonical deduplicated review library:

`recognition_basis/20261025T093043Z/`

| Material folder | Unique photo groups |
| --- | ---: |
| pete_bottles | 5,412 |
| hdpe_containers | 3,476 |
| cardboard | 2,417 |
| paper | 3,680 |
| fabric_scraps | 5,816 |
| dry_untreated_wood_scraps | 775 |
| coconut_shells | 363 |
| **Seven-material subtotal** | **21,939** |
| **Object detection datas** (other materials, scenes, broad labels and review holds) | **42,805** |
| **Total unique decoded-pixel groups** | **64,744** |

These are photo groups, not necessarily unique physical objects, bounding boxes,
approved training samples or recognition classes. Whole mixed scenes are not put
into a single material folder merely because one material is visible.

## What was checked

- 98,264 source photo paths inspected; 33,514 repeated entries excluded from the
  canonical view using oriented decoded pixels. Sources and annotation paths
  remain available. Hardlinks avoid duplicating image bytes.
- Six original images over 25 megapixels held for separate inspection, not
  silently resized or deleted. Five conflicting label groups held outside the
  seven material folders; 530 visual-similarity groups require human review.
- 285 duplicate groups cross publisher train/test/validation splits. Do not
  combine these original splits into a new model evaluation without resolving
  leakage and grouping physical items/video sequences.
- The view preserves 9,321 referenced annotation files; original source trees
  retain masks and relative filenames. Renamed review images are NOT a drop-in
  COCO/YOLO training export. Use `manifest.json` and the original source roots.
- No manual review of every image's label, privacy or waste condition has been
  completed. No new model was trained or promoted by this collection.

## Added/completed detection sources

| Source | Photos before cross-source deduplication | Annotated boxes checked |
| --- | ---: | ---: |
| [Indoor Waste](https://data.mendeley.com/datasets/dy7smxr93r/1) | 4,000 | 6,968 |
| [WasteInsight](https://data.mendeley.com/datasets/p8n7nbxyw3/1) | 447 | 724 |
| [PackWISE v2](https://fordatis.fraunhofer.de/handle/fordatis/463.2) | 586 | 6,713 |
| [ZeroWaste](https://github.com/dbash/zerowaste/) | 4,503 | 26,766 |

All 41,171 listed boxes passed structural image/category/reference and coordinate
checks. This is NOT evidence that their labels or outlines are visually correct.
Indoor `shell` does not mean coconut shell; WasteInsight detects bags, not their
hidden contents. PackWISE's title-page illustration is excluded. ZeroWaste's
4,503 segmentation-mask images are annotations, not an extra 4,503 photographs.

The first three sources state CC BY 4.0. Keep attribution. ZeroWaste remains
research-only pending a conflict between its author README and archive licence.
Unclear-rights TACO photos and held Kaggle sources were not downloaded or used.
Existing public-source manifests preserve their individual licence terms.

## Storage cleanup

- 61,473 exact-byte duplicate paths were coalesced into shared NTFS hardlinks,
  reclaiming an estimated 1,236,276,727 bytes while retaining image/label paths.
- Only the redundant 7,518,242,799-byte ZeroWaste ZIP was deleted, after all 9,009
  extracted files matched its sizes and CRCs. Photos/labels remain; the source
  manifest retains the public URL for redownloading the ZIP.
- Never edit a hardlinked source/review image in place. Write preprocessing or
  augmentation outputs to new files.

## Audit files and reproducible tools

- `recognition_basis/latest.json` — canonical view pointer and counts.
- `recognition_basis/20261025T093043Z/manifest.json` — hashes, source aliases,
  splits, annotation references and review status.
- `detection_annotation_audit.json` — source annotation checks.
- `public_sources/<dataset>/acquisition.json` — source, licence and download status.
- `../scripts/build_recognition_basis.py` — rebuild a separate review view.
- `../scripts/audit_detection_annotations.py` — read-only annotation checks.
- `../scripts/compact_dataset_storage.py` — dry run by default; explicit `--apply`
  coalesces exact duplicates only within the selected `data` directory.

Large local source/view files remain out of Git, consistent with the existing
dataset policy. Code and small summaries can be versioned; review rights before
redistributing any dataset. The app still uses the existing experimental
seven-class model and optional OWL-ViT detector, not these new photos directly.
