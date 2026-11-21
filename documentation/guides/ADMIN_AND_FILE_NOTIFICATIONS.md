# Web administration and published file notifications

Updated 26 October 2026. Administration is web-only. The Android app is for
resident accounts; its administrator dashboard, scorecard viewer, administrator
client APIs and local mobile-admin provisioning command have been removed.

## Publish a file to residents

1. Sign in to the web Admin Panel at `http://127.0.0.1:5173/`.
2. Open **Educational Materials** for a PDF Guide, Infographic, or Video, or
   **Policies & Guidelines** for a policy PDF attachment.
3. Enter the title, category and description, attach the file, choose
   **Published**, then save. Uploading a **Draft** keeps it private.
4. In Android, the resident opens the notification bell on Home. The publication
   appears with its title, description, publication date and **Open attachment**.
   The same file remains available in the existing published reference library.

The existing upload validation remains in force: policy/PDF files up to 20 MB,
PNG/JPEG/WebP infographics up to 10 MB, and MP4/WebM videos up to 100 MB. Educational
materials require their attachment; a policy without an attachment remains a
library entry and does not generate a file notification.

The bell refreshes on opening, on app foreground, through its Refresh control,
and every 30 seconds while active. This is an **in-app notification feed**, not
an Android push service when the app is closed. Backend connectivity is required.
Files open in the phone's available browser/viewer. A launch error is shown and
does not mark the notification as read.

New or revised publications become unread. Read markers are stored locally per
account and API address. File IDs use their existing `cesd-policy-<id>` or
`cesd-material-<id>` identity, avoiding collisions with announcement IDs.
Changing a publication back to **Draft** removes it on the next refresh, and the
backend immediately stops serving that attachment to residents.

No synthetic post was published to this device's live database during development.
The live API had zero published file attachments at verification; publish a real
file using the steps above to populate the bell.

## Authentication and permissions

The existing CESD owner/staff login, cookies, CSRF protection, account-management
boundaries and publication access checks remain in use. The configured CESD web owner account remains active, using its existing
privately entered password. No account, password, scan or dataset was deleted.

The mobile login accepts resident accounts only. Legacy administrator profiles,
staff and superusers cannot obtain a resident session or restore a mobile admin
screen. Registration/profile requests still cannot change roles or permissions.
The database's legacy profile `admin` value remains because CESD staff records use
it; it no longer creates a mobile administration capability. No schema migration
is needed.

The mobile-only `/api/auth/admin/overview/` and
`/api/auth/admin/predictions/<id>/` routes have been removed. Research dataset and
evaluation functionality remains available through Django administration.
Their HTTP APIs now require an active Django staff **session and model
permission**, rather than a mobile bearer token/profile role:

| Endpoint | Permission |
| --- | --- |
| `GET /api/datasets/counts/` | `datasets.view_datasetimage` |
| `POST /api/datasets/upload/` | `datasets.add_datasetimage` plus a valid CSRF token |
| `GET /api/evaluations/` | `evaluations.view_evaluationrun` |
| `GET /api/evaluations/<id>/` | `evaluations.view_evaluationrun` |

A CESD owner/staff grant does not automatically give research model permissions
or access to private resident scans.

## Implementation

| File | Responsibility |
| --- | --- |
| `SNAPTURE_ANDROID/App.tsx` | Resident-only login/restore, supported mobile route list, removed admin UI/styles |
| `SNAPTURE_ANDROID/src/api.ts` | Resident response validation; removed administrator/evaluation mobile client APIs; publication metadata types |
| `SNAPTURE_ANDROID/src/localUpdates.ts` | Combine published announcements with published policy/material attachments |
| `SNAPTURE_ANDROID/src/NotificationBell.tsx` | File actions, read state, refresh and errors |
| `SNAPTURE_ANDROID/src/useContentRefresh.ts` | Optional active-app polling with background/unmount cleanup |
| `SNAPTURE_ADMIN/src/pages/ContentManager.tsx` | Explain Published versus Draft notification behavior |
| `SNAPTURE_BACKEND/accounts/views.py`, `urls.py` | Resident login; removed mobile administrator dashboard endpoints |
| `SNAPTURE_BACKEND/core/auth.py` | Resident token restrictions and model-permission-checked web sessions |
| `SNAPTURE_BACKEND/datasets/views.py`, `evaluations/views.py` | Session-based research authorization and dataset upload CSRF |
| `SNAPTURE_BACKEND/cesd/views.py` | Reused existing published learning feed and publication-checked file delivery |

Removed: mobile `AdminScorecards.tsx` and its old tests; `setup_mobile_admin`
management command; root `Setup-SnaptureAdmin.ps1`; the obsolete mobile setup guide
and commands. The existing `create_cesd_owner` command remains for a genuinely new
installation. Do not recreate the owner during daily startup.

## Validation

- Full backend suite: **249 tests passed**, including multipart web uploads,
  draft privacy, publication/revision visibility, downloads, withdrawal,
  resident-only login, web owner access, removed routes, research permissions and CSRF.
- Mobile tests run in bounded per-file processes: **39 of 41 files passed**,
  **179 test cases passed**, no failed files. The two previously observed timeouts
  remain `AutomaticCamera.test.tsx` and `CatalogProjectFlow.test.tsx`; neither is
  reported as passing.
- TypeScript and changed mobile-file ESLint passed; web admin build/lint passed.
- Android production JavaScript bundle and assets built successfully.
- Django checks passed, with no migration changes. Git whitespace checks passed.
- The live removed route returned 404; the web proxy CSRF endpoint returned 200.
  Metro serves the attachment action and no mobile dashboard component.
- Existing web-owner database access remains active; the private password was not read.

One initial parallel mobile run hit the first file-view test's 5-second timeout;
the isolated rerun passed all eight file notification cases, and the subsequent
bounded full run passed that file too. No validation rules were weakened.

Detailed evidence is under `.tools/git-updates/` in this workspace:
`resident-file-backend-tests.log`, `resident-file-mobile-all/results.json`,
`resident-file-admin-build.log`, `resident-file-bundle.log`, and
`resident-file-live-checks.json`. No new dependency, model training, model
replacement or database migration was required.
