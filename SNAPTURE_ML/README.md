# SNAPTURE_ML

SNAPTURE_ML contains the shared TensorFlow training and inference code for the
standalone SNAPTURE Android client and Django backend. The old FastAPI server
is retained as a diagnostic compatibility tool; normal app requests now go
through `SNAPTURE_BACKEND`.

The maintained training pipeline is scoped to the seven thesis categories:

```text
pete_bottles, hdpe_containers, cardboard, paper,
fabric_scraps, coconut_shells, dry_untreated_wood_scraps
```

The existing TrashNet model remains available for demonstrations, but it is not
treated as evidence for PETE or HDPE. Only the seven scope labels can become a
final decision. Any `glass`, `plastic`, `metal`, `trash`, or other out-of-scope
prediction—and any prediction below the confidence threshold—is returned as
`unknown_unsupported` / **Unidentified or unsupported object**.
Confidence is a practical rejection rule, not a perfect unknown-object detector
or a safety certification.

## Project structure

```text
SNAPTURE_ML/
├── .venv/
├── data/raw/trashnet/dataset-resized/
│   ├── cardboard/
│   ├── glass/
│   ├── metal/
│   ├── paper/
│   ├── plastic/
│   └── trash/
├── models/
│   ├── snapture_baseline.keras
│   ├── labels.json
│   ├── model_config.json
│   └── training_summary.json
├── scripts/
│   ├── api_server.py
│   ├── inference.py
│   ├── predict_image.py
│   └── train_model.py
├── requirements.txt
└── train_model.py
```

The root `train_model.py` is only a compatibility entry point. The maintained trainer is `scripts/train_model.py`.

## Setup

Open PowerShell in the project root:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ML"
```

The project uses Python 3.13 and the existing `.venv`. PowerShell activation is optional; direct interpreter paths avoid execution-policy problems.

Install the pinned dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Dataset and labeling policy

The canonical training location is `data/scope_dataset`. If the original
source dataset is retained, keep it unchanged at
`data/raw/trashnet/dataset-resized` for reference; it is not required after
the prepared scope folder has been created.
The trainer reads the seven labels from `data/scope_dataset/labels.json` and
refuses to train if a scope class is missing or empty.

Use a flat class layout while collecting images:

```text
data/scope_dataset/
├── pete_bottles/
├── hdpe_containers/
├── cardboard/
├── paper/
├── fabric_scraps/
├── coconut_shells/
└── dry_untreated_wood_scraps/
```

For a reviewed dataset, an explicit split layout is also supported:

```text
data/scope_dataset/{train,val,test}/{class_name}/
```

Every image must be verified by a human. Never rename a generic `plastic`
folder to PETE or HDPE without checking each image. Do not use model
predictions as ground-truth labels.

The recommended starting target is at least 100 verified images per class,
with varied lighting, backgrounds, angles, distances, object sizes, and
conditions. Thirty images per class is the minimum training warning threshold;
the `SNAPTURE_ENFORCE_MIN_IMAGES=1` option can make that threshold blocking.

The trainer checks image readability, flags very small images, and rejects
exact duplicate files to prevent train/test leakage. Remove faces, documents,
and other personal information before adding images. Keep a source/license and
label-review record for every collected batch.

To deliberately run a legacy non-scope experiment, set `SNAPTURE_DATA_DIR` and
`SNAPTURE_ALLOW_NON_SCOPE_DATASET=1` explicitly:

```powershell
$env:SNAPTURE_DATA_DIR = ".\data\raw\my-dataset"
$env:SNAPTURE_ALLOW_NON_SCOPE_DATASET = "1"
```

Each immediate subfolder becomes a class. Do not rename a broad `plastic` or `metal` folder to `plastic_bottle` or `metal_can` unless every image in that folder has been verified to match the new label.

### Clean checklist-scope path

The concept checklist uses seven narrower categories than the current
TrashNet source. Generate an explicit local folder layout for those labels:

```powershell
python .\scripts\prepare_scope_dataset.py
```

This creates `data/scope_dataset/` with folders for `pete_bottles`,
`hdpe_containers`, `cardboard`, `paper`, `fabric_scraps`, `coconut_shells`,
and `dry_untreated_wood_scraps`. Exact `cardboard` and `paper` images are
linked into their matching folders. Generic `plastic` images must remain
outside the seven active classes until a human verifies PETE or HDPE; the
current audit keeps them in the recoverable
`data/scope_dataset/_quarantine_2026-10-02/` folder. The script never guesses
PETE or HDPE from a generic plastic label. The complete source-to-label record
is in `data/scope_dataset/dataset_manifest.json`.

The original TrashNet source is not included in this checkout. Do not run the
command above without supplying a real `--source` directory. For new
categories, upload and verify images in the Django dataset collector, then run
the export command below.

Do not promote a seven-class model until each intended scope folder contains
enough verified images. Empty folders are intentional and identify categories
missing from the current source dataset.

### Google Drive batch status (2026-10-06)

The linked Google Drive batch can be downloaded locally under the seven
`data/<class>/` folders. From `SNAPTURE_ML`, run:

```powershell
& .\.venv\Scripts\python.exe .\scripts\import_drive_dataset.py --refresh-index --workers 24
```

The import is resumable. Run the same command again after an interruption; the
cached listing, `data/_source_manifest.json`, avoids repeating the folder
inventory step, so omit `--refresh-index` on later runs. The importer preserves
the source subfolders, maps the seven Drive root names to project labels,
checks JPEG readability, and reports failed items in
`data/_download_failures.json`. Its source-to-local path record is
`data/_import_map.json`. The source inventory has 9,626 items, including 9,613
JPEGs and 13 CSV files; compare the final counts with that inventory.

This is a candidate collection, not a reviewed training set: the
current `data/verified_manifest.json` has no approved records, and sample
review found label/provenance issues in several categories. An unverified
seven-class experiment was trained on this batch and saved under
`models/candidates/snapture-7class-candidate-20261006/`; this did not replace
the default model. Its random image split reached 84.55% test accuracy overall,
but misses the 80% per-category release goal and is not an independent
source/object-separated evaluation. Do not present it as validated performance.
The integrity findings, per-class results, and next steps are recorded in
[`DATA_REVIEW_2026-10-06.md`](DATA_REVIEW_2026-10-06.md).

The raw dataset is deliberately not published in this public repository. The
generated review contact sheets and quarantine/restore map remain local and
git-ignored. The legacy six-class checkpoint remains the default in `models/`;
review privacy, source permissions, and labels before publishing any raw images
or promoting the candidate.

To build a local experimental training view from this exact Drive import, run:

```powershell
& .\.venv\Scripts\python.exe .\scripts\prepare_drive_candidate.py
& .\.venv\Scripts\python.exe .\scripts\train_model.py --data-dir data/candidates/drive_20261006 --output-dir models/candidates/snapture-drive-20261006 --unverified-candidate
```

The preparation step hard-links one copy of each unique image into
`data/candidates/drive_20261006`, excluding exact images that have conflicting
labels across classes. The originals stay in `data/<class>/`. The preparation
manifest records every inclusion and exclusion. The output model is explicitly
marked unverified and stays separate from the active model.

For a local phone prototype after reviewing the candidate metrics, start the
backend from the repository root with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\SNAPTURE_BACKEND\run_phone_prototype.ps1
```

This selects the
candidate model for that server process. Scan results from the candidate are
labeled **prototype result** in the app; they are still tentative material
identifications because the source labels have not been individually verified.
The current batch's training and test results are in
[`DRIVE_PROTOTYPE_EVALUATION_2026-10-06.md`](DRIVE_PROTOTYPE_EVALUATION_2026-10-06.md).

### Capture verified images

The Django backend includes an administrator-protected dataset endpoint. It
never uses the model prediction as a label. The current Android administrator
dashboard provides system activity; detailed dataset upload and review remain
available through Django Admin or the protected API. Uploaded images are kept
pending until an administrator verifies the label.

After reviewing uploads in Django Admin, export only verified records into the
canonical training folders:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_BACKEND"
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py export_verified_dataset
```

The command skips pending/rejected images, avoids exact duplicate exports, and
writes `data/scope_dataset/verified_manifest.json` without user emails.

Do not expose this collector publicly or use predicted labels as ground truth.

## Train and evaluate the model

```powershell
.\.venv\Scripts\python.exe .\scripts\train_model.py
```

The trainer reads `data/scope_dataset/labels.json`, ignores the quarantine
folder, and stops with a clear error if any declared class folder is empty. It
never silently falls back to a smaller dataset.

The trainer validates image files, creates a deterministic stratified 70/15/15
train/validation/test split when the flat layout is used, applies MobileNetV2
transfer learning, and uses class weights for imbalance. It saves:

- `models/snapture_baseline.keras` — trained Keras model
- `models/labels.json` — class order used by the model
- `models/model_config.json` — image size, preprocessing, threshold, and dataset metadata
- `models/training_summary.json` — measured validation results

The test score is kept separate from training and validation. Do not report
validation accuracy as the final thesis accuracy.

The training summary also contains per-class precision, recall, F1 scores, and
the confusion matrices needed for a meaningful thesis evaluation.

## Test one image

```powershell
.\.venv\Scripts\python.exe .\scripts\predict_image.py ".\data\raw\trashnet\dataset-resized\paper\paper1.jpg"
```

The command prints JSON containing the model class, confidence, threshold, and final decision. The image is passed as raw RGB pixels because MobileNetV2 preprocessing is stored inside the trained model.

The threshold can be changed for a local experiment without editing source code:

```powershell
$env:SNAPTURE_CONFIDENCE_THRESHOLD = "0.60"
```

For a classroom demo you can experiment with `0.50` to return more borderline plastic/metal results, but a lower threshold also increases false positives. Restart the API after changing the variable.

The legacy unsupported list can still be configured for diagnostics (all
out-of-scope labels are rejected regardless):

```powershell
$env:SNAPTURE_UNSUPPORTED_CLASSES = "glass,trash"
```

## Diagnostic FastAPI server

The maintained application uses Django, but the old FastAPI server remains
available for model-only diagnostics:

```powershell
.\.venv\Scripts\python.exe -m uvicorn scripts.api_server:app --host 0.0.0.0 --port 18000
```

Use port `18000` so it does not conflict with the Django API on port `8000`.

Example response:

```json
{
  "class": "paper",
  "confidence": 0.648793,
  "decision": "paper",
  "threshold": 0.6,
  "unsupported_class": false,
  "label": "paper",
  "model_class": "paper",
  "title": "Paper",
  "preparation": [
    "Remove wet or heavily contaminated parts.",
    "Keep the paper dry.",
    "Separate tape, plastic, and metal attachments."
  ],
  "reuse_options": [
    "Paper organizer",
    "Gift wrapping",
    "Paper craft"
  ]
}
```

The confidence and class in this example come from the current trained model; they will vary with the image. A low-confidence result is intentionally returned as `unknown_unsupported` instead of presenting an uncertain material as fact.

## Android app connection

The standalone React Native CLI app is in `SNAPTURE_ANDROID`. The current
checkout uses the connected phone's LAN address in
`SNAPTURE_ANDROID/src/api.ts`; an Android emulator should use
`http://10.0.2.2:8000/api`. Do not use `localhost` on a phone. Keep the phone
and computer on the same Wi-Fi network.

## Common fixes

- **`No matching distribution found for tensorflow`**: use the project Python 3.13 environment, not Python 3.14.
- **PowerShell blocks `npm.ps1` or `npx.ps1`**: use `npm.cmd` or `npx.cmd`.
- **`Model is not ready`**: train the model first and confirm the files in `models/` exist.
- **Phone cannot connect**: start the API with `--host 0.0.0.0`, use the computer's IPv4 address, check same Wi-Fi, and allow the development server on the Private network if Windows asks.
- **`unknown_unsupported`**: the model was below the configured confidence threshold or predicted a class outside the seven thesis categories. This is intentionally conservative.

## Limitations

TrashNet is a broad classroom-style dataset; its `plastic` and `metal` classes do not guarantee plastic bottles or metal cans. The current backend is an educational decision-support prototype. It cannot determine hidden contamination, chemical residue, microbial load, internal structural damage, material strength, or food-contact safety.
