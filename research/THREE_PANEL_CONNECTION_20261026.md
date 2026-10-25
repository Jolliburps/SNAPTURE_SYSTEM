# Shared user / CESD web / Django administration — 2026-10-26

## Scope and existing architecture

All three interfaces use `SNAPTURE_BACKEND/config/settings.py`, the existing
`db.sqlite3` and media folder. They do not need three databases or duplicated
tables. The old admin settings are compatibility entry points to that same
backend. The browser test environment deliberately remains separate.

## Gaps addressed

- Registered CESD policies, educational materials, announcements and collection
  schedules in Django admin. Use the exact forms and upload/time validation
  already used by the web API. Saves set the current editor, preserve publication
  timestamp semantics and add entries to the same CESD audit log.
- Django attachment widgets use the protected publication-aware download API,
  not an inaccessible raw media URL. Technical users with the relevant Django
  model-view permission can preview drafts; anonymous visitors still cannot.
- Registered photo scenes, scene items and projects as permission-restricted,
  read-only Django views. No automatic CESD access to residents' private records;
  no progress editing or deletion from these new views.
- Owner-only staff-access/audit views are read-only. Staff creation, password
  setup, deactivation and owner protection stay in the existing web workflow.
- Added `GET /api/cesd/integration/` for authenticated CESD staff. It performs a
  real database query and returns non-identifying content/activity totals,
  registered model names and a Django admin link. No credentials, database path,
  resident identities or scan images are returned.
- Added a theme-consistent Connected system card in web Settings with explicit
  refresh, error feedback and a link to Django admin. Failed checks clear stale
  success state.
- Proxy Django admin, its static assets and existing protected media through
  Vite to the shared backend. Web and Django admin share the existing session
  cookie and CSRF protection on the same origin. Django's View site link returns
  to the configured web panel. Production hosting needs equivalent routing.
- Admin scripts and isolated browser tests now use the existing ML Python
  environment instead of referring to a missing second virtual environment.
- Browser testing exposed a real deferred SQLite read-to-write lock upgrade
  during simultaneous admin/background requests. Configure a 20-second timeout
  and IMMEDIATE atomic transactions, also in the isolated browser database.
  This mitigates the tested collision; it does not make SQLite an unlimited
  multi-writer production database. See Django 5.2 database documentation:
  https://docs.djangoproject.com/en/5.2/ref/databases/#transactions-behavior

## End-to-end data paths

| Staff operation | Resident result |
| --- | --- |
| Publish/withdraw a policy or material in either panel | Added/removed in `/api/learning/`; draft attachments remain protected |
| Publish/withdraw an announcement | Added/removed from Home's `/api/announcements/` feed |
| Add/edit/cancel a schedule | Updated in `/api/collection/` for the resident's saved barangay/month |
| User saves a scan or starts/completes a project | Shared database record and aggregate CESD dashboard/report totals |
| Authorized technical inspection in Django admin | Same saved scene/item/project, not a copied or separately editable record |

Publishing educational content does not train the detector, change model
classes or approve a decision rule. Existing recommendation rule review and
publication still require the separate `core.review_guidance` permission.
Existing started projects keep their instruction snapshots. Mobile content is
fetched on screen entry/foreground/manual refresh, not pushed instantly.

## Validation

- All 239 backend tests pass. Eight new integration tests exercise shared login,
  two-way content edits, publication/withdrawal, announcement visibility,
  upload validation/protected previews, barangay schedules/cancellations,
  private-record permissions, user project completion and shared aggregates.
- Both browser suites pass against isolated ports 8001/5174: existing complete
  CESD workflow plus shared-session/admin/static routing, privacy restrictions,
  connection error/retry and responsive layout.
- Updated stale dashboard/announcement test expectations and web navigation
  count to match the already-existing announcement feature; no production
  functionality was removed to satisfy tests.
- Web production build and lint pass. Django system checks and migration checks
  pass; no schema/data migration is required.
- All 146 mobile tests in 35 suites pass without Android source changes.
- Inspected browser screenshots for Django administration and the connection
  card at phone width. Browser fixtures never use the normal local database.
- Restarted the normal API on port 8000. Read-only local verification confirms
  the shared SQLite connection with IMMEDIATE transactions, registered content
  and project models, and existing scene 41's three fabric ideas. Vite on 5173
  serves the API and Django admin/static routes. The connected physical phone
  retains its USB forwarding to port 8000; no reinstall is needed for this change.

No resident data migration, deletion, permission-grant script, model training,
dataset change or GitHub push is part of this request. Existing unrelated
working-tree changes were preserved.
