# Photo tutorials on Home

18 November 2026 · Implemented local read-only browsing, not resident publication clearance.

The user authorized adding separate photographed tutorials on Home for all seven
materials, with scan recommendations to be updated later. This expands the
earlier exact-match-only Home preview scope. The original 21 tracked catalog
projects, their IDs/steps and saved progress remain unchanged by this addition.

## Featured tutorials

| Category | Source ID | Separate Home tutorial | Steps | Images |
| --- | --- | --- | --- | --- |
| PETE bottles | PET-003 | Self-watering bottle planter | 3 | 4 |
| HDPE containers | HDPE-004 | Milk-jug scoop | 4 | 5 |
| Cardboard | CARD-004 | Cereal-box magazine file | 7 | 8 |
| Paper | PAPER-003 | Scrap-paper notepad | 6 | 7 |
| Fabric scraps | FABRIC-001 | Braided coasters | 5 | 6 |
| Dry untreated wood | WOOD-001 | Wooden pencil holder | 5 | 6 |
| Coconut shells | COCO-004 | Coconut-shell trinket bowl | 5 | 5 |

Seven tutorials, 35 instruction strings, 41 copied image files (seven finished
references and 34 step visuals). The one additional step mapping has no image:
COCO-004 source stage 4. A visible explanatory note remains in the guide. No
other photo is substituted for that gap. The other 21 collected candidates
remain unimported; the external collection is preserved.

Each identity has the form `tutorial:<source ID>:home-2026-11-18-v1`, distinct
from the existing catalog IDs. These are not aliases for older saved projects.
Source instructions, materials and warning text were retained without inventing
dimensions, timings or omitted construction stages. Materials are carried as one
source materials/tools string inside the existing list field.

All 41 images were visually inspected in seven local contact sheets before
mapping. Metadata retains source stage and explicit zero-based tutorial index.
Additional captions distinguish marked lines, prepared parts, diagrams and
finished results from photographed actions. In particular:

- PET-003 stage 1 shows a marked line; stage 2 shows wick/mesh parts; stage 3
  shows assembly. Its source method includes the wick/reservoir, unlike the old catalog planter.
- HDPE-004 stage 2 is an annotated diagram. Stages 3/4 show cut/trimmed results.
- PAPER-003 stage 5 shows the binding edge, not elapsed drying time.
- CARD-004 stages 5/6 show the covering rather than separate decoration/taping actions.
- FABRIC-001 stage 3 shows tracing around a glass on a sheet, not a felt-specific action.
- COCO-004 stage 5 is a result reference, not sanding/finish application.

Every attachment's original URL, source tutorial URL, creator, status, visual
note, file URL, source stage, tutorial index and checksum is listed in
[HOME_TUTORIAL_PHOTO_MAPPING.csv](HOME_TUTORIAL_PHOTO_MAPPING.csv) (42 rows).
Runtime metadata additionally retains the original relative directory/local file
and original download URL. Credits and **Not verified for app reuse** remain in
the existing detail/source area. Permission must be resolved or images replaced
with licensed/original work before resident-facing publication.

## Implementation and limits

| File/folder | Change |
| --- | --- |
| `SNAPTURE_BACKEND/core/data/upcycling/home-2026-11-18-v1/` | `tutorials.json`, `photos.json`, seven source-ID asset folders with 41 hash-named images. |
| `SNAPTURE_BACKEND/core/home_tutorials.py` | Loads read-only tutorial content and returns independent copies. |
| `SNAPTURE_BACKEND/core/materials.py` | Optional `home_tutorials` per material; existing published/eligible fields retained. |
| `SNAPTURE_ANDROID/src/api.ts` | Optional Home tutorial field using the existing educational reference type. |
| `SNAPTURE_ANDROID/src/MainExperience.tsx` | Home/search use the seven tutorials; Home's View all opens the same read-only list with category filters and detail modals. Existing image component and card styles retained. |
| `SNAPTURE_BACKEND/core/test_home_photo_ideas.py` | Tests category coverage, distinct IDs, all images, explicit gap and server rejection of tutorial IDs for tracked projects. |
| `SNAPTURE_ANDROID/__tests__/HomePhotoIdeas.test.tsx` | Tests Home priority, thumbnails, detail content and absence of a Start action. |
| `SNAPTURE_BACKEND/core/test_tutorial_media.py` | Asset count now covers 45 files: four prior catalog images plus 41 tutorial images; byte/digest/route checks retained. |
| `tools/verify_upcycling_update.py` | Keeps its existing-catalog audit separate from newly authorized Home tutorial manifests. |

The existing tutorial-asset route already reads retained version manifests; no
new arbitrary-file/static-media exposure was added. Its traversal checks and
exact allowlist apply to the added images. The mobile uses the existing API host
and localhost forwarding, never Windows paths or third-party image hotlinks.

Home prefers the seven separate tutorials whenever available, with the prior
exact-match/library previews as fallback for older backend responses. Scan
selection, eligibility, recommendations, project creation, Change idea and
historical snapshots were not extended to these tutorial IDs. The server rejects
attempts to start them. Database schema and publication/review records unchanged.

## Verification

| Check | Actual result |
| --- | --- |
| `manage.py test core.test_home_photo_ideas core.test_idea_references core.test_tutorial_media core.test_scan_ideas predictions.test_catalog_projects --noinput --verbosity 1` | 25 passed; isolated test database. |
| Jest `--runInBand HomePhotoIdeas TutorialPhoto RecommendationOrder LearnHierarchy IdeaReferences --testTimeout=15000` | 15 passed. |
| `node_modules/typescript/bin/tsc --noEmit` | Passed. |
| ESLint `src/MainExperience.tsx src/api.ts __tests__/HomePhotoIdeas.test.tsx` | Passed. |
| Live `/api/materials/` and all tutorial image URLs | Seven categories/titles present; all 41 images returned HTTP 200 and matched source bytes/SHA-256. |
| Source comparison | All 35 strings, seven materials/tools strings and warnings exactly match selected records. Original CSV credit/image URL/rights checked while copying. |
| Original catalog audit via `tools/verify_upcycling_update.py` with source/baseline arguments | Original 21 IDs/category/order/materials, step counts and recommendation functions unchanged; prior four image mappings still match. |
| Metro Android bundle | HTTP 200 after the update. |
| Device visual observation for this addition | Not performed; reload the existing debug app to fetch the new materials feed. No rebuild/reinstall needed for this JavaScript/content update. |

For local startup use `RUN_COMMANDS.txt`: retain backend 8000 and Metro 8081,
then connect the existing debug app over authorized USB/wireless ADB forwarding.
On Home, scroll to **Ideas for a greener tomorrow**, swipe through the seven
photo cards, or open **View all** and filter by material. Tap a card for reference
steps/photos and source credits. No account data, screenshot or secret is in this report.

## Maintenance and recovery

Retain old immutable/versioned paths. Add new version directories for content
changes; preserve credits, rights and stage/index metadata. Keep Home tutorial IDs
outside scan recommendations until that later change is explicitly implemented
and reviewed. Missing images must leave the text usable. Do not relabel a
different procedure under a catalog ID or rewrite old project snapshots.

To reverse this addition, remove only the optional Home field/import,
`home_tutorials.py`, Home-specific selection and tests, and the new content folder
after checking for later dependencies. Restore the earlier asset-count expectation
only if those added assets are removed. Preserve prior catalog assets, UI edits,
user data, source collection and unrelated documentation. No recovery was run.
