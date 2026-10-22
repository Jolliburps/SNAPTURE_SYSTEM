# Public waste-image acquisition — 2026-10-22

Raw sources are isolated in `SNAPTURE_ML/data/public_sources/` (git-ignored).
These are research inputs, not automatically approved training data or disposal
rules. Existing datasets, models, camera inference and user scans are unchanged.

## Sources selected for acquisition

| Source | Purpose | Publisher / terms |
| --- | --- | --- |
| RealWaste | Nine broad material labels, including food, vegetation, glass, metal, paper, cardboard and textile waste | https://archive.ics.uci.edu/dataset/908/realwaste — CC BY 4.0 |
| RealDirt | Bottles, bags and cartons with detection annotations | https://zenodo.org/records/12517610 — CC BY 4.0 |
| RECLAIM PET, updated | PET-focused conveyor images; RGB portion only extracted | https://zenodo.org/records/11504415 — CC BY 4.0 |
| RECLAIM HDPE, updated | HDPE-focused conveyor images; RGB portion only extracted | https://zenodo.org/records/11504453 — CC BY 4.0 |
| MMoRWaD RGB | Material/condition metadata, COCO annotations and original object/split IDs | https://zenodo.org/records/22226868 — CC BY 4.0; RGB stills and metadata only, not audio/depth/video |
| TrashNet, creator-hosted resized release | Legacy six-class baseline; check overlap with existing data | https://huggingface.co/datasets/garythung/trashnet — MIT in creator dataset card, preserve creator citation |
| ZeroWaste-f | Annotated cluttered sorting scenes | https://github.com/dbash/zerowaste/ and https://zenodo.org/records/6412647 — author README says CC BY-NC 4.0, record metadata says CC BY 4.0. Keep isolated for non-commercial research pending clarification; no deployment/redistribution clearance asserted |

Dataset names are not completion claims. Each source's `acquisition.json` records
its actual status, archive size/hash, verified image count, errors and duplicate
count after completion. `.part` means incomplete. Keep the original annotations
and publisher metadata with every source.

## Checks of the actual files received

- RealWaste: 4,752 readable images in the publisher's nine class folders.
- TrashNet resized release: 2,527 readable files, including three extra encoded
  duplicates. Do not add this count to existing legacy TrashNet without comparing
  the two copies. Creator dataset-card license was checked, not inferred solely
  from the code repository.
- RealDirt: the verified Zenodo ZIP actually contains **500 JPEG images**, 500
  YOLO label files, and data.yaml. This differs from the landing-page claim of
  2,000 images. Do not report 2,000 downloaded. The files contain 2,398 boxes:
  751 plastic bottles, 1,467 plastic bags, and 180 cartons; initial normalized
  coordinate checks found no invalid label rows. The source's absolute training
  path must be adapted in a future preparation step, not used directly.
- RECLAIM HDPE: the outer ZIP contains separate RGB and HSI ZIPs. Only the RGB
  archive was extracted: 1,362 readable images, no per-object label files found.
  Treat this as material-labeled reference imagery, not a boxed detection set.
- MMoRWaD metadata: 3,300 image entries and 3,300 annotations; metadata records
  721 item-name groups with provided splits. There are 18 distinct material
  strings, but the JSON's categories array is per-image attribute records rather
  than a conventional list of 18 named classes. It needs an inspected conversion,
  not direct use as an ordinary 18-class COCO file. These numbers describe
  downloaded metadata, not proof that the corresponding RGB photos are received.

## Held or intentionally excluded from bulk download

- TACO: official annotation catalogue has image license values `null` and an
  empty license table. Source code MIT alone is not photo clearance. Keep
  annotation metadata for planning; resolve image terms before importing photos.
- Open Images and COCO: download only a defined, rights-audited relevant subset
  later, not their huge general-purpose image collections wholesale.
- SpectralWaste record 11499414: publisher API returned HTTP 410 on this check.
  Do not silently substitute another dataset or say it was downloaded.
- SortWaste: relevant PET/HDPE and clutter annotations; obtain exact download and
  terms from the official site before importing.
- Food recognition, fashion photos, faces and satellite imagery are not assumed
  to be household waste or evidence of chemical/biological contamination.
- No Kaggle account, paid service, API key, license agreement or private account
  was created or used. No photo was sent to an external inference service.

## Acquisition and verification

`SNAPTURE_ML/scripts/acquire_public_datasets.py` downloads selected releases from
their official hosts, supports contiguous HTTP resume, checks publisher hashes
where provided, records SHA-256, checks ZIP paths and rejects symlinks, preserves
a 12 GiB disk reserve, verifies image readability, and reports exact duplicate
files without deleting any. Public images remain unreviewed/training-ineligible.

Example (resume only the desired sources; do not run two writers on one source):

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe -u .\SNAPTURE_ML\scripts\acquire_public_datasets.py --datasets realwaste realdirt trashnet reclaim_hdpe reclaim_pet mmorwad_rgb zerowaste
```

## Before training

1. Review labels, annotation coordinates, faces/personal information, corrupted
   images, real household relevance and original dataset terms.
2. Identify duplicates across all sources AND existing SNAPTURE images. Encoded
   SHA duplicates are only the first check; cropped/resized near-duplicates need
   further review. Do not delete user data or count copied views as new items.
3. Preserve physical-item/capture groups and publisher split IDs. Keep related
   views out of different train/validation/test partitions.
4. Do not relabel every plastic as PET/HDPE, all rigid plastic as HDPE, textiles
   as universally recyclable, or a generic material as a Bacoor collection route.
5. Train an experimental model separately, evaluate on held-out local phone
   photos and compare to the current model. No accuracy gain is claimed until
   measured; do not silently replace the active model.
