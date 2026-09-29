# SNAPTURE dataset collection and training policy

This policy keeps the machine-learning dataset aligned with the seven thesis
categories and prevents the model from presenting guesses as material facts.

## Approved labels

Use only these folder names:

```text
pete_bottles
hdpe_containers
cardboard
paper
fabric_scraps
coconut_shells
dry_untreated_wood_scraps
```

Each image must contain one primary material. If the material cannot be
verified from the image, place it in a review folder instead of guessing.
Generic `plastic` images must not be renamed to PETE or HDPE automatically.

## Collection checklist

- Capture real phone photos in different lighting, distances, angles,
  backgrounds, sizes, and object conditions.
- Include clean, dirty, wet, dry, crushed, folded, and partially obstructed
  examples where those conditions are within the thesis scope.
- Remove duplicates, screenshots, unreadable images, and photos containing
  faces, documents, addresses, or other personal information.
- Obtain consent before using user-submitted images for training.
- Record the source, license/permission, label reviewer, and collection batch.
- Aim for at least 100 verified images per class before reporting results.

## Review and splitting

The maintained trainer checks that every image opens correctly, flags tiny
images, and rejects exact duplicate files. It creates a deterministic
70/15/15 train/validation/test split for the flat collection layout, or reads
explicit `train`, `val`, and `test` folders when those are supplied.

Do not place photos of the same physical object, burst sequence, or near-copy
in multiple splits. Such leakage makes the accuracy look higher than real
phone performance.

## Model and safety rules

- Use transfer learning only after labels are reviewed.
- Report test accuracy and per-class precision, recall, F1, and confusion
  matrices; validation accuracy alone is not a final result.
- Keep a confidence rejection rule. Low-confidence or out-of-scope images must
  be shown as **Needs verification**.
- The model cannot certify chemical, microbial, structural, or food-contact
  safety. Recommendations are educational decision support only.
- Never use an earlier model prediction as the ground-truth label for a new
  training image.

## Dataset path

The canonical path is:

```text
SNAPTURE_ML/data/scope_dataset/
```

The original TrashNet files remain under `data/raw/trashnet/` as reference
data only. The seven-class model must not be trained until all seven scope
folders contain verified images.
