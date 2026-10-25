# Conservative detection filtering — 25 October 2026

## Changes

- Default OWL-ViT inference uses one full-photo pass rather than five overlapping passes. Tiling remains explicit opt-in for experiments, not the mobile default.
- Added blanket, bedsheet and pillow descriptions, plus contrast queries for people, body parts and worn clothing. These descriptions are prompts, not newly trained classes.
- Person/body/worn-clothing detections are excluded from waste records/crops. Background belongings remain review-only unless the user explicitly identifies the intended object. A smaller foreground object is not suppressed merely for being inside a background box.
- Textile synonyms share duplicate filtering, alongside the existing container family. Nearby but distinct boxes and user-marked/corrected objects remain reviewable.
- A shared read-only presentation policy separates accepted, review-only, duplicate, excluded and whole-photo material-only results. Weak scores below the existing 0.28 proposal cutoff and close conflicting query matches do not produce normal boxes. Material confidence cannot override a weak object match.
- Expanding uncertain suggestions only reveals review cards, never their model boxes. Counts exclude weak guesses and suppressed duplicate/body proposals. Empty accepted results say “No reliable object match.”
- Region-based edge/crowding checks use accepted boxes, not rejected proposals. Stale clutter/edge flags from legacy guesses are removed; measured dark/blur signals remain.
- Historical presentation also applies the policy, without deleting or modifying saved records, original coordinates, user selections or project steps. Existing automatic material routing and pre-project confirmation gates remain in place.

## Verification

- 131 mobile tests / 33 suites passed; TypeScript and touched-file ESLint checks passed.
- 124 backend prediction/project tests passed, including 10 added detection-filter tests covering duplicate textiles, foreground preservation, person/body exclusions, weak/conflicting matches, one-pass inference, saved-record preservation, and misleading quality warnings.
- Android release build succeeded.
- Read-only replay of saved scene 38 (the supplied 22:46:44 scan) now presents zero accepted matches, seven review-only guesses, zero boxes and no quality flags. No saved scan or project progress was changed.
- Fresh local inference on that scan's existing privacy-safe photo took approximately 8.07 seconds in a separate cold process. Person, foot and worn-clothing queries were excluded; four remaining object proposals scored 0.109–0.142 and remained review-only. This is a regression check on one photo, not an accuracy evaluation.

## Limits and tradeoffs

This reduces misleading output; it does not train a new model or guarantee all false detections are removed. Contrast queries can miss people/body parts, and conservative filtering/full-photo inference can miss genuine small objects. The 0.28 cutoff is an uncalibrated proposal-score threshold, not a measured accuracy percentage. Further training and evaluation require reviewed object boxes, confusing/non-waste examples and independent phone test photos.

The overlap-suppression approach is informed by the [official Torchvision NMS definition](https://docs.pytorch.org/vision/stable/generated/torchvision.ops.nms.html); the existing detector's text-query behavior is documented in [the official OWL-ViT documentation](https://huggingface.co/docs/transformers/model_doc/owlvit). No paid API, external image upload, new dependency, schema migration or checkpoint replacement was introduced.

## Textile follow-up: filter v3

The 23:10:00 scan (scene 40) exposed a remaining false positive: a broad towel proposal scored 0.302, exceeding the general 0.28 cutoff. Its independent fabric score of 0.808 did not validate the object name or localization.

- Textile queries below a provisional 0.45 object score, or covering more than half the photo, now abstain into review. These are conservative safeguards, not calibrated accuracy claims. Other object thresholds are unchanged.
- Unconfirmed towel, blanket, bedsheet, pillow and fabric-scrap queries use the display title “Possible fabric item” with an exact-object confirmation note. Raw detector names, scores, boxes and material results remain unchanged for diagnostics and research.
- The same textile guard applies to project eligibility: material confirmation alone cannot override an uncertain object region. A user object-name report or user-marked intended region stays distinct from model truth; material/condition and hazard checks still apply.
- “Confirm object name” opens the existing name field directly instead of sending the user around a material-only form. No new navigation screen or dependency was added.
- Read-only replay of scene 40 now yields zero accepted boxes, five review proposals and no region-based photo warning. Original saved record fields are unchanged. User-facing textile names are generic; non-textile weak guesses remain explicitly review-only.
- Verification: 135 mobile tests across 34 suites, 127 backend prediction/project tests, TypeScript and touched-file lint checks passed. Android release build succeeded. No new training, dataset edits or checkpoint replacement occurred. Threshold calibration on reviewed independent photos remains future work; small real textile objects may also be held for review.
