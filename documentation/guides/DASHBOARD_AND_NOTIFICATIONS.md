# Dashboard notifications and collection schedules

For the current file-upload notification behavior and web-only administration,
see [Web administration and file notifications](ADMIN_AND_FILE_NOTIFICATIONS.md).
The validation and inspection figures below record the earlier dashboard task.

Implemented on 26 October 2026 using the existing mobile screen-state router,
CESD publications, saved profile, green/mint palette, Lucide icons and AsyncStorage.
No dependency installation, schema migration, model training or live content
seeding is required by these changes.

## Behavior

- Home's Local Updates section is replaced by a bell beside the profile avatar.
  The bell opens a modal with announcement and published file titles, messages,
  publication dates, file-opening actions, read/unread controls, refresh and
  empty/offline states. Published policy/material attachments join announcements;
  draft files remain excluded. See [file publishing](ADMIN_AND_FILE_NOTIFICATIONS.md).
- Read markers are local to this device and scoped by API address and account ID.
  Only publication IDs/revision timestamps are stored, not notification text.
  Edited publications become unread through the existing record's `updated_at`.
  Clearing application data removes these local markers. No push service or
  server-side read-state synchronization was introduced.
- The existing search bar and its results appear above Collection Schedule.
  Collection Schedule is a full-width card near the top of Home. It shows the
  saved barangay, browsable month, available waste-category filters and up to
  three upcoming entries (or earlier entries when none remain in that month).
  Entries retain their dates, times, instructions, status, cancellation and source.
- The existing calendar uses the same lookup/entry components and marks days
  containing records. The dashboard has one calendar entry point.
- Change/Choose barangay opens the existing Profile/Settings editor. Its existing
  successful profile save updates Home and the calendar. Unsaved selections do
  not change the lookup. Stale responses and records for another barangay are
  excluded. Matching is exact after whitespace/case normalization; `Talaba`
  does not borrow schedules from `Talaba 1`, `Talaba 2`, etc.
- The only `Everyday practices` entry was in the Learn topic list. That entry
  was removed; the five other topics and the CESD reference library/publications
  were preserved. No shared guidance or source records were deleted.
- Home's CESD Library card and its empty Resources heading were removed. The
  existing library remains accessible from Learn → Published policies and materials.

## Existing data sources and accuracy

`GET /api/announcements/` exposes Published CESD `Announcement` records. Drafts
remain excluded. Its new optional `updatedAt` field identifies revisions.

Authenticated `GET /api/collection/?month=YYYY-MM` uses the **saved profile**
barangay, not a client-supplied barangay override. It combines:

1. `cesd.Schedule`: dated records maintained by authorized staff through the web
   admin/Django admin, including waste type, start/end time, notes and status.
   New additive response fields expose those existing values separately as
   `waste_type`, `start_time`, `end_time` and `instructions`; the old response
   fields remain available.
2. `core.CollectionNotice`: existing reviewed/published, digest-verified notices.
   Their publication checks and original source descriptions remain unchanged.
   Missing structured categories/times are explicitly labelled unspecified;
   the UI does not infer them from a broad waste label or neighboring barangay.

At inspection, this device's database contained **zero CESD schedules, zero
published collection notices and zero published announcements**. Consequently,
no collection schedule for **any barangay**, including Habay 1 or the Talaba
barangays, was verified or populated during this task. No dates, recurring days,
times or waste categories were invented. The visible fallback is “No verified
schedule available”; an unreachable API gets a separate error/retry message.

Authorized staff should enter confirmed dated schedules and announcements using
the existing management interfaces. Retain the underlying official/authorized
source and enter each barangay separately. A missing CESD owner account must be
created using the existing `create_cesd_owner` management command before staff
can sign in. No account/password was created by this UI task.

## Files

Modified:

- `SNAPTURE_ANDROID/src/MainExperience.tsx`: Home layout, bell/card integration,
  calendar integration and removal of the one Learn topic.
- `SNAPTURE_ANDROID/src/api.ts`: additive announcement/collection response types.
- `SNAPTURE_BACKEND/cesd/views.py`: additive public revision/schedule fields and
  consistent whitespace handling of the saved barangay.
- `SNAPTURE_ANDROID/__tests__/LearnHierarchy.test.tsx`: checks that the specified
  topic is absent while other topics and reference navigation remain available.

Added:

- `SNAPTURE_ANDROID/src/NotificationBell.tsx`: bell, modal and persistent local
  read state, including account isolation and storage-error handling.
- `SNAPTURE_ANDROID/src/useCollectionSchedule.ts`: shared authenticated month /
  barangay lookup, refresh, filters and stale-response protection.
- `SNAPTURE_ANDROID/src/CollectionSchedule.tsx`: dashboard card and shared
  availability, month/category and schedule-entry components.
- `SNAPTURE_ANDROID/__tests__/DashboardNotifications.test.tsx` and
  `DashboardSchedule.test.tsx`: state, persistence, errors, lookup and complete
  settings-save/navigation regression coverage using synthetic fixtures.
- `SNAPTURE_BACKEND/cesd/test_mobile_dashboard.py`: isolated database tests for
  structured records, profile PATCH, exact barangay boundaries, cancelled/month
  filtering and publication revision/withdrawal behavior.
- This document.

## Validation

- TypeScript `tsc --noEmit`: passed.
- ESLint on all modified/new mobile source and test files: zero errors/warnings.
- Focused mobile suite: **21 tests passed across six files**, including the full
  Habay 1 → Settings → save Talaba 1 → Home → calendar journey.
- All mobile test files checked individually: **35/37 files passed, 148 test
  cases passed, no assertion failures**. `AutomaticCamera.test.tsx` and
  `CatalogProjectFlow.test.tsx` reached the 45-second diagnostic limit, matching
  the two timeouts recorded before this change. Full mobile-suite success is
  not claimed and their assertions were not bypassed.
- Full Django suite: **242 tests passed**, using its isolated test database.
- Android production JavaScript bundle: built successfully, with eight assets
  copied outside the repository to `.tools/dashboard-build/`. No release APK
  was generated or installed by this check. The existing React Native private
  featureflags export-fallback warning remains; no new bundle errors occurred.
- `git diff --check`: passed.
- Physical TECNO check: the updated Home card correctly showed the saved
  Habay 1 and its no-published-schedule fallback. The bell opened the real empty
  notification panel. The USB development connection was restored without
  clearing application data. Read badges and populated schedules were tested
  with synthetic fixtures, not by inserting unverified content into live data.

Detailed logs are under the workspace `.tools/git-updates/dashboard-*.log` and
`.tools/dashboard-build/regression-tests/`. Fixtures were not inserted into the
normal database. Native dependencies and the existing startup commands are
unchanged. Camera, model artifacts, assessment, recommendations, authentication
and history source files were not modified.
