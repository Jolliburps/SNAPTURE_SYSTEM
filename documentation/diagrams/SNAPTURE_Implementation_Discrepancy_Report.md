# SNAPTURE Implementation and Diagram Discrepancy Report

**Inspection date:** 2026-11-17  
**Scope:** checked-in working-tree implementation inspected for the ERD/DFD deliverables.  
**Interpretation:** “Implemented” means source/configuration for the behavior exists. It does not assert the feature has passed independent acceptance or user testing.

## Summary

SNAPTURE has a working end-to-end architecture for scan submission, scene records, candidate object detection, material classification, unknown-item rejection, published guidance matching, started-project tracking, history, CESD content management, dataset review, and evaluation recordkeeping. The local active object detector is OWL-ViT. A YOLO ONNX adapter is present but disabled. The active seven-category material classifier is explicitly marked unverified, so seven-category recognition must not be represented as validated or production-ready.

The data model has no separate Detection, MaterialClassification, Recommendation, ProjectRequirements, Barangay, Notification, or push-delivery table. Relevant detection output is represented by `SceneItem`; per-item class and recommendation state is on `PredictionRecord`; project rules are JSON within `Guidance`; locality fields are free text; schedule/information records use existing CESD/core entities.

## Findings and status

| Area | Status | Observed behavior | Implication for diagrams or claims |
|---|---|---|---|
| Main photo flow | Implemented | React Native camera/gallery submits to `/api/scenes/`; backend records a ScanScene, proposes regions, classifies crops, and returns a scene response. | Show Scene API as primary flow. Do not describe `/api/predictions/create/` as the active main flow. |
| Image preparation | Implemented | Backend validates size/type, corrects orientation, converts color mode, handles crops and calculates image-quality indicators. A local privacy-redaction attempt governs retention. | Quality measures are photo usability estimates, not material or condition classification. |
| Mixed-scene object detection | Partially implemented | Local OWL-ViT configuration is active; proposals are filtered before crop classification. Fallback classifier can provide a whole-photo material result when detection is unavailable. | Distinguish a detected box from a material classifier output; fallback does not localize an object. |
| YOLO object detector | Optional / inactive | `YoloOnnxDetector` adapter exists. Checked-in config has it disabled, with no configured compatible model path or class list. | Do not claim that a trained YOLO model is the active detector. |
| Seven waste categories | Experimental / unverified | `active_model.json` points to a seven-class candidate. Its model configuration says `training_data_verified: false` and has no verified classes. | Do not claim complete category coverage, accuracy, or reliable production recognition. No new training/evaluation was performed for this documentation task. |
| Unknown rejection | Implemented in code | Unsupported labels and low-confidence outcomes use `unknown_unsupported` normalization/serialization. | Keep rejection path in DFD. This inspection did not execute actual unsupported photos, so it is a code-path finding, not an end-to-end test result. |
| Material subtype | Partially implemented | Generic plastic/material outputs can require user confirmation; PETE/HDPE subtype cannot be established from a generic plastic appearance alone. | Show subtype confirmation as user input. Do not imply material code/resin subtype is inferred with certainty from the photograph. |
| Condition handling | Rule-based / user supplied | Assessment and recommendation rules consume selected condition, contents, and other answers. Image-quality processing does not detect cleanliness, contamination, or damage. | In diagrams, show condition as user input; do not depict automatic visual condition classification. |
| Upcycling recommendations | Implemented rule matching | Published, integrity-checked `Guidance` project entries are filtered by material/type, requirements JSON, condition, quantity, measurements, household goal, and preferences. | A recommendation is conditional on classification and answers; there is no external recommendation service or separate requirements table. |
| Physical dimensions | User input only | Physical suitability uses user-entered millimeter measurements. Detector boxes are image-space coordinates. | Do not label box dimensions as real-world size measurement. |
| Started projects | Implemented | Selecting/starting a recommendation stores a snapshot in `UserProject`; step progress is JSON. | Project library/current user projects are not a global `Project` catalog table. |
| Scan results/history | Implemented | `ScanScene`, `SceneItem`, `PredictionRecord` and media references support per-user results/history. | There is no separate Detection or Recommendation table. |
| CESD content | Implemented in shared backend | CESD admin SPA calls same-origin API routes. CESD, core and prediction records use the same Django deployment/database. | CESD is an internal module, not an external system/API boundary. |
| Collection data | Implemented in two structures | `cesd.Schedule` represents waste type and collection windows; `core.CollectionNotice` represents published notices tied to reviewed guidance. | Keep both entities separate; do not merge or invent a single schedule table. Barangay remains plain text. |
| Sources and links | Reference data | Published guidance can store sources/URLs. No runtime fetching of local government or EPA data was found in these recommendation paths. | Source attribution is content, not a live external API integration. |
| Dataset review | Implemented workflow | `DatasetImage` has labeling, consent, rights, quality, inclusion, reviewer and provenance state; `DatasetAudit` and `DatasetExport` record review/export. Identification review is separate. | A scan review is not automatically a training sample. Dataset export is gated; unreviewed images must not be described as approved. |
| Evaluation records | Implemented data model | Evaluation runs/cases/judgments can store protocols, expected labels/routes and reviewer assessment. | The existence of records/tables does not establish model metrics. No evaluation run was executed here. |
| Notifications | No persisted notification/push model found | Schedules and content can be fetched; the checked-in models do not provide a notification or push delivery table/service. | Do not depict persistent notification delivery. |
| Database backend | Local artifact verified; deployment unknown | Checked-in SQLite schema corresponds to app migrations. Settings allow MySQL via environment variables. | ERD is logical Django schema, not a deployment database certification. Deployment engine and hosted storage remain unverified. |

## Modeling decisions

1. The ERD includes all 24 application-owned model tables and `auth_user` as the identity root. It omits Django group/permission/session/content-type/admin bookkeeping tables to keep the diagram focused on SNAPTURE domain behavior.
2. Shared CESD model fields (`created_at`, `updated_at`, `updated_by_id`, and `published_at`) are shown on each concrete table because Django uses concrete tables here; the abstract base classes do not create separate tables.
3. `ImageField` and `FileField` values are shown as path strings. The actual bytes are filesystem media; they are not database blobs.
4. JSON fields are retained as JSON in the logical diagram. Rules, scan snapshots, detector geometry, assessment outcomes and user project progress are not normalized into invented entities.
5. A conditional unique constraint on nonempty dataset upload request keys and the single CESD owner constraint are stated in notes instead of overstating ordinary unique indexes.
6. `Activity.record_id`, `LegacyImport.target_id`, and JSON-encoded user measurements have no database FK to a normalized record and are not drawn as if they do.
7. DFD model and media stores are filesystem artifacts, not relational tables. External data-source websites are not shown as live systems.

## Open verification items

- Complete human verification of the seven-category dataset and model checkpoint before treating recognition as reliable.
- Provide actual compatible YOLO ONNX weights and class mapping, then test it before describing YOLO as active.
- Execute camera-to-backend-to-frontend acceptance checks on real supported and unsupported photographs; this report contains no such test results.
- Confirm the production database engine, media storage, runtime configuration, model weights and deployment revision with the operator; only the local checkout was inspected.
- Verify privacy-redaction retention behavior and protected-media authorization in the deployed environment.
- Confirm published local collection schedules and advice with the relevant local authority; this inspection traced data fields and code, not current public-service accuracy.
