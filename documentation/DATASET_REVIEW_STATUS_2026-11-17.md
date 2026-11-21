# SNAPTURE dataset review status — 17 November 2026

## Current decision

**The dataset is not ready for training.** No new model was trained, replaced, or promoted. No application code or image files were changed in this review.

The review ledger contains all 6,288 candidate files in the four populated categories. After this review, 240 files have individual visual decisions recorded; 6,048 files have not yet received an individual review. Every unreviewed file remains unresolved and ineligible for training.

| Category | Candidates | Individually reviewed | Approved | Rejected | Unresolved |
|---|---:|---:|---:|---:|---:|
| PETE bottles | 2,382 | 60 | 60 | 0 | 2,322 |
| HDPE containers | 1,850 | 60 | 52 | 1 | 1,797 |
| Cardboard | 924 | 60 | 60 | 0 | 864 |
| Paper | 1,132 | 60 | 57 | 0 | 1,075 |
| Fabric scraps | 0 | 0 | 0 | 0 | 0 |
| Coconut shells | 0 | 0 | 0 | 0 | 0 |
| Dry untreated wood scraps | 0 | 0 | 0 | 0 | 0 |
| **Total** | **6,288** | **240** | **229** | **1** | **6,058** |

Of the 6,058 unresolved records, 10 were visually inspected but remain ambiguous or unusable (7 HDPE and 3 paper). The other 6,048 have not been individually reviewed. The single rejection is a background-only HDPE-source frame with no visible waste object. No ambiguous image was forced into a class.

## Individual review batch added

Four additional labeled 4×5 contact sheets were reviewed tile by tile, with source metadata checked for each decision:

- PETE: 20 approved; visible bottle waste and the dedicated PET recyclable-waste source label support the category.
- HDPE: 12 approved, 1 rejected as blank, 7 unresolved because the object is cropped, too small, or unclear.
- Cardboard: 20 approved; visible paperboard/cardboard items agree with the UCI RealWaste class label.
- Paper: 17 approved and 3 unresolved because the substrate could be flexible plastic rather than paper.

The new decisions include an image-specific note, reason, source, license, review method, and review date in `SNAPTURE_ML/data/review_decisions/review_ledger_20261117.json`. All approved files remain `training_eligible: false` until the seven-class collection and grouped splits are ready.

## Candidate sources and provenance

The 6,288 local candidates come from these source folders and the recorded licenses:

| Category | Source breakdown | Recorded license |
|---|---|---|
| PETE bottles | 1,240 RECLAIM PET; 1,142 MMORWAD RGB | CC BY 4.0 |
| HDPE containers | 1,362 RECLAIM HDPE; 488 MMORWAD RGB | CC BY 4.0 |
| Cardboard | 461 UCI RealWaste; 403 TrashNet; 60 MMORWAD RGB | UCI RealWaste: CC BY 4.0; TrashNet creator dataset card: MIT; MMORWAD: CC BY 4.0 |
| Paper | 500 UCI RealWaste; 594 TrashNet; 38 MMORWAD RGB | Same source-specific records as above |

The RECLAIM releases describe PET recyclable waste and HDPE recyclable waste, respectively. The MMORWAD RGB source has per-object material attributes and physical-item grouping metadata. Generic plastic images are not assigned to PETE or HDPE. Source-level labels support review, but each candidate still needs an individual visual/quality decision.

Dataset source records and hashes remain in `SNAPTURE_ML/data/public_sources/` and `SNAPTURE_ML/data/recognition_basis/20261115T191449Z/manifest.json`. The official [UCI RealWaste record](https://archive.ics.uci.edu/dataset/908/realwaste) identifies CC BY 4.0; the separate GitHub mirror states different terms, so continue to use and cite the UCI-origin copy recorded in the acquisition manifest. No missing-category dataset images were downloaded or added.

## Visual similarity groups

The recognition-basis index contains **346 perceptual-fingerprint groups covering 2,639 files**. Six groups (21 files) have now been reviewed side by side; all six are false-positive matches caused by a shared conveyor or sorter-box background. Their objects differ. No exact or near duplicate was found in these six reviewed groups, and none was removed. Similarity alone remains insufficient evidence to reject an image.

**340 groups / 2,618 files remain unreviewed.** Among all groups, 1,242 files are in the four populated candidate categories. The source/object groups from MMORWAD must be retained for any future split; Reclaim capture sequences and other source/session relationships still need grouping review. The similarity review decisions are in `SNAPTURE_ML/data/review_decisions/visual_similarity_review_20261117.json`; the original fingerprint index remains unchanged.

The broader recognition-basis audit reports 23,217 readable input files, 23,189 unique decoded-pixel groups, and 28 exact duplicate file paths excluded from the review view. These are prior pixel-level deduplication results, separate from the 346 approximate visual-similarity groups.

## Missing-category source search

No candidate images were imported, and all three missing classes still have **zero approved samples**. Page-level research found leads, but none yet passes all of SNAPTURE's category-fit, image-level verification, and licensing requirements:

- **Fabric scraps:** the 562-image Roboflow Textile Waste dataset is CC BY 4.0, but its one broad class and sample captions describe clothes, not fabric offcuts. SorTex covers pre-sorting of collected textiles, while the Norway garment dataset covers discarded apparel; neither establishes scraps. CDW-Seg has a construction-fabric mask class, but it is a different waste stream and its separate dataset rights still need confirmation.
- **Coconut shells:** the 151-image Roboflow coconut-shell dataset is marked CC BY 4.0, but it has no project description and mixes shell-related items with other classes; waste status is unverified. UrbanWaste papers describe coconut-shell labels in real bin photos, but the linked repository contains only a README and the data license/access could not be verified. A thesis/paper describes 1,611 coconut-shell-waste images, but a reusable data release/license was not found.
- **Dry untreated wood scraps:** FWNet has a “Scraps” category, but it mixes solid wood with MDF/MDP/melamine offcuts and its Zenodo page does not state a dataset license. WoodVIT is CC BY 4.0 but is a large multisensor bulky-waste collection without the required dry untreated scrap labels. “Untreated wood chips” and construction timber sources are also not equivalent to verified dry untreated scraps.

Dataset names, published counts, license evidence, scope concerns, and source links are recorded in `SNAPTURE_ML/data/review_decisions/missing_category_sources_20261117.json`. These are leads, not imported-image or approval counts.

## Training readiness and remaining work

Training is blocked by incomplete human review and missing classes. Do not create splits or train until the class inventory is complete and approved images are sufficient and balanced.

1. Individually review the remaining 6,048 candidate files and record image-specific decisions/reasons; resolve the 10 reviewed-but-uncertain images where possible.
2. Review the remaining 340 similarity groups; preserve different photographs and record exact duplicates separately from visual lookalikes.
3. Obtain exact-label, reusable datasets (or collect SNAPTURE photos) for fabric scraps, coconut shells, and dry untreated wood scraps. Verify licensing and image contents before import.
4. Assign source/session/physical-object groups, check class balance, then prepare grouped train/validation/test splits with no related-image leakage.
5. Only after the above, train a candidate model and report per-category precision, recall, F1, and confusion matrix. Keep the current experimental model unchanged until evaluation and unknown-item rejection checks pass.

The existing `unknown_unsupported` backend rejection, Item Not Recognized warning, camera flow, scan results, and recommendations were not changed in this dataset-review task.
