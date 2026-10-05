# Experimental seven-class SNAPTURE candidate

This directory contains an experimental MobileNetV2 checkpoint trained on
the seven local SNAPTURE category folders on 2026-10-06. It is deliberately
stored separately from `models/snapture_baseline.keras`; the backend continues
to use that existing six-class TrashNet baseline by default.

The image-random split produced 85.42% validation accuracy and 84.55% test
accuracy. These are preliminary scores, not verified real-world performance:
images were not individually approved, source batches/objects were not grouped
between splits, and several class labels or image sources are uncertain. The
candidate also misses the desired 80% per-category gate (notably HDPE precision,
cardboard recall, and paper recall). See `training_summary.json` and
[`DATA_REVIEW_2026-10-06.md`](../../../DATA_REVIEW_2026-10-06.md) for full results
and limitations.

The original image dataset and face-review/quarantine files are not included in
this public repository. Obtain permission and finish label/privacy review
before sharing the data or promoting this model.

Files:

- `snapture_7class_candidate_unverified.keras` — experimental weights
- `labels.json` — model output order
- `model_config.json` — preprocessing and candidate metadata
- `training_summary.json` — split counts, confusion matrices, and per-class metrics
