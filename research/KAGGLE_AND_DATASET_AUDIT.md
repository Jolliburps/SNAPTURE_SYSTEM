# Kaggle acquisition and recoverable dataset organization — 2026-10-22

## Sources

- Drinking Waste Classification v2, `arkadiyhacks/drinking-waste-classification`:
  publisher lists CC0, four classes and YOLO annotations. It incorporates some
  TrashNet data; keep the original notices and compare overlap. Raw/YOLO folders
  contain repeated copies, not independent samples.
- Waste Classification Data v1, `techsash/waste-classification-data`: publisher
  lists CC BY-SA 4.0. Original O/R and TRAIN/TEST labels are retained as source
  labels, not interpreted as Bacoor disposal decisions. Respect attribution and
  share-alike conditions for relevant reused dataset material.
- Garbage Classification 12 classes, `mostafaabla/garbage-classification`: only
  metadata downloaded. Publisher explicitly states web-scraped images remain
  copyrighted by original photographers. Rights and normal clothing/shoe versus
  discarded-waste suitability remain unresolved; no photos imported from it.

Public official Kaggle download endpoints worked anonymously. No account,
credential, paid plan, competition registration or terms acceptance was used.
The source ZIPs, metadata and image inventories remain in git-ignored
`SNAPTURE_ML/data/public_sources/`.

## Audit and organized destination

`organize_waste_datasets.py` reads the seven original local material folders
(coconut remains excluded from active scope) and every completed verified public
source. Unfinished downloads and segmentation masks are excluded. Corrupt/oversize
files are reported, not silently deleted. It checks encoded SHA-256 and oriented
RGBA pixel SHA-256, and retains one representative per identical-pixel group.

The new versioned output is `SNAPTURE_ML/data/organized_candidates/<run>/`:

- `classification/`: exact six-material source labels where available.
- `broad_materials/`: glass, metal, unspecific plastic, textiles, etc.; plastic is
  never automatically relabeled PET/HDPE.
- `detection/`: boxed-scene sources, not forced into one material per scene.
- `auxiliary_labels/`: Kaggle O/R labels, not local segregation truth.
- `needs_label_review/`: conflicting labels or unmapped cases.
- `excluded_scope/coconut_shells/`: preserved but not enabled as a target.
- `source_annotations/`: preserved annotation files referenced by the manifest.

`manifest.json` links each retained image to ALL original source aliases,
licenses, annotation IDs/files, source splits and provided item groups. Duplicate
exclusions, corrupt files, conflicts and possible visual-fingerprint matches have
separate reports. `latest.json` points to the latest run and summary.

Duplicates are removed **from this organized review collection**, not irreversibly
deleted from raw datasets. Raw annotation-relative paths and archives remain
intact for recovery. Images are hardlinked when possible to avoid extra disk use;
do not edit staged images in place. Rebuild a view or write transformed outputs
to a separate folder. No user scan, active model or source image is deleted.

Similar-looking but non-identical images are not automatically removed: small
text, damage and angles may matter. The visual fingerprint report is a manual
review aid, not proof all near-duplicates were found. Conflicting material or O/R
labels are held rather than silently corrected. Exact duplicates crossing source
TRAIN/TEST splits are flagged; a new physical-item-grouped split is still needed.
EXIF/geometry differences requiring annotation transformation are flagged.

## Before actual use

Every record remains `training_eligible: false` and unreviewed. This automated
audit does not validate material labels, unseen chemical history, faces/privacy,
photo rights for every item, local acceptance, or independent physical objects.
Review those issues and annotations before building train/validation/test sets.
No model training, deployment or automatic camera change is performed here.

## Completed audit result

The run identified by `organized_candidates/latest.json` inspected 88,728 files
from the existing seven stored material folders and eight completed public-source
collections. It excluded 33,489 repeated files from the organized view and kept
55,233 unique oriented-pixel groups. Six images exceeding the 25-megapixel audit
limit were held separately; this is not a claim those six are corrupt.

The retained count includes 363 coconut-shell images in excluded_scope, five
conflicting-label groups and 12 MMoRWaD images needing material-label review.
Other findings: 511 possible visual-fingerprint groups (not automatically
removed), 285 cross-source split-conflict groups, 10 missing detection-label
files, and 13 invalid YOLO annotation rows in 13 files. Source class IDs and
actual box correctness still require review even for structurally valid rows.
5,312 original annotation files were preserved in the generated view.

No originals were deleted. New links occupy separate directory entries rather
than duplicating image bytes. Incomplete ZeroWaste and rights-held photo sources
were not included. This is a deduplicated review collection, not approved
training data or 55,233 independent physical objects.

`finalize_dataset_audit.py` preserves source metadata, checks YOLO structure,
records missing/invalid labels, and safely normalizes generated broad-label
folders. It does not fabricate missing boxes, clamp invalid coordinates or
change raw annotations.

Run with the project Python:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_ML\scripts\organize_waste_datasets.py --workers 4
```
