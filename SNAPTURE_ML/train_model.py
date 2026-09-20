"""Compatibility entry point; the maintained trainer lives in scripts/."""

from pathlib import Path
import runpy


if __name__ == "__main__":
    runpy.run_path(
        str(Path(__file__).resolve().parent / "scripts" / "train_model.py"),
        run_name="__main__",
    )
