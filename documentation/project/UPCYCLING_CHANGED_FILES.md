# Upcycling implementation file changes

## Modified existing files

- `SNAPTURE_ANDROID/App.tsx`
- `SNAPTURE_ANDROID/__tests__/AutomaticCamera.test.tsx`
- `SNAPTURE_ANDROID/__tests__/SceneResults.test.tsx`
- `SNAPTURE_ANDROID/src/MainExperience.tsx`
- `SNAPTURE_ANDROID/src/ProjectGuide.tsx`
- `SNAPTURE_ANDROID/src/ProjectPanels.tsx`
- `SNAPTURE_ANDROID/src/SavedScanReview.tsx`
- `SNAPTURE_ANDROID/src/SceneResults.tsx`
- `SNAPTURE_ANDROID/src/api.ts`
- `SNAPTURE_BACKEND/config/settings.py`
- `SNAPTURE_BACKEND/config/urls.py`
- `SNAPTURE_BACKEND/core/assessment.py`
- `SNAPTURE_BACKEND/predictions/project_views.py`
- `SNAPTURE_BACKEND/predictions/scene_views.py`
- `SNAPTURE_BACKEND/predictions/views.py`

## Added implementation files

- `SNAPTURE_ANDROID/__tests__/PhotoProjectGuide.test.tsx`
- `SNAPTURE_ANDROID/__tests__/ScanResult.test.tsx`
- `SNAPTURE_ANDROID/__tests__/ScanSession.test.tsx`
- `SNAPTURE_ANDROID/__tests__/SuitabilityProjects.test.tsx`
- `SNAPTURE_ANDROID/__tests__/UpcyclingHub.test.tsx`
- `SNAPTURE_ANDROID/src/PhotoProjectGuide.tsx`
- `SNAPTURE_ANDROID/src/ScanResult.tsx`
- `SNAPTURE_ANDROID/src/ScanSession.tsx`
- `SNAPTURE_ANDROID/src/SuitabilityProjects.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingHub.tsx`
- `SNAPTURE_ANDROID/src/UpcyclingUI.tsx`
- `SNAPTURE_ANDROID/src/upcyclingApi.ts`
- `SNAPTURE_BACKEND/upcycling/__init__.py`
- `SNAPTURE_BACKEND/upcycling/admin.py`
- `SNAPTURE_BACKEND/upcycling/assessment.py`
- `SNAPTURE_BACKEND/upcycling/management/__init__.py`
- `SNAPTURE_BACKEND/upcycling/management/commands/__init__.py`
- `SNAPTURE_BACKEND/upcycling/management/commands/prepare_project_requirements.py`
- `SNAPTURE_BACKEND/upcycling/matching.py`
- `SNAPTURE_BACKEND/upcycling/migrations/0001_suitability_inventory_photo_projects_community.py`
- `SNAPTURE_BACKEND/upcycling/migrations/0002_add_top_view.py`
- `SNAPTURE_BACKEND/upcycling/migrations/__init__.py`
- `SNAPTURE_BACKEND/upcycling/models.py`
- `SNAPTURE_BACKEND/upcycling/scan_sessions.py`
- `SNAPTURE_BACKEND/upcycling/test_sessions.py`
- `SNAPTURE_BACKEND/upcycling/tests.py`
- `SNAPTURE_BACKEND/upcycling/urls.py`
- `SNAPTURE_BACKEND/upcycling/views.py`
- `documentation/project/MULTIVIEW_SCAN_UI.md`
- `documentation/project/UPCYCLING_CHANGED_FILES.md`
- `documentation/project/UPCYCLING_UPGRADE.md`
- `documentation/project/UPCYCLING_VALIDATION.md`
- `tools/report_upcycling_trials.py`

## Recovery

Run RESTORE_BEFORE_UPCYCLING.ps1 with -Preview before restoring. It preserves the database and uploaded photos and archives current source.
