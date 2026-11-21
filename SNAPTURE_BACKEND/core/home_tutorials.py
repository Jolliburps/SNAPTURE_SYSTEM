"""Read-only Home tutorials, independent of scan eligibility and saved projects."""
import json
from copy import deepcopy
from pathlib import Path

VERSION = 'home-2026-11-18-v1'
ROOT = Path(__file__).resolve().parent / 'data' / 'upcycling' / VERSION
TUTORIALS = json.loads((ROOT / 'tutorials.json').read_text(encoding='utf-8'))


def home_tutorials(material):
    return deepcopy(TUTORIALS.get(material, []))
