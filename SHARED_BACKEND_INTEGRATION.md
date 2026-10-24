# Shared mobile and admin integration

Android and the CESD web panel now use the same Django service, database, and uploads. The canonical admin module is `SNAPTURE_BACKEND/cesd`; the old admin server scripts delegate to the backend. Local resident records stay in `SNAPTURE_BACKEND/db.sqlite3`.

## Start locally

From the repository root, start the API in one terminal:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py migrate
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py runserver 0.0.0.0:8000
```

In another terminal:

```powershell
Set-Location .\SNAPTURE_ADMIN
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. Sign in with the existing imported CESD owner/staff account. Android still uses `http://127.0.0.1:8000/api`; restore `adb reverse tcp:8000 tcp:8000` for a USB phone. Restart older API/Vite processes and reload the mobile app to load the new code. Run only one API process on port 8000. `npm.cmd run dev:api` is an alternative launcher using the ML Python environment.

## Existing local data

The existing isolated admin database was imported on this computer. Two staff accounts, one policy, one schedule, and 17 audit records were imported with remapped IDs and original UTC timestamps. Original resident login/profile records, 89 prediction records, 12 scan scenes, 12 scene items, and 7 projects were verified unchanged. Repeating the import was verified to avoid duplicates. The old admin database remains untouched. Backups are in the ignored `SNAPTURE_BACKEND/.local/backups` directory.

On other installations, run `manage.py import_legacy_cesd` to preview and add `--apply` to back up and import. Import before creating another owner. Conflicting identities/owners stop the import. The importer supports the former SQLite admin installation; it stops if that source has mobile activity or guidance requiring a broader migration. New admin password mail is in `SNAPTURE_BACKEND/.local/mail`; old signed setup links must be requested again.

## Connected features

| Feature | Shared route and behavior |
| --- | --- |
| Policies and learning uploads | `/api/learning/` includes Published policies/materials and existing source summaries. Drafts are excluded. |
| Attachments | `/api/cesd/files/{resource}/{id}/` checks current publication or staff access. Mobile displays infographics and opens PDFs/videos in the browser. Unpublishing revokes public attachment access. |
| Collection calendar | `/api/collection/?month=YYYY-MM` matches the resident's saved barangay, includes times/notes/cancellation, and supplies stable IDs for CESD schedules. |
| Home announcements | Staff author Draft/Published announcements in the new web page; `/api/announcements/` supplies Published entries to Home. |
| Dashboard and reports | Staff receive aggregate saved scans/items/projects from the shared database. No resident identities or scan images are included. |
| Scan/project flow | Existing authentication, scene, prediction, project, restart, and step APIs remain available. Saved projects retain their instruction snapshots. |

Content reloads on screen entry, foreground return, and manual refresh. Changes are fetched; push notifications and real-time subscriptions were not added. Educational uploads do not change ML classes or decision rules. The existing guidance review/publish workflow remains at Django `/admin/` for users with appropriate permissions. Retraining remains a separate ML operation.

Mobile activity counts select scans/projects by creation date. Project active/completed counts reflect current steps, including later changes. Scans count saved scenes plus standalone predictions; items count saved predictions. Deleted records are excluded. These are current saved-record summaries, not historical activity events.

## Compatibility-test handoff

Existing test assertions were left unchanged. `cesd` test files moved with their module into the backend. Test infrastructure now isolates Playwright's API at port 8001 and its frontend at port 5174, with a separate database/media/mail directory. It will not reuse a normal Vite server connected to live local data.

The current dashboard tests have two methods needing updated expectations: `test_defaults_empty_validation_and_permissions` and `test_month_lengths_and_exact_local_boundaries`. Their exact `counts` comparisons omit the new `announcements` key (six reported assertion failures including month subtests). Dashboard draft totals now also include announcement drafts. Reports include announcements and `mobile_activity`; dashboard also returns `mobile_activity`.

Checks performed: Django system/migration checks, web production build/lint, Android TypeScript, selected mobile tests including `CatalogProjectFlow`, existing CESD/content/project backend tests, all 12 photo-privacy tests, and a rolled-back API smoke check for publication/unpublication, attachment ranges/access, barangay schedules/cancellations, permissions, aggregates, and project access. The broader compatibility suite and physical-device/browser acceptance remain for follow-up.

For acceptance, publish and edit each content type in the web panel, refresh mobile, verify draft/unpublished records disappear, open PDF/image/video attachments on the phone, change barangay/month, cancel a schedule, and complete/restart a project while checking admin aggregates. Verify separate resident/staff permissions and empty/offline states.
