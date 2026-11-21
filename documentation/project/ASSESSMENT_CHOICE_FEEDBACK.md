# Assessment choice feedback

The shared upcycling matching endpoint now returns assessment feedback for every registered project and material, including results with no eligible projects. Messages describe the current reported answers rather than AI verification. They do not replace sourced project requirements or loosen existing checks.

- Clean and dry and the supported clean-scrap variants are recorded as user reports; other project requirements still apply.
- Needs cleaning provides material-specific preparation cautions and asks for reassessment afterward. Paper is not washed and cardboard is not soaked. The app does not automatically change condition after a save.
- Damage requires explicit project-specific acceptance and usable portions; it is not a blanket approval or rejection.
- Mold/contamination and chemical or restricted history retain their exclusions. Cleaning alone is not presented as clearance.
- Uncertain condition, contents, resin marking and wood history explain the missing evidence. Conflicting resin choices require reviewing the actual marking/category. Food/oil history is distinguished from currently reported contamination.

Update project fit now shows an assessment-updated alert with current feedback and the selected project's actual remaining checks. A project whose requirements are unpublished remains locked even with clean/dry answers. Quantity deficits and failed requirements remain explicit. The feedback also stays visible in Project fit, or above the no-project result. Failed requests still use the existing error display.

The unresolved clean/dry and damage requirements keep condition choices accessible without requiring Edit details. When an exclusion produces no project cards, the existing Photos & item details page includes the same answer controls to review a mistaken report. No new module or route was added; existing text, alert, field and choice styles are reused. Historical snapshots are not regenerated or overwritten.

Automatic condition classification remains unavailable until the visual assessor is configured and validated. Material confidence does not imply condition confidence, chemical history or structural suitability. The strict AI step-photo procedure remains unchanged.

Validation: 271 backend core/prediction/upcycling tests, 15 targeted Android tests and TypeScript passed. The condition-feedback test matrix exercises all seven material catalogs and all supported condition values, as well as contents, resin and wood-history choices. These are logic tests with fixture outputs, not AI accuracy measurements.
