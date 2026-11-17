# Bottle recommendation pipeline fix

## Root cause

The detector prompt maps `plastic bottle` and `plastic jug or container` to `unknown_unsupported`. This deliberately avoids claiming a resin from appearance. Assessment previously looked up projects only by the seven material keys, so a recognized generic bottle could never reach the PET/HDPE catalog. Automatic routing then suppressed all ideas for the discard route. The result card also used a material/sorting verification flag as object confidence, incorrectly calling a strong object detection an “Unconfirmed suggestion.”

## Implementation

- Added an exact, whitespace/case-normalized object alias lookup. It searches existing published project records as conditional candidates. It does not change the prediction decision, infer resin, alter weights, or approve projects.
- Weak/ambiguous objects, unsupported glass, hazards, chemical contact and unsuitable condition remain excluded. Corrected object names override the original object name for the candidate lookup.
- Quantity and physical requirements use the existing preliminary matcher. A catalog miss remains distinct from a failed request.
- Preserved candidate projects through automatic disposal routing. These remain `preliminary`, have `basis=object_candidate`, show the missing resin check, and cannot start a project.
- Changed object uncertainty display to use detection review status and object score. Material uncertainty remains explicitly visible.
- Candidate projects appear before lengthy disposal instructions. Project steps, quantities, material checks, source and an optional reference image are available in details. No new project records were added for this fix.
- Added retry for live-result retrieval failure. A failed request keeps the error rather than claiming the catalog is empty.

## Files

- `SNAPTURE_BACKEND/core/object_project_candidates.py` (new)
- `SNAPTURE_BACKEND/core/assessment.py`
- `SNAPTURE_BACKEND/predictions/views.py`
- `SNAPTURE_BACKEND/predictions/item_actions.py`
- `SNAPTURE_BACKEND/core/test_object_project_candidates.py` (new)
- `SNAPTURE_ANDROID/src/DetectionItemCard.tsx`
- `SNAPTURE_ANDROID/src/ItemActionAdvice.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingIdeaChoices.tsx`
- `SNAPTURE_ANDROID/src/SceneResults.tsx`

## Validation and limitations

- 15 backend candidate/preview/matching tests passed.
- 17 additional automatic-routing, framed-recommendation and saved-idea tests passed.
- Two mobile suites passed, seven tests; TypeScript and targeted lint passed with the optional reference-image presentation included.
- The backend was restarted to load the fix; existing account data and scan snapshots were preserved. Historical assessments retain the catalog results saved at the time. Capture a new photo or explicitly reassess an old item to use current matching.
- The current local catalog contains two source-checked ideas per category and no expert-reviewed projects. Their instructions are existing source adaptations. This change does not grant expert/CESD approval or certify a particular bottle's suitability.
- Tests use actual local catalog definitions with synthetic prediction fixtures. No new real-photo camera experiment, visual phone verification of these candidate cards, model evaluation or usability study was performed.
- Android `:app:assembleDebug --offline` passed in 4 minutes 9 seconds (234 tasks). The first attempt failed to locate Node; rerunning with the workspace Node directory on PATH passed. Log: `.tools/maintenance/bottle-candidates-build.log`.
- API/database outage simulation and physical-phone image rendering were not tested in this run. Existing camera/model weights and old scan snapshots were not modified. The broader application's four previously reported hazard/unknown assertion failures remain outside this targeted validation.
