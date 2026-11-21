# Selective scan-module import — 2026-11-19

## Source and scope

The local `SNAPTURE_SYSTEM-NewFEATURES` folder is the authoritative base. It has no
Git metadata; none was initialized. No branch was merged, no local checkout was
replaced, and nothing was committed, pushed, deployed, migrated or retrained.
No applicable `AGENTS.md` was found in the project or its ancestor directories.

Source: <https://github.com/Jolliburps/SNAPTURE_SYSTEM/tree/feature/camera-condition-flow-2026-11-19>.
Inspected exact parent `167acfbafb36780a06e0757e0c9f350402e198f1` to commit
`85cbfbd29b742597cdf0dec76427966fa7d38135` (“Improve camera focus and
condition-based upcycling flow”). The source branch HEAD is that commit; there
were no later commits to import. The parent was verified in the commit history.
Older history was inspected for provenance only; no comparison against `main`
was used as an import patch.

The source was fetched into the separate temporary repository
`C:\Users\Jude\AppData\Local\Temp\snapture-scan-import-20261119-source`.
Selected hunks were checked against local files before application. Overlapping
files were reconciled manually. Backup copies, the original source patch and
before/after hash manifests are retained locally.

## Imported behavior and required support

- **Before scanning:** retain the local camera guide, capture readiness and
  gallery crop validation. The source commit does not change camera setup or
  capture controls. Its quality feedback adds conditional low-resolution and
  possible overexposure warnings; plain white paper alone is not flagged as
  overexposed. The obsolete mixed-mode retry wording is corrected.
- **Scanning:** transpose EXIF orientation before RGB conversion at detector and
  material-classifier entry points. Retain existing resizing, model processing,
  material labels, thresholds, weights and detector rules.
- **Results:** save accepted measured `localized_box` coordinates separately
  from padded `classification_crop` coordinates in the existing JSON field.
  The serializer returns only valid accepted focus coordinates. Historical
  records without measured coordinates receive no fabricated focus box.
  Android validates bounds and draws the focus outline in theme green on the
  existing contained photo. Single framed items proceed to material review
  without a redundant selection checkbox; multi-item selection remains.
- **Condition assessment:** show category-specific condition labels while
  retaining existing backend codes. Add explicit clean torn-paper and usable
  cardboard/fabric scrap conditions to the assessment schema. Unknown, wet,
  contaminated and generically damaged items do not gain early project choices.
- **Preparation:** use material-specific steps and one readiness confirmation.
  Paper/cardboard are dried rather than washed. Plastic rinsing requires known
  food/drink contents. Unknown material or unsafe contamination blocks the
  completion shortcut. A successful request updates the same prediction ID;
  failures retain readiness controls for retry. Preparation does not erase
  recorded chemical contents or change material identity.
- **Recommendation handoff:** filter existing catalog entries by the imported
  scrap conditions. New idea selections require the source project's fit check
  for usable size/shape, amount and tools. Existing saved project selections
  retain their progress and resume directly. Existing project APIs and ownership
  rules remain in use.

Supporting changes are limited to the assessment schema, preparation/condition
helpers and components, project-fit helper, recommendation filtering, project
eligibility for the new condition codes, focus serialization/storage, and tests
exercising those paths. No database migration or new API endpoint is required.

The real scene-to-project compatibility test exposed one missing connection in
the source commit: `predictions/item_actions.py` still required exactly `Clean
and dry` in automatic routing and project advice. Its new material-specific
readiness helper accepts the imported scrap conditions only for paper,
cardboard or fabric with explicitly dry, uncontaminated answers. Those condition
codes are also accepted when an existing scene selection is saved again. This
support is necessary to prevent a valid imported condition from being rejected
or its ideas hidden at handoff. Material confirmation, hazard checks, tentative
object restrictions and confidence policy are retained. Negative tests reject
wet, chemically contaminated and wrong-material scrap states.

Two small chooser compatibility adjustments accompany the imported fit check:
an absent legacy `materials` list is treated as empty, and cancelling fit review
is disabled while a save is underway. Neither changes stored catalog content.

## Local work preserved and remote changes excluded

- Kept the local recommendation catalog literal, descriptions, materials,
  step-by-step instructions, photo mappings, metadata, rights notes and credits.
  Imported the `core/recommendations.py` filtering lines only; deliberately
  excluded the remote hunk replacing paper-craft summary/materials/steps.
- Kept local `UpcyclingIdeaChoices` photo-first ordering, `TutorialPhoto` and
  `PhotoCredits`, adding fit confirmation around its existing chooser.
- Kept local project snapshot photo deep-copy support in `project_views.py`.
- Kept local face-detection privacy context in `scene_views.py` and the local
  unavailable-photo wording/layout in `SceneResults.tsx`.
- Excluded **all** `src/api.ts` changes: they only alter general network/debug
  connection wording and comments, with no scan request change. API address,
  environment and connection configuration remain local.
- Did not copy remote `PHASE1_CAMERA.md` or `docs/CHANGES_2026-11-19.md`; those
  describe another workspace's results, including its failing test baseline.
  This document records the validation performed here.
- Excluded every older commit's changes, including datasets, model publication,
  shared administration and historical feature work. Authentication, admin UI,
  unrelated layouts, databases, migrations, saved projects and app progress
  were outside the edit scope.

## Files

Modified production files:

- `SNAPTURE_ANDROID/src/AssessmentAdvice.tsx`
- `SNAPTURE_ANDROID/src/AssessmentScreen.tsx`
- `SNAPTURE_ANDROID/src/SceneResults.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingIdeaChoices.tsx`
- `SNAPTURE_BACKEND/core/assessment.py`
- `SNAPTURE_BACKEND/core/recommendations.py` (filtering only)
- `SNAPTURE_BACKEND/core/scan_ideas.py`
- `SNAPTURE_BACKEND/predictions/image_quality.py`
- `SNAPTURE_BACKEND/predictions/material_classifier.py`
- `SNAPTURE_BACKEND/predictions/item_actions.py` (required handoff reconciliation)
- `SNAPTURE_BACKEND/predictions/project_views.py`
- `SNAPTURE_BACKEND/predictions/scene_detector.py`
- `SNAPTURE_BACKEND/predictions/scene_views.py`
- `SNAPTURE_BACKEND/predictions/views.py`

New production helpers/components:
`SNAPTURE_ANDROID/src/{PreparationSteps.tsx,materialConditions.ts,materialPreparation.ts,projectFit.ts}`.

Modified Android tests:
`AssessmentScreen.test.tsx`, `CatalogProjectFlow.test.tsx`,
`ChangeProjectIdea.test.tsx`, `ItemActionAdvice.test.tsx`,
`QuickAssessment.test.tsx`, `RecommendationOrder.test.tsx`,
`ScanUpcyclingIdeas.test.tsx`, `SceneResults.test.tsx`, and
`TextilePresentation.test.tsx`, all under `SNAPTURE_ANDROID/__tests__/`.
New tests in that directory: `PreparationSteps.test.tsx`,
`materialConditions.test.ts`, `materialPreparation.test.ts`, `projectFit.test.ts`,
and `ScanImportFlow.test.tsx`.

Modified backend/ML tests: `SNAPTURE_BACKEND/core/test_scan_ideas.py`,
`SNAPTURE_BACKEND/predictions/{test_scenes.py,test_single_item_frame.py}`, and
`SNAPTURE_ML/scripts/test_scope_inference.py`. New backend tests:
`SNAPTURE_BACKEND/predictions/{test_phase1.py,test_preparation_progress.py,test_scan_import_compatibility.py}`.
Existing interaction tests add the actual fit-confirmation action and retain
their save, retry, selected-ID and progress assertions; no tests were skipped,
removed or relaxed to obtain a passing result.

## Validation

Local baseline: TypeScript passed. Django `predictions core` ran 216 tests with
eight existing assertion failures: seven subcases of the framed-recommendations
display-name assertion and one unsupported-title assertion. Baseline logs are
`.run-logs/scan-import-baseline-backend.log` and
`.run-logs/scan-import-baseline-typescript.log`.

The combined frontend run did not complete. An isolated, uncached, per-suite
runner records individual results and limits a stalled suite to 45 seconds.
Results are stored under `.run-logs/scan-import-baseline-suites/` and the
corresponding post-integration directory. A timeout is not counted as a pass.

Final results:

| Check | Before import | After import |
| --- | --- | --- |
| Django `predictions core` | 216 run; 208 passed, 8 assertion failures | 229 run; 221 passed, the same 8 assertion failures |
| Targeted Django scan/content/project compatibility | Baseline covered by the run above | **100 passed** |
| Android suites, isolated uncached runner | 38 suites attempted; 134 tests passed, 34 failed; camera suite timed out | 43 suites attempted; 182 tests passed, 33 failed; same camera timeout |
| New mobile test failures compared by suite and full test name | — | **None** |
| TypeScript `tsc --noEmit` | Passed | Passed |
| ESLint for changed mobile files/tests | Not separately recorded | 0 errors; 1 inline-style warning on the existing focus-overlay style pattern |
| ML `scripts.test_scope_inference` | Not separately run | **8 passed**; dimensions, dtype and raw RGB range retained |
| File/content preservation audit | 18,495 original file hashes | 18,468 unchanged; 27 intentional modifications; 13 additions; 0 deletions; 0 unexpected paths |

The full suites are **not fully passing**. Backend failures remain the seven
material subcases expecting `confirmed by you` in display text and the single
unsupported-title wording assertion. The mobile run retains 33 failures already
seen by exact suite/test name before the import, including timeouts, outdated
controls, labels and saved-result expectations. `AutomaticCamera.test.tsx` did
not finish within the isolated runner's 45-second limit both before and after;
it is not counted as a pass. One pre-existing `WasteRecommendations` timeout
did not recur; this timing difference is not claimed as an unrelated fix.
No baseline failures were hidden or fixed through broader refactoring.

Detailed mobile failures and the exact before/after comparison are in
`.run-logs/scan-import-mobile-comparison.json`; individual suite JSON/log files
are in `.run-logs/scan-import-{baseline,after}-suites/`.
Backend results: `.run-logs/scan-import-{baseline,after}-backend.log` and
`.run-logs/scan-import-targeted-backend.log`. Additional evidence:
`.run-logs/scan-import-after-typescript.log`, `scan-import-lint.log`, and
`scan-import-ml-tests.log`.

The 100-test targeted command used the local virtual-environment Python and
`SNAPTURE_DB_ENGINE=sqlite`, with Django's isolated test database:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py test core.test_assessment core.test_scan_ideas core.test_tutorial_media predictions.test_phase1 predictions.test_single_item_frame predictions.test_scenes predictions.test_preparation_progress predictions.test_scan_import_compatibility predictions.test_automatic_routing predictions.test_project_change_idea --noinput --verbosity 0
```

The isolated Android runner (`.run-logs/scan_mobile_tests.py baseline` / `after`)
uses the project's bundled Node executable and runs each existing suite with
`--runInBand --watchman=false --roots __tests__ --no-cache --silent --forceExit
--runTestsByPath`, recording JSON. It preserves Jest's normal per-test timeout;
the 45-second process cap bounds stalled suites. The normal combined run was
stopped after it stalled and was not counted as verification.

Automated coverage includes gallery/camera guide geometry and frame validation,
oriented pixel crops, invalid uploads, scan retries and request IDs, accepted
versus uncertain localization, single/multiple item behavior, all seven material
profiles, preparation and blocked conditions, persistence to the correct scan,
failed-save retry, late-response protection after changing scans, project-fit
cancellation, saved-project resumption, progress/ownership rules and existing
photo assets/source metadata. Some broad UI scenarios remain limited by the
baseline failures above.

Physical-phone/emulator interaction, camera hardware, gallery permissions,
real-photo model accuracy and an Android APK build have not been performed by
this import. Automated fixtures do not establish recognition accuracy.

## Backup and recovery

Backup: `history/scan-module-import-2026-11-19/`.
`files.json` records each imported path's prior existence and original SHA-256;
`files/` contains original local files, and `source-commit.patch` preserves the
exact inspected remote patch. `integrity-before.json` hashes 18,495 files outside
dependencies, build/cache directories and existing backup/log trees. The
post-import inventory identifies changed/added/deleted paths.
`review.json` records the preservation assertions, and `applied-local.patch`
contains the actual local code/test diff for review. The catalog literal was
compared as a Python syntax tree and is unchanged. Model weights, datasets,
databases/media, environment/settings, migrations, admin/auth code and unrelated
assets all remain byte-identical within the inventoried files.

To undo the import, stop local development processes, read `files.json`, and
restore **only** entries with `existed: true` from `files/<path>` to the matching
project path. Remove **only** the exact individual helper/test files whose
entries have `existed: false`, after confirming no subsequent work depends on
them. Remove this report separately if desired. Verify restored existing files
against their recorded hashes. Do not restore, replace or delete any database,
media, model, dataset, environment file or the entire project directory.

The temporary source checkout and `.run-logs/scan-import-*` artifacts are review
evidence, not application dependencies. Keeping them is safe; application code
does not refer to them.
