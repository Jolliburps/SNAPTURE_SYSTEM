# Feasibility implementation - 2026-10-18

## Scope and user interface

Six active categories: PETE bottles, HDPE containers, cardboard, paper,
fabric scraps and dry untreated wood scraps. Coconut shells are excluded at
the user's request. Its original images, checkpoint output and historical
records are preserved. The existing seven-output experimental classifier is
not mislabeled as a newly trained six-output model; a coconut prediction is
rejected instead of relabeled.

The existing login, dashboard, navigation and camera remain. A scan now leads
to **Assess this item**, where the user confirms relevant details and gets
independent material, segregation and project results. **Waste > Assess an
item without a photo** provides the manual route. It records zero AI confidence
and identifies the result as user-selected. It does not count as a successful
camera recognition.

## Content and safety boundaries

The new core.Guidance table holds versioned segregation rules and projects,
sources, restrictions, requirement answers, review provenance and publishing
state. Django Admin supports draft -> reviewed -> published -> archived with
an explicit `core.review_guidance` permission. Changed published content with
an invalid digest is excluded. Creating a newer version prevents the old
version from silently resurfacing after withdrawal. Ordinary accounts cannot
publish content or write approval flags through prediction endpoints.

The user authorized Google/public-source research because CESD review material
is not available. `seed_reference_guidance` therefore publishes clearly labeled
**source_checked** references, not CESD-approved or expert-tested content.
It adds four conditional preparation/recovery references (paper, cardboard,
PETE and HDPE) and three low-complexity reuse adaptations (paper wrapping,
cardboard collage and fabric dusting). Local collector acceptance, dates and
bin colors are NOT inferred from US sources or older Bacoor announcements.
Other projects and unsupported local classifications remain unavailable.

Sources accessed 2026-10-18:
- DENR-EMB/NSWMC, general segregation context (search-accessible; direct page
  blocks automated fetching): https://nswmc.emb.gov.ph/sampulna-solid-waste-segregation-remains-a-major-challenge-in-ph/
- US EPA, common recyclables (not Bacoor collection rules):
  https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables
- US EPA, Consumer's Handbook, EPA 530-K-96-003 (adapted reuse suggestions):
  https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P100047Q.TXT

Unknown answers are not negative answers. Chemical history, contamination,
damage and unresolved wood treatment prevent positive prototype projects.
Plastic marks require a readable code. Matching a material never automatically
qualifies it for a project. A reference recovery result can be available while
all project recommendations are withheld. Confidence is not accuracy.

New assessment snapshots preserve context, rule versions and source digests.
Current guidance is rechecked before selection or starting a saved project,
so withdrawing content cannot be bypassed using a saved recommendation ID.
No existing user records are deleted. Uploaded images must be readable and
within explicit file/pixel limits; the UI's visual photo checklist is not an
automatic blur or object-count detector.

Collection notices now have a separately published, digest-checked record tied
to a reviewed information source. The calendar requests notices for the user's
barangay and selected month. No real collection dates have been seeded: older
web announcements are not treated as a current recurring schedule.

## Local setup

Back up the local SQLite database before migration, then from SNAPTURE_BACKEND:

```powershell
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py migrate
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py seed_reference_guidance
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py test --noinput
```

No database platform replacement, external recognition API or paid subscription
is necessary. The optional free GPU workflow is documented in
`SNAPTURE_ML/FREE_TRAINING.md`. Its notebook requires deliberate, authorized
image upload; nothing is uploaded automatically. No new training accuracy or
80% per-category guarantee is claimed.

## Runtime verification and remaining evidence

The local database was backed up to the ignored `.run-logs` directory before
migration. Existing account/scan/project counts were unchanged afterward.
Backend, app, data-review and model-selection tests pass; TypeScript and
targeted lint checks pass. The bundled Android release APK builds successfully.
No phone was attached, so physical-camera/UI validation is still pending.

An existing-checkpoint smoke run produced both withheld and incorrect folder
matches, including a paper sample suggested as cardboard. These local candidate
images may overlap training and have unreviewed labels, so the run is not an
accuracy measurement. It does show that a high score is not proof of correctness.
The unverified checkpoint therefore always requires explicit user material
confirmation before guidance is unlocked, including high-confidence suggestions.
No new model was trained or promoted. A local inventory contains 14,889
six-material candidates; zero were automatically marked reviewed.

CESD/adviser agreement on final local category names, exact item rules and
expert-tested project instructions is still required. Public-source adaptations
are interim educational references. Budget/hosting, verified collection feeds,
physical-device usability, representative labeled data and independent model
evaluation remain separate requirements. This is not a claim of public-deployment
readiness or a completed resident study.
