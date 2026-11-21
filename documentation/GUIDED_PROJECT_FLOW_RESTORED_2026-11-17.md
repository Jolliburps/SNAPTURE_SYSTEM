# Guided project flow restored

This update supersedes the earlier read-only preview behavior. Choosing an existing catalog idea now opens a saved project checklist through the existing project API and ProjectGuide.

- Recommendations display a Choose action. The long step list is removed from the expandable recommendation card.
- Conditional ideas prepend their outstanding material, quantity and fit checks to the guide. Their saved reference retains `qualification_status=preliminary` and `tracking_basis=preparation_and_instruction_checklist`. Checklist progress does not change a scan's material classification, model confidence or review status.
- Existing hazard, damaged/contaminated-item and tentative-object exclusions remain. No new projects or model weights were added.
- Each guide step, including the last, has Mark as done. Finish appears separately after all steps have been saved. A failed save keeps the current step open and does not show Finish.
- Existing project persistence, resuming, restart and owner checks remain in use. The backend still derives completed status once every step is saved; Finish exits the guide or opens its completion summary.
- Removed the unrelated Did you know block from the completion summary.

Changed: backend `predictions/project_views.py`; mobile `src/ScanUpcyclingIdeas.tsx`, `src/ItemActionAdvice.tsx`, `src/UpcyclingIdeaChoices.tsx`, `src/ProjectGuide.tsx`; backend tests `core/test_immediate_upcycling.py`, `core/test_object_project_candidates.py`; mobile tests `__tests__/ProjectGuide.test.tsx`, `__tests__/UpcyclingIdeaChoices.test.tsx`.

Validation: 24 targeted backend tests passed, 13 targeted mobile tests passed, TypeScript passed and targeted mobile lint passed. The backend was restarted. Physical-phone validation of this restored flow and a new Android build were not performed in this update. Existing unrelated working-tree changes were preserved.
