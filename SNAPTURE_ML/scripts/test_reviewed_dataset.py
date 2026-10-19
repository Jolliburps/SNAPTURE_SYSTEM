import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image
from scripts.reviewed_dataset import LABELS, prepare, validate_prepared


class ReviewedDatasetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        records = []
        for index, label in enumerate(LABELS):
            for group in range(3):
                file = self.root / f"{index}-{group}.png"
                Image.new("RGB", (80, 80), (index * 30, group * 60, 45)).save(file)
                records.append({"path": str(file), "label": label, "group": f"{label}-item-{group}", "reviewed": True,
                                "reviewed_by": "Synthetic fixture", "permission": "Synthetic fixture generated for unit testing"})
        self.payload = {"records": records}
        self.manifest = self.root / "review.json"
        self.output = self.root / "prepared"

    def write_manifest(self):
        self.manifest.write_text(json.dumps(self.payload), encoding="utf-8")

    def test_grouped_splits_validate(self):
        self.write_manifest()
        exported = prepare(self.manifest, self.output)
        self.assertEqual(validate_prepared(self.output), 18)
        self.assertEqual({row["split"] for row in exported}, {"train", "val", "test"})

    def test_unreviewed_input_is_rejected_without_copying(self):
        self.payload["records"][0]["reviewed"] = False
        self.write_manifest()
        with self.assertRaises(ValueError):
            prepare(self.manifest, self.output)
        self.assertFalse(self.output.exists())

    def test_same_item_cannot_have_conflicting_labels(self):
        self.payload["records"][3]["group"] = self.payload["records"][0]["group"]
        self.write_manifest()
        with self.assertRaises(ValueError):
            prepare(self.manifest, self.output)

    def test_duplicates_are_rejected(self):
        self.payload["records"][1]["path"] = self.payload["records"][0]["path"]
        self.write_manifest()
        with self.assertRaises(ValueError):
            prepare(self.manifest, self.output)

    def test_changed_image_or_unreviewed_extra_file_is_rejected(self):
        self.write_manifest()
        prepare(self.manifest, self.output)
        Image.new("RGB", (80, 80), "red").save(self.output / "train" / LABELS[0] / "extra.png")
        with self.assertRaises(ValueError):
            validate_prepared(self.output)

    def test_existing_dataset_is_not_overwritten(self):
        self.write_manifest()
        prepare(self.manifest, self.output)
        with self.assertRaises(ValueError):
            prepare(self.manifest, self.output)


if __name__ == "__main__":
    unittest.main()
