import json
import tempfile
import unittest
from pathlib import Path

from scripts.model_selection import resolve_model_paths


class ModelSelectionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "models"
        self.root.mkdir()
        self.root = self.root.resolve()

    def manifest(self, **changes):
        payload = {"schema_version": 1, "model": "candidate/model.keras", "labels": "candidate/labels.json", "config": "candidate/config.json"}
        payload.update(changes)
        (self.root / "active_model.json").write_text(json.dumps(payload), encoding="utf-8")
        return payload

    def test_without_selection_preserves_legacy_default(self):
        result = resolve_model_paths(self.root, {})
        self.assertEqual(result[0], self.root / "snapture_baseline.keras")

    def test_selection_uses_checkpoint_and_matching_sidecars(self):
        payload = self.manifest()
        for key in ("model", "labels", "config"):
            path = self.root / payload[key]
            path.parent.mkdir(exist_ok=True)
            path.touch()
        self.assertEqual(resolve_model_paths(self.root, {}), tuple(self.root / payload[k] for k in ("model", "labels", "config")))

    def test_missing_selected_checkpoint_fails_instead_of_silent_fallback(self):
        self.manifest()
        with self.assertRaises(FileNotFoundError):
            resolve_model_paths(self.root, {})

    def test_rejects_path_outside_models(self):
        self.manifest(model="../outside.keras")
        with self.assertRaises(ValueError):
            resolve_model_paths(self.root, {})

    def test_rejects_absolute_path(self):
        self.manifest(model=str(self.root / "absolute.keras"))
        with self.assertRaises(ValueError):
            resolve_model_paths(self.root, {})

    def test_rejects_bad_schema(self):
        self.manifest(schema_version=2)
        with self.assertRaises(ValueError):
            resolve_model_paths(self.root, {})

    def test_directory_override_wins_over_selection(self):
        self.manifest()
        result = resolve_model_paths(self.root, {"SNAPTURE_MODEL_DIR": "other"})
        self.assertEqual(result[0], self.root.parent / "other" / "snapture_baseline.keras")

    def test_file_override_wins_over_selection(self):
        self.manifest()
        result = resolve_model_paths(self.root, {"SNAPTURE_MODEL_PATH": "custom.keras"})
        self.assertEqual(result[0], Path("custom.keras"))
        self.assertEqual(result[1], self.root / "labels.json")


if __name__ == "__main__":
    unittest.main()
