# Immediate upcycling ideas — November 17, 2026

The recommendation change is implemented locally. It has not been committed, pushed, or visually verified on a phone.

## Behavior

- A supported, confidence-qualified material or a user-confirmed material can retrieve up to three published preliminary ideas before the full fit form is completed.
- The existing experimental-checkpoint, unknown-material, ambiguous-object and unsupported-item gates remain. The current experimental model still requires material confirmation. This change does not establish reliable automatic seven-category recognition.
- Missing condition, history, quantity or measurements are checks on a preliminary idea. Known incompatible types, shapes, quantities and supplied dimension bounds filter ideas out.
- Optional household goals prioritize previews. A goal is no longer required to qualify an otherwise matching reviewed project.
- Damaged, moldy, chemically exposed and otherwise explicitly unsafe items receive handling guidance rather than project previews. Unknown condition or an item needing cleaning may show preliminary ideas with explicit checks; neither becomes permission to start.
- Project creation and restart exclude preliminary IDs on the server, including direct requests. Qualified projects still use the existing reviewed-project rules.
- One usable item stays selected after a result refresh. The result no longer renders the same action's idea list twice. Disposal guidance remains available separately.
- Preview cards show name, description, minimum quantity and review status. Materials, steps, full fit checks and source attribution remain available in project details.

## Catalog actually installed locally

The idempotent `seed_reference_guidance` command added 18 public-source entries: four segregation references and fourteen project references (three original references plus eleven new ideas). Existing versions and the 21 legacy draft projects were preserved. The local database was backed up to `.tools/maintenance/backups/upcycling-before-seed-20261117.sqlite3` before seeding.

| Category | Published source-checked ideas | Expert-reviewed projects |
|---|---:|---:|
| PET/PETE bottles | 2 | 0 |
| HDPE containers | 2 | 0 |
| Cardboard | 2 | 0 |
| Paper | 2 | 0 |
| Fabric scraps | 2 | 0 |
| Dry untreated wood scraps | 2 | 0 |
| Coconut shells | 2 | 0 |

Examples include intact-bottle dry storage, container organizers, plant-pot covers, cardboard drawer trays, paper wrapping, fabric reuse, wood labels and decorative shell holders. These are conservative source adaptations, not evidence of item-specific suitability. No dimensions, physical testing, resin identity or expert approval were invented. New entries include English and Filipino copy. Existing original references retain their existing language coverage.

Sources supporting the general reuse concepts:

- US EPA, *Consumer's Handbook for Reducing Solid Waste*: https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100047Q.TXT
- US EPA, common recyclables: https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables
- Victorian Government, reuse and repair: https://www.environment.vic.gov.au/household-waste-recycling/reduce-waste/reuse-repair
- US EPA, construction and demolition material reuse: https://www.epa.gov/smm/sustainable-management-construction-and-demolition-materials
- Philippine Information Agency, coconut-shell reuse: https://pia.gov.ph/news/luzon/from-backyard-waste-to-trade-fair-finds-giving-discarded-coconut-shells-new-life-purpose

These sources support reuse concepts; the adapted steps have not been independently tested or approved by CESD. Source records remain editable through the existing versioned Guidance administration. No schema migration was needed.

## Validation

- Mobile TypeScript check passed.
- Four targeted mobile suites passed: 15 tests covering preview instructions, disabled starts, item selection, panel state and saved guidance.
- Focused backend run passed: 75 tests. Two additional preview tests were then added; all six tests in `core.test_immediate_upcycling` passed in the final broader run.
- Final `core` and `predictions` regression run: 219 tests; 215 passed, four failed. The suite is not fully green. Remaining assertions concern the earlier unknown-versus-model-suggested-hazard behavior: `ManagementGuidanceTests.test_hazards_override_even_a_confirmed_material_and_do_not_offer_rinsing_or_reuse`, `SceneApiTests.test_background_detections_stay_reviewable_without_waste_boxes`, `SceneApiTests.test_phone_and_towel_are_selectable_without_overwriting_predictions`, and `SafetyGateTests.test_hazard_precaution_overrides_user_recyclable_report`. Those expect stronger hazard classification or older precaution wording than the current application returns. Do not interpret this report as clearing those failures.
- The tests use real seeded catalog content and explicitly synthetic prediction/context fixtures. They do not run camera inference on real photographs. No phone screenshots or usability study were performed.
- Logs: `.tools/maintenance/immediate-upcycling-focused.log` and `.tools/maintenance/immediate-upcycling-final.log`.

## Files touched for this task

Backend: `core/assessment.py`, `core/recommendation_engine.py`, `core/physical_suitability.py`, `core/idea_references.py`, `core/management/commands/seed_reference_guidance.py`, `predictions/views.py`, `predictions/item_actions.py`, `predictions/project_views.py`.

Mobile: `src/api.ts`, `src/AssessmentScreen.tsx`, `src/DisposalObjectRow.tsx`, `src/DetectionItemCard.tsx`, `src/SceneResults.tsx`, `src/ItemActionAdvice.tsx`, `src/ScanUpcyclingIdeas.tsx`, `src/UpcyclingIdeaChoices.tsx`, `src/LocalizedText.tsx`.

Tests: `core/test_immediate_upcycling.py`, `core/test_assessment.py`, `core/test_idea_references.py`, `core/test_support.py`, `predictions/test_automatic_routing.py`, `predictions/test_item_actions.py`, `predictions/test_identifier.py`, `predictions/test_quick_assessment.py`, and mobile `__tests__/UpcyclingIdeaChoices.test.tsx`, `__tests__/AssessmentAdvice.test.tsx`, `__tests__/WasteRecommendations.test.tsx`.

Several of these files already contained staged or unstaged work before this task. Existing unrelated workspace changes and staging were preserved.

## Remaining work

- Restart the backend and reload Metro/app to use these local code changes. No release build or remote deployment was performed.
- Review and publish real expert-tested projects if tracked, qualified projects are required. Source previews can be read now; they do not become tracked projects solely because a photo or confidence score exists.
- Validate the new screens and complete camera flow on actual photographs of the seven categories and unsupported objects.
- Complete dataset verification and model evaluation separately; no model or dataset was changed here.
- Resolve the four broader regression failures before claiming an entirely passing application suite.
