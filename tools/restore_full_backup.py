"""Restore the encrypted full-folder GitHub Release backup into a ZIP.

Install the optional dependency: python -m pip install cryptography
Then: python tools/restore_full_backup.py --key /private/recovery-key.json \
        --parts /downloads --output /safe/location/SNAPTURE_SYSTEM.zip
This never extracts or executes the restored files.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

MAGIC = b'SNAPTURE_BACKUP_V1\0'


def restore(key_path, parts_dir, output):
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    recovery = json.loads(Path(key_path).read_text(encoding='utf-8'))
    parts = recovery['parts']
    key = base64.b64decode(recovery['key_base64'], validate=True)
    output = Path(output)
    if output.exists():
        raise ValueError('Choose a new output path; existing files are never overwritten.')
    header = b''
    tail = b''
    decryptor = None
    try:
        with output.open('xb') as target:
            for part in parts:
                path = Path(parts_dir) / part['name']
                digest = hashlib.sha256()
                count = 0
                with path.open('rb') as source:
                    while chunk := source.read(8 * 1024 * 1024):
                        count += len(chunk)
                        digest.update(chunk)
                        if decryptor is None:
                            needed = len(MAGIC) + 12 - len(header)
                            header += chunk[:needed]
                            chunk = chunk[needed:]
                            if len(header) < len(MAGIC) + 12:
                                continue
                            if not header.startswith(MAGIC):
                                raise ValueError('Unrecognized backup format.')
                            decryptor = Cipher(algorithms.AES(key), modes.GCM(header[-12:])).decryptor()
                            decryptor.authenticate_additional_data(header)
                        data = tail + chunk
                        if len(data) > 16:
                            target.write(decryptor.update(data[:-16]))
                            tail = data[-16:]
                        else:
                            tail = data
                if count != part['bytes'] or digest.hexdigest() != part['sha256']:
                    raise ValueError('Incomplete or changed backup part: ' + part['name'])
                print('Verified ' + part['name'], flush=True)
            if decryptor is None or len(tail) != 16:
                raise ValueError('The encrypted archive is incomplete.')
            target.write(decryptor.finalize_with_tag(tail))
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--key', required=True, type=Path)
    parser.add_argument('--parts', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    print('Restored and authenticated ZIP: ' + str(restore(args.key, args.parts, args.output)))
