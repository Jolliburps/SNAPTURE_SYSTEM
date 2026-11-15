# SNAPTURE Git and dataset workflow

This guide covers the `main` branch and reviewed ML training images. The
canonical shared dataset is `SNAPTURE_ML/data/scope_dataset/`. Do not publish
the local Drive candidate folders (`SNAPTURE_ML/data/pete_bottles/`,
`hdpe_containers/`, and similar): their labels, permissions, and privacy review
are incomplete. Keep raw TrashNet source files local under
`SNAPTURE_ML/data/raw/trashnet/dataset-resized/`.

## Install Git and Git LFS

On Windows, install Git for Windows from [git-scm.com](https://git-scm.com/download/win)
and Git LFS from [git-lfs.com](https://git-lfs.com/). Then open a new
PowerShell window and run:

```powershell
git --version
git lfs version
git lfs install
```

Git LFS is already configured by `.gitattributes` for supported image formats
inside `data/scope_dataset/`. Do not run `git lfs migrate`; this repository's
existing history has not been rewritten.

## Clone or update the project

```powershell
git lfs install
git clone https://github.com/Jeb050904/SNAPTURE-.git SNAPTURE--main
cd SNAPTURE--main
git switch main
git lfs pull
```

For an existing checkout:

```powershell
git switch main
git pull --ff-only origin main
git lfs pull
```

Git LFS normally downloads objects during clone and pull when its filters are
installed. `git lfs pull` explicitly fetches the objects for the current
checkout if a pointer file remains.

## Add reviewed dataset images

Before adding images, confirm each image has an approved label, documented
source/license or permission, and no faces, documents, addresses, or other
private information. Keep the existing class directory names from the current
dataset policy. Put only reviewed images in `SNAPTURE_ML/data/scope_dataset/`.
Never relabel generic plastic as PETE or HDPE without verifying each item.

Check a new image path before staging:

```powershell
git check-ignore -v SNAPTURE_ML/data/scope_dataset/pete_bottles/new-image.jpg
git check-attr filter -- SNAPTURE_ML/data/scope_dataset/pete_bottles/new-image.jpg
```

The first command should report no ignore rule; the second should report
`filter: lfs`. Stage intended paths explicitly so unrelated ongoing work is
not included:

```powershell
git add .gitattributes .gitignore documentation/GIT_DATASET_WORKFLOW.md
git add SNAPTURE_ML/data/scope_dataset/
git status --short
git lfs status
```

Review the staged file list and LFS status before committing. Then commit and
push normally; the Git LFS pre-push hook uploads the associated objects:

```powershell
git commit -m "Add reviewed SNAPTURE dataset images"
git push origin main
```

To verify LFS tracking after the push:

```powershell
git lfs ls-files
git lfs status
git status --short --branch
```

The LFS list should include the reviewed image paths, and the push should
finish without an LFS upload error. Ask collaborators to run `git lfs pull`
after pulling if image paths contain pointer files rather than image data.

## Common Git LFS issues

- **`git: 'lfs' is not a git command`:** install Git LFS, open a new terminal,
  and run `git lfs install`.
- **Images appear as small text pointer files:** run `git lfs pull`; confirm
  Git LFS is installed and the relevant path is listed by `git lfs ls-files`.
- **Push reports a missing object:** run `git lfs status`, then retry
  `git push` while online. Do not bypass the LFS pre-push hook.
- **Storage or bandwidth limit reached:** check the repository owner's GitHub
  billing and LFS usage. Do not remove or rewrite shared history to work around
  a quota.

## GitHub limits and quota

GitHub's current included Git LFS allowance is 10 GiB storage and 10 GiB
download bandwidth per billing cycle for Free and Pro accounts; Team and
Enterprise Cloud include 250 GiB each. The allowance is shared at the account
level, so check the repository owner's current usage before uploading. LFS
storage counts each new version of a file; downloads by collaborators consume
bandwidth. Without paid overages, exceeding storage can leave clones with only
pointer files and prevent pushes, while exceeding bandwidth can disable LFS
downloads until the next cycle. GitHub's maximum individual LFS file size is
2 GiB on Free/Pro, 4 GiB on Team, and 5 GiB on Enterprise Cloud. Regular Git
files over 100 MB are blocked by GitHub.

See GitHub's [Git LFS billing and quota details](https://docs.github.com/en/billing/concepts/product-billing/git-lfs),
[LFS file-size limits](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage),
and [large-file policy](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).
