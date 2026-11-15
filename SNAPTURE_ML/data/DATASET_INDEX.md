# Dataset index and review status — 16 November 2026

## Current public-only review build

The current build is `data/recognition_basis/20261115T191449Z/`. It was produced
from ten available public sources. Original archives and extracted source trees
remain local under `data/public_sources/`; this directory is excluded from Git.
The seven local-only folders from the earlier data collection were unavailable,
so this is not a reconstruction of the historical local dataset.

| Review folder | Unique photo groups |
| --- | ---: |
| pete_bottles | 2,382 |
| hdpe_containers | 1,850 |
| cardboard | 924 |
| paper | 1,132 |
| fabric_scraps | 0 |
| dry_untreated_wood_scraps | 0 |
| coconut_shells | 0 |
| **Seven-folder total** | **6,288** |
| **Other materials, scenes, detection and review holds** | **16,901** |
| **Total unique decoded-pixel groups** | **23,189** |

The indexed 23,217 photo paths were readable. Exact duplicate exclusion removed
28 review entries (25 from WasteInsight and 3 from TrashNet); original images
were not deleted. All 23,189 review files are hard links to source files. The
manifest retains source filenames, labels, source splits and annotation paths.

## Audit status

- 0 corrupt photos; 3 conflicting-label groups; 346 possible visual-similarity
groups; no manual visual review of every image has been completed.
- No cross-split exact-duplicate groups were found in this available public
build. This does not reproduce the historical split audit for unavailable
local data.
- 4,510 annotation files are preserved. Structural checks covered 47,069 boxes
with 0 geometry errors. MMoRWaD has 12 annotation filenames that do not match
12 extracted image filenames; these candidates remain held for review, without
automatic remapping.
- ZeroWaste remains in a separate research-only detection folder while its
license conflict is unresolved (author README CC BY-NC 4.0 versus Zenodo
metadata CC BY 4.0).
- No training was performed; `training_ready` is false. These files are not a
training export or a working recognition model.

The historical local report recorded 98,264 input paths, 64,744 pixel groups,
21,939 groups in the seven target folders, and 285 split-conflict groups. Those
figures are historical only and cannot be reproduced without the missing local
folders. Broad labels such as “textile trash”, “wood”, and “shell” were not
forced into fabric scraps, dry untreated wood scraps, or coconut shells.

## Source records and reproducibility

`../../research/public_dataset_acquisition_status.json` lists source URLs,
licenses, statuses, archive checksums and available image counts.
`../../research/recognition_basis_summary.json` and
`detection_annotation_audit.json` contain the current build and annotation
summaries. Per-source `acquisition.json` files are stored with local source data.

Use `../scripts/acquire_public_datasets.py` and
`../scripts/acquire_supplemental_datasets.py` for the pinned public-source
acquisition flow; `../scripts/build_recognition_basis.py` creates the separate
review view, and `../scripts/audit_detection_annotations.py` checks annotation
structure. Public data are not approved for training or redistribution merely
because they were downloadable. Preserve each source attribution and license.

Git LFS patterns are scoped to reviewed images placed in
`SNAPTURE_ML/data/scope_dataset/`. Raw public sources and this review build remain
excluded from Git.