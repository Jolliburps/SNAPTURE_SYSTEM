# Complete SNAPTURE backup and restoration

The `NewFEATURES` branch contains the application source, tests, documentation,
the seven material datasets, source records, and local model files. Binary
dataset images and model weights use Git LFS. On a new computer:

```powershell
git lfs install
git clone --branch NewFEATURES https://github.com/Jolliburps/SNAPTURE_SYSTEM.git
cd SNAPTURE_SYSTEM
git lfs pull
git lfs fsck
```

Follow `RUNBOOK.md` to install the application dependencies and start the system.
Downloading or activating a checkpoint does not retrain it or verify accuracy.

## Full local folder snapshot

The GitHub Release named **Complete SNAPTURE folder backup — 18 November 2026**
contains an encrypted ZIP divided into numbered `.aes.partNNN` assets. This
snapshot also preserves files normally excluded from source control, including
local environments, generated builds, tools, logs, account databases and private
uploads. AES-256-GCM encryption protects private contents in this public repository.
The archive contains the local folder, not globally installed tools, Android phone
storage, Windows credentials, or files outside `SNAPTURE_SYSTEM`.

Download every numbered part. The recovery key is **not on GitHub**. Its original
local location is:

`C:\Users\My PC\Documents\SNAPTURE_BACKUPS\2026-11-18\SNAPTURE_RECOVERY_KEY.json`

Keep a separate secure copy of that recovery file. It includes the secret key and
the expected size and SHA-256 digest of every archive part. Losing it makes the
encrypted full-folder backup unrecoverable. Never commit or upload it publicly.

Restore the ZIP using the included tool:

```powershell
python -m pip install cryptography
python tools/restore_full_backup.py --key "D:\Private\SNAPTURE_RECOVERY_KEY.json" --parts "D:\Downloads\SNAPTURE-backup" --output "D:\Restore\SNAPTURE_SYSTEM.zip"
```

The tool checks each part and authenticates the entire decrypted ZIP. It does not
extract or run files. Extract into a new directory. Local virtual environments
and build caches may need rebuilding on a different computer. The embedded
`SNAPTURE_BACKUP_MANIFEST.json` lists the archived files and their checksums.
