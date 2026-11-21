# Camera assessment and guided project workflow

Implemented 20 November 2026. Existing scans and completions retain their original evidence; new camera sessions use `camera-assessment-v2`.

## Screen and service destinations

| Stage | Android component | Backend/data |
| --- | --- | --- |
| Size, quantity, mode, guided photos | ScanSession | scenes POST, image_quality.scan_details |
| Combined material evidence | ScanResult and SuitabilityProjects | upcycling.workflow, per-view AdditionalView evidence |
| Verdict and clarification | AssessmentControls | assessment GET/PATCH/POST and shared workflow verdict |
| Preparation and reassessment | AssessmentControls | purpose=reassessment, full_item_confirmed, retained hazard history |
| Safety notice, inspection, usable quantity | AssessmentControls | separate workflow confirmations and backend project eligibility |
| Project matching/start | SuitabilityProjects | published ProjectRequirement and shared gates for both start APIs |
| Live selected-frame checks | PhotoProjectGuide and LiveStepScanner | steps POST, StepPhoto and verification service |
| Final whole-product submission | FinalProductPanel | final POST, FinalProductAssessment |
| Completion | existing My Projects | completions POST, immutable final assessment copy |

## Current runtime limits

The existing experimental TensorFlow/MobileNetV2 model supplies seven material classes at a 0.70 threshold. OWL-ViT inference is disabled. Classification does not identify chemical composition, hidden contamination, physical strength, step completion, or finished-product quality. Adding dataset files does not retrain the model.

No validated visual assessor is configured by default. New assessments stay pending when required condition evidence is unavailable. Step/final checks cannot pass or unlock progression without complete validated evidence. A metadata approval reference is a deployment gate, not proof of model quality. Representative batch photos do not verify every piece.

The safety modal uses clearly labeled illustrative condition examples, not diagnostic reference photographs. Reviewed, permission-cleared condition photographs can replace these examples later.

## Material combination and eligibility

All submitted material views must agree on one scope class and each meet its threshold. The conservative score is the minimum, not an invented aggregate probability. Extra views may reduce acceptance; this rule needs field evaluation. Historical snapshots are never rewritten by live reassessment.

Known hazardous reports remain blocked after later clean answers. Six explicit condition fields require complete validated observations: damage, deformation, wet_appearance, visible_contamination, usable_portions, structural_appearance. Ordinary removable dirt requests preparation. Water-exposed paper/cardboard requires clarification, preparation and updated full-item evidence. Close-ups cannot establish substance composition.

Inspection acknowledgment and inspection confirmation are separate. Changes to evidence/relevant facts invalidate inspection. Usable quantity cannot exceed initial quantity. Projects need explicit sourced requirements; missing requirements cannot be filled with guessed limits.

## Assessor integration contract

Configure an actual evaluated adapter with SNAPTURE_VISUAL_ASSESSOR. SNAPTURE_VISUAL_ASSESSOR_VALIDATION is JSON with exact model identity, approved purposes (condition, project_step, project_final), and a nonempty evidence_source identifying the evaluation/approval record. Do not enable a fixture adapter in production.

Condition responses include model and observations with field, value and certainty. Complete clear required fields are needed; uncertain/conflicting evidence stays pending.

Step/final callable inputs: image, purpose, criteria (stable IDs and instructions), project_title, project_steps, and evidence context. Output: schema_version=1, exact purpose/model, quality={usable:boolean,guidance:string}, nonempty feedback, and exactly one result per supplied criterion ID with status and nonempty evidence. Step statuses: met/unmet/not_assessable. Final also permits missing. Verdicts are derived server-side. Arbitrary step_status=matches cannot unlock new projects.

Step photos are selected while the live scanner is running; requests do not overlap. Poor visibility gives guidance, not assumed failure. No continuous video is uploaded. Exact reused evidence is rejected, but checks are not cheating-proof. Missing capability or invalid responses never pass.

Final assessment requires a new whole-product image after every step is verified, explicit sourced final_criteria and approved project_final capability. Only the latest validated Meets Visible Project Requirements result permits completion. No numerical accuracy score or strength/safety certification is supplied. Corrections remain In Progress.

## Database and verification

Migration upcycling.0003 adds the final evidence table and a default-empty completion JSON field. Local SQLite backup is outputs/runtime/before-camera-flow-migration.sqlite3. No data-deletion migration is used.

Related backend tests, UI tests, TypeScript, migration checks and Android Metro bundle are run during implementation. Runtime logs under outputs/runtime contain the exact results. Full UI suite retains unrelated Home/Learn/navigation failures; do not describe the whole suite as passing. Physical-phone smoke check verified Item Details before camera, size entry, photo-stage navigation, and Analyze locked until evidence/confirmation. No test scan was submitted to the user history. Full condition/step/final live-model assessment cannot be tested until the validated assessor is supplied.

Final automated results: backend core/predictions/upcycling 307 tests passed; targeted new Android flow 22 tests passed; full Android 268 passed and 5 unrelated Home/Learn/navigation failures. TypeScript and Metro bundle succeeded.

## Cloud vision connector added

The real provider adapter is `upcycling.cloud_vision.assess`. It calls the OpenAI Responses API with image content and strict structured outputs, current evidence and bounded saved evidence for comparison. It uses no mock success path. Cloud-photo opt-in, backend API key and explicit model ID are required. No paid request has been made during development because no credential is configured.

Run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\SETUP_VISION.ps1` from the repository root. It prompts for cloud-photo acknowledgment and a hidden API key; writes backend `.env` only; never marks the model validated. Default candidate model is configurable with `-Model`. Restart START_BACKEND.ps1 after setup.

Readiness: `.\SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_BACKEND/manage.py check_vision --local-config`. Add `--image <local photo>` only when intentionally sending that photo for a billable inference probe. A successful probe is connectivity evidence, not evaluation or safety certification. The probe does not modify scans or approval settings.

Project readiness: `audit_project_requirements` reports missing inputs. `prepare_project_requirements` prepares unpublished catalog-based checkpoints/final-criteria drafts without overwriting existing reviewed records. Research content explicitly marked unreviewed is not silently published. Published project requirements and a recorded real-image evaluation are still needed before automatic approval can become operational.

Provider documentation: https://developers.openai.com/api/docs/guides/images-vision and https://developers.openai.com/api/docs/guides/structured-outputs . Material confidence/training remains separate from this vision integration.
