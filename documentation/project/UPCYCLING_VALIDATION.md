# SNAPTURE validation protocol and evidence status

## Evidence available

The automated tests exercise API ownership, input validation, state transitions, matching contracts for seven categories, photo sequencing, image reuse checks, inventory accounting, completion image persistence, and organization-scoped ratings. Synthetic image files in tests are transport fixtures, not waste-condition datasets. Configured test requirements and mocked model outputs are test fixtures, not real project validation.

There are no newly collected physical-material trial results from this implementation session. Detection performance, material-classification accuracy, visible-condition accuracy, physical suitability accuracy, recommendation relevance, quantity matching accuracy, user-correction frequency, completed-project rate and user satisfaction remain unmeasured for this upgrade. Do not report passing software tests as evidence of these metrics.

## Software verification on November 20 2026

- Django `test upcycling core predictions`: **259 tests passed**. The upcycling module includes matching fixtures for all seven categories, measurement unknowns, project-specific damage acceptance, hazard exclusions, later history corrections, inventory idempotence, photo sequencing, final-cover persistence, unavailable/failed visual assessment, and organization-scoped rating tests.
- Targeted Android Jest run: **43 tests passed in eight suites** covering SceneResults, PhotoProjectGuide, SuitabilityProjects, ProjectGuide, AutomaticCamera, ProjectNavigation, ProfileSettingsNavigation and BarangayProfile. The single-item route tests now assert immediate preliminary projects rather than the obsolete mandatory material-check screen.
- TypeScript `tsc --noEmit`: passed.
- Django system checks: passed. Migration consistency reports no missing migrations.
- Source recovery command: preview and a disposable-fixture restore passed, preserving unrelated data while archiving the current source.
- An unrestricted all-suite Android run was stopped after taking unusually long without completion. It is not reported as passed. The targeted suites above completed successfully.
- No on-device physical-material accuracy study or fresh APK build is reported for this session. Android native dependencies and configuration were not changed.

## Actual materials to collect

| Category | Include | Exclude or challenge |
| --- | --- | --- |
| PET/PETE bottles | Known code 1 beverage bottles, intact and deformed examples | Unknown resin, glass, chemical history, hidden damage |
| HDPE containers | Known code 2 containers, varying openings and sizes | Unknown resin, chemical contents, misleading packaging |
| Cardboard | Whole sheets, boxes, usable dry scraps | Wet sides, food/chemical stains, mold |
| Paper | Whole sheets, clean torn and crumpled pieces | Coated stock, privacy-sensitive printing, contamination |
| Fabric scraps | Multiple compatible pieces of known dimensions | Mixed layers, insufficient usable area, contamination |
| Dry untreated wood | Known untreated offcuts, measured thickness | Painted/treated wood, embedded hardware, sawdust, mold |
| Coconut shells | Open shells and usable fragments | Sharp or unstable fragments, hidden damage |

Use independent physical items for evaluation and training. Record lighting, angle, device, dimensions measured with a ruler, actual usable quantity, visible damage, relevant item history, and whether another view was needed. Agree on ground truth and project-specific acceptance criteria with qualified reviewers. A photograph cannot independently establish chemical history or structural safety.

## Trial process

1. Assign an anonymous trial ID and record the physical material and ground truth.
2. Capture it in the Android camera and record the real detector/classifier result and model version.
3. Compare AI observations against independently labeled visible characteristics. Mark unavailable observations unmeasured.
4. Capture an additional view only when needed. Confirm it is the same physical item and record whether it resolves uncertainty.
5. Confirm relevant missing measurements and history. Record corrections and time/effort.
6. Compare each project outcome with its sourced physical and safety requirements. Include insufficient quantity and no-match cases.
7. Actually perform an appropriate project with the materials. Photograph each step and record failed or unclear checks.
8. Save the final photo and actual materials/quantities. Verify inventory consumption and the completed-project library.
9. If using a program, submit to a published activity and use a separate authorized organization account to rate it.
10. Record project achievability, completion, participant satisfaction and reviewer disagreement.

## Recording measured results

Store researcher-collected trials in a JSONL file. Each line needs `trial_id`, `category`, `actual_material_trial: true`, and `evidence_file`, which points to a real evidence file relative to the log. Optional boolean metrics are `detection_correct`, `material_correct`, `condition_correct`, `suitability_correct`, `recommendation_relevant`, `quantity_match_correct`, `user_corrected`, and `project_completed`. Use null for unmeasured fields; do not convert unavailable AI outputs into successful predictions. `satisfaction` is an optional integer from 1 to 5.

Run `SNAPTURE_ML\.venv\Scripts\python.exe tools\report_upcycling_trials.py <actual-trials.jsonl> --output <report.json>` from the project root. It reports denominators and null for metrics without observations, rejects duplicate trial IDs, and requires evidence-file presence. It does not certify the truth of researcher labels. Detection correctness rate is a trial-level measure, not mAP; calibrated model evaluation requires labeled bounding boxes and an appropriate evaluation pipeline.
