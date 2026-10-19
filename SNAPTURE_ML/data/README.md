# Recoverable dataset quarantine — 2026-10-02

These folders were removed from the active SNAPTURE dataset after visual and
label review. They were moved, not permanently deleted.

- `pete_bottles_plastic_unclassified_2026-10-02/`: generic plastic images
  were nested under PETE but are not verified PETE.
- `fabric_scraps_textile_2026-10-02/`: textile-trash images include masks,
  shoes, and other mixed items, so they are not verified fabric scraps.
- `coconut_shells_commons_2026-10-02/`: search results include whole coconuts,
  farms, food, and other scenes in addition to shells.
- `dry_wood_non_recyclable_2026-10-02/`: images include paint, glue,
  packaging, and other non-wood objects.
- `cardboard1_unverified_2026-10-02/` and `paper1_unverified_2026-10-02/`:
  alternate folders kept out of the canonical class folders until their
  source and labels are reviewed.
- `plastic_generic_2026-10-02/` and `textile_trash_2026-10-02/`: generic
  source categories that cannot be used as PETE/HDPE or fabric-scrap labels.
- `active_review_sheets_2026-10-02/` and `wood_direct_sample_review.jpg`:
  temporary visual-audit files, not training data.

The active dataset now contains only the seven canonical class directories.
Restore an image only after checking the individual image, material label,
source/license, and reviewer decision.
