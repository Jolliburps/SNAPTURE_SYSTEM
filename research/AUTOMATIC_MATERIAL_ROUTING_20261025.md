# Automatic material routing — 25 October 2026

The scan screen no longer asks users to choose Keep, Discard or Recycle/upcycle.
Users select the objects they want guidance for; the server chooses the workflow.

- Seven scope materials route to recycling/upcycling confirmation, not immediate project approval.
- Recognized objects outside that scope route to disposal guidance, not automatically to residual garbage. Existing organics, recovery/diversion and special-handling safeguards remain.
- Weak or conflicting object suggestions remain review-only; scope routing is not improved detection accuracy.
- Existing material confirmation and clean/dry condition must be saved before ideas are exposed. Plastic resin checks and existing contamination/hazard gates remain.
- Project creation and changing ideas enforce the confirmation gate server-side; hiding buttons is not the only protection.
- Correcting the assessed material updates the same item's action snapshot and effective route. Historical reads do not rerun detection or use a newer scan.
- Legacy explicit-action API requests and historical snapshots remain compatible. New mobile confirmations request automatic routing and cannot also override the action.
- No model changes, training, schema migrations, project resets or dataset edits.

Implementation touches Android scan selection/results, shared action advice, the existing assessment entry point and API types; backend scene selection/serialization, action advice/snapshots, prediction serialization and project eligibility.

Verification: 130 mobile tests across 33 suites; TypeScript and touched-file ESLint checks; 114 prediction/project backend tests, with 7 focused automatic-routing API tests rerun after final assertions. Android release build succeeded and was installed with `adb install -r` (preserving data). The local backend was restarted with the updated code. Physical gesture testing was not performed and no user scans or project steps were changed during verification.
