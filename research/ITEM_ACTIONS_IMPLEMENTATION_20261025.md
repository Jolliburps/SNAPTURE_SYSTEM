# Item actions and recognition data update

## Camera result flow

1. Capture/pick a photo using the unchanged camera controls.
2. Review real detector suggestions; select **Keep**, **Discard**, or
   **Recycle / upcycle**, then a condition. A box tap alone never silently
   chooses Discard. Belongings are not automatically waste.
3. Low-score proposals are hidden behind an explicit review option instead of
   flooding the photo. Continue to a compact result: chosen action, conditional receiving group,
   at most three next steps and a short safety note. Existing assessment,
   recommendation and source details remain expandable.
4. Matching safe reuse ideas open existing persistent step-by-step projects.
   General catalog ideas are labelled educational, not CESD-approved. Cleaning,
   damaged/contaminated condition, conflicting object queries and suspected
   hazards prevent premature project starts. Existing projects remain intact.
5. Selection, condition and advice snapshots stay attached to their own item and
   photo. History never takes instructions from the most recent camera scan.

No photo can establish whether a user wants to discard an object, its hidden
contents or its treatment/contamination. The action suggestion is conditional,
not an autonomous keep/discard decision or a safety certification.

## Waste groups and safety

The user-provided CESD interview excerpt reports 52% biodegradable, 18%
recyclable, 16% residual with diversion potential, 4% special/hazardous and 10%
residual. These are composition shares, **not model scores, priors, confidence
thresholds or evidence that an individual object belongs in a bin**.

Food scraps get suitable-organics guidance, not unconditional backyard composting
of cooked/oily foods. Diversion candidates require an accepting current program;
no buyer, price, partner or Bacoor drop-off address is invented. Glass is handled
separately, but is not automatically hazardous. The app explicitly says **do not
break or crush glass yourself**, and separates bottle/jar from window/jalousie
glass. Suspected chemicals, sharps, batteries and electronics retain conservative
separate-handling instructions, even if another material is reported.

General reference sources:

- [US EPA: common recyclables](https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables)
- [US EPA: home composting](https://www.epa.gov/recycle/composting-home)
- [US EPA: electronics donation/recycling](https://www.epa.gov/recycle/electronics-donation-and-recycling)
- [US EPA: household hazardous waste](https://www.epa.gov/hw/household-hazardous-waste-hhw)

These are general references, not substitutes for a current CESD acceptance list.

## Recognition limits and next ML work

See `../SNAPTURE_ML/data/DATASET_INDEX.md` and
`recognition_basis_summary.json` for actual counts, provenance and holds.
64,744 unique photo groups are available for review; 21,939 map to the seven
material folders. Other/broad/mixed scenes are separate. The new annotation
checks covered 9,536 photos and 41,171 boxes before duplicate exclusions.

More files alone do not fix false detections. This update adds an ambiguity guard
to action guidance: near-tied, different object queries are not interpreted as
agreement, and cannot open a reuse project without checking the object. It does
not pretend that guard trains the detector or measures accuracy.

Before training a replacement: review source labels/licences/privacy, map object
classes without inventing PET/HDPE or chemical-safety labels, resolve duplicate
split leakage, group repeated physical items/video sequences, and collect an
independent Bacoor phone test set including non-waste belongings and unfamiliar
items. Train a separate candidate, compare per-class precision/recall, localization
metrics, false positives on non-waste objects, unknown rejection and end-to-end
guidance correctness before promotion. No blanket 80% or all-waste claim is made.

## Compatibility

Uses existing JSON storage; no database migration, external paid API, upload of
private photos or replacement of model weights. Old clients can still submit the
legacy disposal-selection payload. The new action payload validates owner/item
scope, allowed actions and conditions. Existing camera, admin and project-progress
functions are preserved. Added the previously missing coconut-shell category to
the mobile fallback category mapping to match the seven-category backend.

## Verification

- Mobile: TypeScript passed; 31 suites / 118 tests passed. Lint has no errors
  (one pre-existing inline-style warning in `App.tsx`).
- Backend: affected applications passed 167 tests; the final focused suite,
  including the additional unknown-object guard, passed all 44 tests. Django system checks
  passed; the running API loads the existing seven-class candidate and exposes
  the new action workflow. No migration was required.
- ML/data tools: all 37 tests passed. Every new annotation was structurally
  checked; see `detection_annotation_audit.json`.
- The complete backend run found six pre-existing CESD dashboard test failures:
  their expected counts omit the `announcements` field already returned by the
  committed dashboard implementation. That unrelated feature/test was not edited.
- Android release built successfully and was installed with `adb install -r`,
  preserving app data and restoring USB forwarding to port 8000. The phone was
  dozing on its lock/notification screen; visual phone interaction was not
  completed, and no project steps or user scans were created for testing.
- A read-only inference smoke test used three deterministically chosen public
  photos with real OWL-ViT inference and the existing crop material classifier.
  It completed, but included weak proposals and uncertain material results. Cold
  start was about 41 seconds; subsequent photos about 6 seconds on this PC.
  These three examples are not an accuracy evaluation. See
  `recognition_execution_smoke_20261025.json`; no claim that new downloads have
  already improved recognition is warranted.
