# Scan screening and recommendation separation

Implemented in `C:\Users\Jude\Desktop\SNAPTURE_SYSTEM-NewFEATURES` on 2026-11-19.

## Workflow

Before this change, `assess()` matched reviewed projects and called the educational catalog while scans were created, serialized, and updated. Project arrays were also displayed in assessment, scene handling, and history. Refreshing an assessment could clear the user's saved selection.

Now, camera and manual scans return identification, the existing seven material categories, condition/safety questions, material preparation, sorting guidance, and a separate `screening` result. Confirmation and preparation updates stay on screening. Initial results, nested assessment/handling/action advice, and historical transport contain empty project arrays. Concrete reuse-reference sections in legacy management guidance are omitted from screening transport. Stored historical snapshots are not edited by GET.

Only an eligible result exposes **Proceed to Upcycling Recommendation**. That action opens `upcycling-recommendations` and sends the explicit request. The page has loading, retry, errors, and an eligible-but-no-matching-project outcome. It retains the existing chooser, project-fit confirmation, TutorialPhoto, PhotoCredits, photo ordering, startProject, ProjectFlowContext, and guide/progress flow. Educational suggestions are labeled separately from expert-reviewed projects.

## Screening rules

| Status | Meaning |
| --- | --- |
| `eligible` | Confirmed material or approved high-confidence material evidence, explicitly reviewed condition, known acceptable previous contents/contact, dry material with no known contamination, category-appropriate usable condition, and all relevant safety checks complete. |
| `needs_information` | Identity, condition, exposure, resin, untreated-wood history, object confirmation, or another required check is incomplete or uncertain. |
| `needs_preparation` | Applicable cleaning/drying is needed; readiness must be explicitly confirmed and reassessed. |
| `ineligible` | Reported hazardous exposure, special handling, contamination, mold, damage, or residual classification excludes prototype reuse. |
| `unsupported` | Outside the existing seven categories, unless a hazardous condition takes priority. |

PET/PETE and HDPE require their actual matching resin mark. Wood requires known untreated history. Approved high-confidence paper/cardboard retains its plain-surface/no-personal-details check. Tentative/mixed-photo objects retain object review, including the existing confirmed single-frame exception. A manual Keep/Discard intention does not authorize a recovery project. Automatic routing uses the independent screening result instead of the presence of ideas. Safe scrap conditions remain restricted to their existing material categories.

Array length, available sorting advice, recover routing, summary styling, and `has_reviewed_projects` never authorize Proceed. Skipping the form hides its action even if an older snapshot was eligible. Eligibility does not certify safety, local collection acceptance, expert approval, or project fit.

## API and storage

`POST /api/predictions/<prediction_id>/recommendations/`

The existing bearer authentication is required. The record is loaded by both owner and ID under a transaction. Foreign IDs return 404, missing authentication returns 401, and incomplete/ineligible screening returns 409 before any project generator runs. Client eligibility flags are ignored. Normal app requests send the `screening_revision` received with screening; changed server inputs return 409 and require another review.

Example request body:

```json
{"screening_revision": "the value returned with this prediction"}
```

The response includes prediction/scene IDs, current screening, an input revision, existing recommendation objects and provenance, and `available` or `no_matching_project`. No schema migration is required. A revision-bound recommendation cache is stored only after this explicit operation in the existing private `image_quality` JSON field. It is omitted from normal responses.

The singular `/predictions/<id>/recommendation/` operation still selects an existing choice. Project start/change/restart validation consumes an explicitly requested, still-current cache; it does not generate projects. Withdrawn or edited expert guidance is checked again without rematching. Changing material, conditions, quantity, identity evidence, intention, or relevant scene inputs invalidates cached choices. An existing owned project resumes its original snapshot/progress without a new generation request or reset. Older projects can still resume; requesting new alternatives requires reviewing their source scan and pressing Proceed.

`refresh()` updates screening assessment only. It preserves `selected_recommendation` and stored choices; empty screening arrays are not interpreted as permission to erase existing project state.

## Navigation and asynchronous state

App navigation stores the selected prediction, its scene ID, originating screen, saved-history ID, and a unique Proceed intent. History first opens read-only, then its explicit review updates only the selected prediction. Returning from recommendations restores that review or scene selection. Returning to screening does not fetch projects. New photos, item review, live assessment updates, manual resets, opening another saved scan, and logout clear the active target.

The Proceed action guards repeat taps. The recommendation page reuses an intent's pending/result promise across guide/back remounts, retains successful retries, and ignores responses after unmount or item/input changes. Once inputs change, the old intent remains invalid even if props later revert. Response prediction/scene IDs are checked before rendering.

## Preservation and backup

Source/test backup: `history/screening-recommendation-separation-2026-11-19/files/`; original SHA-256 values: `manifest.json` in the same folder. This contains 169 original source/test files.

Git inspection still shows unborn branch `local-preserved-before-feature-update`, with no resolvable HEAD. Git history was not repaired, fetched, reset, switched, committed, or pushed. No database migration/reset, model retraining, dependency installation, deployment, app-data clearing, phone install, or phone launch was performed. Local configuration, datasets, weights, Android settings, accounts, uploaded photos, tutorial assets, and the separate checkout were not changed.

Camera implementation, capture/EXIF/focus helpers, preparation implementation, catalog descriptions/steps/photos/credits, project-fit rules, photo ordering, and guide/progress components were preserved. The chooser adds provenance text while retaining its existing fit/photo behavior.

## Validation

Fresh baseline for this task:

- Backend: 230 tests, 8 reported failures (seven framed-category wording subcases plus the unsupported-title mismatch). `.run-logs/screening-baseline-backend.log`.
- Frontend: 184 passed, 35 failed, plus 45-second suite timeouts in AssessmentScreen and AutomaticCamera. `.run-logs/scan-import-screening-baseline-suites/summary.json`.

Latest results:

- TypeScript: `tsc --noEmit -p SNAPTURE_ANDROID` passed. Django `manage.py check` passed.
- Full backend: **241 passed / 242 run; one pre-existing failure**. `PredictionQuestionnaireTests.test_out_of_scope_model_label_is_serialized_as_unidentified` expects ?Unidentified or unsupported object?; the authoritative local presentation returns ?Unsupported?. This was already present in the fresh baseline. `.run-logs/screening-release-backend.log`.
- New focused backend separation tests: **12/12 passed**. `.run-logs/screening-focused-backend-complete.log`.
- New frontend separation tests: **12/12 passed**. Latest `.run-logs/scan-import-screening-handoff-sequential-suites/ScreeningSeparation.test.tsx.json`. The final handoff run also passed SavedScanReview (6) and RecentScanReviewButton (2), totaling **20/20** with no timeouts. `.run-logs/scan-import-screening-handoff-sequential-suites/summary.json`.
- Related sequential frontend validation: **102 passed, two failed**, no suite-cap timeouts across 16 suites. `.run-logs/scan-import-screening-complete-sequential-suites/summary.json`. One failure was an outdated single-item uncertain-toggle assertion; it was corrected and ScanUpcyclingIdeas then passed **4/4** in `.run-logs/scan-import-screening-entrypoints-sequential-suites/ScanUpcyclingIdeas.test.tsx.json` and the release run. AssessmentScreen (5), QuickAssessment (24), SceneResults (14), DetectionAccordion (5), SavedScanReview (6), RecentScanIdeas (1), RecentScanReviewButton (2), ItemActionAdvice (3), ScanImportFlow (3), SuccessAuthFlows (6), TutorialPhoto (5), RecommendationOrder (3), and projectFit (9) passed in the sequential run.
- CatalogProjectFlow's fabric/change-idea test passed. Its camera-to-completion case remains timing-sensitive: it passed alone with step logging (unchanged assertions, 4,835 ms, `.run-logs/screening-catalog-debug.log`), but combined silent runs exceeded the unchanged 5-second test timeout; the release rerun reached the 45-second process cap. **This suite is not claimed as fully passing.** Debug logging was removed from the test source.
- Broad frontend run: **198 passed, 29 failed**, plus AutomaticCamera and CatalogProjectFlow suite-cap timeouts. `.run-logs/scan-import-screening-final-suites/summary.json`. This run preceded the last focused fixture corrections. Existing UI/timing failures remain outside this change; no full frontend pass is claimed.
- Targeted ESLint for both new components passed after fixing its reported hook-dependency and cleanup issues. `.run-logs/screening-components-final-lint.log`. No dependencies or lint configuration were changed.

The backend source/catalog and native camera preservation check compared the backup hashes/implementation block successfully. No physical-phone validation was performed.

Meaningful added checks cover generator suppression for scene and legacy single-photo creation, condition/preparation updates, confirmation and history; nested content redaction; all seven screening paths; owner/authentication enforcement; unsafe/unknown and changed-revision rejection; cache invalidation; eligible no-match; saved selection retention; and project snapshot/progress/media preservation. Frontend checks cover screening-only entry points, skipped and ineligible gating, the exact selected ID, duplicate taps, retry/guide return, stale responses, history review, fit confirmation, ordering, photos, and credits.

Checks use the existing `.venv` and bundled Node with Jest `--runInBand --watchman=false --no-cache --forceExit`, unchanged 5-second test timeouts and a 45-second per-suite process limit. Sequential focused runs avoid resource contention observed in the broad three-process run. No assertion timeouts were increased. Broad failures are reported rather than being called a complete pass.

## Modified and added files

- `SNAPTURE_ANDROID/App.tsx`
- `SNAPTURE_ANDROID/src/api.ts`
- `SNAPTURE_ANDROID/src/AssessmentAdvice.tsx`
- `SNAPTURE_ANDROID/src/AssessmentScreen.tsx`
- `SNAPTURE_ANDROID/src/DetectionItemCard.tsx`
- `SNAPTURE_ANDROID/src/ItemActionAdvice.tsx`
- `SNAPTURE_ANDROID/src/SavedScanReview.tsx`
- `SNAPTURE_ANDROID/src/SceneResults.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingIdeaChoices.tsx`
- `SNAPTURE_ANDROID/__tests__/AssessmentScreen.test.tsx`
- `SNAPTURE_ANDROID/__tests__/CatalogProjectFlow.test.tsx`
- `SNAPTURE_ANDROID/__tests__/DetectionAccordion.test.tsx`
- `SNAPTURE_ANDROID/__tests__/ItemActionAdvice.test.tsx`
- `SNAPTURE_ANDROID/__tests__/QuickAssessment.test.tsx`
- `SNAPTURE_ANDROID/__tests__/RecentScanIdeas.test.tsx`
- `SNAPTURE_ANDROID/__tests__/SavedScanReview.test.tsx`
- `SNAPTURE_ANDROID/__tests__/ScanUpcyclingIdeas.test.tsx`
- `SNAPTURE_ANDROID/__tests__/SuccessAuthFlows.test.tsx`
- `SNAPTURE_BACKEND/core/assessment.py`
- `SNAPTURE_BACKEND/core/content.py`
- `SNAPTURE_BACKEND/core/management_guidance.py`
- `SNAPTURE_BACKEND/core/test_assessment.py`
- `SNAPTURE_BACKEND/core/test_idea_references.py`
- `SNAPTURE_BACKEND/core/test_management_guidance.py`
- `SNAPTURE_BACKEND/core/test_scan_ideas.py`
- `SNAPTURE_BACKEND/core/test_support.py`
- `SNAPTURE_BACKEND/core/test_tutorial_media.py`
- `SNAPTURE_BACKEND/core/waste_taxonomy.py`
- `SNAPTURE_BACKEND/predictions/disposal_workflow.py`
- `SNAPTURE_BACKEND/predictions/item_actions.py`
- `SNAPTURE_BACKEND/predictions/project_views.py`
- `SNAPTURE_BACKEND/predictions/scene_views.py`
- `SNAPTURE_BACKEND/predictions/tests.py`
- `SNAPTURE_BACKEND/predictions/test_automatic_routing.py`
- `SNAPTURE_BACKEND/predictions/test_catalog_projects.py`
- `SNAPTURE_BACKEND/predictions/test_detection_filter.py`
- `SNAPTURE_BACKEND/predictions/test_framed_recommendations.py`
- `SNAPTURE_BACKEND/predictions/test_identifier.py`
- `SNAPTURE_BACKEND/predictions/test_item_actions.py`
- `SNAPTURE_BACKEND/predictions/test_project_change_idea.py`
- `SNAPTURE_BACKEND/predictions/test_project_restart.py`
- `SNAPTURE_BACKEND/predictions/test_quick_assessment.py`
- `SNAPTURE_BACKEND/predictions/test_scan_import_compatibility.py`
- `SNAPTURE_BACKEND/predictions/test_scenes.py`
- `SNAPTURE_BACKEND/predictions/urls.py`
- `SNAPTURE_BACKEND/predictions/views.py`
- `SNAPTURE_ANDROID/src/ScreeningOutcome.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingRecommendations.tsx`
- `SNAPTURE_ANDROID/__tests__/ScreeningSeparation.test.tsx`
- `SNAPTURE_BACKEND/core/screening.py`
- `SNAPTURE_BACKEND/core/recommendation_requests.py`
- `SNAPTURE_BACKEND/predictions/recommendation_views.py`
- `SNAPTURE_BACKEND/predictions/test_screening_separation.py`
- `documentation/SCAN_SCREENING_RECOMMENDATION_SEPARATION.md`

Validation logs and the runner are under `.run-logs/`; no generated backup/log files are application inputs.

## Reproducing checks on this computer

From the project root in PowerShell:

```powershell
& .\.tools\node-setup-v22.23.5\node-v22.23.5-win-x64\node.exe SNAPTURE_ANDROID/node_modules/typescript/bin/tsc --noEmit -p SNAPTURE_ANDROID
& .\SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_BACKEND/manage.py check
& .\SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_BACKEND/manage.py test core predictions --noinput --verbosity 0
& .\SNAPTURE_ML\.venv\Scripts\python.exe .run-logs/scan_mobile_tests.py screening-review-sequential ScreeningSeparation.test.tsx QuickAssessment.test.tsx SavedScanReview.test.tsx SceneResults.test.tsx
```

To use the changed workflow, restart the existing backend and load the updated JavaScript through the normal development workflow. No migration, reclassification of old photos, model download, or phone reinstall is required by this change. The remaining broad-suite failures and CatalogProjectFlow timing issue should be addressed separately before treating the entire project test suite as green.
