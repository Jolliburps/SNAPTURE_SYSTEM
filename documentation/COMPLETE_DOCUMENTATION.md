# SNAPTURE System Complete Documentation

Bacoor Household Waste Management System

Technical and operational manual for developers and project reviewers

Generated 26 October 2026 from the local working tree, including existing
uncommitted feature changes. This manual covers installation, daily operation,
architecture, data protection, experimental recognition, administration and
maintenance. The application is a development prototype; its datasets and model
scores do not establish field accuracy, local collection acceptance or deployment
readiness. The source index records the documents consolidated here.

# 1 Project overview

SNAPTURE combines a resident Android application, a CESD web panel and one local
Django backend. Both clients use the same database and media storage. Android
sends photos to Django for computer-side inference; the phone does not run the
TensorFlow or OWL-ViT models. Educational publications and collection schedules
are maintained through the staff interfaces and fetched by residents.

Administration is web-only. Resident login, saved scans, material assessments,
project instructions, progress and profile settings remain in Android. The
removed mobile administrator dashboard and its overview endpoints are not part
of the current application.

## 1.1 Current scope and interpretation

The current source defines seven supported material labels:

```text
pete_bottles
hdpe_containers
cardboard
paper
fabric_scraps
dry_untreated_wood_scraps
coconut_shells
```

The six-material descriptions dated 18–21 October are historical. Coconut shells
were restored on 22 October, as recorded in DISPOSAL_INTENT_WORKFLOW.md and
confirmed by current core/materials.py, scripts/inference.py and dataset rules.
Seven model outputs do not imply seven independently validated material classes.
Generic plastic is not automatically PETE or HDPE; a photo cannot establish
previous chemical contents, resin identity, wood treatment or microbial safety.

The system separates object proposals, material suggestions, user confirmations,
segregation references and project eligibility. A large model score does not
confirm all those facts. Source-checked educational content is distinct from
expert-reviewed instructions and CESD endorsement.

## 1.2 Repository and workspace layout

```text
SNAPTURE/                          Local machine workspace
  Start-Snapture.ps1               Local service launcher
  Use-SnaptureEnvironment.ps1      Terminal-only tool and settings loader
  RUN_COMMANDS.txt                 Copyable local launch commands
  .tools/                         Portable tools and private diagnostic evidence
  SNAPTURE_SYSTEM/                 Git repository
    SNAPTURE_ANDROID/             Resident app and Android native project
    SNAPTURE_ADMIN/               Web panel, browser tests, compatibility launcher
    SNAPTURE_BACKEND/             Canonical Django backend and migrations
    SNAPTURE_ML/                  Inference, models, training and dataset tools
    research/                     Source registries and dated research records
    documentation/                This manual, current guides, historical records
    README.md                     Repository entry point
    RUNBOOK.md                    Detailed Windows operations
```

The outer scripts and portable tools are local conveniences, not guaranteed
contents of a fresh Git clone. Keep all four repository components as siblings:
backend model loading and admin compatibility launchers rely on those paths.
The admin server directory delegates to the canonical backend; it is not a
second production database or an obsolete duplicate to delete.

# 2 Installation and configuration

## 2.1 Compatible tools and manifests

| Component | Repository requirement or configuration | Evidence |
| --- | --- | --- |
| Mobile JavaScript | Node >=22.11.0; React 19.2.3; React Native 0.87.1 | SNAPTURE_ANDROID/package.json |
| Shared client setup | Node 22.x at least 22.12 for both client workflows | RUNBOOK.md; admin README |
| Dependency installation | npm with each existing package-lock.json | Both client manifests and lockfiles |
| Shared Python | Python 3.13; Django 5.2.17; TensorFlow 2.21.0 | ML requirements; runbook |
| Android | JDK 17; compile SDK 37; minimum SDK 24; target SDK 36 | Android build.gradle files |
| Native tools | Build Tools 37.0.0; NDK 29.0.14206865; Kotlin 2.2.0 | android/build.gradle |
| CMake | 3.31.6 in documented Android setup | RUNBOOK.md |
| Optional detection | torch >=2.8,<3; transformers >=4.57,<5; safetensors >=0.4 | requirements-detection.txt |

This PC's existing portable setup uses Node 22.23.4, npm 10.9.9, Python
3.13.17 and JDK 17. Reuse the existing environment; there is no need to upgrade
working tools simply because a newer version exists. Lockfiles determine actual
JavaScript package versions where package.json contains ranges.

SNAPTURE_ML/requirements.txt also pins NumPy 2.5.3, Pillow 12.3.0,
opencv-python-headless 5.0.0.93, FastAPI 0.141.1, Uvicorn 0.53.0,
python-multipart 0.0.32, PyMySQL 1.1.1, requests 2.34.2 and gdown 6.4.1.
The detection manifest separately requests opencv-python 4.11.0.86. These two
OpenCV distributions share the cv2 namespace; blindly installing both manifests
can produce an inconsistent environment. This documentation records the conflict
without modifying either manifest or the running environment.

VS Code extensions are editor tools, not runtime dependencies. Python/Pylance,
ESLint and formatters may help development; their presence does not install
Node, Python, Java, Android tools or packages. Expo Go and a globally installed
React Native CLI are not required by this React Native CLI project.

## 2.2 Fresh installation only

The following commands are setup instructions, not actions performed by this
cleanup. Run them from the repository root only on a new or deliberately repaired
installation. Do not recreate an existing virtual environment or overwrite .env.

```powershell
py -3.13 -m venv .\SNAPTURE_ML\.venv
& .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r .\SNAPTURE_ML\requirements.txt
npm.cmd ci --prefix .\SNAPTURE_ANDROID
npm.cmd ci --prefix .\SNAPTURE_ADMIN
```

Review the OpenCV conflict before adding optional detection dependencies. The
documented detector setup is an explicit download operation, not daily startup:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r .\SNAPTURE_ML\requirements-detection.txt
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_ML\scripts\install_scene_detector.py
```

The installer preserves local model provenance. Inference must not silently
download or replace weights while processing a resident's request.

## 2.3 Environment settings and private files

Use SNAPTURE_BACKEND/.env.example as the setting-name template. Preserve an
existing private .env; copy the template only if no local file exists. Django
reads process environment variables. On this PC, Use-SnaptureEnvironment.ps1
loads the local file into the current process and configures tool paths without
changing machine-wide PATH. Do not print the resulting environment.

Important setting names include DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS,
DJANGO_CSRF_TRUSTED_ORIGINS, ADMIN_WEB_URL, SNAPTURE_DB_ENGINE, MYSQL_DATABASE,
MYSQL_USER, MYSQL_PASSWORD, MYSQL_HOST and MYSQL_PORT. The database engine defaults
to SQLite. Do not include real secrets or database exports in project reports.

Set JAVA_HOME to JDK 17 and ANDROID_HOME/ANDROID_SDK_ROOT to the real SDK for
Android work. android/local.properties is machine-specific. Debug signing uses
the local user-profile key; release currently uses debug signing too and is for
local testing. Production signing needs its own deliberate configuration.

# 3 Daily development workflow

## 3.1 Exact commands on this PC

These commands work from any PowerShell directory. Use the existing service if
its port is already occupied. Do not start duplicate APIs or Metro processes.

Terminal 1 starts Django and remains open:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Backend
```

Terminal 2 starts Metro and remains open for debug Android:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Metro
```

Terminal 3 installs/opens Android after connecting and authorizing the phone:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Android
```

For an already installed app, restore connectivity without rebuilding. A watcher
can restore mappings after later authorized reconnections. Keep only one watcher;
an existing background watcher may already own this job.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Reconnect
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Reconnect -Watch
```

Optional terminal 4 serves the web panel:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Jude\Desktop\SNAPTURE\Start-Snapture.ps1" Admin
```

Open http://127.0.0.1:5173/ for CESD administration and use the existing private
credentials. Do not recreate the owner. Django administration is at
http://127.0.0.1:8000/admin/ and additionally uses model-specific permissions.
Ctrl+C stops a foreground service. Saved data remains on disk; an unsaved selected
photo or in-progress request is not a durable completed scan.

## 3.2 Repository commands without the local launcher

After configuring the tools and loading the intended backend environment, run
one command group per terminal from the repository root:

```powershell
# Backend terminal
Set-Location .\SNAPTURE_BACKEND
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

```powershell
# Metro terminal
Set-Location .\SNAPTURE_ANDROID
npm.cmd start
```

```powershell
# Android terminal
Set-Location .\SNAPTURE_ANDROID
adb.exe devices -l
$targetSerial = Read-Host 'Authorized target serial from adb devices'
adb.exe -s $targetSerial reverse tcp:8000 tcp:8000
adb.exe -s $targetSerial reverse tcp:8081 tcp:8081
npm.cmd run android -- --device $targetSerial --no-packager
```

```powershell
# Web terminal
Set-Location .\SNAPTURE_ADMIN
npm.cmd run dev
```

Migrations are for first setup or actual schema changes, after a database/media
backup. They are not required every time a terminal opens:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py migrate
```

For an initial empty installation only, create a CESD owner using the existing
create_cesd_owner management command. A Django superuser is a separate technical
account; mobile residents must not be promoted to bypass CESD access checks.

## 3.3 USB and network behavior

Enable Developer options and USB debugging on the TECNO phone, unlock it, use a
data cable, select File transfer if necessary, and approve the PC's debugging
key. adb devices must report device, not unauthorized or offline. The application
uses http://127.0.0.1:8000/api through reverse forwarding; Metro uses 8081.
Unplugging USB breaks those paths in this configuration. Charging alone does not
prove ADB data connectivity. A watcher can restore forwarding after reconnection,
but cannot repair a cable or approve the phone's prompt.

Wireless ADB and direct LAN are alternative documented workflows in RUNBOOK.md.
Direct LAN requires the computer's reachable IPv4 address, appropriate hosts and
CSRF origins, and corresponding mobile/Metro configuration. The phone's own IP
does not identify the backend. Vite's proxy can remain on 127.0.0.1 when Django
runs on the same computer. Unrelated networks require deliberate hosting or a
permitted tunnel/VPN; changing a private IP cannot bypass network isolation.

# 4 Frontend architecture and navigation

Android uses TypeScript components and a screen-state router in App.tsx. The
screen allowlist and session restoration enforce resident-only navigation.
src/MainExperience.tsx holds the main Home/Learn/Waste/Profile experience and
integrates the notification bell and collection card. This is not evidence of
a React Navigation dependency; package.json lists the actual installed stack.

| Main file under SNAPTURE_ANDROID | Responsibility |
| --- | --- |
| App.tsx | Session, screen routing, photo state and scan submission |
| src/api.ts | API base URL, authenticated fetch, types, timeouts and response checks |
| src/MainExperience.tsx | Main tabs, Home search, profile panels and Learn access |
| App.tsx and src/CaptureGuide.tsx | Native camera, frame geometry and capture readiness |
| src/SceneResults.tsx | Scene results, current single-item selection and legacy display |
| src/DetectionItemCard.tsx | Item presentation, review and advice actions |
| src/AssessmentScreen.tsx | Material/condition confirmation workflow |
| src/AssessmentAdvice.tsx | Assessment outcomes and sources |
| src/WasteRecommendations.tsx | Detailed conditional waste guidance |
| src/SavedScanReview.tsx | Review stored scans and their own saved context |
| src/ProjectGuide.tsx | Persisted instruction steps and completion/restart |
| src/ProjectIdeaPicker.tsx | Eligible idea replacement for an unstarted project |
| src/NotificationBell.tsx | In-app publications, read state and attachment actions |
| src/localUpdates.ts | Combine announcements with published file entries |
| src/useCollectionSchedule.ts | Barangay/month lookup and stale-response guards |
| src/CollectionSchedule.tsx | Schedule card, filtering and shared entries |

Home search precedes Collection Schedule. The previous Resources heading/CESD
Library Home card and the Everyday practices Learn entry were removed. Published
policies/materials remain reachable through Learn. No missing resource is
silently replaced by invented content or a local collection schedule.

The web frontend uses React, TypeScript and Vite, with React Router, Tailwind,
Lucide and Recharts. src/pages/ContentManager.tsx manages publication forms;
vite.config.ts proxies API/admin/static/protected media to the shared backend.
Web navigation includes Dashboard, Policies, Educational Materials, Announcements,
Collection Schedule, Reports and Settings. Staff Access and audit access are
owner-restricted.

# 5 Backend architecture and API

SNAPTURE_BACKEND/config/settings.py defines Django applications, middleware,
database, logging and media configuration. config/urls.py composes the routes.
The first included CESD routes also implement public learning and collection
feeds; merely reading core/urls.py would miss that ordering.

| Django module | Responsibility |
| --- | --- |
| accounts | Resident registration/login, hashed tokens, profile and reset flow |
| core | Material scope, versioned guidance, assessment, authentication and activity logging |
| predictions | Prediction records, scenes/items, privacy processing, action snapshots and projects |
| datasets | Pending image contributions, review and controlled export |
| evaluations | Locked research protocols, captured outputs, judgments and scorecards |
| cesd | Web sessions, staff access, publications, schedules, audit and aggregate reports |

## 5.1 Resident and public routes

| Route | Purpose and boundary |
| --- | --- |
| GET /api/materials/ | Supported material catalogue; lightweight connectivity probe |
| GET /api/health/ | Model/runtime status; can load the lazy classifier |
| GET /api/learning/ | Published CESD policies/materials and source summaries |
| GET /api/announcements/ | Published announcements only |
| GET /api/collection/?month=YYYY-MM | Authenticated saved-barangay month lookup |
| POST /api/auth/register/ and /api/auth/login/ | Resident sessions only |
| POST /api/auth/logout/ | Revoke resident token |
| GET/PATCH /api/auth/me/ | Own profile and allowed fields |
| POST /api/auth/me/photo/ | Own validated profile picture, max 5 MB |
| POST /api/auth/password-reset/request/ and confirm/ | Resident password-reset workflow |
| GET/POST /api/scenes/ | Owned scene list or multipart photo analysis |
| GET/DELETE /api/scenes/<id>/ | Owned scene read or deletion |
| GET /api/scenes/capabilities/ | Installed detector capability |
| POST /api/scenes/<id>/items/ | Legacy/manual region support; new single-item scenes reject extra regions |
| POST /api/scenes/<id>/disposal-selection/ | Owned item selection and action snapshots |
| GET /api/predictions/ and /api/predictions/saved/ | Own prediction history and saved ideas |
| POST /api/predictions/create/ | Legacy whole-image prediction compatibility |
| GET/PATCH /api/predictions/<id>/ | Own assessment and recorded prediction |
| POST /api/predictions/<id>/recommendation/ | Select an eligible recommendation |
| GET /api/predictions/questions/<label>/ | Applicable assessment questions |
| GET/POST /api/projects/ | Own started projects |
| PATCH /api/projects/<id>/steps/<index>/ | Save an individual instruction step |
| POST /api/projects/<id>/restart/ | Guarded restart of a completed eligible project |
| POST /api/photo-privacy/preview/ | Authenticated in-memory redaction compatibility endpoint |

This table describes route families, not a replacement for request validation
in views.py, scene_views.py and project_views.py. Private routes require a valid
resident token and owner checks. IDs alone never authorize access.

## 5.2 Staff and research interfaces

CESD session routes under /api/cesd/ include csrf, login, logout, me, password
request/confirm, staff, activity, metadata, reports, dashboard and integration.
The resource routes manage policies, materials, announcements and schedules.
File delivery uses /api/cesd/files/<resource>/<id>/ and rechecks publication or
authorized staff access on each request. Drafts must not be exposed by a raw
media-directory web-server alias.

/api/datasets/counts/ requires a Django staff session and
datasets.view_datasetimage. /api/datasets/upload/ additionally requires
datasets.add_datasetimage and CSRF. /api/evaluations/ and its run detail require
evaluations.view_evaluationrun. A legacy profile admin value or mobile bearer
token does not authorize those research routes. The removed
/api/auth/admin/overview/ and administrator prediction-detail routes must not
be used by the mobile client.

# 6 Database and durable records

SQLite at SNAPTURE_BACKEND/db.sqlite3 is the default. Django owns its schema;
all migrations remain in their original application directories. The current
SQLite configuration uses a 20-second timeout and IMMEDIATE atomic transactions
to reduce a tested concurrent read-to-write lock failure. This is not unlimited
multi-writer production capacity.

The domain includes Django users/sessions, resident profiles/tokens, prediction
records, ScanScene/SceneItem records, UserProject progress/reference snapshots,
guidance/information sources/collection notices, dataset review records,
evaluation runs/cases/judgments, and CESD StaffAccess/publication/schedule/audit
records. User photos/files live under media; development mail and backups are
private local data, not source documentation.

History reads a stored assessment/action snapshot rather than rerunning
recognition on a newer photo. Explicit edits refresh only the relevant item's
assessment. Project instructions and source references are snapshotted on start;
deleting a source scan does not erase completed work. Scene deletion removes its
owned image/crop files through application logic; cleanup never simulates it by
deleting a media folder.

## 6.1 Legacy import and optional MySQL

SNAPTURE_ADMIN/server/admin_config is a compatibility launcher. Former isolated
CESD installations can preview import_legacy_cesd before using --apply. Apply
backs up both SQLite databases/media, preserves the source, remaps IDs and uses
an import ledger to avoid duplicate imports. Conflicting identities/owners or
unhandled mobile data stop the import. Do not import again on this PC merely
because a dated report describes another machine's earlier migration.

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd
# Only after preview, backup and deliberate approval of the affected data:
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd --apply
```

MySQL is optional and uses SNAPTURE_DB_ENGINE=mysql plus MYSQL_* settings.
The existing backend/scripts/migrate_sqlite_to_mysql.ps1 exports records,
migrates the destination and imports them without deleting the SQLite source.
Its exports include private account data; protect them. A blank MySQL database
does not automatically contain existing accounts or content. No database server,
data import or migration was executed for this cleanup.

# 7 Camera recognition and waste assessment

## 7.1 Capture through result

The native camera draws a square covering 80% of the shorter preview dimension.
Capture waits for layout/readiness and freezes normalized frame geometry at the
shutter event. The review screen shows the selected local photo. Gallery input
uses a reviewed central square; it does not inherit camera sensor geometry.

App.tsx sends a multipart photo, request_id and single-item/frame metadata to
/api/scenes/. The API EXIF-orients and crops the intended region before detection,
classification and saved preview processing. New framed history retains the
inside region, not outside pixels. Coordinates in the result refer to that crop.
The request ID makes supported retries idempotent for the same resident.

predictions/scene_detector.py uses local OWL-ViT base patch32 with text queries.
Current default inference is one full-frame pass, with conservative deduplication;
older descriptions of five tiled passes are historical. Object scores and
material scores are independent. Background/person/worn-clothing contrast queries
reduce forced waste matches without guaranteeing detection of every person.

Multiple reliable objects inside a new single-item frame cause a retake response
without a partial saved scan. One reliable item is retained. When object identity
is unreliable, a real material classification of the framed area can yield a
material-only result with no fabricated box or object confidence. This is not
proof that the image contains exactly one physical item. Missing detector assets
are an explicit capability/setup failure; do not claim universal fallback support.

The server processes one local scene-inference request at a time. Models load
lazily and remain cached in the backend process. The first scan after restart can
take materially longer than a warmed scan. Restarting Django for every retry
discards that benefit. Current scene fetch timeout is 180 seconds; a timeout or
USB failure is not proof that a request never completed.

## 7.2 Model assets and confidence

models/active_model.json selects
candidates/snapture-7class-candidate-20261006/snapture_7class_candidate_unverified.keras,
with its matching labels.json and model_config.json. The legacy
models/snapture_baseline.keras remains for rollback/diagnostics. Explicit
model-directory or individual model/label/config environment overrides take
precedence; inspect scripts/model_selection.py before changing them.

scripts/inference.py EXIF-orients RGB input, resizes to the configured 224-pixel
input and passes raw 0–255 pixels because MobileNetV2 preprocessing is stored in
the model. It checks output count against label order and applies scope/confidence
rejection. The experimental candidate config uses a 0.80 rejection cutoff;
the code's general default 0.60 is not evidence the active candidate uses it.
No threshold was changed during consolidation.

OWL proposal minimum 0.10 and ordinary display cutoff 0.28 are uncalibrated.
Textile guesses below 0.45 or spanning over half the frame remain review-only.
A high fabric score cannot validate the exact towel/blanket identity or a weak
box. Manual corrections and user-marked regions remain distinguishable from
model output. Legacy scene presentation filters do not silently delete raw rows.

## 7.3 Safety and recommendation eligibility

Supported materials route to material/condition confirmation before recycling
or upcycling ideas. Other objects route to conditional disposal guidance;
unsupported is not synonymous with residual garbage. Suspected electronics,
sharps, batteries, chemicals or hazardous containers require special handling.
Reported unknown history is not a negative hazard answer.

Plastic projects require actual resin evidence. Wood needs known untreated
history and condition checks. Contamination, mold, damage and unresolved hazards
withhold incompatible reuse. The server repeats eligibility checks before idea
selection, project creation and restart; hiding a mobile button is not the access
or safety boundary. General references do not invent local bin colors, receiving
addresses, prices, dates or chemical-safety certification.

Guidance is versioned with source/review metadata and publication digests.
Changing or withdrawing guidance can invalidate a new action while preserving
an old project's recorded instructions. Single framed material-only scans have
a specific user-confirmed material route to existing educational ideas; that
exception does not convert a weak legacy detector box into a verified object.

## 7.4 Projects and historical advice

ProjectGuide saves actual steps. Saving an unfinished step can advance after
500 ms; the last unfinished step uses Finish. Earlier steps must still be saved.
Failed writes do not advance. Undo/review and navigation cancel pending timers.
Completion summaries/counts derive from persisted progress, not animations.

Do it again confirms restart and rechecks current eligibility. Change idea is
limited to unstarted projects and the original scan's eligible choices. Recording
a step locks that ability, including after undo/restart. Reusing an already saved
idea preserves progress; replacement metadata records an unused duplicate choice.
No real project was reset or edited by this cleanup.

Detailed waste advice includes preparation, disposal, recycling/reuse, safety,
environmental context and Bacoor referral. Stored management-reference-v1
snapshots retain their sources. Legacy items may receive a labeled read-only
supplement from their own saved context; a history GET must not rewrite evidence
or borrow a later scan. Qualitative reuse statements are not measured carbon or
waste-diversion savings.

# 8 Machine learning data and research

## 8.1 Data locations and preservation

Original public downloads belong in SNAPTURE_ML/data/public_sources/. Per-source
acquisition.json, publisher metadata, versions, URLs, licenses and hashes record
what was actually received. recognition_basis/ is a separate deduplicated review
view, not the original archive or a ready-made training export. Other materials,
mixed scenes, broad labels and uncertain cases stay under Object detection datas.

Seven target folders do not justify forced labels: Indoor Waste shell is not
necessarily coconut, WasteInsight bags do not reveal their contents, and broad
plastic/textile sources do not prove PETE/HDPE or fabric scraps. Preserve raw
COCO/YOLO references, masks, original splits, physical-item groups and annotations.
Hardlinked review images must not be edited in place: write transformed files to
a new location or both names can refer to the same changed bytes.

## 8.2 Recorded sources and licensing holds

| Recorded source | Version or official source record | Interpretation |
| --- | --- | --- |
| Indoor Waste | Mendeley dy7smxr93r version 1 | CC BY 4.0; publisher object labels |
| WasteInsight | Mendeley p8n7nbxyw3 version 1 | CC BY 4.0; bag boxes, not contents |
| PackWISE v2 | Fraunhofer fordatis/463.2 | CC BY 4.0; preserve masks and splits |
| Kaggle Drinking Waste | arkadiyhacks/drinking-waste-classification | Recorded CC0 claim; retain incorporated TrashNet MIT notices |
| Kaggle Waste Classification | techsash/waste-classification-data | Recorded CC BY-SA 4.0; O/R are publisher labels |
| RealWaste | UCI dataset 908 | CC BY 4.0; broad classification labels |
| RealDirt | Zenodo 12517610 | CC BY 4.0; received ZIP recorded 500 images, not landing-page 2,000 |
| RECLAIM PET updated | Zenodo 11504415 | CC BY 4.0; RGB selection, retain metadata |
| RECLAIM HDPE updated | Zenodo 11504453 | CC BY 4.0; RGB does not imply object boxes |
| MMoRWaD RGB | Zenodo 22226868 | CC BY 4.0; inspect nonstandard category metadata |
| TrashNet resized | Creator garythung/trashnet on Hugging Face | Retain dataset card, MIT notice and creator attribution |
| ZeroWaste-f | Zenodo 6412647; dbash/zerowaste author repository | Research-only hold: author CC BY-NC versus archive CC BY conflict |

These are existing recorded source identities, not a fresh download or license
clearance claim. Source URLs and exact per-file hashes remain in the registry
and manifests; no missing links were fabricated. TACO image rights, general
COCO/Open Images subsets, inaccessible SpectralWaste and unclear SortWaste
acquisition remain separate review questions. Do not bypass access restrictions.

The 25 October DATASET_INDEX records 98,264 source paths, 64,744 unique pixel
groups and 33,514 repeated entries excluded from that view. Its seven-material
subtotal was 21,939; Object detection datas contained 42,805. Category counts
were PETE 5,412; HDPE 3,476; cardboard 2,417; paper 3,680; fabric 5,816;
wood 775; coconut 363. These are historical reference-library figures, not counts
recomputed on this device by the cleanup.

That index also records 530 similarity groups, five conflicting-label groups,
285 cross-split duplicate groups and six over-25-megapixel images held for review.
It preserves 9,321 referenced annotation files and reports structural checks of
41,171 boxes across four detection sources. Structurally valid coordinates are
not proof of visual label/box correctness. The old report of archive pruning and
hardlink compaction describes an earlier PC operation, not an action here.

Original-PC local/private material images and permission manifests are not
guaranteed by Git. Earlier restoration identified 15,252 legacy image paths not
included in the checkout. Keep that missing private/local data question separate
from public-source downloads. A groupmate's statement that code is updated does
not prove those files exist on this machine.

## 8.3 Acquisition and review tools

| Script under SNAPTURE_ML/scripts | Role |
| --- | --- |
| acquire_public_datasets.py | Official registry, supported HTTP resume, checksums, safe extraction and reserve |
| acquire_supplemental_datasets.py | Supplemental publisher metadata/license/hash checks |
| organize_waste_datasets.py | Oriented-pixel deduplication, alias/provenance and review grouping |
| build_recognition_basis.py | Build a timestamped separate review view and latest pointer |
| audit_detection_annotations.py | Structural annotation/reference audit |
| finalize_dataset_audit.py | Report label/annotation problems without fabricating boxes |
| reviewed_dataset.py | Review manifest, physical-item grouping, preparation and validation |
| validate_scope_dataset.py | Dataset validation before deliberate training |
| compact_dataset_storage.py | Explicit storage operation; not part of this cleanup |
| check_active_model.py | Inspect model selection/configuration |

Acquisition preserves a 12 GiB reserve and rejects unsafe archive paths/symlinks.
Use a single writer per source. Verify complete archives before extraction;
.part is incomplete, not a usable archive. Similar images and conflicting labels
are review flags, not automatic deletion instructions. Deduplication excludes
copies from a view while preserving originals and annotation-relative paths.

The existing acquisition example below resumes selected registered sources.
It is not a claim this command was run during cleanup:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe -u .\SNAPTURE_ML\scripts\acquire_public_datasets.py --datasets realwaste realdirt trashnet reclaim_hdpe reclaim_pet mmorwad_rgb zerowaste
```

Review-building operations, when separately authorized, are:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_ML\scripts\organize_waste_datasets.py --workers 4
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_ML\scripts\build_recognition_basis.py
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_ML\scripts\audit_detection_annotations.py
```

No download, data compaction, source deletion, retraining or model promotion was
performed as part of documentation cleanup.

## 8.4 Training and evaluation boundaries

Reviewed training requires per-image material, privacy, source/permission,
reviewer and physical-item/capture-group records. Keep related variants out of
different partitions; run augmentations only after splitting, on training data.
Generic plastic must not be relabeled by folder name or model prediction.
An image-random 70/15/15 split can leak physical objects or similar source images.

The historical candidate trained eight MobileNetV2 epochs and recorded 85.42%
validation and 84.55% image-random test accuracy. Those unverified labels and
non-grouped splits do not establish phone accuracy. The separate Drive candidate
recorded 91.99% validation and 90.64% image-random test accuracy, also not a valid
independent release estimate; cardboard precision/recall remained weak. Preserve
both reports and their per-class metrics rather than combining them into one
misleading score. Current activation is determined by active_model.json, not an
old report stating the baseline was still live.

FREE_TRAINING.md retains an optional historical six-material Colab workflow.
Reviewed_dataset inventory/prepare/validate/package commands and a separate
candidate output prevent inadvertent replacement. Uploads to Colab require a
deliberate privacy/permission decision; no raw data is uploaded automatically.
Free GPU availability is not guaranteed. The maintained trainer is
scripts/train_model.py; the root train_model.py is compatibility code to retain.
The old FastAPI server is optional diagnostics on port 18000, not daily API 8000:

```powershell
# From SNAPTURE_ML, for a deliberate model-only diagnostic session:
.\.venv\Scripts\python.exe -m uvicorn scripts.api_server:app --host 0.0.0.0 --port 18000
```

The research evaluation module locks protocols before final output capture,
records independent adjudicated references and anonymous physical-item groups,
captures immutable prediction snapshots, and freezes reviewed reports. Material
identification, segregation guidance and recommendation validity are separate
scorecards. Recommendation judgments require material fit, condition fit, safety,
instruction correctness, practicality and local applicability; safety failures
cannot be canceled by strong averages on other criteria.

It reports denominators/coverage and Wilson intervals for appropriate proportions.
Manual selections are excluded from raw camera metrics. Detection mAP requires
real ground-truth boxes and is not supplied by crop classification accuracy.
No CVI or expert agreement result exists without independent ratings. SAM2 and
broader fine-class pipelines in the research plan remain proposals/adapters,
not installed, trained or validated replacements.

# 9 Administration and authentication

The CESD owner/staff panel uses Django sessions, CSRF and StaffAccess. Residents
use scoped bearer sessions; the database stores token hashes, not the original
token. Staff/superusers/legacy admin profiles cannot obtain a mobile resident
session. Client response/route checks complement server restrictions. No default
password is provided. Existing private credentials and hashes were not read or
changed for this cleanup.

Owners manage staff through Settings and use individual setup/reset links.
Development mail is local and links expire; production delivery is not configured
by copying a document. Deactivation/session revocation, owner protection and
permissions remain enforced. CESD content authority does not automatically grant
private resident-scan, research export or guidance-review permissions.

The Django Connected system link shares the same session/database through Vite's
proxy. /api/cesd/integration/ performs a real query and reports non-identifying
content/activity totals. It is not a second database sync or a push service.
Private scan/project views are read-only and require appropriate model permissions.

Development settings still include DEBUG=True and permissive host defaults.
The resident password-reset path has development-only behavior that must be
reviewed before production. This is an existing deployment gap, not a cleanup
change. Never distribute .env, mail/setup links, tokens, passwords, private
database backups or user photos with the consolidated documentation.

# 10 Publications schedules and notifications

## 10.1 Publish an attachment

1. Open the web panel and sign in with the existing CESD staff/owner account.
2. Use Educational Materials for PDF Guide, Infographic or Video, or Policies
   and Guidelines for a policy PDF.
3. Enter the title/category/description, attach an allowed file, choose Published
   and save. A Draft stays private.
4. In Android, open Home's bell and use Open attachment. The publication also
   remains in the Learn reference library.

PDF/policy limit is 20 MB; PNG/JPEG/WebP infographic limit is 10 MB;
MP4/WebM video limit is 100 MB. Validation includes type/signature checks without
transcoding. Materials require attachments. A policy without a file can be a
library entry without becoming a file notification.

The bell combines announcements with published attachments and displays title,
description, date and read state. It refreshes on opening, foreground return,
manual refresh and every 30 seconds while active. Background/unmounted timers
stop. This does not deliver an OS notification when the app is closed.

Read markers are local per account/API base and publication revision. Edited
publications become unread. File IDs use cesd-policy/material namespaces rather
than colliding with numeric announcement IDs. Opening failure remains visible
and does not mark an item read. Returning content to Draft removes it on refresh
and immediately revokes public file delivery. A real publication must exist;
cleanup did not insert demo posts into the normal database.

## 10.2 Collection schedules and provenance

Collection looks up the saved profile barangay and selected month. Exact
case/whitespace-normalized matching prevents Talaba borrowing Talaba 1 or 2's
records. It combines staff-maintained dated CESD schedules with reviewed published
CollectionNotice records. Dates, times, category, cancellation, notes and source
remain distinct. Missing structured values are labeled unspecified.

The Home card shows a browsable month, filters and up to three suitable entries;
the calendar shares lookup/display components. Changing barangay uses the
existing Profile save. Unsaved selections or stale responses must not change
the displayed area's schedule. Empty data is No verified schedule available;
network failure has a separate retry state.

CESD_ADOPTION records source-checked summaries of eleven original documents,
including hazardous-waste, segregation, recovery, composting, sanitation and
historical CESD activities. The source files are pinned in core/cesd_sources.py
and may exist only on the original PC. Interview ambiguities, incomplete
ordinance references, historical WACS figures and future collection plans were
not converted into current legal rules or schedules. Do not claim these summaries
are expert approval or redistribution permission for the originals.

# 11 Testing and troubleshooting

## 11.1 Safe verification commands

From the repository root with the configured Python environment:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py check
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py test --noinput --verbosity 1
```

From SNAPTURE_ANDROID:

```powershell
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test -- --runInBand --watchman=false
```

From SNAPTURE_ADMIN:

```powershell
npm.cmd run lint
npm.cmd run build
```

The cleanup ran the full isolated Django suite, focused mobile regressions,
mobile TypeScript/lint and web lint/build. Exact counts and logs are in
CLEANUP_REPORT.md. Older implementation documents report earlier test counts;
they are not additional tests run by cleanup. Earlier full mobile checks had
two bounded-file timeouts (AutomaticCamera and CatalogProjectFlow); focused
success does not resolve those timeouts or establish a passing full suite.

Admin test:ui seeds only its isolated synthetic database on ports 8001/5174;
it does not reuse the normal 8000/5173 services. Review its setup before invoking.
It was not needed or run for Markdown-only cleanup. A new native APK build or
phone installation was also unnecessary because no application code moved.

## 11.2 Common failures

| Symptom | Action |
| --- | --- |
| cd SNAPTURE_ANDROID cannot find path | Start at SNAPTURE_SYSTEM, not its outer workspace; prefer the absolute local launcher |
| npm/adb/Python not found | Load Use-SnaptureEnvironment.ps1 in that terminal; use npm.cmd and the actual venv interpreter |
| USB connection error | Check authorization/device state, preserve servers and restore both reverse mappings |
| Fast Refresh disconnected | Check Metro and port 8081; avoid reloading an unsaved photo unnecessarily |
| First analysis slow | Allow lazy models to warm; inspect current worker/logs before restarting Django |
| Red error remains after reconnect | The old UI error can persist until retry; tap Analyze once and inspect the new request |
| No model assets | Restore configured trusted assets/dependencies, not arbitrary weights or an unreviewed retraining |
| Model says unknown | Rejection is intentional; confirm material safely or use manual assessment |
| Draft file not visible | Publish deliberately; verify current Published status and permitted attachment |
| Web login rejected | Use CESD owner/staff identity, not a resident or legacy mobile administrator |
| Missing schedules | Verify saved barangay/month and actual publications; do not invent dates |
| Address/CSRF error over LAN | Use actual backend host and full web origin, then deliberately reload settings |
| Port already used | Find and reuse the existing service; do not launch duplicate instances |

The activity logger prints internal ID/action/status/duration metadata and excludes
passwords, tokens, request bodies and image bytes. Metro logs screen-view events.
Old .log files may describe an earlier process; compare timestamps before drawing
conclusions. Use /api/materials/ for lightweight connectivity rather than warming
the model through health on every watcher tick.

# 12 Deployment maintenance and preservation

The current project uses local Django development serving, prototype model
weights and debug signing. A production release needs deliberate secret/debug/host
configuration, HTTPS and private-media routing, access/rate limits, durable
inference job recovery, backup/restore testing, mail delivery, production signing,
privacy review and independently validated recognition. These are future work,
not capabilities established by cleanup.

Face redaction uses local OpenCV YuNet from models/privacy, with the original
MIT notice and pinned hash preserved. Backend storage fails closed for images
when redaction fails while retaining permitted inference results. Redaction can
miss faces and does not remove all identifying context. Route scene/prediction
media through the protected handler; never expose the full MEDIA_ROOT directly.

For maintenance, back up the database and media coherently before migrations or
imports. Keep backup/mail/model/data manifests private and out of Git. A source
clone is not a backup of datasets, credentials or residents' photos/accounts.
Review git status/diff before staging; this working tree already has uncommitted
feature work. Do not use destructive Git resets to tidy it.

Only eight Markdown reports were moved for this cleanup. Source trees, migrations,
tests, manifests, environments, native build folders, assets, model weights,
datasets, original license files and Git metadata were retained. No original data
was deleted, no model trained/replaced, no source pushed, no accounts altered and
no running service intentionally restarted. See CLEANUP_AUDIT.md for the reviewed
scope and CLEANUP_REPORT.md for completed actions and verification.

# 13 Source index and historical record

The index below maps every relevant project Markdown file discovered before
cleanup to its current location and the topics consolidated here. Dependency
package documentation and raw dataset trees were excluded. Original unique
records remain readable as Markdown. The downloaded OWL-ViT model card and
privacy notice remain with their licensed assets.

Current source/configuration takes precedence over dated reports for supported
materials, screen entry points, endpoint access and daily startup. Old test/model
counts describe their particular run. Historical six-material training commands,
old machine paths, five-pass detection, pre-upload preview, Home Resources,
mobile admin and missing announcement claims are explicitly superseded here.

<!-- SOURCE_INDEX -->

- `documentation/guides/ADMIN_AND_FILE_NOTIFICATIONS.md` — 9–10 web-only access and file publishing.
- `documentation/history/CESD_ADOPTION.md` — 10 source adoption and provenance limits.
- `documentation/guides/DASHBOARD_AND_NOTIFICATIONS.md` — 4 and 10 Home, calendar and bell.
- `documentation/history/EVALUATION_SCORECARDS.md` — 8 research protocols, three independent scorecards.
- `documentation/history/FEASIBILITY_IMPLEMENTATION.md` — 1, 7 and 10 historical scope and source review.
- `documentation/history/GUIDE_AND_DETECTION_REFINEMENTS.md` — 7 project guide, detection filtering and safeguards.
- `README.md` — 1–3 overview and installation, superseded duplication.
- `RUNBOOK.md` — 2–3, 6, 11–12 detailed operations and maintenance.
- `documentation/history/SHARED_BACKEND_INTEGRATION.md` — 5–6, 9 shared storage, import and permissions.
- `documentation/history/UX_CAMERA_AND_SORTING.md` — 7 historical camera design and detector setup.
- `research/AUTOMATIC_MATERIAL_ROUTING_20261025.md` — 7 automatic routing and confirmation gates.
- `research/DETAILED_SCAN_RECOMMENDATIONS.md` — 7 detailed advice and historical snapshots.
- `research/DETECTION_FILTER_FIX_20261025.md` — 7 one-pass inference and textile review policy.
- `research/DISPOSAL_INTENT_WORKFLOW.md` — 1 and 7 restored coconut scope, selection and snapshots.
- `research/FRAMED_SINGLE_ITEM_CAPTURE_20261026.md` — 7 current camera ROI and single-item rejection.
- `research/GITHUB_UPLOAD_SCOPE_20261026.md` — 12 Git boundaries and local-only resources.
- `research/ITEM_ACTIONS_IMPLEMENTATION_20261025.md` — 7 action snapshots, confirmations and special handling.
- `research/KAGGLE_AND_DATASET_AUDIT.md` — 8 source labels, deduplication and annotation holds.
- `research/LOW_FRICTION_ASSESSMENT.md` — 7 focused questions, saved answers and review state.
- `research/PHOTO_PRIVACY_AND_LEARN.md` — 4, 7 and 12 superseded preview/navigation; privacy.
- `research/PROJECT_IDEA_CHANGE_20261025.md` — 7 saved-progress locks and original-item identity.
- `research/PUBLIC_DATA_ACQUISITION.md` — 8 official sources, checksums and licensing.
- `research/RESTORED_SCAN_IDEAS_20261026.md` — 7 framed material-only idea eligibility.
- `research/THREE_PANEL_CONNECTION_20261026.md` — 5–6, 9 shared sessions, admin and SQLite transactions.
- `research/WASTE_IDENTIFIER_PLAN.md` — 7–8 research taxonomy, held-out validation and limitations.
- `SNAPTURE_ADMIN/README.md` — 2–3, 5–6, 9–11 web setup, import, permissions and tests.
- `SNAPTURE_ANDROID/README.md` — 3–4 and 7 mobile workflow and native development.
- `SNAPTURE_BACKEND/README.md` — 5–7 and 11 shared API, database and diagnostics.
- `SNAPTURE_ML/DATASET_POLICY.md` — 8 review policy; six-material scope superseded.
- `SNAPTURE_ML/DATA_REVIEW_2026-10-06.md` — 8 historical labels, quarantine and experimental metrics.
- `SNAPTURE_ML/DRIVE_PROTOTYPE_EVALUATION_2026-10-06.md` — 8 separate Drive experiment and unreliable split metrics.
- `SNAPTURE_ML/FREE_TRAINING.md` — 8 historical optional Colab and reviewed grouping workflow.
- `SNAPTURE_ML/README.md` — 2, 7–8 inference, dataset and compatibility entry points.
- `SNAPTURE_ML/data/DATASET_INDEX.md` — 8 historical reference counts and annotation preservation.
- `SNAPTURE_ML/data/README.md` — 8 recoverable quarantine and label review.
- `SNAPTURE_ML/models/candidates/snapture-7class-candidate-20261006/README.md` — 7–8 candidate activation, class order and limitations.
- `SNAPTURE_ML/models/owlvit-base-patch32/README.md` — 7–8 local model architecture and upstream attribution.
- `SNAPTURE_ML/models/privacy/README.md` — 12 pinned YuNet model and MIT provenance.

The original Markdown is retained at these locations. This manual merges repeated
operational explanations; historical reports retain their unique commands, tables,
source citations and dated validation results. Full licenses and upstream model
notices remain beside their assets rather than being substituted by this summary.
