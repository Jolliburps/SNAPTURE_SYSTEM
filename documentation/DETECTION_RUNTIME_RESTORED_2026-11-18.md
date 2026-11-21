# Detection runtime restored

18 November 2026. Investigated the generic “Detection could not complete” error
after the local Android installation. No recommendation, model-selection,
threshold, authentication or detection algorithm code was changed.

## Actual changes

Replaced three Git LFS pointer files with their exact original binaries. Preserved
pointer backups under ignored `SNAPTURE_BACKEND/.local/model-lfs-pointers/`.

| Model path under `SNAPTURE_ML/models/` | Bytes | Verified SHA-256 |
| --- | --- | --- |
| `candidates/snapture-7class-candidate-20261006/snapture_7class_candidate_unverified.keras` | 9747124 | `c73d9181f274c680936c42115df66af502394f115a7e356bbf2be8b44ebc73ac` |
| `owlvit-base-patch32/model.safetensors` | 612983940 | `4dbe0399f0b7d7c8dddf1535a98769cc30743bebc877aea681998c8d984ce52b` |
| `privacy/face_detection_yunet_2023mar.onnx` | 232589 | `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4` |

Classifier/privacy downloads came from the original repository's LFS storage.
The LFS detector transfer stalled and was stopped; the official
`google/owlvit-base-patch32` Hugging Face mirror supplied identical bytes matching
the project's LFS digest. No photos were uploaded to an external inference service.

Installed missing local CPU detection dependencies into `SNAPTURE_ML/.venv`:
PyTorch 2.15.0+cpu, Transformers 4.57.6, safetensors 0.8.0 and their dependencies,
within the ranges declared in `requirements-detection.txt`. Kept the already
installed OpenCV headless 5.0.0.93 from the main requirements, rather than adding
the optional file's conflicting OpenCV 4.11 package. Requirements files unchanged.

An initial classifier import encountered Windows Application Control blocking a
DLL. A fresh process subsequently loaded it successfully without changing any
security policy. Requested the existing Django autoreloader to restart by updating
`core/ml_service.py`'s timestamp; verified its source bytes did not change. This
cleared earlier cached startup failures.

## Verification

- Live `/api/health/`: HTTP 200, `status: ok`, `model.loaded: true`, all seven
  original classes and the existing experimental model version.
- Actual OWL-ViT inference on a synthetic blank image: completed in 10.81 seconds,
  zero proposals, no truncation. This verifies loading/execution, not bottle accuracy.
- YuNet blank-image check: completed with zero face regions.
- `& .\SNAPTURE_ML\.venv\Scripts\python.exe SNAPTURE_BACKEND/manage.py test predictions.test_photo_privacy predictions.test_material_classifier --noinput --verbosity 1`:
  **17 tests passed** using the isolated test database.
- `& .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip check`: no broken requirements.
- Unauthenticated scene capabilities remained HTTP 401 as expected.

The resident's photo was not resubmitted by this task; retrying the actual phone
scan remains a device check. The first detector request can take longer while
weights load. Existing eligibility and confidence checks still apply; restoration
does not establish model accuracy, expert approval or readiness for publication.

This supersedes older local reports' statements that model binaries are absent
in this workspace. It does not change those reports' historical test evidence.
