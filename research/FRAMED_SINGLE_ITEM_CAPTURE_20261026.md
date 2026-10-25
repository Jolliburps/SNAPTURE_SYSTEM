# Framed single-item capture — 26 October 2026

## Behavior

- A centered square border covers 80% of the shorter live preview dimension. Its geometry is derived from the actual camera preview layout, not screen dimensions or header/control height. Capture stays disabled until layout and camera startup are ready.
- Android uses the compatible preview surface for overlay visibility, explicit center-cover scaling and interface-locked output orientation. The existing camera controls, flash behavior and manual-material option remain.
- The captured normalized rectangle is frozen at shutter time and passed to the server with `single_item=1`. Review displays the same center-cover aspect and border. Gallery images use a clearly reviewed central square rather than inheriting the live camera's aspect.
- The server EXIF-orients the image, maps the frame to pixels, and crops before waste detection, material classification, privacy processing or saved previews. Outside pixels are not retained in new framed scan history. Saved result coordinates refer to the cropped image; original frame coordinates are retained only as metadata.
- If multiple reliable object proposals occur inside the frame, return HTTP 422 with a retake instruction. A proposal-limit result also requires a retake. Neither case creates a scan, crops or partial history entry. Person-only frames are rejected rather than forced into the seven material classes.
- If one reliable proposal remains, preserve it as the only item. Duplicate proposals do not create extra items. If no individual object is reliable, run the existing real material classifier on the framed area and return one explicitly material-only result with no detected-object confidence or box. This is not a fake object detection or confirmation that exactly one physical object is present.
- New single-item scenes cannot append more regions or select multiple items. The result UI hides the add-region action and keeps at most one selected item. Existing material/condition confirmation and uncertainty safeguards still apply before projects.
- Legacy multi-item scans and clients remain readable/compatible; old photos, projects and progress are not migrated, deleted or reset.

## Verification

- 143 mobile tests across 35 suites passed, including frame geometry, layout readiness, preview aspect preservation, camera/gallery request metadata, multi-item error feedback and single-selection UI.
- 136 backend prediction/project tests passed, including nine focused single-frame tests. A red-outside/green-inside fixture verifies that only the green ROI reaches detection and saved previews. Tests also cover duplicate regions, multiple-item rejection without partial writes, body-only rejection, real material-only fallback, frame validation, history/idempotency and extra-region/selection guards.
- TypeScript, touched-file lint checks and Android release build succeeded. Installed with `adb install -r`, preserving app data; the local backend was restarted.

## Limitations

This enforces an intended single-item workflow and hard input crop, not perfect object counting. Missed or incorrect model proposals remain possible. Full preview-to-photo field-of-view alignment must also be checked on physical devices; automated geometry tests alone do not certify every camera's native framing. No new training, checkpoint replacement, dependency or schema migration was introduced.
