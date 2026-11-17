# SNAPTURE dataset folder

- [Dataset index](DATASET_INDEX.md) lists the seven approved categories and candidate counts.
- [Source register](SOURCE_REGISTER.md) identifies the original project collection and the retained publishers.
- `public_sources/` holds extracted publisher files and a README for each source.
- `phone_scans/` contains the capture and labeling template.
- `active_manifest.json` records local candidate counts. `verified_manifest.json` records approved training exports.
- `labels.json` stores the seven class labels. `_source_manifest.json` preserves the original Drive import record.

Historical files moved during cleanup can be recovered through the relocation
maps in `../dataset_archive/`.
