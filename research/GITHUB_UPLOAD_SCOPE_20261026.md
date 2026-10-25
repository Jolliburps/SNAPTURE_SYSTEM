# GitHub upload scope — 2026-10-26

Target repository: `Jolliburps/SNAPTURE_SYSTEM`, branch `NewFEATURES`.

## Included in this update

- Latest Android camera framing, single-item results, conservative detection
  presentation, confirmation and recycling/upcycling recommendation flow.
- Persistent project guides and change-idea navigation/scrolling fixes.
- Shared user/CESD web/Django administration, protected content previews,
  connection checks and shared SQLite transaction configuration.
- Related backend, Android and browser tests; admin build/test configuration;
  operational and implementation notes.
- Public-dataset acquisition, audit, organization and storage tools, with small
  dataset indexes/audit summaries. These reports describe local data; they do
  not include that image collection or imply a newly trained model.
- Existing versioned model checkpoints, labels/configuration, application icons
  and the privacy model remain part of the repository and verification scope.

## Intentionally local, not uploaded

The user explicitly chose to keep `SNAPTURE_ML/data/New folder/` local and upload
system code and reports. Its files are preserved unchanged and ignored so they
cannot accidentally enter a later source-code commit.

Other established local-only exclusions remain:

- Dataset image trees, public-source archives, generated review views and large
  per-image manifests; license/privacy review is required before redistribution.
- The local database, private user scan uploads, password mail and backups.
- Credentials, signing keys, machine-specific environment/SDK settings.
- Dependency environments, node_modules, SDK/JDK caches and build outputs/APKs.
- Downloaded optional OWL-ViT weights. Restore them explicitly with the existing
  `SNAPTURE_ML/scripts/install_scene_detector.py` and optional detection
  dependencies; no automatic model download occurs during user inference.
- Local run logs, browser fixture databases, screenshots and test artifacts.

A GitHub clone is therefore a source/model/configuration snapshot, not a full
backup of this computer, its datasets or residents' accounts/photos. Follow
`RUNBOOK.md` for installation, local configuration and database setup.

## Validation evidence

Before this upload, the current system passed 239 backend tests, 146 Android
tests in 35 suites, both isolated browser suites, the admin production build and
lint, Django system checks and migration checks. See
`THREE_PANEL_CONNECTION_20261026.md` and `RESTORED_SCAN_IDEAS_20261026.md`.

## Upload verification procedure

This note records scope, not an advance claim that an upload succeeded.

1. Inspect every non-ignored changed/untracked file and check staged paths for
   credentials, private databases/uploads and oversized accidental data files.
2. Commit the intended source update and push without force to `NewFEATURES`.
3. Confirm the server's branch commit matches local `HEAD`.
4. Fetch a fresh shallow clone from GitHub into the ignored local diagnostics
   directory. Compare its commit, complete recursive Git tree and every
   path/mode/blob object against the local commit, including model binaries.
5. Verify the local source tree has no remaining changes or untracked source
   files; separately report the intentionally ignored local material above.

The completion response must identify the verified branch/commit and must not
describe local-only datasets, databases or builds as uploaded.
