# SNAPTURE historical Android and shared mobile assessment

Date of original work: 4 November 2026, Asia/Manila. This retained record covers Android and shared application work on an unfinished application. The results below are historical evidence reported in the supplied archive, not validation of the current cleanup.

## Architecture assessment

The repository contains one React Native CLI 0.87.1 / React 19.2.3 / TypeScript mobile app in `SNAPTURE_ANDROID`, a shared Django backend, a React web admin and the ML code/model assets. It is not an Expo Go application. The mobile entrypoint registers `SNAPTURE_ANDROID`; Android uses that module and the shared `App.tsx`/`src/` implementation. No second app was created and no existing unfinished screen was removed.

Navigation uses existing typed screen state and explicit back/close controls rather than a third-party navigator. Material assessment, recommendation gates, scene/history IDs, project progress and content APIs remain shared. API tokens, notification read state and the dated schedule cache use existing AsyncStorage scopes. Private scan images, saved assessments and project steps remain server records. Django uses its existing SQLite database by default, with optional MySQL configuration; neither schema nor stored records/images were changed here.

The audit covered the mobile screens and Android native files, installed package metadata, shared API/authentication/storage modules, Android development helpers, Django API/database integration, and the current admin/ML boundaries. The installed checkpoint is experimental; this task did not replace, retrain or validate it. The earlier cancelled waste-classification update remains reverted.

## Existing feature status

“Fully implemented” below means the named existing shared code path is present and covered by applicable automated checks. It does not certify native device behavior or make the whole product complete.

| Feature | Status | Assessment and continuing work |
| --- | --- | --- |
| API transport, resident session validation, email/password login/register/logout | 1 — Fully implemented shared paths | Existing error, timeout, role and session tests retained. Platform-specific connection guidance added. Native persistence and live credential tests remain pending. |
| Project lists, steps, saved ideas, restart/change-idea gates | 1 — Fully implemented shared paths | Existing server-backed flow and tests retained; no replacement logic or navigation structure. |
| Barangay/content lookup, in-app update/read state, dated schedule fallback | 1 — Fully implemented shared paths | Foreground/polling feed and limited cache behavior preserved. No claim of background push or general offline operation. |
| Camera, image selection/upload and native thumbnail | 4 — Platform adjustments implemented | JPEG capture, compatible picker representation, URI/MIME handling, foreground/picker session gating, camera-free fallback and platform-safe controls prepared. Permissions, image conversion, orientation and camera interruption still need device testing. Latest-photo discovery remains an Android-specific optional preview. |
| Native storage bridge and application layout | 4 — Platform adjustments implemented | Shared storage semantics preserved. Root keyboard avoidance and modal safe areas added, and the marking dialog can scroll. Actual small-screen and native keyboard checks remain pending. |
| External reference/file opening and profile picture | 4 — Platform adjustments implemented | Shared Linking/API paths retained; profile picker and multipart uploads use compatible local images. Test browser handoff, selected photo permissions and native file handling on device. |
| Recognition, recommendation validity and local acceptance | 2 — Partially implemented/validation dependent | Existing model and evidence/safety gates retained. Experimental model performance and local guidance still need project validation; no new recognition results or approvals were fabricated. |
| Password-reset delivery | 2 — Environment dependent | Existing request/confirm flow remains; development reset-code behavior is not proof of production email delivery. |
| Google sign-in, operating-system background push, video project instructions, offline detection/write queue | 3 — Not implemented | Existing unavailable/limited behavior remains honest. No placeholder was presented as a working feature. Future implementations require Android validation. |

## Implemented changes

* Preserved one shared application and the existing Android native configuration. Existing UI colors, typography, icons and navigation remain; only compatibility-related layout and messages changed.
* Added optional platform API URL overrides while retaining the current Android default. All configured URLs are validated, including all production overrides. Android helper probes select the Android override. API-origin token/cache separation remains intact.
* Added shared picker/upload helpers: compatible image representation, no extra EXIF request, JPEG camera output, supported MIME preservation, cached file URI and Android content URI handling, and clear rejection of unresolved/unsupported photo sources.
* Paused the camera when the app is inactive or the gallery is open. Resuming waits for session readiness and resets torch state for reapplication. A completed capture cannot navigate after the camera screen unmounts. Devices without a camera retain photo selection/manual assessment.
* Added root keyboard avoidance, safe areas inside native modal surfaces and scrollability for the marking dialog without changing photo-coordinate calculations. Corrected remaining Android-specific camera wording. Corrected the privacy-preview notice to describe the existing server-side processing.
* Introduced static readiness and JavaScript bundle checks. These checks now target Android. The original work aligned Node engine metadata with the installed React Native package; no runtime dependency upgrade was part of that work.

## Dependencies and platform configuration

Installed native modules inspected: AsyncStorage 3.1.1, image-picker 8.2.1, Nitro Image 0.15.2, Nitro Modules 0.37.1, safe-area-context 5.10.0, SVG 15.15.5 and VisionCamera 5.2.3. These installed versions were recorded during the original work; installed package metadata alone does not certify a native build.

Node 22.23.4 satisfies the installed RN engine range. Android SDK/Gradle/NDK settings, application ID, manifest and native source were preserved.

## Historical verification results (4 November 2026)

| Check | Result and boundary |
| --- | --- |
| Android native build | **Passed:** `:app:assembleDebug --offline --no-daemon --max-workers=2 -PreactNativeArchitectures=arm64-v8a`. Gradle reported BUILD SUCCESSFUL. APK: `SNAPTURE_ANDROID/android/app/build/outputs/apk/debug/app-debug.apk`. This is a debug/Metro build, not a production release. No device was reinstalled or reset. |
| Shared Jest tests | **Passed:** 48 suites / 237 tests, using the full existing run and latest affected-suite reruns. Includes platform connection behavior, image descriptors, gallery controls, camera background/resume/picker behavior and existing authentication, history, content and project flows. Native modules/API responses are mocked where appropriate. |
| Developer tooling tests | **Passed:** 10 tests, including preserved Android helpers, platform URL selection, production validation and readiness-check behavior. |
| TypeScript and changed-file ESLint | **Passed:** no TypeScript errors and no lint errors in changed application/test/tooling code. |
| Android JavaScript/assets | **Passed in the original report:** Android bundle resolved with eight assets. This is not a native compile. |
| Static readiness | The original readiness count included checks for a retired native target. Use the current Android checks for this cleanup; no historic count is a current result. |
| Django/database | **Passed:** Django system check; read-only SQLite connectivity; temporary local HTTP materials endpoint returned the seven existing material guides; unauthenticated private scan endpoint returned HTTP 401. The temporary server was stopped; no users/scans/images were created or changed. |
| Cold ML health request | **Unresolved existing runtime check:** a temporary-server `/api/health/` request timed out after 45 seconds during cold model initialization. It was not converted into a claimed success or a recognition result. Investigate startup latency separately before a live end-to-end scan demonstration. Backend/model source was unchanged. |
| Native visual/device acceptance | **Pending:** actual Android camera, permissions, keyboard, small/notched displays, network route and restart/persistence matrix. Automated render tests are not a physical-device review. |

Existing nonblocking warnings remain: Metro falls back when an installed package imports React Native's private FeatureFlags path, and Gradle reports deprecated features for a future Gradle 10 migration. Neither was a dependency upgrade undertaken by this change.

## Remaining work

Use the [Android development guide](guides/CROSS_PLATFORM_MOBILE.md) and run its device acceptance matrix. Before distribution, configure production HTTPS and review Android signing and privacy behavior.

Continue unfinished Android features using this codebase. Add Android checks to each feature's acceptance criteria; keep model/local-guidance validation separate from native compatibility.

## Files changed

The Android/shared file list below records the earlier work, not the current cleanup. The original report referenced source snapshots and a review patch that are not included in this archive.

### Modified during the earlier work (Android/shared)

- `SNAPTURE_ANDROID/__tests__/AuthNetwork.test.ts`
- `SNAPTURE_ANDROID/__tests__/AutomaticCamera.test.tsx`
- `SNAPTURE_ANDROID/__tests__/NetworkReliability.test.ts`
- `SNAPTURE_ANDROID/App.tsx`
- `SNAPTURE_ANDROID/package-lock.json`
- `SNAPTURE_ANDROID/package.json`
- `SNAPTURE_ANDROID/README.md`
- `SNAPTURE_ANDROID/scripts/android-dev.cjs`
- `SNAPTURE_ANDROID/scripts/configure-api.cjs`
- `SNAPTURE_ANDROID/src/api.ts`
- `SNAPTURE_ANDROID/src/apiEnvironment.ts`
- `SNAPTURE_ANDROID/src/BarangayPickerModal.tsx`
- `SNAPTURE_ANDROID/src/GalleryThumbnail.tsx`
- `SNAPTURE_ANDROID/src/MainExperience.tsx`
- `SNAPTURE_ANDROID/src/MarkObjectModal.tsx`
- `SNAPTURE_ANDROID/src/NotificationBell.tsx`
- `SNAPTURE_ANDROID/src/PrivatePhotoPreview.tsx`
- `SNAPTURE_ANDROID/src/ProjectPanels.tsx`
- `SNAPTURE_ANDROID/src/SettingsPage.tsx`
- `SNAPTURE_ANDROID/src/SuccessAlertDialog.tsx`

### Created during the earlier work (Android/shared)

- `documentation/CROSS_PLATFORM_DEVELOPMENT_REPORT.md`
- `documentation/guides/CROSS_PLATFORM_MOBILE.md`
- `SNAPTURE_ANDROID/__tests__/CrossPlatformEnvironment.test.ts`
- `SNAPTURE_ANDROID/__tests__/CrossPlatformUploads.test.ts`
- `SNAPTURE_ANDROID/__tests__/GalleryPlatform.test.tsx`
- `SNAPTURE_ANDROID/__tests__/MobileMedia.test.ts`
- `SNAPTURE_ANDROID/scripts/check-bundles.cjs`
- `SNAPTURE_ANDROID/scripts/mobile-doctor.cjs`
- `SNAPTURE_ANDROID/scripts/tests/cross-platform-tools.test.cjs`
- `SNAPTURE_ANDROID/src/mobileMedia.ts`

