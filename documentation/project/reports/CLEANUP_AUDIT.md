# Project cleanup audit

Audit date: 26 October 2026. Scope: existing local SNAPTURE_SYSTEM checkout.

## Before changes

The root contained `.git`, `.gitignore`, `research/`, `SNAPTURE_ADMIN/`,
`SNAPTURE_ANDROID/`, `SNAPTURE_BACKEND/`, `SNAPTURE_ML/`, README, RUNBOOK and
eight implementation reports. The surrounding workspace additionally holds
portable development tools, launcher scripts, run commands and local reports.
Those machine-specific files remain outside the repository and are retained.

The initial Git status already contained source modifications, two removed
mobile-admin files and new feature tests/components. These are pre-existing
changes, not cleanup deletions. The initial status and file hashes are saved
outside the repository in `.tools/cleanup-audit/`.

## Reviewed candidates and decisions

No OS metadata, editor backup, merge-reject or temporary-file candidates were
found in the inspected first-party source trees. Do not delete unfamiliar files
to manufacture a cleanup result. No permanent file deletion is planned.

Move six provenance/implementation reports into `documentation/history/` and
two current feature guides into `documentation/guides/`. Preserve their bodies,
repair documentation references, and give readers a current manual and concise
README. Historical reports remain evidence of their dated implementation;
their old counts, paths, six-material scope and UI descriptions are not current
runtime guarantees. The current source restores all seven materials and removes
mobile administration. Unique research notes remain in `research/`.

## Protected resources

Preserve all four application component trees, source, tests, migrations,
package manifests/lockfiles, Python requirement manifests, environment templates,
hidden configuration, scripts, CI files, licenses, model cards/weights/labels,
datasets/annotations/splits, review holds, accounts, database/media/backups,
node_modules, Python environments, Android build output and Git metadata.
Runtime and dependency folders are excluded from documentation content collection.
They remain present and are measured by metadata only; no private data is copied
into the manual. Dataset images are not opened or visually audited in this task.

## Risks and verified contradictions

- Backend imports ML from its sibling directory. Do not relocate components.
- CESD compatibility launchers share the backend; they are not duplicate servers.
- API 8000, Metro 8081, Vite 5173 and the USB watcher can be active. Preserve logs,
  process metadata, caches and forwarding; do not restart them for cleanup.
- Root README and old dataset policies describe six materials, while current
  `core/materials.py`, inference scope and organization rules include coconut shells.
- Android/backend READMEs still describe mobile administration or absent CESD
  feeds. Correct those statements in documentation only.
- Runtime requirements specify OpenCV headless 5.0.0.93 while detection requirements
  specify opencv-python 4.11.0.86. Record the conflict; do not reconcile packages here.
- Historical dataset counts and successful downloads on the original PC do not
  prove complete restoration here. Preserve source registries and licensing holds.
- Word/PDF are derived deliverables. Markdown, model/license and workflow entry
  points remain available for GitHub and tooling.

## Proposed moves

- `CESD_ADOPTION.md` → `documentation/history/CESD_ADOPTION.md`: group existing technical records without moving application code.
- `EVALUATION_SCORECARDS.md` → `documentation/history/EVALUATION_SCORECARDS.md`: group existing technical records without moving application code.
- `FEASIBILITY_IMPLEMENTATION.md` → `documentation/history/FEASIBILITY_IMPLEMENTATION.md`: group existing technical records without moving application code.
- `GUIDE_AND_DETECTION_REFINEMENTS.md` → `documentation/history/GUIDE_AND_DETECTION_REFINEMENTS.md`: group existing technical records without moving application code.
- `SHARED_BACKEND_INTEGRATION.md` → `documentation/history/SHARED_BACKEND_INTEGRATION.md`: group existing technical records without moving application code.
- `UX_CAMERA_AND_SORTING.md` → `documentation/history/UX_CAMERA_AND_SORTING.md`: group existing technical records without moving application code.
- `ADMIN_AND_FILE_NOTIFICATIONS.md` → `documentation/guides/ADMIN_AND_FILE_NOTIFICATIONS.md`: group existing technical records without moving application code.
- `DASHBOARD_AND_NOTIFICATIONS.md` → `documentation/guides/DASHBOARD_AND_NOTIFICATIONS.md`: group existing technical records without moving application code.

## Verification plan

Check initial versus final hashes for every existing tracked file and untracked
source/configuration file, allowing only explicitly listed Markdown edits/moves.
Check package/lockfile root dependency agreement, local Markdown file links,
active-model/label/privacy/detector asset presence, Django system checks and isolated
tests, mobile type/lint/focused regression checks, and web lint/production build.
Render and inspect the generated documents. Record actual results, including
pre-existing warnings or timeouts, in CLEANUP_REPORT.md.
