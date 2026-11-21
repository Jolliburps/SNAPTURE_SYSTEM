# Completed project cleanup report

Completed 26 October 2026 on the existing local working tree. No commit, push,
application logic change, dependency upgrade, service restart, data migration,
model replacement, dataset operation or permanent deletion was performed.

## Structure before and after

Before: the root held `.git/`, `research/`, the four application directories,
`.gitignore`, README.md, RUNBOOK.md and eight standalone implementation reports.
After: the same application/research/Git directories remain, with a new
`documentation/` directory. README and RUNBOOK remain at root. Documentation is
grouped as `documentation/guides/` for current feature guides and
`documentation/history/` for six dated implementation/provenance reports.
No application component was renamed or moved. The surrounding workspace's
launchers, RUN_COMMANDS.txt, reports, tools and service logs remain intact.

Final metadata-only inventory counted 199,648 files, including installed
dependencies, model/data files, build output and Git metadata. Root loose files
fell from 11 to 3 by grouping the eight reports. The detailed final directory
inventory is local at `.tools/cleanup-audit/final-folder-inventory.json`.
Its logical byte counts include hardlink aliases and must not be presented as
physical disk usage or reclaimed space.

## Completed file operations

Permanent deletions: **0**. Reversible Markdown moves: **8**.

| Previous root path | New path | Reason |
| --- | --- | --- |
| CESD_ADOPTION.md | documentation/history/CESD_ADOPTION.md | Group documentation; retain unique content |
| EVALUATION_SCORECARDS.md | documentation/history/EVALUATION_SCORECARDS.md | Group documentation; retain unique content |
| FEASIBILITY_IMPLEMENTATION.md | documentation/history/FEASIBILITY_IMPLEMENTATION.md | Group documentation; retain unique content |
| GUIDE_AND_DETECTION_REFINEMENTS.md | documentation/history/GUIDE_AND_DETECTION_REFINEMENTS.md | Group documentation; retain unique content |
| SHARED_BACKEND_INTEGRATION.md | documentation/history/SHARED_BACKEND_INTEGRATION.md | Group documentation; retain unique content |
| UX_CAMERA_AND_SORTING.md | documentation/history/UX_CAMERA_AND_SORTING.md | Group documentation; retain unique content |
| ADMIN_AND_FILE_NOTIFICATIONS.md | documentation/guides/ADMIN_AND_FILE_NOTIFICATIONS.md | Group documentation; retain unique content |
| DASHBOARD_AND_NOTIFICATIONS.md | documentation/guides/DASHBOARD_AND_NOTIFICATIONS.md | Group documentation; retain unique content |

The root README now provides concise entry links. The Android README describes
the current resident-only flow. Backend/ML READMEs correct stale mobile-admin,
announcement and connection instructions. Historical six-material policy/training
guides now carry explicit seven-material scope notices without changing their
original experiment commands. RUNBOOK and research scorecard references were
repaired. None of these edits changes application behavior.

All 38 discovered relevant project Markdown documents were classified and
incorporated by topic in COMPLETE_DOCUMENTATION.md. Their original/current paths,
pre-cleanup SHA-256 and covered sections are in documentation_sources.json and
the manual's source index. Unique historical instructions, metrics, research,
licenses and model notices remain at their original or listed moved paths.
No Markdown source was deleted after consolidation. Exact pre-cleanup Markdown
copies, initial Git status and integrity evidence are retained locally under
the outer workspace `.tools/cleanup-audit/`.

## Deliverables

- [Word manual](../../exports/SNAPTURE_SYSTEM_Complete_Documentation.docx)
- [PDF manual](../../exports/SNAPTURE_SYSTEM_Complete_Documentation.pdf)
- [Editable consolidated manual](../COMPLETE_DOCUMENTATION.md)
- [Initial audit and risk decisions](CLEANUP_AUDIT.md)
- [Source incorporation manifest](../../provenance/root-documentation_sources.json)

The manual has a title page, populated contents, heading hierarchy, page numbers,
tables, monospaced commands and a complete source index. The Word and PDF use
the same consolidated Markdown source. Detailed rendering results follow below.

## Files intentionally retained

No confirmed disposable temp/OS/editor files were found in the first-party audit.
All runtime/source assets, imports, migrations, tests, manifests and lockfiles,
environment templates/hidden configuration, CI/project scripts, databases/media,
private backups/mail, models/labels/provenance/licenses, datasets/annotations,
quarantine and review holds remain. node_modules, virtual environments, Android
build output and caches remain because this is an active development machine.
The CESD compatibility launcher and ML compatibility entry point are referenced
tools, not obsolete duplicates. Uncertain files were not removed.

## Verification executed

Commands ran through the existing terminal environment loader. Backend tests use
their isolated test database, not the normal database. Test logs are local under
`.tools/cleanup-audit/` in the surrounding workspace.

| Check and actual command | Result |
| --- | --- |
| Python manage.py check | Passed; no Django system issues |
| Python manage.py test --noinput --verbosity 1 | 249 passed |
| Mobile node node_modules/typescript/bin/tsc --noEmit | Passed |
| Mobile node node_modules/eslint/bin/eslint.js . | Passed |
| Mobile Jest --runInBand --watchman=false --runTestsByPath AssessmentAdvice, FileNotifications, DashboardNotifications, ResidentAccess | 4 suites, 23 tests passed |
| Web node node_modules/oxlint/bin/oxlint | Passed |
| Web npm.cmd run build | Passed; TypeScript and Vite production build |
| Existing package.json versus package-lock.json roots | Both lockfile v3 dependency/devDependency sets match |
| Git diff --check | Passed |

Compared 447 pre-existing tracked and untracked source/configuration file hashes: 439 unchanged, 8 changed Markdown files, no missing protected files and no unexpected non-Markdown changes. All three active model selections, YuNet model/license and detector config/weights remain accessible. No source path changed, so imports and build paths remain the same.

The web build regenerated its ignored dist output as expected. No native rebuild
or app reinstall was required for documentation-only changes. The entire mobile
suite and browser E2E suite were not rerun: earlier full mobile diagnostics had
two known file timeouts (AutomaticCamera and CatalogProjectFlow). Focused success
does not claim those are resolved. No test asserts model accuracy or visually
reviews every dataset image.

## Unresolved issues and manual review

- Public/private dataset restoration completeness remains a separate task.
  Historical source counts do not prove all data is on this PC. Preserve the
  15,252-original-PC-path question and inspect existing acquisition manifests.
- ZeroWaste retains its research-only licensing hold; unclear-rights sources
  remain unapproved. No rights review or raw-image redistribution occurred.
- OpenCV manifests request conflicting distributions/versions. Resolve in an
  isolated compatibility task before reinstalling detection requirements.
- Production debug/signing/privacy/hosting and independent model evaluation are
  still needed. Documentation cleanup does not make this a production release.
- Existing uncommitted feature modifications and two previously deleted mobile
  admin files remain as found; they are not changes caused by cleanup.
- This cleanup does not verify that the last phone connection error is cleared.
  The USB watcher and existing servers were deliberately left undisturbed.
- The managed document dependency loader was unavailable. A separate tools venv
  installed python-docx 1.2.0, PyMuPDF 1.26.7, pdf2image 1.17.0, ReportLab 4.4.9 and support
  packages; application npm/Python dependencies were not installed or changed.
- Packaged render_docx.py failed because LibreOffice soffice.exe is unavailable.
  Word opened/saved the DOCX and populated its contents, but native PDF export
  stalled twice, including a PDF/A retry. Only the task-created Word instances
  and their two export helpers were stopped. Computer-use inspection could not
  connect to its native pipe. ReportLab generated the real PDF from the same
  Markdown, and PyMuPDF rendered it. No placeholder PDF was substituted.

## Document rendering and final links

The PDF has **17 pages**, a populated linked contents page and 36 outline entries.
All 17 final rendered page images were visually inspected after correcting an
initial code-block shading overlap and reducing an excessive second contents
page. No text clipping, overlapping blocks or missing glyphs remain in the
inspected final PDF. Geometry/glyph checks reported zero flags. Tables repeat
headers where split. Page numbers and monospaced commands are present.

The DOCX is valid OOXML, opens/saves in Word, has seven tables, 37 populated TOC
paragraphs and a recorded Word page count of 19. Its text, headings, code styles
and source index were checked structurally. **Full visual verification of the
Word pagination remains incomplete**, because both available native rendering
paths failed or stalled. The PDF has independent pagination, so its contents
page numbers intentionally differ from Word's. Open the Word document locally
to confirm its exact pagination before formal submission.

Final Markdown link check: **zero missing local target files**. Detailed evidence
is in `.tools/cleanup-audit/checks.json`, `final-integrity.json`, `pdf-qa.json`,
`markdown-links.json`, `git-status-before.txt` and `git-status-after.txt` in the
outer workspace. Final deliverables total approximately 214 KB; no space saving
is claimed because no original files were permanently removed.
