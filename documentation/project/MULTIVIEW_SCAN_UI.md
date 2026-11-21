# Scan sessions and interface updates

## Capture and assessment

Opening Scan now displays Front View, Back View, Side View, Top View and Bottom View immediately. Each photo can be previewed, retaken, replaced through the camera/gallery control, or deleted before analysis. At least one photo is needed; all five are available without forcing irrelevant views. Users explicitly confirm the images show the same physical item.

One request sends the primary photo and up to four additional views. The existing detector and classifier process the primary camera-guide crop. Additional views are cropped using their own capture frames and material-classified, then passed to the existing optional visual-condition adapter. The original model is not replaced. These photos become AdditionalView records under one PredictionRecord and one SceneItem, not additional waste items or collection lots. Conflicts require review; no cross-view physical identity or dimension measurement is invented.

The top view is enabled by the additive `upcycling/0002_add_top_view.py` migration. No duplicate scan/session table was added. Existing accounts, scans, inventory, projects and relationships are retained.

## Stable controls and scan layout

Chips reserve the check-icon area in both selected and unselected states. Actions keep the same border, minimum height, icon area and label when expanding. Previous/Next actions occupy equal-width slots. Loading text uses reserved space, and private photos reserve their image frame while credentials load. Long choices can wrap within their containers rather than overflow.

The My Scans header gives its text a shrinkable column and a separate Clear all area. History photos use contain scaling with more inset space. The post-scan image has a padded rounded card, a moderate height, and a clear gap before the material and project sections. The oversized second hero banner was removed. Profile names, email and statistic labels are readable at consistent sizes. Existing Android font scaling is preserved.

## Historical results

New single-item scans save a JSON result snapshot in the existing PredictionRecord image metadata. It contains the original prediction, detected object, condition observations, user-fact provenance, all session photo references, project suitability results and classification. It is written once during the original scan. The private `/api/upcycling/predictions/<id>/result/` endpoint retrieves it without rerunning detection or regenerating projects.

Live and saved single-item results share ScanResult. Saved projects and their original instructions are read-only: later catalog edits do not replace them. Explicit changes to current item details do not overwrite the original snapshot. Older scans without snapshots keep their previous saved-result interface; the system does not fabricate historical recommendations that were never stored. Deleted or missing photos show an unavailable message instead of preventing result review.

## Hazardous and unsupported results

Hazardous results show WARNING, HAZARDOUS WASTE, a reason, the ineligibility statement and Done. No project list is displayed. Unsupported results show the item photo, Unsupported Material, the seven-category explanation and Done; no projects are displayed. Unknown or out-of-scope objects do not automatically become hazardous. The existing precautionary glass special-handling policy is preserved and explained; this is not a new claim that all unsupported items are hazardous.

## Collection and upcycling space

Find something to make opens a separate recommendation page directly, with compatible collection matching enabled from the start. It no longer inserts a recommendation dropdown inside the collection list. Matching pools only available, compatible material quantities. Dimensions, shape, thickness, confirmed condition, resin/history checks and project requirements still apply. Missing quantities are reported; incompatible lots are excluded. Capturing more views cannot add inventory stock.

Upcycling Space now shows only Collection and Ratings in one compact two-button row, following the user's simplified navigation request. My Projects, Completed Projects, Saved/Favorite Projects, My Skills and Programs were removed from this hub. Existing project routes, stored projects, photos, inventory, organization records and ratings are retained. New projects can still start from collection recommendations and complete their photo workflow; returning from that workflow opens Collection.

My Scans and Upcycling Space use a compact shared header with a left-aligned Profile back control and, in Upcycling Space, a right-aligned Refresh control. The header uses real icons and dedicated navigation controls. Upcycling modal pages, including collection recommendations and the project photo guide, have their own safe-area provider and view so content clears the phone's status and navigation bars.

No separate Problems section was found in the inspected current Android interface. Local Updates remains unchanged; no unique information was removed under an assumed duplicate label.

## Limits and validation

The vision adapter remains optional and must be configured and validated for automatic condition or craft-step checking. Project requirements must be sourced and published. UI and API tests use mocked model outputs and do not establish real-world accuracy. The supplied screenshots guided spacing and proportions; a physical-device visual review of this update remains necessary.

Tests cover five-view editing and one-request submission, one scene/item with four supplemental views, private immutable results, no detection on saved-result reads, separate hazardous/unsupported rendering, compatible inventory totals, direct collection navigation and all four Upcycling Space sections. A complete test summary is recorded in the implementation history logs.

Verification on November 20: the combined core/prediction/upcycling run passed 264 tests; the final upcycling run passed 19 tests. The targeted Android run passed 41 tests in ten suites. TypeScript, Django system checks and migration consistency passed. Migration 0002 is applied locally. No physical-device visual approval or model-accuracy claim is implied by these results.

The subsequent Programs removal, shared header and modal safe-area changes passed TypeScript and 15 tests across UpcyclingHub, SavedScanReview, ProfileSettingsNavigation and ProjectNavigation. Physical-device layout review remains outstanding.
