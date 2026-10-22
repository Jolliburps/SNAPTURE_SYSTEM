# Object recognition and disposal-intent workflow

Implemented 22 October 2026 in the existing React Native / Django application.
This is a workflow improvement, not a new accuracy claim or a trained model release.

## What changed

Capture/upload, privacy processing, the original photo, item crops, assessment,
project tracking and grouped history remain in place. After detection:

1. Show actual model proposals with stable numbered boxes and distinct object colors.
2. Ask **Which items do you want to discard?** Nothing is selected by default.
3. Box taps and list checkboxes toggle the same selection, including phones,
   watches and other possible background belongings. Optional object-name
   corrections remain separate from the original label and score.
4. Confirm only the chosen items. Show a handling route for each, with existing
   assessment and project links where applicable. Users can change selections
   without re-running detection. A missed object can be marked manually and named;
   it is never presented as an AI detection.

Routes are: eligible for a matching published expert-reviewed project; more
information required; special handling; or no verified upcycling method available.
An unselected object has no requested handling action. Unsupported material is
never automatically residual waste, recyclable, or upcyclable.

## Model and evidence boundaries

The installed scene detector remains local OWL-ViT base patch32. It is a zero-shot
text-query detector, not a detector newly trained on the acquired waste datasets.
Queries now include towel, wallet, comb and coconut shell, alongside the existing
phone/watch/computer and waste queries. Adding a query does not establish reliable
recognition of that class. No paid service, new weights or fabricated boxes were added.

NMS still merges same-family duplicates; it preserves overlapping distinct named
objects such as phone and towel rather than merging them merely because they overlap.
These changes do not guarantee recovery of hidden, transparent or partially visible items.

OWL detection scores are uncalibrated, not measured accuracy. No independent
material confidence or AI waste-classification score is fabricated. The API reports
those unavailable values as null; object-label routing hypotheses have their own
explicit basis. Plastic remains **subtype unconfirmed** until the user reports the
relevant resin mark. Selection and manual correction do not validate the AI prediction.

As explicitly requested in this task, coconut shells are restored as a seventh
assessment/library option and query. Existing Keras weights are unchanged; the
existing seven-output experimental checkpoint can retain its coconut label.
This does not individually verify its training labels or field performance.
The downloaded candidate dataset collection has not been trained or promoted by
this change; its earlier review/exclusion manifests have not been silently altered.

## Storage and safety

Reuse existing `ScanScene.quality` and `PredictionRecord.image_quality` JSON for
confirmed item IDs, user corrections, disposal intent and per-item handling snapshots.
The owner-scoped selection endpoint validates IDs/names and never changes model
labels, confidence or material answers. History reads saved assessment/handling
snapshots, not a newer scan or newly generated detections. Explicit assessment edits
refresh the corresponding item's handling snapshot only.

Potential electronics and hazardous object names block ordinary material projects,
even when a user reports a contradictory material. Corrected names can add precaution
but cannot erase an original electronics/hazard suggestion. Special-handling cards
do not show incompatible material reuse instructions or guide buttons.

New projects retain their source/review metadata in `UserProject.reference`, so it
survives deletion of a source scan. Existing projects are not reset or assigned an
invented reviewer. Their missing source snapshot is disclosed. Project information
shows material, summary/output description, tools/materials, cautions and original
source text/URLs when saved.

Four additive/state migrations: core, dataset and evaluation material choices restore
coconut; predictions adds the project reference snapshot. No approval data is seeded.
The inspected local database has three source-checked project references and zero
expert-reviewed projects. Those references are not silently promoted to approvals.

## Validation

- Backend: 139 tests passed, including selection/deselection, phone+towel workflow,
  overlapping named objects, manual corrections, low score, uncertain plastics,
  unsupported objects, special handling, ownership, invalid/empty images, detector
  failure, historical isolation and project-source snapshots.
- Frontend: 106 tests passed, including checkbox/box synchronization, confirmation,
  failure recovery, double-submit prevention, history and special-handling cards.
- Classifier mapping: 6 tests passed. TypeScript, targeted ESLint and diff checks passed.
- Workflow tests use isolated fixtures; synthetic project approvals exist only in
  test databases. They are not evidence of model accuracy or client endorsement.

For field validation, photograph independently held-out objects, annotate real
boxes/materials, measure detection separately from material identification, and
record missed/false objects. A user's selection is not a ground-truth label.

## Sources actually checked

- [OWL-ViT documentation](https://huggingface.co/docs/transformers/model_doc/owlvit)
- [US EPA: Electronics donation and recycling](https://www.epa.gov/recycle/electronics-donation-and-recycling)
- [US EPA: Common recyclables](https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables)

These are general references, not verified Bacoor service locations or schedules.
Current CESD/barangay acceptance and qualified project review remain necessary.

## Main implementation files

- Android: `App.tsx`; `src/api.ts`, `SceneResults.tsx`, `DisposalObjectRow.tsx`,
  `DetectionItemCard.tsx`, `AssessmentScreen.tsx`, `ProjectGuide.tsx`.
- Backend: `config/urls.py`; `predictions/disposal_workflow.py`, `scene_detector.py`,
  `scene_views.py`, `views.py`, `models.py`, `project_views.py`;
  `core/assessment.py`, `materials.py`, `idea_references.py`, `waste_taxonomy.py`;
  core/datasets/predictions migrations and affected regression tests.
- ML: `scripts/inference.py` and its mapping tests; no model artifact changes.

Unrelated dataset acquisition/audit work already in the working tree is preserved.

## Local deployment and checks

The release APK was built and updated in place on the connected physical phone
(`com.snapture_android`), without installing the separate prototype package.
The database was backed up before migrating. Counts remained 2 scenes, 27 prediction
records and 3 projects; all project completion arrays matched the backup.
The local API was restarted and USB port 8000 forwarding restored.

A real local-model smoke test on one stored dataset image completed. Its bottle
proposal scores were only 0.100–0.139; this is not a labelled detection evaluation
and must not be presented as improved accuracy. Independent field testing remains
essential. On-phone read-only inspection confirmed the new disposal-selection
screen opens from the original saved-photo history. No new scans, selections or
project steps were submitted during that visual check.
