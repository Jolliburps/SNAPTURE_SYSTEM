# Camera Phase 1

## Existing architecture retained

- Android sends the camera guide coordinates with a single-item photo to Django's scene endpoint. EXIF orientation and preview-cover mapping are applied before cropping. Only the guide crop is retained for this flow.
- Local OWL-ViT uses text queries, its saved Hugging Face processor, duplicate filtering and principal-region selection. People, holding hands and nearby animals are context rather than automatic rejection when a target is located.
- MobileNetV2 classifies the selected padded region into seven material categories. The active checkpoint is the experimental October 6 candidate, not a newly trained model. Its configured input size uses bilinear resizing and float32 RGB in 0–255; MobileNet normalization is embedded in the checkpoint. OWL-ViT retains its own model-specific processor. Applying a second common normalization would be incorrect.
- Existing assessment, confidence validation, recommendations, history, privacy processing and project completion are retained. No confidence thresholds or model weights are changed.

## Changes

- Quality checks add conditional low-resolution and possible overexposure warnings alongside existing darkness/softness/edge checks. Uniform white paper is not treated as overexposure. These are advisory heuristics, not validated image-quality scores; a weak model proposal does not itself establish poor photo quality.
- Detector and material encoding boundaries correct EXIF orientation before RGB conversion. This fixes direct material callers losing orientation when encoding to PNG. Resize and embedded normalization remain in the classifier's existing preprocessing path.
- Accepted detector coordinates are stored separately as `localized_box`. The padded `classification_crop` remains the actual classifier input. Serialization exposes only valid, accepted localization bounds, never a fabricated whole-frame or padded-crop outline.
- Android draws accepted focus bounds in theme green on the existing photo, uses contain-image coordinates and rejects invalid/out-of-range boxes. No separate zoom-image section is added.
- Historical records without measured localization remain accessible but receive no reconstructed focus box. No database migration is required.

## Verification

Backend tests cover quality signals, EXIF consistency, accepted versus uncertain bounds, frame cropping, saved coordinates, contextual hands/people/animals, seven-category selection, detector filtering and classification. Classifier tests cover configured dimensions and raw RGB range. Android tests cover conditional warnings, camera behavior and valid green versus invalid bounds.

These regression tests do not measure object localization accuracy or material accuracy on real phone photos. Next evaluation needs reviewed examples from all seven categories with main-object boxes, plus unsupported look-alikes. Confidence automation still requires the existing validation policy; Phase 1 does not certify the experimental checkpoint.
