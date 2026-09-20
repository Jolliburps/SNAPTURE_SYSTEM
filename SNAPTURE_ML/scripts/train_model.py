"""Train the SNAPTURE image classifier from the existing local dataset."""

from __future__ import annotations

import json
import os
from pathlib import Path

import tensorflow as tf
from PIL import Image, UnidentifiedImageError


PROJECT_DIR = Path(__file__).resolve().parents[1]
MODEL_DIR = PROJECT_DIR / "models"

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 42
EPOCHS = 12
VALIDATION_SPLIT = 0.20
CONFIDENCE_THRESHOLD = 0.60
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp"}


def image_files(folder: Path) -> list[Path]:
    return sorted(
        path
        for path in folder.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def is_dataset_root(folder: Path) -> bool:
    if not folder.is_dir():
        return False
    class_dirs = [child for child in folder.iterdir() if child.is_dir()]
    return len(class_dirs) >= 2 and all(image_files(child) for child in class_dirs)


def find_dataset_root() -> Path:
    configured = os.getenv("SNAPTURE_DATA_DIR")
    candidates: list[Path] = []

    if configured:
        configured_path = Path(configured)
        candidates.append(
            configured_path
            if configured_path.is_absolute()
            else PROJECT_DIR / configured_path
        )

    candidates.extend(
        [
            PROJECT_DIR / "data" / "raw" / "trashnet" / "dataset-resized",
            PROJECT_DIR / "data" / "dataset-resized",
            PROJECT_DIR / "dataset-resized",
        ]
    )

    for candidate in candidates:
        if is_dataset_root(candidate):
            return candidate

    checked = "\n".join(f"- {candidate}" for candidate in candidates)
    raise FileNotFoundError(
        "Could not find a dataset directory containing at least two non-empty "
        f"class folders. Checked:\n{checked}\n"
        "Set SNAPTURE_DATA_DIR to override the dataset location."
    )


def validate_images(dataset_dir: Path) -> tuple[list[str], dict[str, int]]:
    class_dirs = sorted(
        child
        for child in dataset_dir.iterdir()
        if child.is_dir() and not child.name.startswith(".")
    )
    if len(class_dirs) < 2:
        raise ValueError(f"Dataset must contain at least two class folders: {dataset_dir}")

    class_names: list[str] = []
    counts: dict[str, int] = {}
    invalid: list[Path] = []

    for class_dir in class_dirs:
        files = image_files(class_dir)
        if not files:
            continue
        class_names.append(class_dir.name)
        counts[class_dir.name] = len(files)

        for path in files:
            try:
                with Image.open(path) as image:
                    image.verify()
            except (UnidentifiedImageError, OSError):
                invalid.append(path)

    if invalid:
        preview = "\n".join(f"- {path}" for path in invalid[:10])
        suffix = "" if len(invalid) <= 10 else f"\n- ...and {len(invalid) - 10} more"
        raise ValueError(
            f"Found {len(invalid)} unreadable image(s) before training:\n{preview}{suffix}"
        )

    if len(class_names) < 2:
        raise ValueError("The dataset needs at least two non-empty class folders.")

    return class_names, counts


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
    # Keep preprocessing inside the model so CLI, API, and future exports match.
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(class_count, activation="softmax")(x)

    model = tf.keras.Model(inputs, outputs, name="snapture_mobilenetv2")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0001),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main() -> None:
    dataset_dir = find_dataset_root()
    class_names, image_counts = validate_images(dataset_dir)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Dataset: {dataset_dir}")
    print(f"Classes: {class_names}")
    print(f"Image counts: {image_counts}")
    print("No separate test folder was found; the validation split is used for evaluation.")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        dataset_dir,
        validation_split=VALIDATION_SPLIT,
        subset="training",
        seed=SEED,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="int",
        shuffle=True,
    )
    validation_ds = tf.keras.utils.image_dataset_from_directory(
        dataset_dir,
        validation_split=VALIDATION_SPLIT,
        subset="validation",
        seed=SEED,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        label_mode="int",
        shuffle=False,
    )

    detected_class_names = train_ds.class_names
    if detected_class_names != class_names:
        raise RuntimeError(
            "Dataset class discovery changed between validation and TensorFlow loading."
        )

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(autotune)
    validation_ds = validation_ds.prefetch(autotune)

    model = build_model(len(class_names))
    model_path = MODEL_DIR / "snapture_baseline.keras"

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy",
            patience=3,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(model_path),
            monitor="val_accuracy",
            save_best_only=True,
        ),
    ]

    history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=EPOCHS,
        callbacks=callbacks,
    )

    validation_loss, validation_accuracy = model.evaluate(validation_ds, verbose=0)
    model.save(model_path)

    labels_path = MODEL_DIR / "labels.json"
    with labels_path.open("w", encoding="utf-8") as file:
        json.dump(class_names, file, indent=2)

    config_path = MODEL_DIR / "model_config.json"
    with config_path.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "image_size": list(IMAGE_SIZE),
                "preprocessing": "mobilenet_v2_internal",
                "confidence_threshold": CONFIDENCE_THRESHOLD,
                "validation_split": VALIDATION_SPLIT,
                "dataset_path": str(dataset_dir.relative_to(PROJECT_DIR)),
                "classes": class_names,
            },
            file,
            indent=2,
        )

    summary_path = MODEL_DIR / "training_summary.json"
    with summary_path.open("w", encoding="utf-8") as file:
        json.dump(
            {
                "validation_loss": float(validation_loss),
                "validation_accuracy": float(validation_accuracy),
                "epochs_completed": len(history.history.get("loss", [])),
                "image_counts": image_counts,
                "has_separate_test_set": False,
            },
            file,
            indent=2,
        )

    print(f"Validation accuracy: {validation_accuracy:.4f}")
    print(f"Model saved to: {model_path}")
    print(f"Labels saved to: {labels_path}")
    print(f"Config saved to: {config_path}")
    print(f"Training summary saved to: {summary_path}")


if __name__ == "__main__":
    main()
