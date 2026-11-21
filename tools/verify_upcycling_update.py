"""Audit versioned tutorial media; optionally compare the read-only collection/baseline.

Uses only Python's standard library and never writes source data or app state.
"""
import argparse
import ast
import csv
import hashlib
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
CONTENT = REPO / 'SNAPTURE_BACKEND/core/data/upcycling'
CATALOG = REPO / 'SNAPTURE_BACKEND/core/recommendations.py'


def catalog(path):
    tree = ast.parse(path.read_text(encoding='utf-8'))
    node = next(n for n in tree.body if isinstance(n, ast.AnnAssign) and n.target.id == 'CATALOG')
    rows = {}
    for material, choices in zip(node.value.keys, node.value.values):
        for entry in choices.elts:
            value = {ast.literal_eval(k): ast.literal_eval(v) for k, v in zip(entry.keys, entry.values)
                     if ast.literal_eval(k) != 'photos'}
            rows[value['id']] = (ast.literal_eval(material), value)
    functions = [ast.dump(n) for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
    return rows, functions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-root', type=Path)
    parser.add_argument('--baseline', type=Path, help='Pre-edit recommendations.py')
    args = parser.parse_args()
    rows, functions = catalog(CATALOG)
    assert len(rows) == 21 and all(len(row['steps']) == 3 for _, row in rows.values())
    assert all(all(isinstance(s, str) and s.strip() for s in row['steps']) for _, row in rows.values())
    if args.baseline:
        before, old_functions = catalog(args.baseline)
        assert functions == old_functions, 'Recommendation/question functions changed'
        assert list(before) == list(rows), 'IDs/order changed'
        for project, (material, row) in rows.items():
            old_material, old = before[project]
            assert material == old_material and len(old['steps']) == len(row['steps'])
            assert {k: v for k, v in old.items() if k not in {'summary', 'steps'}} == {
                k: v for k, v in row.items() if k not in {'summary', 'steps'}}
        print('PASS: baseline IDs, category/order, titles, materials, step counts and functions unchanged')
        print('Changed summaries:', sum(rows[k][1]['summary'] != before[k][1]['summary'] for k in rows))
        print('Changed step strings:', sum(a != b for k in rows for a, b in zip(rows[k][1]['steps'], before[k][1]['steps'])))
    records = {}
    manifest = []
    if args.reference_root:
        records = {r['id']: r for r in json.loads((args.reference_root / 'recommendations.json').read_text(encoding='utf-8'))}
        with (args.reference_root / 'photo_manifest.csv').open(encoding='utf-8-sig', newline='') as source:
            manifest = list(csv.DictReader(source))
        assert len(records) == 28
    attached = missing = 0
    for path in CONTENT.glob('*/photos.json'):
        if path.parent.name.startswith('home-'):
            continue  # Separate read-only tutorial identities; not the 21-item catalog.
        for project, photos in json.loads(path.read_text(encoding='utf-8')).items():
            assert project in rows
            for photo in [photos['finished'], *photos['steps']]:
                if 'step_index' in photo:
                    assert type(photo['step_index']) is int and 0 <= photo['step_index'] < len(rows[project][1]['steps'])
                if photo['url']:
                    asset = (CONTENT / photo['url'].removeprefix('/api/tutorial-assets/')).resolve()
                    assert asset.is_relative_to(CONTENT.resolve())
                    assert hashlib.sha256(asset.read_bytes()).hexdigest() == photo['sha256']
                    attached += 1
                else:
                    assert photo['photo_status'] == 'Dedicated process photo needed'
                    missing += 1
                if records:
                    record = records[photos['source_id']]
                    assert all(photos[k] == record[k] for k in ('source_url', 'credit', 'photo_rights', 'relative_dir'))
                    item = record if photo['source_stage'] == 'finished' else next(
                        s for s in record['steps'] if s.get('source_step', s['number']) == photo['source_stage'])
                    assert photo['source_local_photo'] == item.get('local_photo')
                    if photo['url']:
                        original = args.reference_root / record['relative_dir'] / item['local_photo']
                        assert original.read_bytes() == asset.read_bytes()
                        assert photo['original_image_url'] == item.get('photo_url', record['finished'])
                        relative = f"{record['relative_dir']}/{item['local_photo']}"
                        match = next(m for m in manifest if m['recommendation_id'] == record['id'] and m['local_file'] == relative)
                        assert match['source_image_url'] == photo['original_image_url']
                        assert match['credit'] == photos['credit'] and match['photo_reuse_permission'] == photos['photo_rights']
                        if item.get('visual_note'):
                            assert item['visual_note'] in photo['visual_note']
    print(f'PASS: {attached} attached files and {missing} explicit missing-photo mappings; 21 projects / 63 string steps')
    if records:
        print('PASS: all attached bytes, provenance and manifest rows match the 28-record source collection')


if __name__ == '__main__':
    main()
