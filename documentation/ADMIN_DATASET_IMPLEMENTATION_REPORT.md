# Admin and dataset implementation — 26 October 2026

## Delivered behavior

The existing CESD web admin now uses softer green-grey backgrounds, warm light
surfaces, visible borders, clearer table separation/focus states and restrained
red delete controls. The existing green brand and seven main navigation links
remain. **Dashboard → Open image datasets** opens `/datasets`.

The owner can delete policies, educational materials, announcements and collection
schedules after a title/ID confirmation. The API requires owner access, CSRF and
the current record revision. It audits the deletion and removes that content row
and public listing. Attachments remain private; there is no content Trash.

Dataset managers can move individual or selected images to recoverable Trash.
The dialog states IDs/count and file effects. No original image is deleted.
Restoration returns a copy to pending review and excludes it from export.
Withdrawn consent cannot be restored by an administrator. No permanent-purge
operation, automatic retention deletion or export-audit deletion was added.

Dataset copies use the existing Django image store and extended DatasetImage
table. Official predictions, verified official assignments, custom names/groups,
review and inclusion remain separate. Correct Name remains a proposal and only
updates a shared group when a separate, explicitly consented dataset copy exists.
Case/whitespace variants of Charger share a global stable group ID across users.
Rename/merge preserves aliases, image references and review/audit history and
places changed memberships on an export-inclusion hold.

The mobile research prompt preserves legacy **Review only** consent and adds
**Share dataset copy** with a separate retention explanation. Independent copies
survive My Scans clearing and can be withdrawn in Settings. Neither choice
trains the model or verifies a label. Private images are never bulk-imported.

## Categories and actual local data

The exact model categories remain in `core/materials.py:SCOPE_LABELS`:

| Official label | Recorded offline photo groups | Live shared-image DB records at verification |
| --- | ---: | ---: |
| `pete_bottles` | 5,412 | 0 |
| `hdpe_containers` | 3,476 | 0 |
| `cardboard` | 2,417 | 0 |
| `paper` | 3,680 | 0 |
| `fabric_scraps` | 5,816 | 0 |
| `dry_untreated_wood_scraps` | 775 | 0 |
| `coconut_shells` | 363 | 0 |

Recorded values are from the **20261025T093043Z** Git registry, totaling 21,939
material photo groups. The canonical `recognition_basis` manifest is **missing
on this PC**. These numbers do not demonstrate restored files, permission,
verification or training eligibility. The page explicitly distinguishes this
historical inventory from database-managed image counts. The shared database
library is empty; no demonstration photographs or Charger entries were inserted
into the user's live database. Browser/unit fixtures use isolated data only.

Public source folders, annotation paths, model labels/encoding and weights were
not reorganized, replaced or trained. All **33** protected model asset hashes
match the existing preservation baseline. ZeroWaste stays on its existing
research-only licensing hold; missing private/local-only images are not invented.

## Review and export policy

Human approval requires recorded consent, rights/privacy and usable-quality/label
confirmation, review evidence and explicit inclusion. Pending, rejected, excluded,
trashed and withdrawn images do not enter normal exports. Custom labels never
become additional classes in the active seven-class model.

Web snapshots generate `official_categories/<exact-label>/`, separate
`custom_labels/<stable-id>-<slug>/`, and `manifests/dataset.json`. Manifests include
relative paths, record IDs, checksums, predicted/verified labels, custom group,
review date, public provenance, version and date; they omit resident identities,
tokens, private URLs and private answer metadata. Exact duplicates export once;
conflicting selected duplicate assignments, missing/corrupt files and changed
checksums are withheld. Snapshot downloads recheck current eligibility and refuse
stale manifests. Already downloaded copies cannot be recalled. No new model is
trained or promoted.

The official-only `export_verified_dataset` command applies the same review
eligibility and refuses nonempty destinations to avoid stale-file leakage.
Generated `official_categories/` is the future folder-training root. Original
storage remains intact; exports are copies generated on request.

## Main implementation files

| Path | Responsibility |
| --- | --- |
| `SNAPTURE_ADMIN/src/index.css` | Softer shared admin surfaces, borders, destructive states, dataset grid and responsive layout. |
| `SNAPTURE_ADMIN/src/pages/ContentManager.tsx` | Owner delete button, confirmation, busy/error/success handling and list refresh. |
| `SNAPTURE_ADMIN/src/pages/DatasetManager.tsx` | Seven category counts, dated inventory, custom groups/search, review/upload dialogs, selection, Trash/restore and snapshot downloads. |
| `SNAPTURE_ADMIN/src/App.tsx`, `src/pages/Dashboard.tsx` | Protected dataset route and dashboard entry without replacing navigation. |
| `SNAPTURE_BACKEND/datasets/models.py` | Extended image metadata, stable custom groups/aliases, audit/export records and export eligibility. |
| `SNAPTURE_BACKEND/datasets/services.py` | Name normalization, consented copies, withdrawal, image decoding/checksums, binary reuse and failed-upload cleanup. |
| `SNAPTURE_BACKEND/datasets/management_views.py`, `urls.py`, `views.py` | Staff model-permission APIs, private previews, review, Trash, group changes, counts, recorded inventory and snapshots. |
| `SNAPTURE_BACKEND/datasets/exports.py` | Bounded, deduplicated, checksum-checked research export generation; official/custom separation. |
| `SNAPTURE_BACKEND/datasets/resident_views.py` | Owner-scoped contribution list and consent withdrawal after scan clearing. |
| `SNAPTURE_BACKEND/datasets/admin.py` | Read-only Django view of managed research records; no hard-delete/review bypass. |
| `SNAPTURE_BACKEND/datasets/management/commands/grant_dataset_manager.py` | Idempotent, audited dataset-only grant to an existing active CESD owner. |
| `SNAPTURE_BACKEND/datasets/management/commands/export_verified_dataset.py` | Safe new-folder official-category CLI export. |
| `SNAPTURE_BACKEND/cesd/views.py` | Owner content deletion and denial of public raw dataset media paths. |
| `SNAPTURE_BACKEND/config/urls.py` | Dataset API namespace accessible through the existing CESD client/proxy. |
| `SNAPTURE_BACKEND/predictions/review_views.py`, `scene_views.py` | Separate copy consent and proposed-name synchronization without changing inference. |
| `SNAPTURE_ANDROID/src/AssessmentScreen.tsx`, `api.ts` | Explicit review-only versus dataset-copy choice and authenticated contribution calls. |
| `SNAPTURE_ANDROID/src/ResearchContributions.tsx`, `SettingsPage.tsx` | Resident management/withdrawal of independent shared copies. |
| `SNAPTURE_BACKEND/datasets/tests.py` | Permission, consent, history, storage-failure, review, grouping, export, inventory and grant regressions. |
| `SNAPTURE_ADMIN/tests/datasets.spec.ts`, `server/seed_e2e.py` | Isolated browser fixtures and end-to-end dataset/content deletion checks. |
| `SNAPTURE_ANDROID/__tests__/ResearchConsentApi.test.ts`, `ResearchContributions.test.tsx`, `IdentifierUX.test.tsx` | Explicit consent boundaries and confirmed withdrawal tests. |

Existing account-security and management tests were updated only for the new
invalid-upload response and an unambiguous staff-card selector. No new npm or
Python packages were installed; both package lockfiles are unchanged.

## Applied database change and preservation

Applied successfully: `SNAPTURE_BACKEND/datasets/migrations/0004_shared_review_library.py`.
It adds the new metadata, indexes, conditional upload retry constraint and four
group/alias/audit/export tables. Source predictions use SET_NULL, preserving shared
copies when My Scans is cleared. Existing records receive no invented consent or
approval. Subsequent migration checks report no missing migration changes.

A consistent SQLite online backup immediately before applying the migration is:
`C:\Users\Jude\Desktop\SNAPTURE\.tools\dataset-admin\before-dataset-admin-20261026T150534Z.sqlite3`.
Keep it private and retain media backups separately. Preexisting table counts
before/after are unchanged: 2 accounts, 23 predictions, 18 scenes, 3 projects,
0 shared dataset images and 0 identification-review entries. No live account,
scan, image, content row or project was deleted during implementation.

The existing web owner received the five dataset-only model permissions via the
audited `SNAPTURE Dataset Managers` group. It remains a non-superuser without
private prediction/scene view permissions. No password or credential changed.

## Actual validation

| Check | Result |
| --- | --- |
| Django full regression suite | **269 tests passed**. Includes permission/CSRF denial, exact-ID trash, preservation of shared bytes/unrelated rows, corruption/storage/DB failure, approval gates, global normalized groups, aliases/merge, scan-clear preservation, withdrawal, official/custom export, dedup/conflict, stale export, safe CLI destination, owner-only grant and content deletion. |
| React Native unit tests | **44 suites, 202 tests passed**; live network blocked. Includes camera, assessment, notifications, schedules and authentication regressions. |
| Admin browser suite | **4 scenarios passed** in isolated Chrome/database: existing session/permission boundaries, content management, confirmed content deletion, shared-image upload/review/grouping/export/Trash/restore and narrow layout. |
| Admin TypeScript/Vite production build and Oxlint | Passed. |
| Mobile TypeScript and strict ESLint | Passed, zero lint warnings. |
| Android production JavaScript bundle | Passed; 8 assets copied to the private verification directory. This is not a fresh Gradle/APK build or physical-device test. |
| Django system/migration checks | Passed; no model changes missing migrations. |
| Live read-only checks | Backend/admin/Metro HTTP 200; unauthenticated dataset API HTTP 401. Owner summary permission check HTTP 200. Existing row counts and 33 model assets preserved. |

Tests use synthetic images, not a claim that every restored source image was
visually reviewed. Early checks found and fixed the wrapped-user upload lock,
a Windows test file handle, a browser upload selector and a staff-name selector.
The mobile component tests were corrected to target accessible controls rather
than React Native's lazy component identity. The first sandboxed browser cleanup
stalled; only its isolated servers/processes were stopped, then the suite completed
with appropriate local process permissions. Normal application servers stayed up.
The existing Metro private-feature-flag resolution warning and preexisting
test-only React act warnings remain; successful build/test results were not
fabricated or inferred from those warnings.

## Limits and next use

Refresh `http://127.0.0.1:5173/`, sign in with the existing web-owner account and
open **Dashboard → Open image datasets**. Existing Backend/Metro/Admin/Wireless
terminal commands are unchanged. The backend auto-reloaded; a second instance
was not started. No new environment variable is required.

Still requiring a real-device check: share a non-sensitive photo with the new
dataset-copy consent, confirm it appears pending in the admin, then withdraw it
from Settings. Wireless connectivity was previously verified, but this task did
not claim a fresh physical scan/consent test. Approval and export require a
qualified human reviewer and real source permission. Restore/rebuild the missing
canonical offline library separately before browsing its historical images.

No automatic semantic merging, similarity classification, training, permanent
file purge or raw dataset upload was introduced. Uploaded/shared images and export
manifests remain private; production HTTPS, hosting, storage and retention policy
still need deployment configuration. For operations, backup/migration commands
and detailed consent/export rules, see the [management guide](guides/ADMIN_DATASET_MANAGEMENT.md).
