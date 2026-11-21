"""One-time, reversible organization of root documentation; never touch app data."""
import hashlib
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
BACKUP = ROOT / 'history/filesystem-organization-2026-11-19'
KEEP = {'README.md', 'RUNBOOK.md', 'BACKUP_AND_RESTORE.md', 'COMPLETE_DOCUMENTATION.md'}

def main():
    if BACKUP.exists():
        raise SystemExit('Organization backup exists; refusing to repeat.')
    moves = {}
    for path in ROOT.glob('*.md'):
        if path.name in KEEP:
            continue
        category = 'reports' if any(word in path.stem for word in ('REPORT', 'AUDIT', 'STATUS', 'FIX_', 'RESTORED_', 'FLOW_')) else 'guides'
        moves[path] = ROOT / 'documentation' / 'project' / category / path.name
    originals = {p: p.read_bytes() for p in moves}
    edits = {}
    # Resolve Markdown links from their original directory before relocating docs.
    for folder in (ROOT, ROOT/'documentation', ROOT/'guides'):
        paths = folder.glob('*.md') if folder == ROOT else folder.rglob('*.md')
        for path in paths:
            raw = path.read_bytes()
            text = raw.decode('utf-8-sig')
            destination = moves.get(path, path)
            def link(match):
                target = match.group(1)
                if ':' in target or target.startswith('#'):
                    return match.group(0)
                file, sep, anchor = target.partition('#')
                resolved = (path.parent / file).resolve()
                mapped = moves.get(resolved, resolved)
                if destination == path and mapped == resolved:
                    return match.group(0)
                import os
                relative = os.path.relpath(mapped, destination.parent).replace('\\', '/')
                return '](' + relative + (sep + anchor if sep else '') + ')'
            updated = re.sub(r'\]\(([^\s)]+)\)', link, text)
            if updated != text:
                originals.setdefault(path, raw)
                edits[path] = updated.encode('utf-8')
    for path, raw in originals.items():
        target = BACKUP/'files'/path.relative_to(ROOT)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    for source, target in moves.items():
        assert not target.exists(), target
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))
    for path, raw in edits.items():
        moves.get(path, path).write_bytes(raw)
    manifest = {'moves': {str(p.relative_to(ROOT)):str(t.relative_to(ROOT)) for p,t in moves.items()},
                'edited_links': [str(p.relative_to(ROOT)) for p in edits],
                'original_sha256': {str(p.relative_to(ROOT)):hashlib.sha256(raw).hexdigest() for p,raw in originals.items()}}
    (BACKUP/'manifest.json').write_text(json.dumps(manifest,indent=2))
    index = ['# Project file map', '', 'Start with [README](../README.md), [run commands](../RUN_COMMANDS.txt), or [runbook](../RUNBOOK.md).', '',
             '| Folder | Contents |', '| --- | --- |', '| `SNAPTURE_ANDROID/` | Mobile application |', '| `SNAPTURE_BACKEND/` | API and local data |', '| `SNAPTURE_ADMIN/` | Web administration |', '| `SNAPTURE_ML/` | Models, datasets and inference |', '| `documentation/project/guides/` | Project architecture and feature guides |', '| `documentation/project/reports/` | Change reports and historical validation |', '| `history/` | Recovery backups; preserve these |', '| `.run-logs/` | Diagnostic and validation artifacts |', '| `.tools/` | Local development tools |', '', '## Organized root documents', '']
    index += [f'- [{p.stem}]({t.relative_to(ROOT / "documentation").as_posix()})' for p,t in sorted(moves.items())]
    index += ['', 'Application paths, launchers, exports, configuration, models, datasets and saved data were kept in place.', 'Recovery manifest and original files: `history/filesystem-organization-2026-11-19/`. Restore original files and reverse only the listed moves to undo this organization.']
    (ROOT/'documentation/FILE_MAP.md').write_text('\n'.join(index)+'\n',encoding='utf-8')
    print(f'Organized {len(moves)} documents; repaired links in {len(edits)} documents. Backup: {BACKUP}')

if __name__ == '__main__':
    main()
