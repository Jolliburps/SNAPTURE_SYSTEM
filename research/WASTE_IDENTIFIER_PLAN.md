# SNAPTURE broader waste identification: implementation and research plan

Prepared 2026-10-21. This is an experimental implementation, not a claim of universal recognition, CESD endorsement, or measured accuracy. No new model was trained and no new public dataset was downloaded in this change.

## 1. Architecture and its boundaries

```text
Phone photo / gallery
  -> private local Django scene
  -> existing local OWL-ViT query-based proposals + deduplication
  -> numbered boxes, including uncertain and possible background objects
  -> per-region suggestion + uncalibrated query alternatives (up to 3 actually observed)
  -> UNIDENTIFIED unless material/category evidence is sufficient
  -> user checks cropped region, material, contents, condition, contamination, moisture
  -> independent safety + versioned guidance checks
       -> reference-only segregation / CESD referral for unsupported or uncertain items
       -> expert-reviewed published projects only for eligible six-target materials
  -> optional, explicit image contribution -> pending human review -> MANUAL future training

Missed object -> user marks two corners -> human-marked UNIDENTIFIED region

Offline proposed replacement (NOT deployed):
SAM2 automatic masks -> evaluated proposal deduplication -> trained fine-class model
 -> calibrated rejection on unseen materials -> same confirmation/safety layer
```

OWL-ViT, Grounding DINO and YOLO-World are vocabulary-conditioned detectors; they are not a guarantee of class-agnostic, exhaustive object discovery. A generic `object` prompt is not a universal objectness detector. SAM/SAM2 masks can split one object or merge/miss objects and provide no material, contamination or hazard truth. The research adapter in `SNAPTURE_ML/scripts/open_world_pipeline.py` demonstrates the contract without pretending the weights or validation exist. [SAM2 official repository](https://github.com/facebookresearch/sam2)

The current detector has a minimum proposal score of 0.10, deduplicates overlapping hypotheses, and budgets at most 30 model proposals. All valid *stored* regions stay boxed and reviewable; a limit warning is shown rather than claiming nothing was missed. Human-added boxes have score zero and `input_method=manual`, so they must not improve camera recognition scores. The manual review limit is 60 regions per scene. Use separate photos when crowded.

The initial identity rejection example uses 0.55 plus a margin in the offline adapter. The deployed query scores are uncalibrated: unverified-model predictions still require confirmation regardless of score. Neither a large softmax value nor a CLIP match establishes that an unfamiliar object is in distribution. The live system has not acquired validated open-set performance merely by adding a threshold.

## 2. Taxonomy / mapping

Treat A/B1/B2/C as proposed *handling groups*, not disjoint physical material properties. Paper, cardboard, untreated wood and natural fabric may biodegrade and may also be reusable. B1 can contain these materials; it should not be presented as proof they are biologically non-degradable. B1 means possible recovery, subject to item details and local acceptance. B2 means residual, not simply 'not accepted for recycling'. Lack of recycling access does not prove a hazardous or compostable item belongs in residual. Confirm final labels with CESD. Philippine statutory collection labels include compostable, recyclable, non-recyclable and special waste. [RA 9003](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/4800)

| Fine identity / evidence | Candidate group | Target | Required checks before a project | Output |
|---|---|---|---|---|
| Generic plastic bottle | Unidentified; possible B1 | Unknown | Read actual resin mark; contents/history | Never assume PET |
| Confirmed PET/PETE #1 bottle | B1 conditional | PETE | No chemicals, clean/dry, residue resolved, intact | Expert-reviewed non-food guide only |
| Confirmed HDPE #2 container | B1 conditional | HDPE | Same, plus reliable non-hazardous original use | No chemical-container reuse |
| Plain cardboard | B1 conditional | Cardboard | Dry, uncoated, no grease/mold/private details | Published matching guide only |
| Plain paper | B1 conditional | Paper | Exclude receipts/laminates, grease/mold/private details | Published matching guide only |
| Fabric scrap | B1 conditional | Fabric | Clean/dry, no mold/oil/chemicals, suitable intact fibers | No blanket claim of compostability |
| Wood scrap | Unidentified until history checked | Wood only if known untreated | Treatment history; paint/varnish/stain/pressure treatment, hardware, mold, rot, pests | No burning or structural project |
| Glass / ordinary metal | Possible B1 | Other | Exact item, breakage, contents, local acceptance | General collection reference; no six-target project |
| PP/PS/PVC/LDPE, sachet, composite carton | Unidentified until checked | Other | Resin/composition, contamination and accepting facility | Never map all to B1 or B2 by appearance |
| Food / leaves | Possible A | Other | Actually discarded? Type, contamination, suitable local composting route | Referral/general education; no automatic fertilizer recipe |
| Cigarette / discarded diaper | Possible B2 | Other | Confirm identity and local instructions | No DIY reuse |
| Battery / syringe / bulb / electronic waste / suspect paint container | Precaution C | Other | Do not require handling an item just to confirm it | Special-handling referral; no reuse |
| Unfamiliar or weak evidence / background device | Unidentified | None | User may report Other/category, but that is not verification | Keep box; await review |

Sources and dates are stored per draft idea. General recycling references cannot establish a Bacoor drop-off address or local acceptance. No such address is invented. [EPA common recyclables](https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables)

### Condition and safety

- `UNKNOWN`: answers/history insufficient. No project.
- `NEEDS_HANDLING`: wet, dirty or removable food residue; preparation must be safe and applicable. Complete safe preparation, then reassess. Selecting 'needs cleaning' does not unlock ideas.
- `OK`: required answers indicate clean/dry and no disqualifiers. Still needs confirmed material, quantity and an expert-reviewed published matching idea.
- `NOT_RECYCLABLE`: compatibility name from the requested schema, meaning *excluded from this prototype's reuse projects*, not an authoritative landfill ruling. Chemical contamination, damaged/moldy items, oily or biologically contaminated material and unconfirmed wood history never get a residual assignment merely because this field is set.

The safety gate runs server-side. A user's category choice cannot bypass it. Suspected hazards override a reported B1 group. Unknown chemical containers are not given rinse-and-reuse instructions. The general hazardous reference is a precaution, not camera diagnosis. [EPA household hazardous waste](https://www.epa.gov/hw/household-hazardous-waste-hhw)

## 3. Dataset priorities and rights

See `dataset_registry.json` for checked publisher links, actual useful labels, license scope and holds. Dataset inclusion is not a quality objective by itself. Prioritize local, correctly annotated examples; reserve broad food, clothing and background datasets for limited pretraining/negative roles where justified.

1. RealWaste: broad material pretraining; image labels, not boxes or PET/HDPE proof. Publisher states CC BY 4.0. [UCI](https://archive-beta.ics.uci.edu/dataset/908/realwaste)
2. TACO: context boxes/masks; verify every photo's rights before import. Its toolkit MIT license is not assumed to license all images. Its bottles/containers cannot be automatically relabeled PET/HDPE. [Official toolkit](https://github.com/pedropro/TACO)
3. ZeroWaste: segmentation in an industrial domain; dataset is CC BY-NC 4.0. Do not assume that covers a future commercial client deployment. [Official repository](https://github.com/dbash/zerowaste/)
4. Open Images / COCO: generic object pretraining and background negatives, with separate image-rights checks. [Open Images terms](https://storage.googleapis.com/openimages/web/factsfigures_v7.html), [COCO terms](https://github.com/cocodataset/cocodataset.github.io/blob/master/dataset/termsofuse.htm)
5. TrashNet: only a generic baseline; no resin-specific labels. Code/photo terms need separate treatment. [Original repository](https://github.com/garythung/trashnet)
6. Use a licensed pretrained segmentation model experimentally; do not download the billion-mask SA-1B collection onto this student PC. Model and dataset licenses differ. [SA-1B publisher](https://ai.meta.com/datasets/segment-anything)

Unverified names in the submitted list are recorded as HOLD, not silently imported or described as unavailable. Not finding a suitable public source is not proof no dataset exists.

### Local collection gaps and initial budget

These are **proposed pilot budgets**, not statistical guarantees or images already available. Categories overlap: tag the same example under multiple conditions without counting it as multiple independent objects. Start with 500-1,000 labeled images per fine class where feasible, then use learning curves to decide whether more data helps. Include a substantial number of distinct physical items, not hundreds of views of one bottle.

| Gap | Initial collection target | Capture / labels |
|---|---|---|
| Philippine packaging, household containers and footwear | 600 images across at least 150 distinct items | Researchers photograph consented staged items; second annotator verifies fine identities |
| Batteries, CFLs, power banks, medicines, paint/chemical containers, sharps | 300 safe reference images across at least 100 distinct examples | CESD-authorized staff or licensed archive; never collect/handle actual sharps or chemicals for the study; identify type and uncertainty |
| Diapers, sanitary products, tissue | 150 staged images | Unused clean examples or qualified licensed references; no biological-waste handling or identifiable people |
| Clean/dirty/wet/greasy/mold-like material | 360 images across at least 120 items | Safely stage removable food/water conditions; genuine chemical/mold labels require verified records or qualified references, not appearance |
| Untreated versus coated/treated wood | 300 images across at least 100 pieces | Known-origin stock and labels from knowledgeable supplier/reviewer; unknown treatment stays unknown; no sanding/burning |
| PETE versus other resin; HDPE versus PP; contents history | 600 images across at least 200 containers | Photograph whole object and readable resin/original-content evidence; evidence linked but not shown as a shortcut in test images |
| Crushed cans/bottles and broken-looking objects | 240 images across at least 80 items | Safe staged deformation; use licensed broken-glass reference photos rather than making sharp waste |
| Overlapping/cluttered piles | 300 scenes | Every visible distinguishable item boxed by two annotators; ambiguity/occlusion tagged; do not invent hidden boundaries |
| Lighting, angles and backgrounds | 300 additional views | Multiple phones, indoor/day/dim scenes; keep repeated items/scenes in the same split |
| Composite cartons, multilayer wrappers, waxed/laminated paper | 300 images across at least 100 items | Composition from product markings/vendor evidence; CESD validates local routing |

A 'no known suitable public dataset' flag applies particularly to reliable previous contents, treatment history and local acceptance. Images alone cannot supply this ground truth. Do not ask users to expose private documents or photograph faces. Store permissions, source URLs, acquisition date, SHA-256, near-duplicate cluster, physical-item group, scene group, fine label, box/mask, ambiguity flags, evidence and reviewer identity in an access-controlled manifest. Do not push contributed images to public GitHub by default.

## 4. Training and evaluation protocol

1. Freeze the fine-class dictionary and annotation guide with the adviser and qualified CESD informant; identify what the informant is authorized to validate. Add reviewed Other/Unidentified labels without making 'unknown' a guarantee of open-set coverage.
2. Collect a pilot and have two independent annotators label before looking at predictions. Adjudicate disagreement. Label 'not waste / not discarded' separately from material identity.
3. Partition by physical item, household/session, scene and near-duplicate cluster. A provisional 70/15/15 split is a starting convention, not a substitute for adequate independent test counts. Keep a separate Philippine phone-photo test set. Apply augmentation only after splitting and only to training.
4. Compare: current OWL-ViT baseline, a trained lightweight detector, and class-agnostic proposals plus a fine-class model. Record compute/latency/memory. Do not assume a general segmented region has become a waste instance.
5. Tune rejection thresholds/margins or calibrated energy/similarity scores only on validation, including genuinely held-out object types. Separate detector score, classifier score and decision-rule outcome. Retain unclassified valid proposals; report proposal budgets and exclusions.
6. Detection: mAP50 and mAP50:95, recall of annotated objects, duplicate/background false positives, size/occlusion analysis. Requires real bounding-box ground truth. Do not substitute crop classification accuracy.
7. Classification: per fine class and six target materials, macro F1, precision/recall, confusion matrix, calibration and unknown false-acceptance/rejection. Report coverage as well as correctness among accepted cases.
8. Segregation: qualified reference routes and referral decisions, category confusion matrix, unsafe-route rate and special/hazardous recall. Include absent/uncertain information. A photo cannot validate hidden chemical history.
9. Recommendations: the existing six-criterion scorecard checks material, condition, safety, correctness, practicality and local applicability. Report review coverage, unacceptable/unsafe suggestions and when the system properly withholds. No measured benefit or accuracy exists until real cases are reviewed.
10. Set go/no-go targets and confidence intervals with the adviser before final testing. Hazard misses need explicit review, not compensation by high overall accuracy. Log all failures. Never tune on the final test set; new iteration needs fresh held-out evaluation.

`EVALUATION_SCORECARDS.md` covers immutable result snapshots and locked protocols. The current scorecard does not calculate detection mAP or automatic ground-truth box matching; those remain research work after annotations exist. No external paid API is required.

## 5. Confirmation UI and privacy

Preserve the current camera layout: no large numbered onboarding panels or restored camera border. Only the results/assessment functions change.

- Each valid detected region stays a numbered box and card. Unknown and background hypotheses are open for review rather than silently deleted. User-marked missing items are visibly manual.
- Tap Review item to see the crop and up to three actual observed detector-query alternatives. These are not calibrated top-three material probabilities; fewer are shown when fewer exist.
- Confirm a supported target using evidence, or report Other/material/category. Reported categories are distinguished from reviewed local rules. Unknown does not force B2.
- Answer condition/history, contamination and moisture; specific resin/paper/wood questions remain. Update assessment explicitly.
- Safe public-reference advice can explain a referral without claiming local drop-off availability. Unverified guides are absent, not decorated with a misleading verification badge.
- Contribute an image only after explicit opt-in. The review queue references the existing private image, records a snapshot and defaults to pending. An authorized human can review; there is no automatic training or dataset export. Withdrawal deletes the queue entry; deleting the scan cascades its contribution. Explain that independently authorized prior offline exports/model versions would need their own withdrawal policy before any training release.

## 6. Knowledge base and verification

`upcycling_library.json` contains one candidate per target with the requested fields. All six are **UNVERIFIED** and are not imported/published automatically. An idea-level authoritative citation is not verification of the exact adapted process, measurements or safety precautions. Dates that cannot be established must be null; `last_reviewed` and reviewer cannot be fabricated. Cost and time are null until a local pilot measures them.

The wood candidate intentionally has no construction steps: no complete authoritative joinery plan was verified. Do not invent dimensions, fasteners or loading limits to fill a schema. No ecobrick construction, plastic melting, long-term PET food/drink storage, bird/pet feeder, child toy, structural furniture or burning project was approved. Future risky steps require step-specific PPE, trained operator, tool procedure and qualified review.

Existing source-checked draft adaptations are now withheld from new recommendations unless republished as expert-reviewed guidance through the existing versioned review workflow. Already-started project progress and historic records are not erased, but restarting/starting a project still rechecks eligibility. 'VERIFIED' in the per-object API means the applicable published guidance carries an identified expert review; it is never a universal safety certification.

## 7. Not completed / not verified

- Universal 'all waste' recognition and every-object coverage: not technically guaranteed and not claimed.
- New broad-class classifier, calibrated open-set detector, deployed SAM2 or resin/contamination recognition: not trained/installed/validated here. Current production remains local experimental OWL-ViT with an expanded query vocabulary and explicit user checks.
- Full public-data import and license clearance: not done; see holds. Food and fashion data cannot become waste/contamination ground truth by relabeling.
- CESD-specific acceptance, collection addresses, routes and department endorsement: not supplied or inferred from a consultant's title.
- Exact expert-verified DIY processes for all six materials: unavailable; six drafts provided with explicit gaps, not false certification.
- Quantified accuracy, environmental impact, hazardous recall or improved field performance: not measured; automated software tests are not evidence of model accuracy.
- No remote image API, paid service, automatic retraining, public photo upload, or GitHub push was performed by this change.
