# Google Drive image-batch review — 2026-10-06

## Decision

Do **not** promote or replace the current model with this batch yet. In response
to the request to train the seven categories, an explicitly unverified candidate
was trained and evaluated; its checkpoint and metrics are saved separately from
the live model. The image files are readable, but several category labels are
not dependable enough for supervised training. The current
`verified_manifest.json` has zero approved records for all seven scope labels.
Keep the imported images as review candidates until each image has an accepted
label, source/permission record, and reviewer decision.

## Inventory and integrity

The local `_source_manifest.json` lists 9,626 Google Drive items. All 9,613
image entries were matched to a local file by class, filename, and byte size;
the remaining 13 items are CSV manifests. Pillow opened and verified every
matched image: 0 unreadable, 0 below 64×64 pixels. Exact SHA-256 comparison
of the source-manifest batch found 198 duplicate groups (202 extra copies),
including 5 groups duplicated across different labels.

| Candidate label | Images | Sample review |
| --- | ---: | --- |
| `pete_bottles` | 1,274 | Mostly bottle photos, but sample included people; remove privacy-risk images. Only 2 of 1,274 images have source-manifest rows, both hot-sauce photo URLs, so provenance and PET resin labels remain unverified. |
| `hdpe_containers` | 652 | Product containers do not establish resin type visually; the sample included images apparently belonging to PET bottles/other plastic. Only the detergent subset has populated source metadata; two other subset manifests are empty. |
| `cardboard` | 397 | Mostly boxes/cartons; visual category looks plausible, but sample review is not per-image label approval. |
| `paper` | 960 | Mostly newspapers, magazines, bags, and notebooks; visual category looks plausible, but sample review is not per-image label approval. |
| `fabric_scraps` | 5,500 | Sample was mostly intact clothing, not fabric scraps; label does not match the thesis class reliably. No source manifest was found for this batch. |
| `coconut_shells` | 330 | Includes whole coconuts, food, and shop scenes as well as shells; not consistently shell waste. |
| `dry_untreated_wood_scraps` | 500 | Includes pallets, stacked lumber, and wood surfaces, not consistently dry untreated scraps. |

These sample observations identify risks; they do not label every image.
The paper, coconut, and wood CSV row counts also differ from their matched
image counts (964 vs. 960, 328 vs. 330, and 504 vs. 500 respectively), so
those source records need filename-level reconciliation. Generated contact
sheets for the 15-image-per-class sample are in the local, git-ignored folder
`data/_audit_ml_2026-10-06/`.

A subsequent full-tree exact-hash pass found 2,663 redundant copies within the
same class. Those copies were sent to the Windows Recycle Bin, retaining one
identical file in each class; 17,148 class images remain. Six cross-label
duplicate groups were preserved for human review. Resolve these cross-label
groups before making train/validation/test splits. The removal list and
retained-path mapping are logged under `.run-logs/ml-dedupe-*`.

## Face and conflicting-label quarantine

An OpenCV YuNet face-detection pass flagged 464 distinct images. Contact sheets
for the 215 high-confidence detections were visually reviewed; those images
showed faces/people (some were printed on paper or fabric). These 215 files,
plus both copies from the six cross-label exact-duplicate groups (12 files),
were moved out of the active class folders into the ignored, recoverable
`data/_audit_ml_2026-10-06/training_hold/` folder. The CSV restore map records
each original path, quarantine path, reason, score, and SHA-256. The remaining
249 lower-confidence face candidates were not moved; manually review them
before treating the candidate model's metrics as reliable.

| Candidate label | Active images after quarantine |
| --- | ---: |
| `pete_bottles` | 3,034 |
| `hdpe_containers` | 606 |
| `cardboard` | 2,619 |
| `paper` | 3,636 |
| `fabric_scraps` | 5,816 |
| `coconut_shells` | 376 |
| `dry_untreated_wood_scraps` | 832 |

The trainer also excluded one unreadable image each from cardboard and paper;
those two originals were added to the recoverable hold folder. The final
training inventory therefore contains 16,919 readable images.

## Existing model and pipeline

The current checkpoint is the legacy six-class TrashNet model
(`cardboard`, `glass`, `metal`, `paper`, `plastic`, `trash`). Its recorded
validation accuracy is 0.6297 and it has no separate test set. It is not a
seven-class SNAPTURE checkpoint and must not be described as one.

The imported Drive candidates are under `data/` class folders. `data/labels.json`
declares their seven-class order for the experimental run; it does **not** mean
the images have been individually verified. The raw dataset remains local and
must not be published to the public GitHub repository until privacy, source,
license, and label review is complete. The audit sheets and restore map remain
git-ignored.

## Unverified seven-class candidate experiment

The candidate checkpoint is stored in
`models/candidates/snapture-7class-candidate-20261006/`; it does not overwrite
`models/snapture_baseline.keras`, which remains the live legacy six-class model.
The candidate was trained for 8 epochs with MobileNetV2 transfer learning on
the seven folders above. Training/validation/test assignment was a deterministic
random image split (70/15/15), not a split grouped by image source, physical
object, or capture session. Its test score can therefore be inflated by similar
images across splits and is not a trustworthy real-world accuracy estimate.

| Category | Test precision | Test recall | Test F1 |
| --- | ---: | ---: | ---: |
| `pete_bottles` | 89.4% | 90.8% | 90.1% |
| `hdpe_containers` | 57.3% | 90.1% | 70.1% |
| `cardboard` | 76.9% | 67.9% | 72.2% |
| `paper` | 82.4% | 74.5% | 78.2% |
| `fabric_scraps` | 96.4% | 94.3% | 95.3% |
| `coconut_shells` | 67.6% | 85.7% | 75.6% |
| `dry_untreated_wood_scraps` | 63.7% | 85.6% | 73.0% |

Overall validation accuracy was 85.42% and image-random test accuracy was
84.55%. This does **not** meet the requested 80% per-category release goal:
cardboard and paper recall are below 80%, and several categories have low
precision. Treat the model as a research candidate, not an enabled user-facing
classifier. Full metrics and confusion matrices are in the candidate's
`training_summary.json`.

## Accuracy and recommendation quality gate

The old checkpoint's 62.97% validation score does not establish performance
for the seven current categories. After labels and provenance are approved,
split by physical object, capture session, or source batch before training so
near-identical views cannot leak between train and test. Use a separate,
untouched test set and inspect per-class precision, recall, F1, and the
confusion matrix. Treat 80% as a minimum per-class release gate (not just an
overall average), and do not claim the target until the independent test
results meet it.

Recommendation quality is a separate product evaluation, not the image
classifier's category accuracy. Build a reviewed set of material-to-idea
examples; score each recommendation for material fit, safety, and usefulness,
then track top-k relevance and unsafe-recommendation rate. Keep deterministic
safety rules for unknown materials and hazardous/contaminated items, and use
user feedback only as a signal for review—not as verified truth by itself.

## Next safe steps

1. Review images individually; reject wrong objects, mixed scenes, duplicates,
   near-copies, screenshots, privacy content, and uncertain material labels.
2. Verify PETE/HDPE from an explicit resin mark or reliable source; do not infer
   resin from a container's appearance or product category.
3. Confirm source/license coverage, especially for PETE and fabric, and record
   reviewer, final label, source, and decision for each retained image.
4. Export only approved images to a reviewed dataset layout, split by physical
   object/source batch to prevent leakage, then train a new candidate.
5. Compare the candidate's per-class precision/recall/F1 and confusion matrix
   with the old checkpoint on an untouched, source-separated test set before
   promoting it.
