# SNAPTURE ERD / DFD Source Traceability

**Inspection date:** 2026-11-17  
**Scope:** checked-out working tree at `SNAPTURE--main`; Django backend, React Native app, React admin SPA, local model configuration, and checked-in SQLite schema.  
**Purpose:** map each documented entity and process to implementation evidence. This is an architecture description, not a claim that every feature is production-validated.

## Evidence method

- Model fields and relationships were read from Django model declarations and checked against migrations and the SQLite table catalogue without reading user or scan rows.
- Runtime configuration and URL routing were traced in source. The SQLite database is the checked-in local database; settings also allow a MySQL backend through environment configuration. The deployed database was not inspected.
- Mobile scan entry points and API calls were traced from the React Native app. The CESD admin client uses same-origin API paths in the Django backend.
- Model pointers and JSON configuration were read as checked-in files. No model weights were retrained or changed.
- File fields store relative paths; image and attachment bytes reside under the configured local media root. Model weights and configs reside in the repository's local model directories.

## Process-to-source traceability

| Diagram process | Status | Primary source files | Evidence represented |
|---|---|---|---|
| P1 / 1.0 Identity and access | Implemented | `SNAPTURE_BACKEND/accounts/models.py`; `accounts/views.py`; `accounts/urls.py`; `config/settings.py` | Django `auth_user`, one-to-one Profile, hashed API tokens, authentication and role checks. CESD staff access is a separate one-to-one extension. |
| P2 / 2.0 Image acquisition and preparation | Implemented | `SNAPTURE_ANDROID/App.tsx`; `SNAPTURE_ANDROID/src/api.ts`; `SNAPTURE_BACKEND/predictions/scene_views.py`; `predictions/image_quality.py`; `predictions/photo_privacy.py` | Camera/gallery input; request/image validation; orientation, RGB, crop and image-quality metadata; local privacy redaction attempt; ScanScene lifecycle. Image heuristics do not infer item condition. |
| P3 / 3.0 Object detection | Partially implemented | `SNAPTURE_BACKEND/predictions/scene_detector.py`; `predictions/detection.py`; `predictions/yolo_adapter.py`; `SNAPTURE_ML/models/detection_config.json` | Checked-in active scene provider is local OWL-ViT. Proposal filtering and crop generation exist. Optional YOLO ONNX adapter is disabled and has no configured active model/class list. |
| P4 / 4.0 Material classification and unknown rejection | Implemented, model unverified | `SNAPTURE_BACKEND/core/ml_service.py`; `predictions/material_classifier.py`; `predictions/views.py`; `predictions/scene_views.py`; `SNAPTURE_ML/scripts/inference.py`; `SNAPTURE_ML/models/active_model.json`; selected candidate `model_config.json` and `labels.json` | Per-crop model classification; confidence threshold and `unknown_unsupported` fallback; serialization restricts unsupported choices. Active seven-label candidate is explicitly marked unverified. |
| P5 / 5.0 Assessment and handling route | Implemented | `SNAPTURE_BACKEND/core/assessment.py`; `core/management_guidance.py`; `core/waste_taxonomy.py`; `predictions/disposal_workflow.py`; `predictions/item_actions.py` | Assessment consumes class/decision, confidence, answers, user condition, quantity and prior contents. Rules determine route, eligibility, and no-match explanation. Condition is user-reported, not camera-detected. |
| P6 / 6.0 Upcycling guidance matching | Implemented | `SNAPTURE_BACKEND/core/recommendation_engine.py`; `core/physical_suitability.py`; `core/models.py`; `predictions/views.py` | Published, digest-valid Guidance entries are matched by material/type, explicit requirements, condition, quantity and answers/preferences. User-supplied dimensions are checked in millimeters. No external recommendation API. |
| P7 / 7.0 Started project and progress | Implemented | `SNAPTURE_BACKEND/predictions/models.py`; `predictions/project_views.py`; `SNAPTURE_ANDROID/src/ProjectGuide.tsx`; `src/api.ts` | Starting a recommendation creates a UserProject snapshot with steps, materials, safety/reference information and completed-step state. |
| P8 / 8.0 Scan results and history | Implemented | `SNAPTURE_BACKEND/predictions/models.py`; `predictions/scene_views.py`; `predictions/views.py`; `SNAPTURE_ANDROID/src/SceneResults.tsx`; `src/api.ts` | User-scoped scan and prediction serialization/history. SceneItem links a detected box to an optional PredictionRecord. Media access is protected by backend checks. |
| P9 / 9.0 Local content and collection information | Implemented | `SNAPTURE_BACKEND/core/models.py`; `cesd/models.py`; `core/management_guidance.py`; `cesd/views.py`; `cesd/integration.py` | Guidance, CollectionNotice, and CESD schedule/policy/material/announcement data. CESD is same backend/database. Barangay values are strings. Source URLs are references, not API integrations. |
| P10 / 10.0 Dataset image review/export | Implemented | `SNAPTURE_BACKEND/datasets/models.py`; `datasets/management_views.py`; `SNAPTURE_ML/data/` | Consent, rights, quality, labels, review, groups, audit trail and export manifest. An identification review does not itself add an image to the training dataset. |
| P11 / 11.0 Evaluation record management | Implemented as record workflow | `SNAPTURE_BACKEND/evaluations/models.py`; `evaluations/` | EvaluationRun, held-out cases and recommendation judgments provide a protocol/review ledger. Presence of these tables does not imply an evaluation has been performed or metrics exist. |
| P12 / 12.0 CESD content management/reporting | Implemented | `SNAPTURE_BACKEND/cesd/models.py`; `cesd/views.py`; `cesd/urls.py`; `SNAPTURE_ADMIN/src/lib/api.ts`; `SNAPTURE_ADMIN/src/pages/` | Same-origin admin SPA API, staff access, published content, schedules and activity. No external CESD service boundary is modeled. |

## Relational entity-to-source traceability

`id` fields below are Django-generated primary keys unless indicated. Foreign keys to the identity table target Django's configured `AUTH_USER_MODEL` (`auth_user` in this checkout).

| ERD entity | Django model / source | Relationship or implementation note |
|---|---|---|
| `auth_user` | Django auth model; configured from `config/settings.py` | Identity root used by app tables. Framework permission/group/session tables are intentionally omitted from this application ERD. |
| `accounts_profile` | `accounts.Profile`, `accounts/models.py` | One-to-one user; role, display name, barangay text and optional profile image. |
| `accounts_apitoken` | `accounts.ApiToken`, `accounts/models.py` | Many tokens may belong to a user; stored value is a hash. |
| `cesd_staffaccess` | `cesd.StaffAccess`, `cesd/models.py` | One-to-one user; conditional constraint allows one account owner. |
| `cesd_policy` | `cesd.Policy`, `cesd/models.py` | Inherits created/updated/editor and publication fields. Optional attachment path. |
| `cesd_material` | `cesd.Material`, `cesd/models.py` | Inherits tracking/publication fields; required attachment path. |
| `cesd_schedule` | `cesd.Schedule`, `cesd/models.py` | Inherits tracking/editor fields; barangay remains text. |
| `cesd_announcement` | `cesd.Announcement`, `cesd/models.py` | Inherits tracking/publication fields. |
| `cesd_legacyimport` | `cesd.LegacyImport`, `cesd/models.py` | External legacy identifiers and local target ID; unique source/model/source_id tuple, with no target FK. |
| `cesd_activity` | `cesd.Activity`, `cesd/models.py` | Actor FK; record type/id/label form a polymorphic reference, not a database FK. |
| `core_guidance` | `core.Guidance`, `core/models.py` | Versioned segregation/project/information catalogue. `requirements` is JSON, not a normalized requirements relation. |
| `core_collectionnotice` | `core.CollectionNotice`, `core/models.py` | FK to Guidance; barangay stored as text. Separate from CESD Schedule. |
| `datasets_customlabelgroup` | `datasets.CustomLabelGroup`, `datasets/models.py` | Self-referential merge target. |
| `datasets_customlabelalias` | `datasets.CustomLabelAlias`, `datasets/models.py` | Alias belongs to a label group. |
| `datasets_datasetimage` | `datasets.DatasetImage`, `datasets/models.py` | Optional uploader/reviewer/deleter, custom group, and one-to-one source prediction. Conditional request idempotency constraint applies only to nonempty request keys. |
| `datasets_datasetaudit` | `datasets.DatasetAudit`, `datasets/models.py` | Optional image/group/actor links; before/after JSON. |
| `datasets_datasetexport` | `datasets.DatasetExport`, `datasets/models.py` | UUID version, manifest JSON and optional creator. |
| `evaluations_evaluationrun` | `evaluations.EvaluationRun`, `evaluations/models.py` | Protocol and split metadata, hold-out and frozen report fields. |
| `evaluations_evaluationcase` | `evaluations.EvaluationCase`, `evaluations/models.py` | Run FK and optional source prediction; unique reference within run; reviewer and captured expected answer fields. |
| `evaluations_recommendationjudgment` | `evaluations.RecommendationJudgment`, `evaluations/models.py` | Case/reviewer FKs; unique case/recommendation pair. |
| `predictions_predictionrecord` | `predictions.PredictionRecord`, `predictions/models.py` | User FK; model result and recommendation state/output snapshots in JSON. Image is nullable. |
| `predictions_scanscene` | `predictions.ScanScene`, `predictions/models.py` | User FK; unique `(user, request_id)`; image file path and scene metadata. |
| `predictions_sceneitem` | `predictions.SceneItem`, `predictions/models.py` | Scene FK; optional one-to-one link to prediction record. There is no separate Detection table. |
| `predictions_userproject` | `predictions.UserProject`, `predictions/models.py` | User and optional source prediction; stores a selected project snapshot and progress. |
| `predictions_identificationreview` | `predictions.IdentificationReview`, `predictions/models.py` | One-to-one prediction; optional reviewer and consent timestamp; review does not automatically export image data. |

## Configuration and model traceability

| Concern | Source | Checked-in behavior |
|---|---|---|
| Main client scan route | `SNAPTURE_ANDROID/App.tsx`, `SNAPTURE_ANDROID/src/api.ts` | Camera/gallery flow calls `createScene` and `/api/scenes/`. |
| Alternate classifier route | `SNAPTURE_BACKEND/predictions/views.py`, `SNAPTURE_ANDROID/src/api.ts` | `/api/predictions/create/` remains available as a legacy/simple single-image route; it is not the primary App.tsx path. |
| Scene detector | `SNAPTURE_BACKEND/predictions/scene_detector.py`; `SNAPTURE_ML/models/detection_config.json` | Local OWL-ViT active provider. Proposal filtering score is not a validated accuracy statistic. |
| YOLO adapter | `SNAPTURE_BACKEND/predictions/yolo_adapter.py`; detection config | Optional ONNX integration is disabled; no active compatible weights/classes configured. |
| Material classifier | `SNAPTURE_ML/scripts/inference.py`; `SNAPTURE_ML/models/active_model.json`; selected model `labels.json` and `model_config.json` | Active pointer selects the seven-category candidate; model config records `training_data_verified=false`, no verified classes, and 0.80 threshold. It is experimental. |
| Unknown rejection | `SNAPTURE_BACKEND/core/ml_service.py`; `predictions/scene_views.py`; `predictions/views.py` | Unsupported/out-of-scope or low-confidence outcomes normalize to `unknown_unsupported`; exact serialization behavior remains in backend. |
| Recommendation conditions | `core/assessment.py`; `core/recommendation_engine.py`; `core/physical_suitability.py` | User answers and requirements govern rules; image-quality signals do not detect cleanliness or contamination. Dimensions are user-provided. |
| Runtime storage | `SNAPTURE_BACKEND/config/settings.py` | Local SQLite checked-in DB; configurable MySQL option; media path local by default. Deployment configuration was not verified. |

