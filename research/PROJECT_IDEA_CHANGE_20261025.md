# Change an unstarted project's upcycling idea

Added **Change idea** to Step-by-Step Guide, both immediately after a scan and
when opening an unstarted project from My projects. It returns directly to the
original material-specific idea chooser, shared with first-time selection. The
original item's photo/name and material are loaded by the project's own saved
prediction ID, never from a newer scan. Fabric/blanket returns to fabric ideas.

- **Keep current idea** cancels without writing anything.
- **Use this idea** updates the same project ID with server-provided instructions,
  tools, precautions and source information. The scan and creation date remain.
- All currently matching choices, including the current and already-saved ideas,
  are shown. The current idea is marked. If another choice already exists for the
  same scan, it is reopened with its progress intact. Only the unused, unstarted
  duplicate choice is removed; its full text snapshot is retained in the reused
  project's `_replaced_unstarted_choices` reference metadata for recovery.
  An identical request retry resolves that archived ID safely. No project with
  recorded progress is deleted or overwritten by this flow.
- Network/save errors preserve the current project and support retry or cancel.
- Completing any step locks changes on the server as well as in the UI. The lock
  persists after undo or restarting a completed project. This protects recorded
  work and prevents skipping Step 1 to bypass the restriction.
- Existing old projects with no recorded progress can change ideas. Historical
  step completions that were undone before this feature existed cannot be
  reconstructed; the persistent lock applies to completions recorded from now on.
- Existing safety/material/condition eligibility checks are reused. No model,
  category, dataset, private scan image or unrelated admin function changed.

Uses existing project reference JSON; no database migration or new dependency.

## Files

- Backend: `predictions/project_views.py`, `predictions/project_urls.py`,
  `predictions/test_project_change_idea.py`.
- Mobile: `src/ProjectGuide.tsx`, `src/ProjectIdeaPicker.tsx`, shared
  `src/UpcyclingIdeaChoices.tsx`, `src/ScanUpcyclingIdeas.tsx`,
  `src/ItemActionAdvice.tsx`, `src/api.ts`,
  `src/ProjectPanels.tsx`, `src/MainExperience.tsx`, `App.tsx`, and
  `__tests__/ChangeProjectIdea.test.tsx`.

## Verification

The updated implementation passed TypeScript, touched component lint, all 126
mobile tests (32 suites), and 107 backend prediction/project tests. Regression
coverage includes original blanket preview, source isolation, navigation, and
reusing saved progress. Release build succeeded. Final results are in `.run-logs`.
The backend was restarted. A read-only request to the running chooser for the
user's current fabric project returned the original Blanket / Fabric scraps,
its available preview, and cleaning-cloth, pouch and patchwork choices, including
the existing cloth project. No live project was changed during that check. Tests
use an isolated database and did not alter the user's project progress. The
release APK is installed with `adb install -r` to retain app data.

## Scroll and navigation fix

The full-screen chooser incorrectly used a `flex: 1` page style as the
ScrollView's content container. That constrained the content to the viewport and
clipped the long list instead of allowing it to grow. It now uses a bounded
`flex: 1` viewport and `flexGrow: 1` padded content. The guide has an explicit
bounded viewport too; modal guide/chooser sheets have a bounded height.

`ProjectFlowPage.tsx` provides a fixed header outside the scroller: the upper-left
arrow returns from the chooser to the current guide, and X exits the upcycling
flow to its originating screen without deleting a project or changing progress.
Navigation is disabled during a save. Both the idea list and step guide retain
their bottom padding and visible scroll indicators.

Verification: TypeScript and touched component lint passed; all 128 mobile tests
(33 suites) passed, including viewport/header layout and Back/X navigation without
saving steps. Android release built successfully and was installed on the phone.
The phone later locked, so an interactive physical swipe check was not completed.
No live ideas were selected, projects deleted, or steps marked during these checks.
