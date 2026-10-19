# Waste and camera UX update

## Design decisions

Waste is now a material library, without a search field or prominent no-photo
button. The camera offers a secondary **Choose material manually** link.
Manual selection has no search box, gallery/camera switch or CESD-reference
shortcut. CESD references remain in Learn. After manually assessing an item,
**Choose another material** stays in that flow.

Camera controls use a circular gallery thumbnail, standard flash icons and a
camera-switch icon. Flash cycles Off, On and Auto. The thumbnail reads only the
newest photo Android permits the app to access. Access is optional: **Enable
preview** requests permission, while tapping the thumbnail/fallback icon always
opens the system picker. Limited/denied access is not treated as an error.

Single-item mode retains the existing classifier. Mixed-items beta uses a
separate local OWL-ViT detector, not the whole-image classifier pretending to
produce boxes. Captured photos are analyzed after submission; live preview
detection is not implemented. The guide is mapped from the center-cover preview
onto the EXIF-oriented photo. Gallery uploads use the entire image.

Results show numbered boxes and item cards. Colors and question marks indicate
experimental group suggestions. A separate disposal-route field remains pending
until supported by the user's details and published guidance. A recyclable can
also be non-biodegradable, so the groups are not treated as mutually exclusive
scientific material classes. Special handling and Needs review prevent forcing
unknown or chemical-contact items into an inappropriate bin.

## Implemented

- Conditional photo warnings from brightness, sharpness and model-box signals.
  There is no static five-tip checklist. An unflagged photo gets no quality-tip
  panel, but this is not proof of good quality.
- Possible softness and darkness checks run on actual pixels. Possible cut-off
  items, crowded scenes and busy backgrounds depend on detected boxes and image
  edges. Single-item mode can warn about several detected items when the
  optional detector is available.
- An optional CPU-only, text-conditioned detector with full-scene and overlapping
  tile passes, coordinate normalization, duplicate suppression and a visible
  maximum of 30 proposals. No synthetic fallback boxes.
- Authenticated scene create/list/detail/delete endpoints. Item records use the
  existing ownership, assessment, source checking and project saving flow.
- Retry request IDs avoid duplicate scenes. Processing is limited to one local
  detection request at a time. The client allows a longer mixed-scan timeout.
- Mixed-scan history is reachable from Waste. Deletion removes the full photo
  and item crops. Clearing scan history also clears mixed scenes. Started project
  snapshots remain; their source references become null if their scan is removed.
- Item cards explain suggested groups, provide material and disposal-route
  fields, and show whether any published reuse idea is currently eligible.
  The assessment page contains sources, materials, steps and safety restrictions.
- A details-check counter and an educational note. Progress is not a measured
  count of correctly sorted items, waste diversion, emissions or environmental
  impact. Quantity must still be supplied by the user.
- Fail-closed behavior for unknown materials and missing guidance. Generic
  plastic bottles are never automatically called PETE or HDPE. Chemicals and
  resin codes cannot be established by appearance alone.

## Important limits

No bounding-box training dataset was supplied. The six-material classifier was
not retrained, and the new detector is **not trained or validated for Bacoor waste**.
It may miss, merge, repeat or mislabel objects, especially in piles or when items
are hidden. It cannot guarantee ALL objects, all waste materials, 80% accuracy,
chemical safety or a correct bin assignment.

An initial smoke test on the supplied annotated reference image missed objects
and mislabeled others. Overlapping tile passes recovered some proposals, but
their scores were low and the names did not reliably match the reference labels.
This is a functional/integration test, **not an accuracy result**. Threshold 0.1
is an experimental proposal cutoff, not a validated confidence calibration.

The detector queries generic bottle/container, paper/cardboard, fabric, wood,
glass, can, food/leaf, wrapper and battery appearances. These are visual proposals,
not new expert-approved disposal or upcycling categories. Automatic confirmed
biodegradable/residual routes and projects for out-of-scope materials remain
unavailable. Camera boxes carry question marks and item cards retain Needs review.

Quality checks are heuristics. Background clutter, blur, object completeness and
object count are not certified. A quiet warning panel must not be interpreted as
proof that every item is visible or detected.

Illustrated project steps are not invented. Only existing source-backed text
steps appear when a supported item passes assessment. Additional projects,
step-by-step images and local bin rules need source permission and review.

This remains a USB-connected development prototype. The optional gallery-read
permission and Play Store photo-permission eligibility need a separate release
review. Django development media serving is not a production private-file system.
A production deployment also needs a durable detection job queue, request/rate
limits and recovery for jobs interrupted by a server restart.

## Local setup and API

No paid service or API key is used. Inference stays on the computer. The explicit
setup step downloads model weights; it does not upload user images.

```powershell
SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r SNAPTURE_ML\requirements-detection.txt
SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_ML\scripts\install_scene_detector.py
```

The downloaded weight directory is git-ignored. Its local provenance file records
the Hugging Face revision. Model architecture/dependencies and the setup script
are in source control-ready files; weights can be downloaded again.

- `POST /api/scenes/`: multipart image, request_id, optional camera frame.
- `GET /api/scenes/`: current user's latest 20 scenes.
- `GET /api/scenes/<id>/`: refreshed per-item assessment results.
- `DELETE /api/scenes/<id>/`: delete the owned scene and its item crops.
- `GET /api/scenes/capabilities/`: optional detector installation availability.

Schema migration: `predictions.0004_scanscene_sceneitem_quality`.
Pre-migration local backup: `.run-logs/db-before-scene-ux-20261019.sqlite3`.

Primary references:

- Model and Apache-2.0 license: https://huggingface.co/google/owlvit-base-patch32
- Detector usage: https://huggingface.co/docs/transformers/model_doc/owlvit
- Android limited photo access: https://developer.android.com/about/versions/14/changes/partial-photo-video-access

## What is needed for reliable mixed-waste sorting

Agree the expanded material list and local routes with CESD and the adviser.
Collect real mixed-waste photos with permission, draw every visible object's box,
label supported and unknown items, and keep physical objects/collection sessions
separate between training and testing. Train/fine-tune a detector and report
per-class precision/recall and box mAP, missed objects and incorrect bin routes
on a held-out local set. Do not substitute model scores or generated boxes for
human-verified labels. Preserve hazardous/unknown fail-safe states.
