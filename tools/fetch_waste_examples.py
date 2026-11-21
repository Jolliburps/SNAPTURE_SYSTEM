"""Fetch the seven attributed educational material reference photos."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'SNAPTURE_ANDROID/src/assets/material-examples'
PHOTOS = [
    ('pete_bottles', 12496883, 'Water bottles', 'https://www.pexels.com/photo/water-bottles-on-a-wooden-floor-12496883/'),
    ('hdpe_containers', 5217898, 'Household product container', 'https://www.pexels.com/photo/bottle-of-cleaning-product-on-table-5217898/'),
    ('cardboard', 8015700, 'Cardboard box', 'https://www.pexels.com/photo/a-brown-kraft-box-8015700/'),
    ('paper', 14935583, 'Paper sheets', 'https://www.pexels.com/photo/stack-of-paper-files-14935583/'),
    ('fabric_scraps', 23495785, 'Fabric pieces', 'https://www.pexels.com/photo/hand-holding-fabric-swatch-against-beige-wall-23495785/'),
    ('coconut_shells', 11865861, 'Coconut halves before preparation', 'https://www.pexels.com/photo/close-up-of-coconuts-halves-11865861/'),
    ('dry_untreated_wood_scraps', 8817836, 'Wooden boards; treatment must be confirmed', 'https://www.pexels.com/photo/stacks-of-wooden-planks-8817836/'),
]

def fetch(row):
    label, photo_id, caption, source = row
    url = f'https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=640'
    with urlopen(Request(url, headers={'User-Agent': 'SNAPTURE educational reference downloader'}), timeout=30) as response:
        data = response.read(4_000_000)
    if not data.startswith(b'\xff\xd8'):
        raise ValueError(f'{label}: response is not JPEG')
    (DEST / f'{label}.jpg').write_bytes(data)
    return {'label': label, 'caption': caption, 'source': source, 'license': 'Pexels License', 'license_url': 'https://www.pexels.com/license/', 'sha256': hashlib.sha256(data).hexdigest()}

if __name__ == '__main__':
    DEST.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        records = list(pool.map(fetch, PHOTOS))
    (DEST / 'sources.json').write_text(json.dumps(records, indent=2) + '\n', encoding='utf-8')
    print(f'Downloaded {len(records)} reference photos.')
