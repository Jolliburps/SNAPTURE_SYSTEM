# SNAPTURE Admin

React + TypeScript + Vite administration for CESD personnel. Policies, materials, schedules, reports, and Settings use a persistent Django API.

## Shared backend integration

Normal development now uses the **same API on port 8000, database, and media folder as Android**. The canonical CESD module is `SNAPTURE_BACKEND/cesd`. `server/admin_config` is a compatibility launcher; only browser-test settings use an isolated database.

Start one API process using either `SNAPTURE_BACKEND/manage.py runserver 0.0.0.0:8000` or `npm.cmd run dev:api` here. Start the web frontend with `npm.cmd run dev` and open `http://127.0.0.1:5173`. Do not run both API launchers simultaneously. Vite proxies `/api` to port 8000; `SNAPTURE_API_PROXY` can override the target for isolated testing.

Run migrations before starting. For an earlier isolated admin installation, run these from the repository root **before creating another owner**:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py migrate
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd --apply
```

The first import previews the source. `--apply` backs up both SQLite databases and media folders under `SNAPTURE_BACKEND/.local/backups`, remaps IDs, and imports staff/password hashes/content/audit timestamps. An import ledger prevents duplicates when repeated. Existing resident accounts, tokens, scans, and projects remain in place. Identity conflicts or an existing different owner stop the import. The source remains untouched. If an old isolated database contains mobile scans/projects or guidance, the importer stops instead of silently omitting them. MySQL targets require a separate database migration after the local import. Back up the backend database/media before applying migrations on other installations.

Sign in again after importing staff. Existing passwords work; setup/reset links signed by the old service need to be requested again. Shared data lives in `SNAPTURE_BACKEND/db.sqlite3`, uploads in `SNAPTURE_BACKEND/media`, and development password mail in `SNAPTURE_BACKEND/.local/mail`.

Published policies/materials appear in the mobile reference library, including infographic display and browser links for PDFs/videos. Published Announcements appear on Home. Schedules match the resident's saved barangay/month and include cancellations. These screens fetch on entry, foreground return, and explicit refresh; there are no push notifications.

Dashboard and Reports include aggregate saved scan/item/project counts without resident identities or photos. Projects are selected by creation date and classified by current progress. Deleted records are excluded. Educational uploads do not change classifier classes or assessment rules. Reviewed guidance remains managed at Django `/admin/` by users with the appropriate model/review permissions. Existing projects retain their instruction snapshots.

## First-time setup and daily startup

Use Node.js 22.12 or newer, Python 3.13, and keep the sibling backend and ML folders. From `SNAPTURE_ADMIN`:

```powershell
npm.cmd ci
py -3.13 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r .\server\requirements.txt
npm.cmd run db:migrate
# Only if no owner was imported or previously created:
npm.cmd run owner:create
```

For mobile inference, also install the ML requirements as described in the root README. The smaller admin requirements support content management but do not install the complete classifier runtime. Both launchers use the same settings and database; use the ML Python environment to run the shared API when testing image analysis.

For daily work, start the shared API in one terminal and `npm.cmd run dev` in another. Keep Android's USB mapping as `adb reverse tcp:8000 tcp:8000`. Restart API/Vite processes started before this integration. A blank API root is normal; test `/api/cesd/csrf/` or `/api/materials/` instead.

Sign in with the imported owner's credentials or those entered during owner creation. There are no default credentials. Owners create staff in **Settings → Staff Access**. New staff use individual setup links from the development mail files in `SNAPTURE_BACKEND/.local/mail`; links expire after 24 hours. No external mail provider is configured. Staff can manage content and schedules; only the owner manages staff and views the audit log.

The web navigation is Dashboard, Policies & Guidelines, Educational Materials, Announcements, Collection Schedule, Reports, Settings. Published content is resident-visible; drafts are staff-only. PDF uploads allow 20 MB, infographics 10 MB, and videos 100 MB. Video uploads validate container signatures without transcoding.

## Verification

```powershell
npm.cmd run lint
npm.cmd run build
npm.cmd run test:server
npm.cmd run test:ui
```

The browser suite uses installed Google Chrome through Playwright. If Chrome is unavailable, change the channel in `playwright.config.ts` to your installed supported browser. `test:ui` seeds **only** `.local/e2e.sqlite3`, generates random local credentials, and launches isolated API/frontend servers on ports 8001 and 5174. It resets that synthetic database on every run; it never resets the normal development database or reuses the normal Vite server. Both test ports must be free. Screenshots are saved in `.local/screenshots`, CSV evidence in `.local/e2e-export.csv`, and failure traces in `test-results`.

Server tests cover authentication/CSRF, owner/staff restrictions, password setup and replay rejection, deactivation/session revocation, resident/owner protection, profile changes, CRUD/filtering/pagination, publication visibility, upload validation/replacement/private files, byte ranges, barangay/date/time validation, mobile response contracts, report counts, and safe CSV output. Browser checks cover complete owner/staff workflows, refresh persistence, previews, uploads/replacement, downloads, and responsive navigation. Desktop screenshots are compared visually with the supplied reference.

`npm.cmd run build` produces `dist/`. `npm.cmd run preview` previews only the built frontend; it is not a replacement for the API or a deployment setup.
