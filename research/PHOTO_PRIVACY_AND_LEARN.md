# Learn navigation and scan-photo privacy — 2026-10-21

## Navigation

Learn opens the existing six topic cards first, using unchanged icons and content.
The existing CESDLearning component is now opened through one Resources card at
the bottom of Home. Its Home Back action and Android Back return Home. Waste
materials remain unchanged; there is no second library entry there.

## Privacy processing

- `POST /api/photo-privacy/preview/` is authenticated. It uses local OpenCV YuNet
  to detect faces and returns only an in-memory, face-redacted JPEG data URI.
  No preview file or scan record is created by this endpoint.
- The capture-review screen displays a neutral placeholder while this runs; it
  never binds the original camera/cache URI to an Image. Retry is available.
  Privacy failure still permits analysis without a visible preview.
- Waste inference receives the original EXIF-oriented pixels in memory. Its
  model, class logic, boxes and inference input are unchanged. Only redacted
  full images and redacted crops are written into new scan media records.
- If redaction fails, item results are retained, but image fields stay empty.
  The server does not persist unprotected images as a fallback. Django may use
  internal temporary upload files for large requests; these are not media files.
- Legacy `/media/scenes/...` and `/media/predictions/...` paths are handled by a
  fail-closed redacting image view before static media routing. Old filesystem
  originals are not rewritten or deleted; those URLs serve protected copies.
  Scan image URLs get a `privacy=face-v1` cache-busting parameter in the app.
  JPEG output removes original EXIF/GPS metadata. Profile photos are unaffected.
- The public preview/history crop URLs retain their existing random-path access
  model. This change is not authenticated-media authorization or a complete
  privacy/security audit.

## Deployment and limits

The model and MIT license are in `SNAPTURE_ML/models/privacy/`. Its pinned hash
and upstream source are documented there. Install requirements-detection.txt.
No paid API, external image upload, identity recognition or training is involved.

**Production hosting must route the two scan-media prefixes through Django's
protected_media view. Do not serve them with a direct Nginx/CDN MEDIA_ROOT alias.**
Do not publish raw media folders or diagnostic originals. This local development
server routes them correctly regardless of DEBUG. The development server is not
a production deployment.

Face detection can miss small, occluded, angled or unfamiliar faces. The UI warns
users to inspect the preview and retake if necessary. Blurring reduces visual
identifiability; it does not guarantee anonymization or remove identifying
clothing/background context. Classifier input is unchanged, but a waste object
overlapping a face-redaction rectangle may be obscured in the displayed photo.

## Verification

- Unit/API checks: multiple regions, unchanged no-face pixels, partial-face bounds,
  invalid coordinates, EXIF rotation, authentication, preview without persistence,
  legacy-image protection, missing files and fail-closed processing errors.
- Inference-spy tests verify original input and protected stored originals/crops
  for both scene and single-image endpoints.
- Real YuNet detected one face in the supplied screenshot and two faces in an
  in-memory two-panel copy. Only a protected QA rendering was written to .run-logs;
  the supplied photo was not added to training data or scan history.
- React tests check main Learn hierarchy, one Home library entry, Back navigation,
  no raw-image flash while pending, failed/retry preview, and invalid preview data.
- This is not a measured face-detector recall or anonymization study. On-phone
  visual interaction still requires checking after installation.

## Files

App: `App.tsx`, `src/MainExperience.tsx`, `src/api.ts`,
`src/PrivatePhotoPreview.tsx`, `src/SceneResults.tsx`.
Server: `config/urls.py`, `predictions/photo_privacy.py`,
`predictions/scene_views.py`, `predictions/views.py`.
Assets/dependencies: `SNAPTURE_ML/models/privacy/` (model, LICENSE, README),
`SNAPTURE_ML/requirements-detection.txt`.
Tests: `LearnHierarchy.test.tsx`, `PrivatePhotoPreview.test.tsx`,
`AutomaticCamera.test.tsx`, `predictions/test_photo_privacy.py`.
