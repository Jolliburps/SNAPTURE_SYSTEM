# SNAPTURE local runbook

## 1. Install Android build tools once

Install JDK 17 and Android SDK Platform/Build Tools 37, Platform-Tools, NDK
`29.0.14206865`, and CMake `3.31.6` through Android Studio's SDK Manager
or `sdkmanager`. A local `.tools/` cache, if present, is ignored by Git.

Verify from a new PowerShell window:

```powershell
java -version
adb version
```

The native build also needs `SNAPTURE_ANDROID/android/local.properties` (ignored
by Git) with paths like:

```text
sdk.dir=C:\\Android\\Sdk
cmake.dir=C:\\Android\\Sdk\\cmake\\3.31.6
```

## 2. Start the Django API

Complete the backend environment setup in `README.md` first. From the repository root, open terminal 1:

```powershell
cd ".\SNAPTURE_BACKEND"
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py migrate
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py runserver 0.0.0.0:8000
```

The API is at `http://127.0.0.1:8000/api/` on the computer. Create the admin
account once with `manage.py createsuperuser`. In the Android app, choose
**Log in**, type `admin` in the email field, and tap **Log in** to open the
administrator sign-in screen. The in-app dashboard shows user and prediction
activity; `/admin/` remains available for detailed Django administration.

## 3. Set the Android API address

- Android emulator: change `SNAPTURE_ANDROID/src/api.ts` to
  `http://10.0.2.2:8000/api`.
- Another physical phone or network: run `ipconfig`, copy the computer's
  Wi-Fi IPv4 address, and replace the current address in `src/api.ts`. Keep
  both devices on the same Wi-Fi network.

## 4. Build and launch the Android app

From the repository root, open terminal 2. Replace the JDK and SDK paths below with your installed paths:

```powershell
$env:JAVA_HOME = "C:\path\to\jdk-17"
$env:ANDROID_SDK_ROOT = "C:\path\to\Android\Sdk"
$env:ANDROID_HOME = $env:ANDROID_SDK_ROOT
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_SDK_ROOT\platform-tools;$env:Path"

cd ".\SNAPTURE_ANDROID"
npm.cmd ci
$adb = "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
& $adb devices
$deviceSerial = "replace-with-adb-serial"
& $adb -s $deviceSerial reverse tcp:8081 tcp:8081
npm.cmd run android -- --no-packager --device $deviceSerial
```

The explicit `--device` value is important when both the physical phone and an
Android emulator are connected. Set `$deviceSerial` to the serial shown by
`adb devices`. The `--no-packager` option assumes
Metro is already running with `npm.cmd start -- --reset-cache` in another
terminal.

If Android Studio installed the tools somewhere else, replace the two paths
above with that computer's JDK 17 and Android SDK paths.

From the repository root, for a build-only check when no device is connected:

```powershell
cd ".\SNAPTURE_ANDROID\android"
.\gradlew.bat :app:assembleDebug --no-daemon
```

The resulting debug APK is
`android/app/build/outputs/apk/debug/app-debug.apk`. `adb devices` must show a
device as `device`; an `offline` entry cannot receive an APK until the emulator
is restarted or USB debugging is re-authorized.

From the repository root, for a phone that should run without Metro, build the bundled release APK:

```powershell
cd ".\SNAPTURE_ANDROID\android"
cmd /c gradlew.bat assembleRelease
```

Install it after enabling USB debugging with:

```powershell
adb install -r ".\app\build\outputs\apk\release\app-release.apk"
```

The release build includes the JavaScript bundle, so it does not need Metro;
the Django API at port 8000 is still required for login and analysis.

The first native build can take several minutes. Accept the camera permission
inside the app. Test the complete flow: register/login, capture one object,
analyze it, then choose a recommendation. High-confidence scans skip the
questionnaire; uncertain materials and wood safety cases show only one focused
follow-up. The recommendations screen optionally adjusts the amount as one,
a few, or many items before saving and pressing `DONE - scan another item`.

## 5. Train the thesis-scope model later

If the original source pictures are retained, they belong in
`SNAPTURE_ML/data/raw/trashnet/dataset-resized/`. The current cleaned
workspace keeps only the seven-category layout at
`SNAPTURE_ML/data/scope_dataset/`; add only verified, correctly labeled images
to its empty scope folders before training.

Populate the seven labeled folders under
`SNAPTURE_ML/data/scope_dataset/` through the administrator workflow. Do not
move generic `plastic` images into PETE or HDPE without verifying the label.
After marking uploads as verified in Django Admin, export them from the
backend. Run from the repository root:

```powershell
cd ".\SNAPTURE_BACKEND"
& "..\SNAPTURE_ML\.venv\Scripts\python.exe" manage.py export_verified_dataset
```

When every scope folder has enough reviewed images, run the trainer's quality
checks from the ML folder. Run from the repository root:

```powershell
cd ".\SNAPTURE_ML"
& ".\.venv\Scripts\python.exe" ".\scripts\train_model.py"
```

The command checks all seven labels, rejects unreadable or duplicate images,
creates a deterministic 70/15/15 split when needed, and writes per-class
metrics to `models/training_summary.json`. It intentionally stops while any
scope folder is empty. Restart Django after a successful training run so it
loads the new model files.
