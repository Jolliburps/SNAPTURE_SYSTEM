# Automatic face blur disabled

18 November 2026. Implemented at the user's explicit request.

New photo previews, saved scene/item images, classifier scan images and served
scan images no longer receive automatic face blurring. Existing blurred image
files are not rewritten: removed image detail cannot be reconstructed from them.
Take a new photo for an unblurred result.

## Changes

- `SNAPTURE_BACKEND/config/settings.py`: `SNAPTURE_FACE_BLUR_ENABLED = False`.
- `predictions/photo_privacy.py`: `display_copy` keeps image detail in the default
  mode. The existing redaction utility remains available for explicit legacy-mode
  tests/recovery. Responses/cache keys identify the new mode as `unblurred-v1`.
  Images still receive EXIF orientation correction and JPEG conversion without
  original EXIF/GPS metadata. Existing file-path validation, image-size checks,
  preview authentication, media routing and private/no-store headers remain.
- `predictions/scene_views.py`: framing uses `faces_detected` separately from
  `faces_blurred`, retaining the existing face-presence input to item checks.
  Face detection no longer edits displayed/saved pixels. If face detection is
  unavailable, it does not hide an otherwise usable photo in the disabled mode.
- `SNAPTURE_ANDROID/src/api.ts`: scan image URLs use a new cache suffix to avoid
  retaining earlier blurred HTTP responses. Existing stored blurred bytes still
  remain blurred.
- `src/PrivatePhotoPreview.tsx` and `src/SceneResults.tsx`: neutral preview/loading/
  error wording; removed the claim that faces are blurred. Preview requests still
  use the existing authenticated endpoint and do not persist images themselves.
- Tests: retained the old redaction assertions under an explicit enabled-mode
  override; added disabled-mode pixel detail, metadata, saved scan, authentication,
  detector-failure and existing media-handler checks. No assertions about the
  optional enabled mode were weakened.

No database/schema changes, model changes, historical image rewrites, data reset,
APK rebuild or reinstall was performed.

## Validation

| Command/check | Actual result |
| --- | --- |
| `& .\SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_BACKEND/manage.py test predictions.test_photo_privacy predictions.test_single_item_frame --noinput --verbosity 1` | 26 passed, isolated test database. |
| Jest `--runInBand PrivatePhotoPreview CaptureGuide SceneResults --testTimeout=15000` | 14 passed, one existing CaptureGuide failure. |
| CaptureGuide baseline check with backed-up pre-change source in a separate temporary workspace | Same `single-item results cannot add more regions or select multiple items` test fails because its expected selection control is absent. Not changed as part of blur removal. |
| `tsc --noEmit` | Passed. |
| ESLint on changed Android files/test | Zero errors; one pre-existing inline-style warning in SceneResults. |
| Metro Android bundle request | HTTP 200. |
| Native device photo inspection after this change | Not performed; no new resident photo submitted by this task. |

The backend's development autoreloader picks up the setting/code changes. Reload
the existing debug app to use the updated JavaScript cache suffix and wording;
keep backend/Metro and existing phone forwarding active. Fresh photos will retain
their visible faces rather than being automatically obscured.

## Recovery

Setting `SNAPTURE_FACE_BLUR_ENABLED` back to `True` re-enables the retained blur
path for future processing/served responses. This does not rewrite saved images.
For selective source recovery, compare only this task's changes against
`SNAPTURE_BACKEND/.local/before-face-blur-removal/`, preserving later edits and all
other work. No recovery was run. Earlier privacy documentation describes the old
default behavior; this report supersedes it for the present local configuration.
