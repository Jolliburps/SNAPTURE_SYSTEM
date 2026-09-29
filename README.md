# SNAPTURE System

SNAPTURE is now organized as three local projects:

- `SNAPTURE_ANDROID/` — standalone React Native CLI Android client. It does
  not require Expo or Expo Go.
- `SNAPTURE_BACKEND/` — Django API, authentication, local database, prediction
  history, recommendations, and administrator dataset tools.
- `SNAPTURE_ML/` — TensorFlow training and inference code shared by Django.

The old Expo prototype has been removed from the active workspace and is not
part of the runnable system.

The original source, when retained, is the six-class TrashNet dataset, while
the thesis checklist uses seven narrower categories. If you have a raw source
directory, generate the clean, labeled layout without changing it:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ML"
python .\scripts\prepare_scope_dataset.py
```

The current workspace already contains the prepared layout and does not retain
the raw source directory, so do not run this command without passing a real
`--source` path. Generic plastic images are kept in a manual-review folder
instead of being falsely labeled as PETE or HDPE; see its
`dataset_manifest.json` for the source mapping.

Dataset locations are intentionally separated:

- `SNAPTURE_ML/data/raw/trashnet/dataset-resized/` — optional original source
  pictures (not included in the current cleaned workspace);
- `SNAPTURE_ML/data/scope_dataset/` — cleaned thesis-scope folders used for
  verified labels and future training;
- `SNAPTURE_BACKEND/media/` — user prediction uploads and dataset uploads,
  not training source data until an administrator verifies them.

Do not create another `dataset-resized` folder at the `SNAPTURE_ML` root.

Dataset images are now collected through the administrator-protected Django
dataset endpoint. Select the verified label before saving each image. This
collector remains local and never uses a model prediction as a ground-truth
label.

After an administrator marks uploads as **verified** in Django Admin, export
them to the training folders with:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_BACKEND"
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py export_verified_dataset
```

See [`SNAPTURE_ML/DATASET_POLICY.md`](SNAPTURE_ML/DATASET_POLICY.md) for the
collection, consent, labeling, split, and evaluation rules.

## Run locally

1. Start the Django backend from `SNAPTURE_BACKEND`:

   ```powershell
   cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_BACKEND"
   & "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py migrate
   & "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
   ```

2. In a second terminal, start Metro for the standalone Android client:

   ```powershell
   cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ANDROID"
   npm.cmd install
   npm.cmd start -- --reset-cache
   ```

   Keep this terminal open. Start only one Metro server on port 8081.

3. In a third terminal, connect and open the installed app:

   ```powershell
   cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM"
   $adb = ".\.tools\android-sdk\platform-tools\adb.exe"
   & $adb devices
   & $adb -s 8PVKYTHM6DK7RK4X reverse tcp:8081 tcp:8081
   & $adb -s 8PVKYTHM6DK7RK4X shell am force-stop com.snapture_android
   & $adb -s 8PVKYTHM6DK7RK4X shell monkey -p com.snapture_android 1
   ```

   The phone and computer must be on the same Wi-Fi because the Django API is
   reached through the computer's LAN address. `adb devices` must show the
   phone as `device`, not `offline`.

   For a first-time native install, set JDK/SDK paths and run
   `npm.cmd run android -- --no-packager` while Metro is already running.

   To verify the native build without a connected device:

   ```powershell
   cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ANDROID\android"
   .\gradlew.bat :app:assembleDebug --no-daemon
   ```

   The APK is written to
   `SNAPTURE_ANDROID/android/app/build/outputs/apk/debug/app-debug.apk`.

The current checkout is configured for the connected phone at
`http://192.168.1.103:8000/api`. For an Android emulator, change
`API_BASE_URL` in `SNAPTURE_ANDROID/src/api.ts` to
`http://10.0.2.2:8000/api`; for another computer or network, use that
computer's LAN IPv4 address and keep both devices on the same Wi-Fi.

The checked native build uses JDK 17, Android SDK Platform/Build Tools 37,
NDK `29.0.14206865`, and CMake `3.31.6`. `android/local.properties` points to
these tools on this computer and is intentionally ignored by Git; recreate it
on another computer with that computer's SDK paths.

Administrators can use the in-app administrator dashboard: choose **Log in**,
enter `admin` in the regular login field, then sign in with the administrator
credentials. The dashboard is protected by the Django API and shows totals,
category statistics, and anonymized activity. An administrator must explicitly
open a record to inspect its non-identifying evaluation details; user emails
and images are not shown in the overview. Django Admin at `/admin/` remains
available for detailed user, prediction, and dataset management. Google
sign-in is intentionally left as a later OAuth configuration step; local
email/password authentication is the working path for this local thesis build.

The Android user navigation is `Home | Materials | My scans | Projects |
Profile`. Material categories open an educational guide before scanning. User
history is account-scoped and can be deleted per scan or cleared completely.
Only the seven thesis categories can be shown as a final identification.
Generic or out-of-scope model classes such as `glass`, `plastic`, `metal`, and
`trash` are shown as **Unidentified or unsupported object** until
category-specific training data is available.

## Folder audit before cleanup

Keep these three folders as the active system:

- `SNAPTURE_ANDROID` — the new native Android client.
- `SNAPTURE_BACKEND` — Django API, authentication, history, and admin.
- `SNAPTURE_ML` — dataset preparation, training, and TensorFlow inference.

`node_modules`, Python caches, the local SQLite database,
Android build output, and `SNAPTURE_BACKEND/media/` are generated/local files
and are already ignored by Git.

For the exact local start sequence, see [`RUNBOOK.md`](RUNBOOK.md).
