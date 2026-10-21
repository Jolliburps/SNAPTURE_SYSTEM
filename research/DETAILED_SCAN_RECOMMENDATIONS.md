# Detailed scan recommendations — 2026-10-21

Additive feature: no camera, detector, classification, route, project eligibility,
navigation, dependency or database-schema changes.

## Behavior

- Expand an existing detected-item card for Disposal Instructions, Preparation
  Before Disposal, Recycling and Reuse, Safety Tips, Environmental Impact, and
  Bacoor Collection Guidance. Existing classification, preparation, review,
  photo and expert-project actions remain available.
- All six target materials have conditional reference guidance. Some already
  recognized non-target hypotheses (glass, metal, food, leaf, flexible packaging)
  have explicitly conditional educational references, not new classifier labels.
- Suspected hazardous items override cleaning/reuse suggestions. Reported damage
  or contamination withholds reuse. Unknown objects receive conservative advice,
  never an invented residual classification.
- Sources expand using one working button. URLs are selectable. No placeholder
  project, collection booking, saving, or completion actions were added. Existing
  tracked projects retain their working completion mechanism; general advice is
  not represented as a completed real-world disposal action.

## History integrity

`core/management_guidance.py` generates `management-reference-v1` in the existing
assessment JSON. The normal refresh/save flow persists it for each item. History
uses the saved snapshot; it does not regenerate stored guidance or run inference.

Older valid snapshots without this field get a read-only reference supplement
derived only from that item's saved material/context and raw detector class. The
UI labels it as a newer supplement, not original advice. No record is rewritten
on history GET. A missing original assessment remains missing: no guessed advice.
Future changes should preserve v1 and its recorded sources for historical fidelity.

## Source and approval boundaries

General references cross-checked against US EPA Common Recyclables, the Consumer's
Handbook, Recycling Basics and Benefits, Household Hazardous Waste, and Composting
at Home on 2026-10-21. Sources are included in the payload. These are general
educational adaptations, not Bacoor acceptance rules, expert-tested procedures,
or CESD approval. Ask the barangay/CESD for an exact receiving service, date, and
preparation requirements; no address, price, collection date or bin color is
invented. No measured carbon/weight saving is claimed.

## Changed files for this feature

- Backend: `core/management_guidance.py`, `core/assessment.py`,
  `predictions/views.py`, `core/test_management_guidance.py`.
- Android: `src/WasteRecommendations.tsx`, `src/api.ts`,
  `src/DetectionItemCard.tsx`, `src/SavedScanReview.tsx`,
  `src/AssessmentAdvice.tsx`, `__tests__/WasteRecommendations.test.tsx`.
- This implementation note.

Tests cover six materials, hazardous/contaminated/damaged/unknown cases,
conditional non-target references, no project unlocks, snapshot isolation,
non-mutating legacy supplements, live-card expansion, source toggling,
standalone and scene history, and switching between saved scan IDs.
