# Guide completion and automatic scan refinements

## Project guides

The shared `src/ProjectGuide.tsx` is used from project lists and scan-result
recommendation links. Saving an unfinished step advances after 500 ms. The last
unfinished step uses **Finish**; there is no Next button on the last step. Earlier
unfinished steps must still be checked: jumping to the end never fabricates their
completion. Save errors remain visible and do not advance the guide.

Previous and the step list support review. **Undo this step** is secondary.
Navigation cancels a pending transition so a timer cannot unexpectedly override a
user who has gone back. Timers are canceled when the guide unmounts.

When all steps are saved, the guide displays an animated checkmark, project title,
material, saved step count, qualitative reuse fact and **Done** / **Review steps**
actions. Reopening a completed project starts at this summary. **Do it again**
requires confirmation before resetting the saved checklist. Completed badges and
profile counts come from persisted server progress, not an animation or local-only
flag. Resetting makes the project active again; counts describe current project
states, not lifetime completions.

`POST /api/projects/<id>/restart/` is owner-scoped, requires completion, and checks
that the source assessment still permits the published project. Deleted source
scans or withdrawn/changed guidance require a fresh assessment rather than an
unsafe automatic restart. Existing completed history is not removed when restart
is denied. Step updates and restart are transactional.

The current step and its action come before the review list. Caution stays visible
as a compact two-line note with **Read full caution**, rather than occupying most
of the guide. The completion fact does not invent kilograms, carbon savings or a
measured environmental impact.

## One camera flow

The single/multiple selector is removed. Every new photo uses the local detector;
one candidate gets the simpler item-result layout, multiple candidates get grouped
sorting. The legacy whole-image prediction endpoint remains for compatibility,
not as a user-selectable camera mode. Missing detector/network errors point to
manual material selection rather than a removed mode.

## Less clutter in scan results

- Same-family NMS handles plastic bottle/container alternatives and nested regions.
  Near-duplicate boundaries are score-weighted, not unioned into giant rectangles.
  Strong cross-class duplicates are suppressed. Existing saved scenes receive the
  display filters on read; underlying records/files are not silently deleted.
- Proposal score 0.1 retains review candidates. Display score 0.28 gates unverified
  image boxes. These are prototype thresholds, **not calibrated accuracy rates**.
  Low-score or broad/ambiguous regions appear in Needs review, not on the photo.
  Explicitly user-confirmed material can be reviewed without being relabeled as a
  new high-confidence model result.
- At most six eligible boxes appear simultaneously. Each has only a readable
  number badge. Cards contain full names. Box/card selection highlights the other
  representation, scrolls to it and can focus another eligible box.
- Image containment geometry is shared by the photo and overlays so portrait and
  landscape images can be letterboxed without shifting boxes. The preview is
  height-limited to leave space for results and instructions.
- Four named groups have plain labels without repeated question marks. One short
  notice explains that these are suggestions, not disposal approval. Low confidence
  gets a warning indicator rather than displaying every score as if it were accuracy.
- Groups start with at most three cards. Needs review is initially collapsed for
  a multi-item result. Uncertain crop images are visible on selected cards and in
  assessment, so users can tell what is being reviewed even without a drawn box.
- New inference includes keyboard, monitor, watch, computer mouse, laptop and
  phone background queries. Background-looking detections can suppress overlapping
  waste lookalikes, but not a small unrelated foreground item merely inside a
  background region. A visible background notice remains. New background-only
  detections do not create waste prediction records. Discarded electronics still
  need an appropriate local route; this is not a claim that electronics can never
  be waste.
- Photo warnings are above the image, fully wrapping. Pixel-based blur/lighting
  signals remain conditional. Edge/crowding warnings are based on display-eligible
  objects, so a low-confidence giant background guess does not by itself produce
  an edge warning. These checks remain heuristic.

## Group guidance

Each group explains its suggested category. Item-specific preparation comes only
from matching published guidance. Otherwise the UI provides conditional CESD
learning/referral options and asks for item review. Unknown chemical containers
are not automatically told to rinse, flatten or reuse.

Up to two eligible published projects appear per group. **Open guide** selects the
recommendation, starts/reuses the owned project through the existing server checks
and opens the shared guide directly. Projects are not invented to fill empty bins.

## Verification and remaining limits

Physical-phone review confirmed that an existing completed paper project opens
the completion summary with its saved 3/3 count, and that the camera has no mode
selector. The gallery thumbnail still requires the user's media-preview permission;
the picker remains available without granting broad gallery access.

The review also caught the Waste page's photo-history link below the fixed bottom
navigation. It now lives inside the page's scroll content, near the heading, with
a 46 dp minimum tap target. A regression test verifies its scroll ancestry and
navigation callback. The updated app suite has 25 passing tests; TypeScript,
targeted ESLint and the release build pass. The final APK was installed after USB
reconnection. Physical review confirmed the history link is visible and opens the
saved photo, and its Needs review group expands into readable full-name cards.
The saved desk photo's weak proposals are not drawn as boxes or assigned to bins.

The backend was restarted after the interrupted server stopped. The development
app still requires that backend and
the USB port-8000 reverse mapping; it is not an offline deployment.

Regression coverage includes step timing, Finish, undo/review, completion on
reopening, confirmed reset, failed-save retry, owner-scoped restart, withdrawn
guidance, duplicate and background suppression, conditional warnings, box/card
selection and letterbox coordinates.

A fresh read-only detector smoke check on the user's saved desk photo identified
computer/background regions but still produced weak and mistaken waste proposals.
These changes improve presentation and fail-safe review; they do **not** establish
reliable waste recognition. No retraining, accuracy claim, exhaustive object
detection or CESD endorsement follows from this update. Human box annotations and
a held-out local waste test set are still needed.

The original photo, completed projects and scan records are preserved. No GitHub
commit or push is implied by this local implementation.
