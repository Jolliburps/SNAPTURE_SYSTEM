# SNAPTURE dataset sources

These records describe local image collections for the seven approved material categories.
They are candidates for review. The verified export manifest records which images are approved for training.

## Original collection

The [project Google Drive collection](https://drive.google.com/drive/folders/1d2lEtxa-SsTKfjz2ENlTqgVDa739pkyO) supplied candidate images for the seven category folders.
The [_source_manifest.json](_source_manifest.json) records import provenance. A Drive batch link alone
does not establish the original creator, license, or label evidence for each image.

## Retained public sources

| Dataset | SNAPTURE categories it can support | Review focus |
|---|---|---|
| [PlasticWaste-DB v1](https://data.mendeley.com/datasets/tvfx5dspf3/1) | PETE bottles and HDPE containers | Use the publisher resin labels and rotated boxes for candidate review. Check that each object is a bottle or container within scope. See [local audit](public_sources/plasticwaste_db/source_audit.json). |
| [RECLAIM PET RGB](https://zenodo.org/records/11504415) | PETE bottles | Verify bottle form. Group related conveyor views of the same physical item in one split. |
| [RECLAIM HDPE RGB](https://zenodo.org/records/11504453) | HDPE containers | Verify container form. Group related conveyor views of the same physical item in one split. |
| [MMOR-WAD RGB](https://zenodo.org/records/22226868) | PETE bottles, HDPE containers, cardboard, and paper | Use material and physical-item metadata. For plastics, check that the object is within the supported bottle or container scope. |
| [Drinking Waste Classification](https://www.kaggle.com/datasets/arkadiyhacks/drinking-waste-classification) | PETE bottles and HDPE containers | Use the PET and HDPE milk bottle collections as candidates. Check source class IDs and duplicates before selecting files. |
| [RealWaste](https://archive.ics.uci.edu/dataset/908/realwaste) | Cardboard and paper | Use the cardboard and paper labels as candidates. Review coatings and mixed materials separately. |
| [TrashNet](https://github.com/garythung/trashnet) | Cardboard and paper | Use the cardboard and paper folders as candidates. Check duplicates against other sources. |
| [Indoor Waste](https://data.mendeley.com/datasets/dy7smxr93r/1) | Paper | Use annotated paper objects. A generic shell label does not establish the material of a coconut shell. |
| [PackWISE v2](https://fordatis.fraunhofer.de/handle/fordatis/463.2) | Paper and potential fabric or wood localization examples | Use publisher paper annotations for review. Textile and wood annotations may help localization after object review. They cannot verify fabric scraps or dry untreated solid wood. |

## Latest acquired plastic source

PlasticWaste-DB supplied **499 PET** and **321 HDPE** image files.
After local annotation, label and duplicate screening, **384 PET** and
**163 HDPE** candidates remained for individual review.
These counts are publisher resin labels. Bottle and container scope and label evidence still need review.

## Local collection still needed

Use the [phone scan checklist](phone_scans/README.md) to document hard coconut shells, genuine fabric scraps,
wood with known untreated history, and independent captures of all seven categories under real scanning conditions.
