# Restored scan recycling/upcycling ideas — 2026-10-26

## Cause

The single framed-item material fallback has no reliable object identity or box.
Even after a user confirmed its material and clean/dry condition, the object
review gate still rejected it as a whole-image classifier result. This hid the
existing educational idea selector and prevented project creation. Previously
saved action snapshots retained that same blocker.

## Changes

- Reuse the existing `UpcyclingIdeaChoices`, assessment and persistent project
  guides. No camera, model weights, detection threshold, category list, database
  schema or project-progress changes.
- Add a direct **Recycling / upcycling ideas** entry for an eligible single
  framed item. It saves the selection through the existing API, then opens the
  existing material/condition check. Failed requests do not navigate.
- Allow material-based ideas when the user has explicitly checked a supported
  material for the sole selected item in a single framed scan. This exception
  does not apply to weak detector boxes or legacy mixed-photo classifications.
- Continue checking condition, plastic resin marks, contamination and special
  handling. Unconfirmed/unsafe items cannot start a project through a direct API
  request either. General educational ideas are not CESD approval.
- Display the material as **confirmed by you**, not an invented object name.
  Raw detector labels/scores remain unchanged; object confidence stays null and
  material-only results have no object box.
- For affected saved framed scans, render advice from that same prediction's
  saved assessment and handling data. Do not rewrite history on GET or borrow
  recommendations from a newer scan.

## Verification

- 141 prediction/project backend tests pass, including all seven supported
  materials, working project creation, unknown-to-fabric correction, unsafe
  conditions, resin checks, legacy weak-object guards and read-only history.
- 146 mobile tests in 35 suites pass, including direct entry, network errors,
  showing choices after confirmation and the existing guide/change-idea flow.
- TypeScript and targeted ESLint pass. Android release build succeeds.
- Read-only verification of existing scene 41 / prediction 277 returns
  `fabric_cleaning_cloth`, `fabric_pouch`, `fabric_patchwork`, with no database
  changes, no object confidence and no displayed object box.
- Release installed with `adb install -r` on connected device
  `8PVKYTHM6DK7RK4X`; existing application data retained. Backend restarted.
  Physical-screen interaction was not verified while the phone was dozing.

## Files changed for this fix

- `SNAPTURE_ANDROID/src/SceneResults.tsx`
- `SNAPTURE_ANDROID/__tests__/DisposalSelection.test.tsx`
- `SNAPTURE_ANDROID/__tests__/QuickAssessment.test.tsx`
- `SNAPTURE_BACKEND/predictions/item_actions.py`
- `SNAPTURE_BACKEND/predictions/scene_views.py`
- `SNAPTURE_BACKEND/predictions/test_framed_recommendations.py`
- This implementation note.

Other existing working-tree changes were preserved. No dataset files were
changed, no training was run and nothing was pushed to GitHub for this request.
