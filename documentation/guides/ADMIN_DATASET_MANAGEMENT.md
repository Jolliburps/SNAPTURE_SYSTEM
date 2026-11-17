# Admin content and research image datasets

This extends the existing CESD web application, Django sessions, SQLite database
and `datasets.DatasetImage` storage. Open **Dashboard → Open image datasets**
(`/datasets`). The existing seven main navigation links remain unchanged.

## Appearance

The shared admin palette uses a soft green-grey canvas, warm light surfaces,
clear green-grey borders, stronger focus outlines and distinct table headers.
The existing green brand, sidebar and authentication flow remain in place.
Destructive actions use muted red with a readable label.

## Permissions and deletion

| Operation | Required authorization | Result |
| --- | --- | --- |
| Delete policy, educational material, announcement or schedule | Active CESD Account Owner session, CSRF, exact record ID and current revision | Permanently deletes that content row; audits the actor and item. Attachment bytes stay private; the publication/file route stops working. No content Trash. |
| Browse shared research images | Active staff session with `datasets.view_datasetimage` | Private previews and metadata; no access to residents' private histories. |
| Upload / review | `add_datasetimage` / `change_datasetimage` | Explicit upload permission; pending by default. Review records evidence and actor. |
| Move image(s) to Trash / restore | `delete_datasetimage` | Confirms exact IDs/count, retains original bytes and metadata. Restore resets approval to pending and inclusion to false. |
| Create/download snapshot | `export_dataset` and `view_datasetimage` | Versioned manifest and generated ZIP; eligibility is rechecked at download. |
| Withdraw own shared copy | Resident bearer token, matching contributor | Withdraws consent, excludes and trashes the shared copy. Other residents cannot withdraw it. |

Ordinary CESD staff do not automatically gain dataset permissions. The management
command below grants only dataset permissions to an **existing active CESD owner**:

```powershell
# From SNAPTURE_SYSTEM, with the existing environment loaded:
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py grant_dataset_manager --email 'EXISTING-OWNER-EMAIL'
```

It does not create an account, change a password, grant superuser status, or grant
private prediction/scene permissions. All mutation routes enforce authorization
on the backend; staff-session mutations also require CSRF. The Django dataset
admin is read-only so its forms cannot bypass review or permanently delete files.
Dataset audits and export manifests are retained, not offered as destructive
controls. No automatic permanent-purge or storage-retention job is configured.
Trash does **not** free disk space. Previously downloaded exports/publications
cannot be recalled by deletion or consent withdrawal.

For content deletion, confirm/cancel identifies the title and ID and explains the
irreversible row deletion and retained attachment. Dataset bulk deletion affects
only the selected IDs, at most 100 per request, never every result of a filter.
Success refreshes rows/counts. Failures remain visible and do not report success.

## Seven official model categories

`SNAPTURE_BACKEND/core/materials.py:SCOPE_LABELS` remains authoritative:

- `pete_bottles`
- `hdpe_containers`
- `cardboard`
- `paper`
- `fabric_scraps`
- `dry_untreated_wood_scraps`
- `coconut_shells`

No active model weights, class encoding, inference behavior or ML source tree is
changed by this feature. Database counts distinguish total, approved, pending,
export-eligible and excluded/rejected records. Trashed images have a separate
filter. Unidentified records are not assigned an official class automatically.

The page also displays **recorded offline counts**, if the small
`research/recognition_basis_summary.json` registry is present. These are dated
photo-group counts, not live filesystem verification, approved samples or raw
object counts. The page checks only whether the recorded canonical manifest is
present. It does not automatically import public-source datasets into this
consented library, flatten annotation trees, assume rights, or inspect every
image visually. ZeroWaste's existing research-only licensing hold remains.

On this PC the canonical `SNAPTURE_ML/data/recognition_basis/20261025T093043Z/manifest.json`
was absent during implementation. To restore that offline view, transfer the
complete canonical directory and its manifests, plus any missing source trees,
source permission/license manifests and private/local-only originals from the
original PC; or rebuild it with the existing acquisition/organization scripts
after verifying source availability. A Git summary alone does not restore images.
Do not edit hardlinked review/source images in place. See
[`DATASET_INDEX.md`](../../SNAPTURE_ML/data/DATASET_INDEX.md) for the recorded
sources, annotation references, duplicate and split-leakage holds.

## Correct Name and separate consent

Correct Name still proposes a private object name without replacing the model's
raw prediction. It does not share the photo by itself. In the existing assessment
research prompt residents can choose:

1. **Review only**: the legacy review entry references the private scan; clearing
   that scan removes the review entry, as previously disclosed.
2. **Share dataset copy**: explicit separate consent permits an independent
   research copy and proposed name. This copy survives **My Scans → Clear**.
   Residents can withdraw it under **Settings → Manage shared research copies**,
   including after the original scan has been cleared.

Neither choice approves labels or starts training. Sharing warns against faces,
private details and contributing images without permission. Copy consent is
versioned in provenance. Withdrawing from the assessment also withdraws its
dataset copy. Administrators cannot restore withdrawn consent.

Only separately consented copies participate in cross-user custom groups. Names
use Unicode NFKC, whitespace normalization and case folding. `charger`, `Charger`
and ` CHARGER ` resolve to a single stable group ID, displayed as **Charger**.
The proposed input is retained on the image/audit; the group does not depend on
the user's account or a physical folder name. Similar words are not automatically
merged. Names reject control characters and exceedances of 120 characters.

Reviewers can rename or explicitly merge a group with a reason. Old aliases keep
matching the canonical group. Image references and review history remain intact;
changed memberships are held out of exports until a reviewer includes them again.
No source file is moved/deleted. Case-only display changes preserve inclusion.

## Review workflow

For each image, **Review** shows the source, proposed official category, raw
predicted category and separate custom group. The reviewer chooses an explicit
verified official category or a custom export assignment, then records:

- Pending, approved, rejected or excluded status.
- Evidence/reason for the decision.
- Confirmation of rights, license/provenance and privacy.
- Confirmation of the assigned label and usable image quality.
- Explicit inclusion in exports.

Approval requires recorded consent and both review confirmations. Missing or
unclear permission must stay pending/excluded; a user correction is not proof.
Changing a resident's proposed name resets the shared copy to pending and removes
export inclusion. No private scan is modified by shared-library review.

Images use the existing media storage with database membership references. An
exact SHA-256 match can reuse an existing shared binary; changing a group/name
does not copy the image. JPEG/PNG/WebP uploads are verified and decoded, limited
to 10 MB, at least 64 pixels per side and at most 25 megapixels. UUID request keys
make retried uploads idempotent; reusing a key for different content is rejected.
New files left by a failed DB transaction are reference-checked and cleaned up;
storage/DB cleanup failures log a restricted maintenance hold. Existing originals
are never removed by this cleanup. Storage/database outages require operator
review; no claim of an atomic transaction spanning disk and database is made.

## Snapshots and training compatibility

Select images on the current page and use **Create selected snapshot**. Only
active, consented, approved, explicitly included records with rights, quality and
an explicit export assignment qualify. The ZIP contains:

```text
official_categories/
  pete_bottles/                 # and the other six exact labels above
custom_labels/
  <stable-group-id>-charger/
manifests/dataset.json
```

All seven official folders are generated, even when empty. A custom image is
exported only to its custom collection, never added as an eighth official class.
Unidentified and unreviewed records remain browsable in the database and outside
normal exports. The manifest records image IDs, relative paths, SHA-256, predicted
and verified labels, group ID/display label, review date/status, reviewer-written
public citation/license, version and export date. It omits contributor identity,
tokens, private media URLs, user answers and raw private metadata. Reviewers must
also avoid personal details in public citation/group fields.

Exact duplicates in the selected snapshot produce one image with duplicate
references in the manifest. If eligible duplicates have conflicting assignments,
all conflicting copies in that snapshot are withheld for review. Missing,
corrupt or changed-checksum binaries are withheld. Similar images and physical
object leakage still require research review; no automatic similarity verdict
or every-image visual review is claimed. Exports are limited to 200 selected
records / 200 MB. The UI selects only the visible 24-record page. Snapshot history
shows the latest 20 records. Old manifests remain for audit, but their downloads
are refused when eligibility, labels, review or files have changed.

The existing official-only management command now applies the same eligibility
checks and requires a new/empty destination, preventing stale files from leaking
into a later export:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py export_verified_dataset --label paper --output 'NEW-EMPTY-OUTPUT-FOLDER'
```

It creates `official_categories/`, `labels.json` and `verified_manifest.json`.
Use the generated **official_categories** directory as the folder-training root
only in a separately authorized future training workflow. No training, live-model
replacement or raw-dataset Git upload occurs here. CLI exports are trusted local
operator actions and are not web-account permission checks. Web snapshots keep
their version manifests in `DatasetExport` and audit the requesting manager.

## Schema, backup and deployment

Migration: `datasets/migrations/0004_shared_review_library.py`. It extends the
existing image table with separate labels, consent, rights/quality, inclusion,
reviewer, checksum, provenance, request key, timestamps and recoverable Trash.
It adds `CustomLabelGroup`, `CustomLabelAlias`, `DatasetAudit` and `DatasetExport`,
indexed category/status and group/status lookups and unique retry/name keys.
The source prediction relation uses **SET_NULL**, so clearing My Scans preserves
the shared copy. Existing verified rows receive no invented consent or rights
and are excluded until properly sourced/reviewed. No migration imports raw data.

For the current Windows workspace, a consistent SQLite online backup was saved
outside Git under `.tools/dataset-admin/` before applying the schema. The local
`before.json` records the actual backup filename and pre-migration table counts.
Keep that private. Back up `SNAPTURE_BACKEND/media/` independently for full recovery;
a database backup alone does not restore image bytes.

From the workspace root, after an independent backup and with services stopped
for a controlled schema change:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.tools\git-updates\Invoke-ProjectCheck.ps1 MigrationPlan
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\.tools\git-updates\Invoke-ProjectCheck.ps1 Migrate
```

On another PC, load its documented Python environment and use `manage.py migrate
--plan`, then `manage.py migrate --noinput`. Grant the dataset-only owner group
explicitly as above; it is not a default permission for every web account.
Restart the existing backend if it runs without auto reload, then refresh the
admin and reload the development app. No new npm/Python dependencies or environment
secrets were introduced. The existing terminal startup commands still apply.

If recovery is needed, stop writers, retain the failed DB/media for diagnosis and
restore the consistent SQLite backup together with the corresponding code/media
snapshot. Do not reverse the migration on a live system with newer contributions
or blindly overwrite its database. Production hosting, HTTPS, private storage
and access/retention policy remain operator configuration; the local development
server is not a public deployment.

## Verification

Backend tests use a temporary database and synthetic images. Browser tests use
the dedicated `.local/e2e.sqlite3` database on ports 8001/5174; normal services and
resident photos are not their fixtures. Mobile tests block live network access.
See [implementation and verification report](../ADMIN_DATASET_IMPLEMENTATION_REPORT.md)
for actual results and remaining physical-device checks.
