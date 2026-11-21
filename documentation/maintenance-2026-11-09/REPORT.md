# SNAPTURE functionality and detection update — 9 November 2026

Follow-up: the user subsequently selected analysis **inside the square focus guide**. See [focus-guide and multiple-object warning correction](FOCUSED_CAMERA_FIX.md) for current behavior and newer test results; the initial full-photo default described below has been superseded.

Implemented incrementally in the existing Android application, Django backend and React web admin. **OWL-ViT remains active; YOLO is a disabled, replaceable adapter awaiting your trained model and labels.** Existing colors, navigation, Android native implementation and authentication were retained.

## 1. Inspection and inventory

Before editing, inspected the existing camera, navigation/components, API/authentication boundaries, object detector, separate TensorFlow material classifier, versioned guidance/review system, SQLite/history storage, project snapshots and prior camera research notes. A consistent database backup and source/hash snapshot were taken under `.tools/maintenance/backups` and `.tools/maintenance/before` outside the application source.

- [Repository inventory before changes](repository-before.csv): 481 inspected source/configuration/documentation/asset files, sizes and SHA-256 hashes.
- [Current inventory](repository-after.csv), [exact change list](changed-files.csv), [inventory scope and preservation summary](inventory-summary.json).
- [Interactive binding inventory](interactive-elements.csv): each current production JSX control/callback location, handler, disabled expression and related flow-test evidence. Counts refer to source bindings, not unique rendered buttons; reused components and data-generated rows differ at runtime.
  The current index contains 470 production bindings in 40 UI files. The initial 484-binding discovery included 50 test-only bindings; 434 were production bindings.
- Excluded generated dependencies, local environments/caches/builds, private `.env` files, databases, keystores, user media and downloaded OWL-ViT weights from the shareable source inventories. Inspected relevant runtime/model/database status separately. This report directory excludes itself from hash manifests to avoid self-referential hashes.

Framework/setup: React Native 0.87.1, React 19, TypeScript, Vision Camera and Android Gradle project; existing Django 5.2 service performs inference and persists scans; the React/Vite CESD interface uses the same backend. No new native Android dependency or lockfile change was necessary. Hash checks of 38 Android native/build/dependency files found no changes.

## 2. Issues and fixed interactions

| Finding | Change and verification |
| --- | --- |
| Camera denial/session failure could block gallery/manual entry | Kept gallery and manual options reachable; permission/settings errors provide feedback; tested denied-permission gallery/preview/replace flow |
| Fast shutter taps could start duplicate captures before state rendered | Added synchronous in-flight guard, busy spinner/accessible feedback and disabled switching during capture; repeated-tap test |
| Preview/back controls could leave while detection was running | Disabled review Back while analyzing; coalesced rapid Analyze taps into one request; retained error and retry/replace controls |
| Review implied an automatic center crop and default multi-object rejection | New mobile requests send the full image; full-photo contain preview in existing geometry; tests verify request and selection behavior |
| Empty-result scenes disappeared from grouped My Scans | Added scene-backed zero-object history entries and reopening without inference; ownership and read-only-history tests |
| Editable project data had no CESD web management page | Added authorized draft editor, read-only full details for reviewers, search/filter/refresh, review/publish, version creation and deactivate actions; browser CRUD/version tests and permission/CSRF tests |
| Hardcoded catalog could bypass reviewed recommendation requirements | Unified live suggestions/start/change eligibility with the reviewed database rule engine; preserved legacy content as drafts |
| Recommendation choices did not expose concise expandable instructions | Added details expand/collapse with tools, steps, difficulty and safety text using existing components/colors |
| Profile picture could be replaced/cancelled while uploading | Disabled conflicting photo controls during upload; existing save-flow tests remain passing |
| New admin action text was cramped in icon-sized buttons | Corrected only the project table action sizing and labels; screenshot review and browser tests |

Other audited existing flows include navigation/profile/settings, password visibility/authentication, notification attachments, collection calendar/filters, material/library search, item selection/correction/manual marking, expandable result cards, confirmations, project progress/change/restart, saved-photo deletion and clear-all confirmation, research contribution/withdrawal, admin reports/CSV, content CRUD and dataset review/export/Trash. Linked flow tests verify behavior at component/API/browser levels; they do not prove every physical tap or every error branch. Google sign-in remains explicitly unavailable; no fake authentication/provider integration was added. Email delivery still depends on the configured backend email service.

## 3. Camera requirements and improvements

Prior notes document an 80%-of-shorter-side square guide and legacy strict single-item crop. No separate adviser ratio/resolution specification was found. You clarified to use the same ratio, so the camera's existing cover preview/guide geometry remains unchanged. The guide is visual assistance for new captures; detection receives the confirmed full photo. Confirmation uses contain so the complete image is visible inside the existing preview geometry.

Capture/gallery, preview, replace/retake, explicit Analyze image, capture feedback, lifecycle pause/resume, flash state and manual fallback remain available. Older callers explicitly requesting `single_item=1` still retain the original strict crop/rejection behavior; legacy tests pass. No invented focus, resolution or adviser requirement was introduced.

## 4. Implemented workflow and results

Image acquisition → existing EXIF orientation/RGB and quality checks → selected object detector → independent crop material classification → reviewed rule matching after user details → results/history. New scenes record pipeline/provider/filter metadata. The oriented full image is preserved for display/history with the existing face-privacy processing; this is not a claim of retaining an unredacted byte-for-byte original.

Accepted model detections receive individual IDs, normalized boxes, labels and detection confidence. Material, optional reported material type and independent material confidence are separate. A user correction does not relabel the previous classifier score as evidence for the corrected material. Manual/whole-photo classification has no invented detector confidence or detected box. Uncertain/excluded guesses are not counted as accepted objects. Multiple accepted objects show a warning and remain individually reviewable; they are not silently merged or rejected by the new default flow. Quality flags do not certify image suitability.

## 5. Current model and replacement requirements

Active detector: local `google/owlvit-base-patch32`, experimental zero-shot, followed by the existing seven-class TensorFlow material model. Actual local OWL-ViT inference completed on a blank synthetic image and returned zero rows. This validates runtime execution only, not waste-detection accuracy. Existing candidate material labels remain subject to confirmation.

The new backend ONNX adapter validates declared input/output contracts, loads lazily, preprocesses on a separate tensor, parses supported exports, reverses letterbox coordinates, applies configured confidence/class-aware NMS when needed and returns standardized rows. No YOLO weights were supplied, downloaded or fabricated. ONNX tests use explicit synthetic tensors/test sessions, not a trained detector.

See [YOLO model integration](../YOLO_MODEL_INTEGRATION.md) for file location, actual export requirements, class order, supported tensor structures, preprocessing, optional runtime and real-inference/evaluation steps. The example 640×640 contract is not an inspected export. On-device inference remains a future compatibility decision.

## 6. Recommendations and management

`core/recommendation_engine.py` matches published reviewed database entries by confirmed supported material, reported type, condition/history requirements and quantity, within the existing safety/uncertainty gates. Matching is independent of detection and does not invent material properties or combine unrelated objects. No matches return no random project. Saved project steps/progress and scan recommendation snapshots remain available after content changes.

See [Upcycling management](../UPCYCLING_MANAGEMENT.md) for entering projects, exact requirements, separate edit/review permissions, publishing, deactivation and version behavior. There are **21 unreviewed local drafts and no newly published projects**. A qualified reviewer and actual content evidence are still needed. No CESD owner account was created because you chose resident testing first.

## 7. Database/backend and data preservation

Applied `core.0004_recommendation_metadata`: three optional Guidance metadata fields. Existing reviewed digests remain valid when these fields are empty; changes are included in future review digests. No resident/scan/project/authentication table was changed. Management endpoints reuse CESD session authentication, CSRF, access checks and activity audit. Starting/changing a task still checks current published eligibility.

Zero-object scenes are exposed through existing grouped-history responses with a negative scene-summary ID; the mobile API resolves it to the owned scene. Positive legacy prediction IDs retain their route. Reopening history uses saved results and does not rerun inference. The existing resident row was compared with the pre-change SQLite backup and preserved. See [data preservation evidence](data-preservation.json). User-created scans during your concurrent phone testing are retained; test fixtures run in isolated databases/media.

## 8. Validation

| Check | Result |
| --- | --- |
| Django full regression suite | 292 tests passed, isolated test database |
| Final result/history serialization regression checks | 46 tests passed after the final metadata change |
| Mobile Jest | 48 suites / 240 tests passed |
| Mobile TypeScript | Passed |
| Mobile ESLint | Passed without errors/warnings after cleanup |
| Admin TypeScript/Vite production build | Passed |
| Admin lint | Passed after cleanup |
| Admin Chrome/Playwright | Five scenarios passed in 41.6 seconds, covering management, reports, settings integration, datasets and projects; final project-details/action-layout scenario rerun also passed; isolated fixture DB/media |
| Android production JavaScript bundle | Passed; separate from native build |
| Android ARM64 debug native build | Actual `:app:assembleDebug` completed successfully in 54 seconds; 226 tasks, 18 executed and 208 up to date |
| Django model/migration checks | No issues; no missing migration changes |
| Existing OWL-ViT runtime | Actual synthetic blank-image inference completed, zero rows; no accuracy claim |
| Paired TECNO CK8n Android 14 | Updated JS reloaded through Metro; foreground app and backend/Metro HTTP 200 verified; camera navigation/control presence observed |

Zero/one/multiple detection contracts, letterbox reversal/NMS, unsupported classes, missing YOLO, type/condition/quantity/no-match rules, authorization/CSRF, zero-object saved history and history without inference have deterministic tests. They are not labeled-dataset accuracy evaluation. Logs are retained locally under `.tools/maintenance`; no secrets or real credentials are included in this report.

Machine-readable results: [validation-results.json](validation-results.json). The final full backend rerun passed all 292 tests after the serialization and YOLO status checks were finalized.

## 9. Remaining limits

- Trained YOLO weights, export metadata/class list and representative labeled evaluation data are required before YOLO inference or accuracy can be validated.
- The existing OWL-ViT and candidate material model can miss/mislabel items. Material properties, condition, contaminants and resin marks require appropriate confirmation.
- The 21 preserved project drafts require real review/publication. No published eligible rule means no startable project; this is deliberate rather than silently restoring unreviewed recommendations.
- Automated component/API/browser checks cover many interactions, but do not establish that every control and native permission/device/camera branch has been physically tested. Physical flash/switch/gallery acceptance remains a device checklist; your active phone scan test was left under your control.
- A phone charger-voltage system alert interrupted the device check; you reported unplugging/clearing it and camera navigation resumed. This was a phone system message, not an app error.
- The first Windows-managed Playwright run completed its five cases but hung during server teardown. The owned test processes were explicitly cleaned up; the final browser rerun uses separately managed isolated servers. Normal backend/Metro ports are separate.

## 10. Running this update

The existing [RUN_COMMANDS.txt](../../RUN_COMMANDS.txt) and T1–T4 launchers remain the entry point. Keep the workspace `.tools` directory: it contains the installed runtimes/SDK and is required by the launchers. Backend and Metro were restarted for the paired phone. Do not launch duplicate services on ports 8000/8081; `STOP_BACKGROUND.cmd` stops only the tracked setup services if you prefer your named terminals.
