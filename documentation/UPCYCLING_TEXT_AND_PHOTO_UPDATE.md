# Upcycling text and photo update

18 November 2026 · **Implemented local prototype; publication and device verification pending.**

**Later authorization:** the user subsequently approved separate read-only Home
tutorials across all seven categories, with scan integration deferred. See
[Home photo tutorials](HOME_PHOTO_TUTORIALS_2026-11-18.md) for the implemented
seven-tutorial addition and its 41 images. This supersedes the exact-match-only
Home limit below; the original tracked catalog and snapshots remain preserved.

### Home photo previews (18 November 2026)

The user requested photo-first recommendations directly on Home and explicitly
chose **only existing exact matches**, declining separate unmatched tutorial
previews. Added optional `photo_ideas` in the materials response for the two
existing catalog matches, marked `educational` and `can_start: false`. Published
guidance/review status and scan eligibility remain unchanged. Historical saved
instructions are not enriched or rewritten.

`MainExperience.tsx` now includes those entries in Home/search/Ideas, orders them
using `photoFirstRecommendations`, and renders actual finished-product thumbnails
through the existing `TutorialPhoto` component's compact mode. The horizontal
Home list shows up to seven cards, prioritizing process-photo entries, then
finished-photo entries, ahead of text-only/pending entries. Opening a photo card
shows its original instruction strings, step metadata, credits and missing-photo
notes via `IdeaDetails`. The added educational badge does not claim expert review.

Only `hdpe_scoop` and `coconut_bowl` have matched photos. The other 26 research
candidates and their downloaded assets remain preserved outside the repository;
they have not been deleted or silently assigned to different catalog projects.
Category-wide photo coverage would require separately authorized matching
content/procedure changes. No new candidate IDs or assets were imported here.

Validation: 18 backend tests passed (`core.test_home_photo_ideas`,
`core.test_idea_references`, `core.test_tutorial_media`, `core.test_scan_ideas`);
14 Android tests passed across HomePhotoIdeas, TutorialPhoto, RecommendationOrder,
LearnHierarchy and IdeaReferences. TypeScript and changed-file ESLint passed.
Live materials response and both preview images returned HTTP 200. Native-device
Home layout has not been newly observed for this change.

### Later display-priority update (18 November 2026)

At the user's request, `src/recommendationOrder.ts` now orders the shared
`UpcyclingIdeaChoices` display by usable instruction text and process photos,
then finished-product photos, then text-only choices. Ties retain their input
order; the input array and returned project IDs are not modified. This applies
to scan recommendations, item-action choices and Change idea through their
existing shared chooser. It does not change server eligibility, catalog order,
saved snapshots, or published library content. No photo-less choices were deleted.

Current matched options remain HDPE `hdpe_scoop` and coconut `coconut_bowl`.
PETE bottle projects still have text instructions but no attached photos:
PET-003's wick/mesh/reservoir procedure differs from the existing drainage-only
`pete_planter` overview despite its title. The other collected PET projects also
require different products/procedures. Photo priority cannot create a matching
PETE visual or recommend HDPE/coconut projects for a PETE bottle.

Verification: 15 Jest tests passed across `RecommendationOrder`, `TutorialPhoto`
and `ChangeProjectIdea`; TypeScript and changed-file ESLint passed. These are
local automated checks, not a new device observation. The original report below
describes the earlier integration; this paragraph supersedes its statement that
all display ordering was preserved.

## Purpose and actual scope

Clarified 21 existing educational-catalog descriptions and 63 instruction strings. Attached
four source-reference image files to **two** matching projects, with two explicit missing-photo
notes. These are visual references for the existing procedures, not an import of 28 tutorials.
The other 19 projects remain text-only. All 21 IDs, titles, material categories, materials/tools,
three-step sequences and zero-based progress indices `0, 1, 2` remain in place.

Supporting changes are limited to optional media metadata, a scoped file route, snapshot
copying and image rendering. Existing screen styles, navigation, recommendation/ranking
functions, eligibility gates, warnings, review/publication records, authentication and database
schema were preserved. No migrations, model changes, production data updates, native builds,
reinstallations, commits, pushes or deployments were performed.

Workspace: `C:\Users\Jude\Desktop\SNAPTURE_SYSTEM-NewFEATURES`. Writes succeeded, but this
download has **no `.git` metadata**; `git status --short` and `git rev-parse --show-toplevel`
both report “not a git repository.” Prior edits cannot be identified with Git here. A pre-edit
backup of the eight modified existing files is retained at
`$env:TEMP\snapture-upcycling-before-20261118`.

The downloaded `C:\Users\Jude\Desktop\Documentation` was resolved and copied into the resolved
workspace's `documentation` directory: **52 files copied, no collisions**, no extra
`documentation/Documentation` level. Originals and the similar root-level documents remain.
Only the copied index was subsequently extended; Word/PDF exports and older reports were not rewritten.
Final comparison found 51 original copied files byte-identical, only the authorized README link
different, and no original document missing.

Current code takes precedence over older documentation: `core/recommendations.py` supplies
the 21 educational choices through `scan_ideas`; expert-reviewed `Guidance` records still
follow their separate publication and assessment path. The older management guide's statement
that there is no active educational catalog does not describe this checkout. No review
status or rule was changed to reconcile that historical difference.

## Files and wording

| Repository-relative path | Actual change and reason |
| --- | --- |
| `SNAPTURE_BACKEND/core/recommendations.py` | Clearer summaries/steps; optional `photos` on `hdpe_scoop` and `coconut_bowl`. Existing functions unchanged. |
| `SNAPTURE_BACKEND/core/tutorial_media.py` | Loads repository-owned versioned metadata; serves only explicitly listed JPEGs, with resolved-path containment. |
| `SNAPTURE_BACKEND/core/urls.py` | Adds GET/HEAD `/api/tutorial-assets/<filename>`. |
| `SNAPTURE_BACKEND/predictions/project_views.py` | Copies educational choice photos into existing `reference` JSON when starting or changing an unstarted project. |
| `SNAPTURE_BACKEND/core/data/upcycling/2026-11-18-v1/photos.json` | Source IDs/stages, exact app indices, URLs, credits, rights, captions, checksums and missing-photo records. |
| `SNAPTURE_BACKEND/core/data/upcycling/2026-11-18-v1/hdpe_scoop/*.jpg` | Three copied files: finished scoop, cut section and trimmed section. |
| `SNAPTURE_BACKEND/core/data/upcycling/2026-11-18-v1/coconut_bowl/*.jpg` | One copied finished-bowl reference. |
| `SNAPTURE_ANDROID/src/api.ts` | Optional `TutorialPhotos`/`TutorialPhoto` types on recommendation and project reference; retains `steps: string[]`. |
| `SNAPTURE_ANDROID/src/TutorialPhoto.tsx` | Existing React Native `Image`, configured-host URL helper, fixed basic sizing, accessibility, loading/error notes and source links/credits. |
| `SNAPTURE_ANDROID/src/UpcyclingIdeaChoices.tsx` | Finished photo and credits in existing preview cards, including Change idea choices. |
| `SNAPTURE_ANDROID/src/IdeaDetails.tsx` | Finished and correctly indexed instruction visuals; awaiting-review references still hide content. |
| `SNAPTURE_ANDROID/src/ProjectGuide.tsx` | Snapshot process visuals beside the current instruction; finished photo and credits in existing information/source panel. |
| `SNAPTURE_BACKEND/core/test_tutorial_media.py` | Eight focused route, mapping, compatibility and snapshot tests. |
| `SNAPTURE_ANDROID/__tests__/TutorialPhoto.test.tsx` | Five focused rendering, failure, source-link and saved-guide tests. |
| `tools/verify_upcycling_update.py` | Read-only standard-library audit of catalog invariants, source/manifest correspondence and image bytes. |
| `documentation/UPCYCLING_TEXT_CHANGES.csv` | All 84 before/after text rows: 21 summaries and 63 steps, with IDs/indices. |
| `documentation/UPCYCLING_MEDIA_MAPPING.csv` | All four attached images and two missing-photo mappings, full original URLs and provenance. |
| `documentation/UPCYCLING_TEXT_AND_PHOTO_UPDATE.md`, `documentation/README.md` | This actual-state report and an index link. |
| `documentation/` downloaded contents | Non-destructive documentation setup; original download preserved. |

Examples (the exhaustive review table is [UPCYCLING_TEXT_CHANGES.csv](UPCYCLING_TEXT_CHANGES.csv)):

| ID / field | Before | After |
| --- | --- | --- |
| `hdpe_scoop` / step 0 | Cut away the handle area carefully. | Carefully cut out the handle area of the clean container to form the scoop. |
| `coconut_bowl` / summary | Use a smooth shell as a dry decorative holder. | Use an already-open, cleaned and smoothed coconut shell as a decorative holder for dry, non-food items. |
| `paper_gift_wrap` / step 1 | Flatten the sheet. | Flatten the paper sheet before using it. |

Text-only edits paraphrase the existing actions; they do not assert that an unmatched research
tutorial supports that project. No dimensions, quantities, costs, durations or approvals were added.

## Content and photo mapping

Read-only collection: `C:\Users\Jude\Documents\ChatGPT\Datasets for SNAPTURE\Upcycling Recommendations`.
Read `recommendations.json`, the complete CSV manifest, and the matched/closest relevant
`recommendation.md` records. The HTML index was not used as application code. Every attached
image was visually inspected and byte-compared to its source file.

All asset paths below are relative to the repository folder
`SNAPTURE_BACKEND/core/data/upcycling/2026-11-18-v1/`.
Full repository-relative paths, original image/download URLs, credits, source file paths,
visual types and SHA-256 values are in [UPCYCLING_MEDIA_MAPPING.csv](UPCYCLING_MEDIA_MAPPING.csv)
and the runtime `photos.json`. “Finished” is separate from a progress index.

| Existing app ID | Source ID / material | Source stage → app index | Local asset suffix | Original tutorial / image | Credit / status |
| --- | --- | --- | --- | --- | --- |
| `hdpe_scoop` | HDPE-004 / HDPE | Finished → preview/information | `hdpe_scoop/finished_product-142a605f4146.jpg` | [Tutorial](https://playvolutionhq.com/diy-milk-jug-sensory-play-scoops/) · [Image](https://playvolutionhq.com/wp-content/uploads/2020/01/2020-01-09-09.16.28-1024x1024.jpg) | Jeff Johnson / Playvolution HQ; downloaded finished-product reference |
| `hdpe_scoop` | HDPE-004 / HDPE | 3 → **0** (cut handle section) | `hdpe_scoop/step_03-fece08c0af97.jpg` | [Source stage](https://playvolutionhq.com/diy-milk-jug-sensory-play-scoops/#step3) · [Image](https://playvolutionhq.com/wp-content/uploads/2020/01/2020-01-04-08.50.21-1024x1024.jpg) | Same credit; cut-piece photograph, action not shown |
| `hdpe_scoop` | HDPE-004 / HDPE | 4 → **1** (smooth edges) | `hdpe_scoop/step_04-58ae91f64c25.jpg` | [Source stage](https://playvolutionhq.com/diy-milk-jug-sensory-play-scoops/#step4) · [Image](https://playvolutionhq.com/wp-content/uploads/2020/01/2020-01-04-08.53.55-1024x1024.jpg) | Same credit; trimmed result with scissors, action not shown |
| `coconut_bowl` | COCO-004 / coconut shell | Finished → preview/information | `coconut_bowl/finished_product-d65d291403cf.jpg` | [Tutorial](https://www.instructables.com/How-To-Coconut-Bowl/) · [Image](https://content.instructables.com/FI1/0YTP/G61AVQKK/FI10YTPG61AVQKK.jpg?auto=webp) | goldenbacon / Instructables; downloaded finished-product reference |
| `coconut_bowl` | COCO-004 / coconut shell | 4 → **0** (clean/dry) | No image; explicit note | [Source stage](https://www.instructables.com/How-To-Coconut-Bowl/#step4) | Same credit; dedicated process photo needed |
| `coconut_bowl` | COCO-004 / coconut shell | 4 → **1** (smooth rim) | No image; explicit note | [Source stage](https://www.instructables.com/How-To-Coconut-Bowl/#step4) | Same credit; dedicated process photo needed |

**All attached photos: “Not verified for app reuse.”** Credits and that status are visible in
preview/source areas and retained in project snapshots. No expert/CESD approval is inferred.

Matching limits:

- HDPE-004 uses the same cut-out handle scoop method. Source stages 1 (choose a clean jug)
  and 2 (mark an outline) were not attached to unrelated app steps. The existing app starts
  with a clean container and has a combined cutting instruction; it remains a short overview,
  not a reproduction of the source's full marking/cutting sequence. Source scissors are visible
  in the stage-4 result; the app's existing cutter/sandpaper materials were not replaced.
  Source sensory-use suggestions were not imported: app index 2 still restricts use to garden materials.
- COCO-004 is matched only for an **already-open shell** and decorative non-food use. Source
  stages 1–3 involve supplies/draining/opening a whole coconut and are outside that input state.
  Stage 5 repeats the finished-bowl visual; it is not a sanding-action photo and was not used to
  fill stage 4. The unspecified source sealant was not added or represented as food-safe.
- These brief catalog overviews still need a qualified procedural review before resident publication.
  A source link and a result photograph do not supply missing construction instructions.

### Research candidates not integrated (26)

| Source IDs | Reason for skipping |
| --- | --- |
| PET-001 | Painted character planter requires decorating stages/materials; not the existing drainage-only planter method. |
| PET-002 | Two bottle bottoms plus zipper/glue or alternate stitched route; no existing matching project. |
| PET-003 | Wick, mesh, inverted top and water reservoir are absent from `pete_planter`; similar title is insufficient. |
| PET-004 | Coin-slot piggy bank; no existing matching product. |
| HDPE-001 | Drilled watering jug; no existing matching product. |
| HDPE-002 | Patterned and stitched wallet; not a storage bin. |
| HDPE-003 | Cut/fold gift box with fastener, tissue and ribbon; not the intact labeled storage bin. |
| PAPER-001 | Woven basket; not the app's folded/reinforced paper tray. |
| PAPER-002 | Rolled paper beads and threaded bracelet; not an existing project. |
| PAPER-003 | Cut/glued-spine notepad; not an existing project. |
| PAPER-004 | Glued tube, folded base and paper handles form a gift bag; not sheet gift wrapping. |
| CARD-001 | Glued cereal boxes with diagonal cuts and dividers; not the app's flattened, cut/fold drawer trays. |
| CARD-002 | Rubber-band phone stand; no existing matching product. |
| CARD-003 | Layered picture frame/stencils; no existing matching product. |
| CARD-004 | Diagonally cut cereal-box magazine file; not a desk divider or drawer tray. |
| FABRIC-001 | Braided/coil-glued coasters; no existing matching product. |
| FABRIC-002 | Interfaced corner bookmark; no existing matching product. |
| FABRIC-003 | Patterned, hemmed, overlapping-back earbud pouch with keyring; different from generic sewn/tied storage pouch. Hand-cut source stages 2/7/8/9/10/11 were not treated as app indices. |
| FABRIC-004 | Covered-button magnets; no existing matching product. |
| COCO-001 | Drilled drainage planter differs from the existing liner/plant-holder overview and materials. Illustrations do not demonstrate preparation/drilling; source stages 3 and 5 lack photos. |
| COCO-002 | Earring design, sawing/drilling and jewelry findings are not the generic shell-craft procedure. Stage 7 shows attached findings, not ear-wire manufacture. |
| COCO-003 | Hinged/hasped jewelry box differs from the open decorative bowl; prepared halves do not demonstrate shell opening. |
| WOOD-001 | Drilled pencil holder; not the shelf, markers or generic craft procedure. |
| WOOD-002 | Screwed/glued phone and photo stand; no existing matching product. |
| WOOD-003 | Clip photo display with mounting hardware; no existing matching product; stage 2 lacks a photo. |
| WOOD-004 | Joined catch-all tray with rod/pegs; not an existing matching product. Stage 5 shows the result, not finish application. |

The 19 text-only app projects are: `pete_planter`, `pete_organizer`, `pete_seed_set`,
`hdpe_planter`, `hdpe_storage`, `cardboard_organizer`, `cardboard_divider`, `cardboard_craft`,
`paper_gift_wrap`, `paper_organizer`, `paper_craft`, `fabric_cleaning_cloth`, `fabric_pouch`,
`fabric_patchwork`, `coconut_planter`, `coconut_craft`, `wood_shelf`, `wood_marker`, `wood_craft`.
They have no exact collected product/method match. No candidate was added under a new or relabeled ID.

## Data flow and compatibility

1. Catalog text lives in `core/recommendations.py`; `photos.json` supplies optional metadata for
   its two matched educational entries. The image binaries live beside that manifest under
   a dated version plus content-hash filenames. They are outside uploaded `media/`.
2. Existing scan/assessment serialization naturally carries the optional choice `photos`.
   `scan_ideas.py`, `assessment.py` and their selection/gating functions were not edited.
   The public library's pending/reviewed records are not automatically enriched by ID/title.
3. Photos contain origin-relative `/api/tutorial-assets/...` URLs, never Windows or `file://`
   paths. Android `publicFileUrl` resolves them against the existing `API_BASE_URL` host.
   No third-party image hotlinks are used by `Image`; original URLs are provenance only.
4. The new route is intentionally public for the explicit repository-owned research assets,
   consistent with general reference content. Exact manifest allowlisting plus resolved-path
   containment rejects arbitrary paths, manifests and private scan/scene files. GET/HEAD only;
   JPEG MIME type, `nosniff`, immutable cache headers. Missing binaries return 404.
   Existing authentication, publication filters and private-media routes were not modified.
5. A newly started educational project copies `photos` into existing `UserProject.reference`
   JSON alongside its existing educational review/source fields. Its text is saved through the
   existing `summary`/`steps` snapshot. The common `_project_values` path does the same for an
   allowed unstarted Change idea. No table/model/migration changes were needed.
6. Reads/retries, reopening another saved target, progress, undo and restart do not fetch current
   catalog photos or rewrite saved instructions. Legacy projects without `reference.photos`
   render as text-only. Existing server Change idea locking remains authoritative.
7. The chooser and details render finished visuals; details and the saved guide filter images by
   explicit **zero-based app index**, not source number. The guide's source panel shows the
   finished photo, original source link, credit and unverified permission status. Failed/missing
   images leave instruction text and progress controls available. No new image dependency was added.

## Setup and verification

Use [the current runbook](../RUNBOOK.md) and the maintained
[Android connection guide](guides/ANDROID_WIRELESS_DEBUGGING_AND_TROUBLESHOOTING.md).
Prerequisites remain Python 3.13 with the project's pinned requirements, Node 22.x and locked
Android dependencies; an existing configured backend environment/account; Metro for a debug
app; and an already-installed compatible app/device with debugging authorization. Native
builds additionally need the JDK/Android SDK versions in the runbook. Do not reinstall/reset
the app or database to view these changes. The source collection is needed only for the optional audit.

Normal backend terminal, from this repository root (keep existing private configuration):

```powershell
Get-Content .\SNAPTURE_BACKEND\.env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settingName = $matches[1]
        $settingValue = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($settingName, $settingValue, 'Process')
    }
}
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py check
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py runserver 0.0.0.0:8000
```

This change needs no migration. In a second terminal: `Set-Location .\SNAPTURE_ANDROID` then
`npm.cmd start`. On an already configured USB phone/emulator, use the existing serial:

```powershell
adb devices -l
$targetSerial = 'replace-with-existing-device-serial'
adb -s $targetSerial reverse tcp:8000 tcp:8000
adb -s $targetSerial reverse tcp:8081 tcp:8081
```

Keep `API_BASE_URL = 'http://127.0.0.1:8000/api'`. Existing wireless users should retain their
configured runbook connection. No hosts/ports were changed here. Reload the existing debug
app only after the backend/Metro are available. Assess/confirm a suitable clean HDPE container,
retain all existing history/condition checks, and choose **Garden scoop** when the normal flow
offers it. The preview should show the scoop; the guide should show source stage 3 at step 1
and source stage 4 at step 2. Open **Project information and source** for the finished photo,
credit and tutorial link. A suitable coconut shell's **Decorative bowl** should show explicit
missing-photo notes at steps 1 and 2. Reopen an older saved project to check its original text
and progress. A saved scan's older snapshot will not acquire new photos automatically.

### Actual check commands and evidence

The expected `.venv`, system Node/npm and ADB were absent. For verification, bundled Python
3.12.14 and Node 24.22.1 were used; this is not a claim of a Python 3.13/Node 22/device run.
Django 5.2.17, PyMySQL 1.1.1 and OpenCV 5.0.0.93 were installed into a temporary test dependency
directory, without editing project requirements. Android `npm ci --ignore-scripts --no-audit
--no-fund` installed the existing lockfile through bundled pnpm's npm launcher. Both package
manifests remained byte-identical. Tests used synthetic temporary/in-memory data only.

These variables reproduce the executables and isolated backend import path used here:

```powershell
$runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
$python = Join-Path $runtime 'python\python.exe'
$node = Join-Path $runtime 'node\bin\node.exe'
$env:PYTHONPATH = Join-Path $env:TEMP 'snapture-upcycling-testdeps'
```

| Check | Exact command/procedure | Actual result / limitation |
| --- | --- | --- |
| Django configuration | From root: `& $python SNAPTURE_BACKEND/manage.py check` | **Verified:** no issues. |
| Source/identity audit | `& $python tools/verify_upcycling_update.py --reference-root 'C:\Users\Jude\Documents\ChatGPT\Datasets for SNAPTURE\Upcycling Recommendations' --baseline "$env:TEMP\snapture-upcycling-before-20261118\SNAPTURE_BACKEND\core\recommendations.py"` | **Verified:** all 21 IDs/categories/order/titles/materials and three-step counts unchanged; recommendation/question function ASTs unchanged; 21 summaries/63 steps changed; all four images match original bytes and CSV provenance; two missing-photo mappings. Semantic wording/method review was also performed. |
| Backend routes, snapshots, old API behavior | From `SNAPTURE_BACKEND`: `& $python manage.py test core.test_tutorial_media core.test_scan_ideas core.test_assessment predictions.test_catalog_projects predictions.test_project_change_idea predictions.test_project_restart predictions.test_photo_privacy --noinput --verbosity 1` | **60 passed of 62; 1 failure, 1 error.** All eight new media tests pass. Remaining two real-face-detector tests are blocked by the existing Git LFS model pointer described below. |
| Route security/absent images | Included in `core.test_tutorial_media` above | **Verified:** GET/HEAD bytes/MIME; absent binary 404; manifest/unknown/private-media paths, encoded traversal, Windows-style traversal and even a malicious allowlist entry rejected; POST 405. No actual private user image was used. |
| Snapshot/progress/Change idea | Same backend command; focused snapshot cases plus existing project suites | **Verified:** server ignores client-supplied text/photos; creation snapshots metadata; retries/catalog edits don't rewrite snapshots; legacy text/progress retained; Change idea keeps the project ID and snapshots new metadata; started/undone/completed/restarted locks and ownership tests remain passing. |
| Android focused checks | From `SNAPTURE_ANDROID`: `& $node node_modules/jest/bin/jest.js --runInBand TutorialPhoto ProjectGuide ChangeProjectIdea IdeaReferences ProjectData` | **Verified: 26 tests / 5 suites pass**, including five new photo tests. Covers configured-host URLs, loading, failed/missing photos, exact step indices, credits, original source opening/error, pending content, legacy guides and progress with a missing photo. Renderer tests do not establish native image display. |
| Broader Android regression probe | Same Jest command with `TutorialPhoto ProjectGuide ChangeProjectIdea CatalogProjectFlow ScanUpcyclingIdeas IdeaReferences ProjectData` | **29 passed, 3 failed.** Same three failures reproduced in a separate temporary copy with the backed-up pre-edit source files; not repaired or assertions weakened. See below. |
| TypeScript | From `SNAPTURE_ANDROID`: `& $node node_modules/typescript/bin/tsc --noEmit` | **Verified:** passes. |
| Changed-file lint | From `SNAPTURE_ANDROID`: `& $node node_modules/eslint/bin/eslint.js src/api.ts src/TutorialPhoto.tsx src/UpcyclingIdeaChoices.tsx src/IdeaDetails.tsx src/ProjectGuide.tsx __tests__/TutorialPhoto.test.tsx` | **Verified:** passes. |
| Manual image matching | Viewed all four attached image files; compared source descriptions, stages, notes and CSV rows | **Verified:** two finished references and two prepared-result references, no borrowed gap-fill images. |
| Phone/native layout, network and real image load | Device procedure above | **Not tested:** ADB unavailable; no connected-device/Metro/native build observation or screenshot claimed. |

Existing unresolved checks:

- `test_no_faces_preserves_pixels_and_real_detector_handles_blank_image` errors and
  `test_small_saved_item_crops_are_not_rejected_as_invalid_camera_uploads` fails (503 vs 200).
  `SNAPTURE_ML/models/privacy/face_detection_yunet_2023mar.onnx` is a three-line Git LFS pointer,
  not the expected 232589-byte model. Initially OpenCV was also absent from the temporary test
  environment; installing it revealed the existing model issue. No model file was changed.
  Mocked redaction/fail-closed route checks still pass; full real-detector privacy validation is pending.
- The broader Android probe fails `capture, analyze, choose task, finish steps and land in
  Projects completed` (timeout), `fabric Change idea returns directly to the original blanket
  choices and reopens its saved cloth project` (chooser not found), and `scan result keeps
  general ideas out of the action selection so belongings are not treated as craft supplies`
  (expected control missing). The pre-edit comparison under
  `$env:TEMP\snapture-upcycling-android-baseline-20261118` used the same test files/dependencies,
  restored all four changed Android source files and reproduced **the same three test names**
  with `--runInBand CatalogProjectFlow ScanUpcyclingIdeas --json --outputFile=baseline-results.json`.
  The old suites also emit React `act` warnings. These unrelated flow/test issues remain pending.

## Known gaps and publication status

- **COCO-001 stages 3 and 5:** missing dedicated photos; the whole record is unmatched.
  Its stage-1 whole-coconut and stage-2 stick/opening illustrations do not demonstrate prepared
  shells or drainage drilling. Stage 4 shows planting, not a separate soil-filling action.
- **COCO-004 stage 4:** missing; visible notes remain on both related app indices. No finished
  bowl photo is passed off as cleaning or sanding.
- **WOOD-003 stage 2:** missing; whole record unmatched. No different photo is borrowed.
- No source illustrations were attached. Prepared pieces/results were explicitly captioned.
  Other `visual_note` restrictions remain reasons for skipping rather than claims of an action photo.
- `pete_planter` retains the existing **Self-watering planter** title as required, but its existing
  procedure is drainage-only. PET-003's wick/reservoir method was not substituted. Resolve that
  identity/content inconsistency in a separately authorized reviewed content revision.
- Several original three-step entries are high-level overviews and omit detailed construction
  stages (for example bottle-organizer cutting). This task did not invent missing procedures,
  insert/reorder checklist stages or change materials to make a source fit.
- **Pending publication work:** obtain reuse permission or replace photos with licensed/original
  images; obtain actual qualified review of the exact procedures/materials; complete device
  verification and the existing publication workflow. Downloaded research references establish
  neither a reuse license nor expert/CESD approval. Local prototype implementation does not
  complete the manuscript, system or resident-facing release.

## Maintenance

Edit only allowed summaries and wording within existing step positions. Do not change IDs,
titles, categories, materials, meanings, list counts/order or progress indices as a wording fix.
Use a new reviewed content version for a genuinely different procedure through the existing
workflow, under separate authorization. Do not alter published digests or historical projects.

For a genuinely matching replacement visual, inspect its actual pixels, `source_step`, branch
and `visual_note`; retain the original tutorial/image URLs, creator, permission status and
explicit app index. Add a **new dated content directory and hash-named assets**; never overwrite
old bytes at a snapshot URL. Keep earlier manifests/assets: the route's allowlist reads retained
version manifests, while catalog choices select the current version. Keep absent-image entries
with `url: null`; do not use result pictures as missing process photos. Copy only matched assets.

Run the audit and targeted Django/Jest/type/lint checks above, review every before/after text
row, then perform native-device checks. The optional source/baseline audit arguments are for
local review; the app itself needs neither the external collection nor the temporary backup.

## Selective recovery

No recovery was executed. Compare the pre-edit backup with the current eight modified files
listed above, then reverse only this task's wording/import/photo-rendering/route/snapshot hunks.
If later edits exist, merge those hunks manually rather than copying a whole old file over them.
The backup includes the copied documentation index before this task's link was added.

New application files belonging only to this task are `core/tutorial_media.py`,
`core/test_tutorial_media.py`, `core/data/upcycling/2026-11-18-v1/` (one JSON/four JPEGs),
`src/TutorialPhoto.tsx`, `__tests__/TutorialPhoto.test.tsx` and
`tools/verify_upcycling_update.py`. New report artifacts are this report and its two CSVs.
Keep versioned assets if any subsequently started project snapshot references them; removing
them would yield the supported unavailable-image note. Do not erase or regenerate those snapshots.

Preserve the 52 copied manuals/guides and their downloaded originals unless documentation
setup is explicitly being reversed after comparison; no root-level duplicate should be deleted.
Local helper scripts/logs under backend `.local/`, temporary verification packages and ignored
Android `node_modules` are development artifacts, not application content. Do not reset Git,
databases, scans, accounts, app storage or unrelated files to undo this update.

## Final checklist

- **Implemented:** 21 summaries, 63 step strings; two matched projects; four attached image
  files; two explicit missing-photo mappings; optional metadata/route/rendering/snapshot support.
- **Implemented:** documentation merged non-destructively, index extended, full wording/media
  tables saved, source download and historical documents preserved.
- **Verified:** IDs/order/counts/functions, image/provenance correspondence, eight new backend
  tests, 26 focused Android tests, TypeScript and changed-file ESLint.
- **Unresolved:** two existing real-detector checks blocked by a model pointer; three broader
  Android failures reproduced before this task; 26 incompatible research candidates skipped.
- **Not tested:** native-device display, actual phone forwarding, full production runtime/build.
- **Next action:** team reviews the text/media tables, resolves the existing runtime/test
  prerequisites, verifies the existing app on a device, and obtains photo/procedure clearance
  before any resident-facing publication.
