# SNAPTURE upcycling architecture and implementation

## Inspection before implementation

The restored system uses React Native 0.87 and TypeScript for Android, a Django 5.2 backend, a React/Vite CESD administration client, and a shared local SQLite database (with an optional MySQL configuration). Resident authentication uses bearer tokens. CESD web accounts use Django sessions and StaffAccess records.

The active object detector is the optional local OWL-ViT detector in predictions/scene_detector.py. A separate dataset-trained classifier identifies the seven supported materials. This is not a YOLO runtime; replacing it is outside this upgrade without a verified model comparison. Preprocessing already corrects EXIF orientation, converts to RGB, validates resolution, and applies the visible camera guide crop.

PredictionRecord, ScanScene and SceneItem store recognition results. UserProject stores started project snapshots and checklist progress. Guidance provides versioned published rules. Existing project generation is gated behind a manual screening request and largely matches material, condition and quantity. The built-in educational catalog has no validated numeric dimension requirements.

The CESD models already cover staff, notices, learning resources, schedules and announcements. They do not provide a resident material inventory, explicit photo-backed completion ledger, organization-scoped contests, or structured physical suitability requirements. These responsibilities belong in an additive upcycling module that references existing predictions and projects.

## Implementation boundaries

Preserve all accounts, scans, recommendations, projects and media. Retain the existing detector and Android visual identity. Additional views attach to one PredictionRecord, rather than creating separate inventory items. Early project suggestions are preliminary; they never imply clearance to start. Confirmed matches require project-specific requirements and relevant history. Unknown measurements are not inferred from image pixels.

Visual condition and step assessment require a capable configured vision service. The integration must abstain if unavailable and must distinguish AI observations, user reports, measured values and unknowns. Real-material evaluation requires labeled samples and actual project trials; automated tests cannot establish model accuracy or project success.

## Implemented resident workflow

The existing single-item camera acquisition, guide crop, detector and classifier are preserved. New single-item results open preliminary project suggestions immediately, without the previous mandatory Check item screen. Legacy/mixed-item and historical review screens remain available. The project panel fetches suggestions independently of the legacy manual screening/recommendation cache.

Users can correct the material, add optional front/back/side/bottom views to the same prediction, choose an optional household goal, and select a project to see only its relevant requirements. Additional views are stored under that prediction, not as extra SceneItems or inventory entries. A same-item confirmation is required because physical identity cannot reliably be established by the current classifier. Conflicting views are reported and prevent automatic material acceptance without confirmation.

The visible-condition adapter runs on the primary classifier crop when a scan is created. Additional views call material classification and the same observation adapter. AI observations are displayed with model identity and certainty; confirmed facts and user measurements have distinct source labels. Image pixels are never converted into invented physical dimensions. Corrections to a material clear prior suitability facts.

## Suitability matching and catalog readiness

`upcycling.matching` evaluates each project independently. Requirements can specify compatible object types, dimensions in millimeters, shape, acceptable condition, minimum/maximum quantity, tools, extra materials, safety checklist, goals and photo-checkpoint criteria. Quantity means confirmed usable supply, not object-detection count. A larger stock is not rejected because a project uses only part of it.

Responses distinguish suitable, needs information, more materials, and not suitable. The overall no-match result provides a separate handling fallback. Known chemical exposure, mold and relevant material-history restrictions are not overridden by a matching material label. Damage is accepted only for projects whose requirements explicitly allow it; damage alone is not a universal rejection. Unknown measurements and absent sourced project requirements keep an idea preliminary.

Published expert-reviewed Guidance entries remain reusable project sources. Built-in catalog entries remain educational previews until their physical/safety requirements are sourced and published. `prepare_project_requirements` creates 21 **unpublished drafts** from actual catalog material lists and instructions; it does not invent minimum dimensions, quantities, scoring criteria or expert approval. Open Django admin → Upcycling → Project requirements, complete the requirements from reviewed project sources, and publish them. Empty stock cannot make an incompatible lot suitable: pooled inventory must meet the selected project's checks and have known suitable history.

The main camera flow uses this new suitability endpoint. Older saved-idea/manual flows retain their previous screening and project behavior for compatibility; they are not silently reclassified as physically verified matches.

## Every-step photo process and My Projects

Projects started through the new suitability endpoint store a snapshot with `photo_workflow: true`. Each step requires a distinct photo before the next unlocks. The backend enforces sequence, ownership and image-byte reuse checks; merely pressing Next cannot complete a step. Completed stage evidence is locked so later work cannot silently rely on replaced earlier evidence.

Updated November 20: unfinished photo workflows now require consecutive AI-matched step evidence. An unconfigured or unavailable checker does not advance progress, and documentary photos do not clear completion. The resident can recheck a previously saved unchecked photo using the existing procedure page. Previously completed records retain their original verification status. The percentage counts accepted consecutive steps divided by total steps; it is not model confidence, quality, waste reduction or an official rating.

If a configured visual service fails or returns unusable evidence, the step remains locked for a retry. Only an explicitly unconfigured service uses the documentary-only fallback. Clear, consistent AI observations may refine visible-characteristic and shape checks; uncertain or conflicting observations do not become confirmed facts. User history and measured dimensions retain their separate sources.

The final-step photo is copied into the completed-project record after the user confirms completion metadata and actual materials/quantities. This copy preserves the finished output independently of earlier photo changes. The photo appears as the cover image in My Projects and in Profile → My collection, finished projects and community → Finished projects. Until the finished record is saved, a photo-flow project remains active even if all step photos are submitted. Older checklist projects retain their original behavior and are not falsely labeled photo-verified.

## Inventory and consumption

InventoryLot references an existing prediction through a unique relationship, preventing the same scan from being added twice. Additional views never create extra inventory lots. Quantities can be adjusted or unused lots removed. Consumed material is preserved in history and cannot be reduced below consumption.

Profile collection entries link back to their owned prediction's suggestions, where users can enable compatible-inventory matching as stock grows. Supported examples and exclusions can be expanded from the suggestion panel, and separate recycling/handling guidance remains available from the scan result.

Completion records link through MaterialUsage to owned inventory lots. Completion, availability checks and quantity consumption run in one transaction with row locks. A repeated completion request returns the same record and cannot consume materials again. Materials obtained outside the recorded inventory can be documented separately with names and quantities. The system cannot establish physical identity across separate scans of the same item, so users must avoid adding that item again as a new scan.

## Organization and community features

Organization and Membership reuse existing Django User identities. Organization managers can create programs through Django admin when granted the normal staff/model permissions and a manager membership. A CESD account is not automatically granted cross-organization review powers. Administrators configure organization profiles, memberships and roles; existing CESD content remains unchanged.

Programs include instructions, eligibility, dates, material categories, submission guidelines, published rating criteria, awards and status. Program editing is locked in admin after a submission exists. Residents browse open programs from their profile, confirm eligibility and submit a completed photo-backed project. Program/criteria snapshots are retained with submissions.

Members of the relevant organization review submissions in the profile's Programs panel. Members can also retrieve closed-program queues after the deadline. Reviewers cannot rate their own submissions or another organization's entries. Scores must cover each published criterion exactly once and stay within its integer limits; feedback is required. Recorded official decisions are locked, and participant ratings/recognition appear under Profile → Ratings. There is no community-vote score or automatic award decision. Django read-only records provide audit access; no extra CESD web-dashboard pages were added.

## Database additions

One additive migration, `upcycling/0001_suitability_inventory_photo_projects_community.py`, creates ten models: ProjectRequirement, AdditionalView, InventoryLot, StepPhoto, CompletedProject, MaterialUsage, Organization, Membership, Program and Submission. They reference the existing predictions, projects and users instead of duplicating those records. Unique constraints cover scan-to-lot, photo request IDs, photo digests within projects, completion-to-project, consumption entries, organization memberships and program submissions. Inventory total quantity cannot be below consumed quantity.

The migration is applied locally. Existing records are not deleted or rewritten. Legacy orphan tables left by the previously reverted experiment are not active models and are not reused or erased by this upgrade. A source-only ZIP and pre-change SQLite backup are under `history/upcycling-2026-11-20`; no second Desktop project was created.

## API and operational setup

The new endpoints live under `/api/upcycling/`: capabilities, per-prediction assessment and project suggestions, inventory, project step photos, completions, community, program submissions and submission reviews. Resident APIs use the existing bearer token. Private additional-view, stage and finished photos are served through ownership-checked routes; organization reviewers can access finished images for submissions to their organization. Superuser audit access is supported. Raw upcycling uploads are not served by the existing public media allowlist.

After updating code, run the ordinary Django migration command and restart the backend/Metro. No additional Android native dependency or iOS change was introduced. No external inference API, model download or paid service was enabled.

Set `SNAPTURE_VISUAL_ASSESSOR` to a local Python callable import path only after implementing and evaluating a real vision service. The callable receives a PIL RGB `image` and contextual keywords. For condition assessment, context contains `purpose='condition'`, material and view. For project steps it contains `purpose='project_step'`, instruction, project title, optional checkpoint criterion and prior-photo references.

Its response must contain a nonempty `model` identifier and an `observations` list. Each observation has `field`, `value` and `certainty` (`clear` or `uncertain`). Allowed fields are damage, deformation, wet_appearance, visible_contamination, shape, usable_portions and structural_appearance. Step responses also need `step_status` (`matches`, `needs_correction`, `retake`) and meaningful `feedback`. Unrecognized facts, failures or absent services do not become verified observations. Exact dimensions, chemical history and actual structural strength are not permitted visual facts.

## Validation and remaining work

See [UPCYCLING_VALIDATION.md](UPCYCLING_VALIDATION.md) for the real-material protocol and evidence status. The existing evaluations app remains available for immutable evaluation runs, case snapshots and qualified recommendation judgments; this upgrade adds no duplicate evaluation tables. The optional trial-log summarizer only aggregates researcher-recorded physical trials with evidence files.

Remaining external work: source and publish each project's physical requirements; configure and validate a capable visual assessor; collect actual samples and conduct project trials across all seven categories; configure organizations, reviewers and program rules. Automatic strength, chemical-history, wetness and arbitrary craft-stage accuracy are not claimed. The software does not guarantee detection of reshot or manipulated evidence and does not claim fraud prevention.

The file-by-file implementation inventory is in [UPCYCLING_CHANGED_FILES.md](UPCYCLING_CHANGED_FILES.md). A source restore command is available at the project root: `powershell -ExecutionPolicy Bypass -File .\RESTORE_BEFORE_UPCYCLING.ps1 -Preview`. Omit `-Preview` to restore. The database and photos are preserved, and the current source is archived before restoration.

## Interface refinement

The subsequent [five-view scan and saved-result update](MULTIVIEW_SCAN_UI.md) adds managed scan sessions, shared result screens, immutable history and direct collection navigation. It also documents the My Scans spacing fixes and the new Upcycling Space sections.

The upcycling screens now share SNAPTURE's green palette, rounded cards, clear primary actions, compact selected chips and concise status badges. Ideas appear before optional photo details and goal filters. Project instructions have a progress bar and stage indicators, a dedicated photo area and save feedback. Completion uses separate material-name and quantity fields rather than a typed delimiter format. The profile hub has collection/creation totals, scrollable tabs, expandable quantity editors and program details. Backend eligibility and photo requirements are unchanged. The refinement passed 38 targeted Android tests and TypeScript; it has not been visually verified on a physical phone during this refinement session.
