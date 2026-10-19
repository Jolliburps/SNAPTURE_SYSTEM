# Free, consent-aware six-material training

Scope updated 2026-10-18: PETE bottles, HDPE containers, cardboard, paper,
fabric scraps and dry untreated wood scraps. Coconut shells are excluded
from current results, catalog and future training. Old images, old class
orders and checkpoints are preserved; never relabel a seven-output checkpoint
as a six-output model.

## What is available now

The app still uses the existing experimental checkpoint. Its coconut output
is rejected, not reassigned to the next-best class. No new accuracy claim is
made. A new trained model is a separate candidate until independently tested.

No hosted recognition API is necessary: Django can continue local inference.
The current Windows TensorFlow environment has no usable GPU. For optional
training acceleration, use Google Colab Free and `notebooks/train_free_colab.ipynb`.
No API key or paid subscription is required. Free GPU availability and session
limits are variable and not guaranteed:
https://research.google.com/colaboratory/faq.html

No images are uploaded by these local commands. The notebook requires a
deliberate upload to Google. Check image permissions and privacy first.
Do not upload the entire repository, database, credentials or user histories.

## Reviewed physical-item groups first

From SNAPTURE_ML with its virtual environment:

```powershell
.\.venv\Scripts\python.exe scripts/reviewed_dataset.py inventory data --output data/review_manifest_six_materials.json
```

The inventory is NOT a verified dataset. For each included record, confirm
the material, remove faces/documents, record permission and reviewer, set
`reviewed: true`, and assign a `group` shared by every photo/variant of the
same physical item or capture session. Do not infer resin type or treatment
history from a folder name. Omit excluded/unreviewed records from the training
manifest. A different filename is not proof of a different physical item.

```powershell
.\.venv\Scripts\python.exe scripts/reviewed_dataset.py prepare data/review_manifest_six_materials.json --output data/prepared_six_materials_v1
.\.venv\Scripts\python.exe scripts/reviewed_dataset.py validate data/prepared_six_materials_v1
.\.venv\Scripts\python.exe scripts/reviewed_dataset.py package data/prepared_six_materials_v1 --output data/reviewed_training_bundle_v1.zip
```

Each class needs at least three distinct groups to form three partitions;
this is a structural minimum, NOT enough to establish reliable accuracy.
Use substantially more representative physical items and independent field
photos. Duplicate bytes and mismatched labels are rejected. Near-duplicate
or same-item grouping still requires human review.

Open the notebook in https://colab.research.google.com/, choose a free GPU if
available, then explicitly upload the bundle. It validates the review manifest,
trains MobileNetV2 and downloads a separate candidate with per-class metrics.
Alternatively train locally:

```powershell
.\.venv\Scripts\python.exe scripts/train_model.py --data-dir data/prepared_six_materials_v1 --output-dir models/candidates/six_materials_reviewed_v1 --epochs 30
```

Neither path automatically replaces active_model.json. Inspect held-out
per-class precision/recall/F1, confusion matrix, unsupported-item rejection,
latency and real phone photos before promotion. Do not tune using the final
test set or inflate displayed confidence to claim 80% accuracy. Explicit
`--unverified-candidate` runs remain experiments, never verified evidence.
