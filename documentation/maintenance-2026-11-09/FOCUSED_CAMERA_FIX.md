# Focus guide and multiple-object warning follow-up

The user clarified that detection must analyze **inside the existing square guide**. This supersedes the initial full-photo detection default in REPORT.md. The existing camera ratio and guide geometry remain unchanged.

- Camera/gallery confirmation now shows the guide on a cover preview matching the backend's existing frame mapping.
- The mobile request sends the normalized guide to `createScene`. The backend analyzes only that region, maps boxes back to the original-photo coordinates and retains the full original with existing privacy processing for results/history.
- The legacy strict `single_item` flag is deliberately left off. Multiple objects inside the guide are not automatically rejected.
- Two or more accepted model detections show **Multiple objects detected**.
- Separate model regions that still need review show **Possible multiple objects**. This is a caution, not an exact object count or verified detection claim. Overlapping/containing guesses for the same region do not by themselves trigger it; manual marks, duplicates, excluded proposals and whole-photo material suggestions are not extra model detections.
- New completed scans also open a native warning popup automatically, with **Review results** and **Retake photo** actions. It opens once per result presentation rather than repeating on every refresh/selection. Processing results do not trigger it early. Historical scans retain the banner without opening the new-scan popup.
- Uncertain counts, labels, scores and hidden uncertain boxes keep their existing review status. No model threshold or output was changed to manufacture extra detections.
- Existing scans retain their saved analysis and do not rerun inference. Take a new photo to test the selected focus area.

Validation: all 49 mobile suites / 254 tests passed; 41 targeted backend tests passed; TypeScript and ESLint passed. The focus-guide Android production JavaScript bundle also passed; the popup bundle check is recorded separately in `.tools/maintenance/warning-popup-bundle.log`. Tests cover zero/one/multiple accepted objects, separate uncertain regions, overlapping/containing guesses, manual/excluded/duplicate/material-only cases, popup timing/deduplication/retake/history, crop-only inference, original-photo preservation and box coordinate mapping. These tests do not establish model accuracy or prove a physical device tap.

This is a JavaScript change using the backend's existing frame support. Keep the manually started T1/backend and T2/Metro running; reload the phone application through its developer menu, then capture and analyze a new photo. No new launcher, service or native integration was added. Native camera focus/device acceptance and detector accuracy still require representative physical testing.
