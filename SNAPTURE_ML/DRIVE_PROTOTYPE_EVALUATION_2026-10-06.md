# Drive dataset phone prototype evaluation — 2026-10-06

The linked Drive batch supplied 9,613 readable JPEGs in seven source folders.
`scripts/prepare_drive_candidate.py` retained 9,406 unique images in a local,
unverified training view. It excluded 197 extra exact copies and all 10 images
from five groups that were labeled both PETE and HDPE. The raw import was not
changed. No image was individually approved as the claimed material.

The new MobileNetV2 candidate is stored locally at
`models/candidates/snapture-drive-20261006/`. Eight epochs of training reached
91.99% validation accuracy. The deterministic image-random test split contained
1,411 images and reached 90.64% overall accuracy. This split is not independent
by object, capture session, or image source; similar views may occur on both
sides. These scores do not establish real-world phone accuracy.

| Label | Test images | Precision | Recall |
| --- | ---: | ---: | ---: |
| PETE bottles | 185 | 93.8% | 89.7% |
| HDPE containers | 91 | 76.5% | 85.7% |
| Cardboard | 47 | 45.8% | 57.4% |
| Paper | 138 | 79.7% | 73.9% |
| Fabric scraps | 825 | 99.0% | 95.9% |
| Coconut shells | 50 | 83.9% | 94.0% |
| Dry untreated wood scraps | 75 | 75.6% | 90.7% |

These are raw top-class scores before the prototype's confidence rejection.
The ordinary cutoff is 0.60. Cardboard uses 0.80 because validation precision
was weak at the ordinary cutoff. On the test split at 0.80, only 9 predictions
were accepted as cardboard, 7 correctly, while 7 of 47 cardboard images were
accepted. That is too small and too low-recall to claim reliable cardboard
identification. Other low-confidence predictions are also shown as unidentified.

The local phone prototype uses this candidate through
`SNAPTURE_BACKEND/run_phone_prototype.ps1`. Its health endpoint reports
`experimental_model: true`, and accepted scan titles include **prototype
result**. The model is not the approved `data/scope_dataset` model and should
not be used as a release accuracy claim. Before a final model, review labels
and source permissions, remove private content and near-copies, then evaluate
on an independent set of phone photos grouped by physical object/source.
