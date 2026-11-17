# Replaceable object detection

Current status: **OWL-ViT is active. No trained YOLO model or class list has been supplied.** The YOLO adapter is disabled and returns no fabricated detections. This is an integration boundary, not a trained waste detector.

The existing application already uploads images to Django for inference. Keep that architecture for this update: Android acquires/displays images; the backend loads the selected detector. No Android inference dependency or new native platform integration was added. A future on-device runtime needs a separate compatibility/performance evaluation against the actual export.

## Files and responsibilities

| File | Purpose |
| --- | --- |
| `SNAPTURE_ML/models/detection_config.json` | Explicit provider and export contract; restart backend after changing it |
| `SNAPTURE_BACKEND/predictions/detection.py` | Provider selection, availability and presentation boundary |
| `SNAPTURE_BACKEND/predictions/yolo_adapter.py` | Loading, preprocessing, inference, output validation/parsing, box conversion and NMS |
| `SNAPTURE_BACKEND/predictions/material_classifier.py` | Independent existing TensorFlow material classifier |
| `SNAPTURE_ML/requirements-yolo.txt` | Optional backend ONNX Runtime dependency; not needed for active OWL-ViT |

## Contract supported by this adapter

This adapter supports **only** the following explicitly declared contract. It does not claim compatibility with every YOLO version/export.

- Model file: ONNX inside `SNAPTURE_ML`; example location `models/yolo/custom.onnx`.
- One image input, batch 1, float32, NCHW, RGB, values divided by 255.
- Explicit input size `[height, width]`. The supplied `[640, 640]` is an example contract, **not an inspected model requirement**.
- Centered letterbox resize, bilinear resampling and RGB padding 114. Declare this only after verifying it matches the export/training pipeline. Other preprocessing requires an adapter change.
- Output: single-batch rank-three tensor, `[1, features, candidates]` (`channels_first`) or `[1, candidates, features]` (`rows`). Specify `output_name` if the model has multiple outputs.
- Supported output formats:
  - `xywh_classes`: center x/y, width/height, then one probability per class; `features=4+class_count`.
  - `xywh_objectness_classes`: center x/y, width/height, objectness, class probabilities; score is objectness times class probability; `features=5+class_count`.
  - `xyxy_score_class`: already postprocessed/NMS rows with corner coordinates, score and integer class index; six features. No second NMS is applied.
- Coordinates: explicitly `input_pixels` or `normalized` relative to the padded model input. Boxes are mapped back to normalized original-photo coordinates and clipped.
- Raw format outputs must contain probabilities, not logits. Nonfinite values, mismatched shapes and invalid class indices are rejected/dropped; no labels are guessed from an output shape.
- Confidence threshold, class-aware NMS IoU threshold and maximum detections are explicit config values. The supplied thresholds are examples, not calibrated accuracy guarantees.
- `classes` must contain the **exact trained index order**, for example `[{"label":"your actual class","material_candidates":["cardboard"]}]`. Replace this example with actual training metadata. Object names do not establish material or condition.
- Optional `material_candidates` permits the independent material classifier for that class, using only the existing seven scope labels. An empty list permits no new material mapping. Out-of-scope classifier results remain unknown. No condition, resin, contamination or safety property is inferred from YOLO object labels.
- Optional `sha256` pins the model file. File presence/config validation alone is not successful inference or accuracy validation.

## Integrating your trained export

1. Supply weights/export, exact labels, training scope/license, exporter version/options, input/output metadata, preprocessing and postprocessing definitions, and representative labeled evaluation images. Identify unsupported/hazardous classes and intended detection limits.
2. Inspect the export's actual input/output tensors. Choose this adapter only if those semantics match. Segmentation, pose, quantized/float16, embedded preprocessing, different tensor layouts and other output contracts require explicit implementation and tests.
3. Copy the ONNX file inside `SNAPTURE_ML`, fill the real configuration and set `yolo.enabled` to `true`. Install the optional runtime in the existing backend environment only when needed:

   ```powershell
   Set-Location 'C:\Users\Jude\Desktop\SNAPTURE\SNAPTURE--main'
   & .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r .\SNAPTURE_ML\requirements-yolo.txt
   ```

4. Change the top-level provider to `yolo_onnx` and restart T1/backend. Inspect the authenticated `/api/scenes/capabilities/` response. An unavailable selected YOLO provider returns a clear error; it does not silently switch models.
5. Perform real inference, verify inverse-letterbox box alignment, zero/one/multiple cases, small/edge/overlapping objects and unsupported classes. Compare detections against labeled images, measure accuracy and latency on the actual deployment computer, then choose thresholds. Parser tests with synthetic tensors are not model validation.
6. Confirm material classification independently. Review and publish appropriate project rules separately. Detector replacement never publishes a project or edits saved scans.

The adapter remains inactive until this work is possible. To retain the working detector, leave `provider: "owlvit"` and `yolo.enabled: false`.

Primary references: [Ultralytics export documentation](https://docs.ultralytics.com/modes/export/) and [ONNX Runtime Python documentation](https://onnxruntime.ai/docs/get-started/with-python.html). These explain export/runtime options; they do not establish compatibility with an export that has not been supplied.
