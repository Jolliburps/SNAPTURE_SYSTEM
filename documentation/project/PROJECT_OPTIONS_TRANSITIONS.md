# Project options transitions

Photos & item details now opens a full-screen modal using the existing project-flow header, Back/Close controls and safe-area layout. The original project list stays mounted. The details page retains item observations, known facts, additional views, conflict feedback and the existing add-view action; it also shows the primary item photo. Supported materials and exclusions are no longer duplicated here; the Waste module remains available.

Choose a goal opens a bottom sheet with a temporary selection. Apply goal reloads suggestions and closes the sheet only on success. Cancel, tapping the backdrop and Android Back dismiss without applying the draft. The selected goal appears on the original control. Errors stay visible in the sheet. Include collection remains an immediate toggle. Backend matching and eligibility rules are unchanged.

TypeScript and five targeted tests across SuitabilityProjects, ScanResult and UpcyclingHub passed. Tests cover deferred application, cancellation without a request, opening/closing the details page and retained eligibility gating. The goal sheet was visually inspected on the connected Android phone; its initial zero-height provider layout was corrected to a bounded sheet with scrollable options.


Photo labeling update: the primary photo uses its recorded capture-view label, with a neutral fallback when older data has no label. Per-photo material warnings are now attached to individual additional-view IDs by the assessment API and displayed inside the matching photo group. Existing flat conflicts remain for compatibility and suitability logic. Older API responses fall back to view-prefixed warning text. General cross-view conflicts are shown separately. Frozen historical results are not rewritten. Validation: TypeScript, 23 upcycling backend tests and seven targeted Android tests passed.
