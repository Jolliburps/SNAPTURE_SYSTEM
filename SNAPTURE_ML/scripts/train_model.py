"""Train and audit the SNAPTURE seven-class image classifier.

The trainer is deliberately conservative. It only trains the seven thesis
classes when their labels are explicitly declared, checks image files before
TensorFlow sees them, prevents exact duplicate leakage between splits, and
reports independent validation and test metrics. The existing six-class
TrashNet model is kept for demos; it must not be silently used as a seven-class
model.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
from pathlib import Path
from typing import Iterable

import numpy as np
import tensorflow as tf
from PIL import Image, UnidentifiedImageError


PROJECT_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_DIR / "models"
DEFAULT_DATASET_DIR = PROJECT_DIR / "data" / "scope_dataset"

SCOPE_LABELS = [
    "pete_bottles",
    "hdpe_containers",
    "cardboard",
    "paper",
    "fabric_scraps",
    "coconut_shells",
    "dry_untreated_wood_scraps",
]

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 42
EPOCHS = 30
CONFIDENCE_THRESHOLD = 0.60
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}
SPLIT_NAMES = ("train", "val", "test")
SPLIT_RATIOS = {"train": 0.70, "val": 0.15, "test": 0.15}


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer, got {value!r}.") from error
    if parsed < 1:
        raise ValueError(f"{name} must be at least 1, got {parsed}.")
    return parsed


def image_files(folder: Path) -> list[Path]:
    return sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def read_declared_classes(dataset_dir: Path) -> list[str] | None:
    """Read labels.json, which is the source of truth for class order."""

    labels_path = dataset_dir / "labels.json"
    if not labels_path.is_file():
        return None
    try:
        payload = json.loads(labels_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read dataset labels file: {labels_path}") from error
    if (
        not isinstance(payload, list)
        or len(payload) < 2
        or not all(isinstance(value, str) and value.strip() for value in payload)
    ):
        raise ValueError(f"{labels_path} must contain a list of at least two labels.")
    labels = [value.strip() for value in payload]
    if len(set(labels)) != len(labels):
        raise ValueError(f"{labels_path} contains duplicate labels.")
    return labels


def _split_roots(dataset_dir: Path) -> dict[str, Path] | None:
    """Return explicit train/val/test roots, or None for a flat class layout."""

    present = {
        name: dataset_dir / name
        for name in SPLIT_NAMES
        if (dataset_dir / name).is_dir()
    }
    if not present:
        return None
    missing = [name for name in SPLIT_NAMES if name not in present]
    if missing:
        raise ValueError(
            "A split dataset must contain train, val, and test folders. "
            f"Missing: {', '.join(missing)}"
        )
    return present


def find_dataset_root() -> Path:
    configured = os.getenv("SNAPTURE_DATA_DIR")
    dataset_dir = Path(configured) if configured else DEFAULT_DATASET_DIR
    if not dataset_dir.is_absolute():
        dataset_dir = PROJECT_DIR / dataset_dir
    if not dataset_dir.is_dir():
        raise FileNotFoundError(
            f"Dataset directory does not exist: {dataset_dir}\n"
            "Add verified images to data/scope_dataset or set SNAPTURE_DATA_DIR."
        )
    return dataset_dir


def _class_files(dataset_dir: Path, class_names: list[str]) -> dict[str, list[Path]]:
    roots = _split_roots(dataset_dir)
    if roots is not None:
        result: dict[str, list[Path]] = {}
        for split, root in roots.items():
            for label in class_names:
                result[f"{split}/{label}"] = image_files(root / label)
        return result
    return {label: image_files(dataset_dir / label) for label in class_names}


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_images(
    dataset_dir: Path,
) -> tuple[list[str], dict[str, int], list[str]]:
    """Validate labels, image readability, duplicate leakage, and class sizes."""

    declared_classes = read_declared_classes(dataset_dir)
    if declared_classes is None:
        if not _env_bool("SNAPTURE_ALLOW_NON_SCOPE_DATASET"):
            raise ValueError(
                "This trainer expects data/scope_dataset/labels.json with the seven "
                "thesis labels. Set SNAPTURE_ALLOW_NON_SCOPE_DATASET=1 only for a "
                "deliberate legacy experiment."
            )
        class_names = sorted(
            child.name
            for child in dataset_dir.iterdir()
            if child.is_dir() and not child.name.startswith(".")
        )
    else:
        class_names = declared_classes
        if set(class_names) != set(SCOPE_LABELS) and not _env_bool(
            "SNAPTURE_ALLOW_NON_SCOPE_DATASET"
        ):
            missing = sorted(set(SCOPE_LABELS) - set(class_names))
            extra = sorted(set(class_names) - set(SCOPE_LABELS))
            raise ValueError(
                "labels.json must contain exactly the seven thesis classes. "
                f"Missing: {missing or 'none'}; extra: {extra or 'none'}."
            )

    if len(class_names) < 2:
        raise ValueError("The dataset must contain at least two class folders.")

    files_by_group = _class_files(dataset_dir, class_names)
    counts: dict[str, int] = {label: 0 for label in class_names}
    invalid: list[Path] = []
    small_images: list[Path] = []
    seen_hashes: dict[str, Path] = {}
    duplicate_paths: list[tuple[Path, Path]] = []
    empty_groups: list[str] = []

    for group, files in files_by_group.items():
        label = group.split("/", 1)[-1]
        counts[label] = counts.get(label, 0) + len(files)
        if not files:
            empty_groups.append(group)
            continue
        for path in files:
            try:
                with Image.open(path) as image:
                    width, height = image.size
                    image.verify()
                if width < 64 or height < 64:
                    small_images.append(path)
            except (UnidentifiedImageError, OSError):
                invalid.append(path)
                continue

            file_hash = _sha256(path)
            previous = seen_hashes.get(file_hash)
            if previous is not None:
                duplicate_paths.append((previous, path))
            else:
                seen_hashes[file_hash] = path

    if invalid:
        preview = "\n".join(f"- {path}" for path in invalid[:10])
        suffix = "" if len(invalid) <= 10 else f"\n- ...and {len(invalid) - 10} more"
        raise ValueError(f"Found unreadable image(s) before training:\n{preview}{suffix}")

    if empty_groups:
        missing = "\n".join(f"- {group}" for group in empty_groups)
        raise ValueError(
            "The following class folders are empty. Add verified images before "
            f"training:\n{missing}"
        )

    if duplicate_paths:
        preview = "\n".join(
            f"- {first} == {second}" for first, second in duplicate_paths[:5]
        )
        raise ValueError(
            "Exact duplicate images were found. Remove duplicates before training "
            f"to prevent train/test leakage:\n{preview}"
        )

    minimum = _env_int("SNAPTURE_MIN_IMAGES_PER_CLASS", 30)
    under_minimum = {label: count for label, count in counts.items() if count < minimum}
    warnings: list[str] = []
    if under_minimum:
        message = (
            f"Classes below the recommended minimum of {minimum} images: "
            f"{under_minimum}. Add more verified images for a reliable thesis result."
        )
        if _env_bool("SNAPTURE_ENFORCE_MIN_IMAGES"):
            raise ValueError(message)
        warnings.append(message)
    if small_images:
        warnings.append(
            f"{len(small_images)} image(s) are smaller than 64x64 and may be low quality."
        )

    return class_names, counts, warnings


def _records_for_dataset(
    dataset_dir: Path, class_names: list[str]
) -> dict[str, list[tuple[Path, int]]]:
    roots = _split_roots(dataset_dir)
    if roots is not None:
        records: dict[str, list[tuple[Path, int]]] = {name: [] for name in SPLIT_NAMES}
        for split, root in roots.items():
            for index, label in enumerate(class_names):
                records[split].extend((path, index) for path in image_files(root / label))
        return records

    # Deterministic stratification keeps each class represented in all splits.
    rng = random.Random(SEED)
    records = {name: [] for name in SPLIT_NAMES}
    for index, label in enumerate(class_names):
        files = image_files(dataset_dir / label)
        rng.shuffle(files)
        count = len(files)
        test_count = max(1, round(count * SPLIT_RATIOS["test"]))
        val_count = max(1, round(count * SPLIT_RATIOS["val"]))
        if test_count + val_count >= count:
            test_count = 1
            val_count = 1
        records["test"].extend((path, index) for path in files[:test_count])
        records["val"].extend(
            (path, index) for path in files[test_count : test_count + val_count]
        )
        records["train"].extend((path, index) for path in files[test_count + val_count :])
    return records


def _dataset_from_records(
    records: Iterable[tuple[Path, int]], *, shuffle: bool
) -> tf.data.Dataset:
    entries = list(records)
    if not entries:
        raise ValueError("A dataset split is empty.")
    paths = np.asarray([str(path) for path, _ in entries])
    labels = np.asarray([label for _, label in entries], dtype=np.int32)
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load_image(path: tf.Tensor, label: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
        image = tf.io.read_file(path)
        image = tf.image.decode_image(image, channels=3, expand_animations=False)
        image.set_shape([None, None, 3])
        image = tf.image.resize(image, IMAGE_SIZE)
        return image, label

    if shuffle:
        dataset = dataset.shuffle(len(entries), seed=SEED, reshuffle_each_iteration=True)
    return dataset.map(load_image, num_parallel_calls=tf.data.AUTOTUNE).batch(
        BATCH_SIZE
    ).prefetch(tf.data.AUTOTUNE)


def build_model(class_count: int) -> tf.keras.Model:
    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.08),
            tf.keras.layers.RandomZoom(0.10),
            tf.keras.layers.RandomContrast(0.10),
        ],
        name="data_augmentation",
    )

    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(*IMAGE_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(*IMAGE_SIZE, 3), name="image")
    x = augmentation(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(class_count, activation="softmax")(x)

    model = tf.keras.Model(inputs, outputs, name="snapture_mobilenetv2_scope")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def evaluate_predictions(
    model: tf.keras.Model,
    dataset: tf.data.Dataset,
    class_names: list[str],
) -> dict[str, object]:
    truth: list[int] = []
    predicted: list[int] = []
    for images, labels in dataset:
        probabilities = model(images, training=False).numpy()
        predicted.extend(np.argmax(probabilities, axis=1).tolist())
        truth.extend(labels.numpy().astype(int).tolist())

    matrix = np.zeros((len(class_names), len(class_names)), dtype=int)
    for actual, guess in zip(truth, predicted):
        matrix[actual, guess] += 1

    per_class: dict[str, dict[str, float | int]] = {}
    for index, label in enumerate(class_names):
        true_positive = int(matrix[index, index])
        false_positive = int(matrix[:, index].sum() - true_positive)
        false_negative = int(matrix[index, :].sum() - true_positive)
        precision = (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else 0.0
        )
        recall = (
            true_positive / (true_positive + false_negative)
            if true_positive + false_negative
            else 0.0
        )
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_class[label] = {
            "count": int(matrix[index, :].sum()),
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
        }

    total = int(matrix.sum())
    accuracy = float(np.trace(matrix) / total) if total else 0.0
    return {
        "accuracy": round(accuracy, 6),
        "samples": total,
        "confusion_matrix": matrix.tolist(),
        "per_class": per_class,
    }


def _relative_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_DIR))
    except ValueError:
        return str(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Dataset root; defaults to data/scope_dataset.",
    )
    parser.add_argument(
        "--enforce-min-images",
        action="store_true",
        help="Fail when a class has fewer than SNAPTURE_MIN_IMAGES_PER_CLASS images.",
    )
    parser.add_argument(
        "--allow-non-scope-dataset",
        action="store_true",
        help="Explicitly allow a legacy dataset without the seven thesis labels.",
    )
    args = parser.parse_args()
    if args.data_dir is not None:
        os.environ["SNAPTURE_DATA_DIR"] = str(args.data_dir)
    if args.enforce_min_images:
        os.environ["SNAPTURE_ENFORCE_MIN_IMAGES"] = "1"
    if args.allow_non_scope_dataset:
        os.environ["SNAPTURE_ALLOW_NON_SCOPE_DATASET"] = "1"

    tf.keras.utils.set_random_seed(SEED)
    dataset_dir = find_dataset_root()
    class_names, image_counts, warnings = validate_images(dataset_dir)
    records = _records_for_dataset(dataset_dir, class_names)
    split_counts = {
        split: {
            label: sum(
                1 for _, index in records[split] if index == class_index
            )
            for class_index, label in enumerate(class_names)
        }
        for split in SPLIT_NAMES
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Dataset: {dataset_dir}")
    print(f"Classes: {class_names}")
    print(f"Image counts: {image_counts}")
    print(f"Split counts: {split_counts}")
    for warning in warnings:
        print(f"WARNING: {warning}")

    train_ds = _dataset_from_records(records["train"], shuffle=True)
    validation_ds = _dataset_from_records(records["val"], shuffle=False)
    test_ds = _dataset_from_records(records["test"], shuffle=False)

    total_train = len(records["train"])
    class_weights = {
        index: total_train
        / (len(class_names) * max(1, split_counts["train"][label]))
        for index, label in enumerate(class_names)
    }

    model = build_model(len(class_names))
    model_path = MODEL_DIR / "snapture_baseline.keras"
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=5, restore_best_weights=True
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss", factor=0.3, patience=2, min_lr=1e-7
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(model_path), monitor="val_accuracy", save_best_only=True
        ),
    ]

    history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=EPOCHS,
        class_weight=class_weights,
        callbacks=callbacks,
    )

    model.save(model_path)
    validation_metrics = evaluate_predictions(model, validation_ds, class_names)
    test_metrics = evaluate_predictions(model, test_ds, class_names)

    labels_path = MODEL_DIR / "labels.json"
    labels_path.write_text(json.dumps(class_names, indent=2) + "\n", encoding="utf-8")

    config_path = MODEL_DIR / "model_config.json"
    config_path.write_text(
        json.dumps(
            {
                "model_version": "snapture-mobilenetv2-scope-v1",
                "image_size": list(IMAGE_SIZE),
                "preprocessing": "mobilenet_v2_internal",
                "confidence_threshold": CONFIDENCE_THRESHOLD,
                "dataset_path": _relative_path(dataset_dir),
                "dataset_layout": (
                    "explicit_splits" if _split_roots(dataset_dir) else "stratified_70_15_15"
                ),
                "split_ratios": SPLIT_RATIOS,
                "classes": class_names,
                "verified_classes": class_names,
                "needs_verification_below_threshold": True,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    summary_path = MODEL_DIR / "training_summary.json"
    summary_path.write_text(
        json.dumps(
            {
                "model_version": "snapture-mobilenetv2-scope-v1",
                "dataset_path": _relative_path(dataset_dir),
                "classes": class_names,
                "image_counts": image_counts,
                "split_counts": split_counts,
                "quality_warnings": warnings,
                "epochs_completed": len(history.history.get("loss", [])),
                "validation_accuracy": validation_metrics["accuracy"],
                "test_accuracy": test_metrics["accuracy"],
                "validation": validation_metrics,
                "test": test_metrics,
                "has_separate_test_set": _split_roots(dataset_dir) is not None,
                "training_notes": [
                    "Exact duplicate files are rejected before training.",
                    "Generic plastic images must be manually verified as PETE or HDPE.",
                    "Confidence is a rejection signal, not a safety certification.",
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Validation accuracy: {validation_metrics['accuracy']:.4f}")
    print(f"Test accuracy: {test_metrics['accuracy']:.4f}")
    print(f"Model saved to: {model_path}")
    print(f"Summary saved to: {summary_path}")


if __name__ == "__main__":
    main()
