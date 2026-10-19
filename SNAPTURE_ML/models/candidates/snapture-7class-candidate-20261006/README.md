# Experimental seven-class SNAPTURE candidate

This directory contains an experimental MobileNetV2 checkpoint trained on
the seven local SNAPTURE category folders on 2026-10-06. It is deliberately
stored separately from `models/snapture_baseline.keras`. On 2026-10-14,
`models/active_model.json` selected this checkpoint for local camera testing.
The six-class TrashNet baseline is preserved for rollback. This activation
does not mark the candidate as verified or approved for deployment.

The confidence rejection threshold is now 0.80 for prototype testing.
An 80% model confidence is not an 80% accuracy guarantee. PET/PETE and HDPE
suggestions require a readable resin-code confirmation before project guidance.
Wood still requires the existing surface and treatment check.

The training counts below describe the 2026-10-06 corpus, not the current
15,252 image files remaining after later cleanup. Activating this saved model
does not retrain it on those subsequent changes. A reviewed, source-grouped
training and test split is still required before reporting field performance.

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
