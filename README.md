# SNAPTURE System

SNAPTURE combines a React Native Android app, a Django API, and a TensorFlow image classifier. Its assessment separates material identity, segregation guidance and project eligibility. The active scope is six materials, excluding coconut shells. The existing seven-output experimental checkpoint is preserved with its coconut output rejected; it is not a newly trained six-material model or validated accuracy claim. See [implementation and content provenance](FEASIBILITY_IMPLEMENTATION.md) and [reviewed-data/free training workflow](SNAPTURE_ML/FREE_TRAINING.md).

## Project structure

```text
SNAPTURE_ANDROID/   React Native CLI app and Android project
SNAPTURE_BACKEND/   Django API, migrations, and local database configuration
SNAPTURE_ADMIN/     React web administration sharing the Django API and database
SNAPTURE_ML/        Shared inference, training scripts, model, and requirements
RUNBOOK.md          Additional local development notes
```

This is one Git repository. Keep these folders together because the backend imports the ML code from the sibling folder.

Android and the CESD web panel now share the backend on port **8000**, database, and media directory. After backend migrations, start one API process using the instructions below, then run `npm.cmd run dev` inside `SNAPTURE_ADMIN` and open `http://127.0.0.1:5173`. The admin's `npm.cmd run dev:api` is an alternative launcher for that same API. See [shared admin setup and data import](SNAPTURE_ADMIN/README.md#shared-backend-integration) before creating an owner if you have an older isolated admin database.

## Requirements

- Windows Pow   erShell, Python 3.13, Node.js 22.11.0 or newer, and npm.
- JDK 17, Android Studio with Android SDK Platform 37, Build Tools 37.0.0, Platform Tools, NDK 29.0.14206865, and CMake 3.31.6.
- An Android emulator or a phone with USB debugging enabled. The USB workflow below uses `adb reverse` to reach the API computer.
- SQLite is the local default. MySQL is optional; see [backend instructions](SNAPTURE_BACKEND/README.md) if the team uses it.

## First-time setup (PowerShell)

Clone the repository, then run setup commands from its root:

```powershell
git clone https://github.com/Jolliburps/SNAPTURE_SYSTEM.git
Set-Location .\SNAPTURE_SYSTEM
```

Install dependencies:

```powershell
py -3.13 -m venv .\SNAPTURE_ML\.venv
& .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r .\SNAPTURE_ML\requirements.txt

Set-Location .\SNAPTURE_ANDROID
npm.cmd ci
Set-Location ..
```

Android Studio can create `SNAPTURE_ANDROID/android/local.properties` when it opens the project. If needed, create it with your own SDK location (for example, `sdk.dir=C:\\Android\\Sdk`). This machine-specific file is ignored by Git. Set `JAVA_HOME` to your JDK 17 directory and `ANDROID_HOME`/`ANDROID_SDK_ROOT` to your SDK directory before building if Android Studio has not configured them globally.

Android Gradle uses a debug key in your user profile, outside this repository. If the first build reports a missing debug keystore, create it locally with JDK 17's `keytool`:

```powershell
New-Item -ItemType Directory -Force "$HOME\.android" | Out-Null
keytool -genkeypair -v -keystore "$HOME\.android\debug.keystore" -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'
```

Keep keystores and release signing credentials out of Git.

## Backend configuration

`SNAPTURE_BACKEND/.env.example` lists the backend settings. Copy it to the ignored local `.env` file, then edit its values for your computer:

```powershell
Copy-Item .\SNAPTURE_BACKEND\.env.example .\SNAPTURE_BACKEND\.env
```

For local SQLite, set `SNAPTURE_DB_ENGINE=sqlite` or leave it blank; MySQL settings are used only when that engine is selected. Set `DJANGO_SECRET_KEY` to a private value. Include `127.0.0.1` and `localhost` in `DJANGO_ALLOWED_HOSTS` for the emulator/USB port-forwarding workflow. Leave unused optional settings blank.

Django reads process environment variables, not `.env` directly. In each new backend PowerShell terminal, load your edited file before starting Django:

```powershell
Get-Content .\SNAPTURE_BACKEND\.env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.+)$') {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
    }
}
```

The API uses the tracked model in `SNAPTURE_ML/models/` by default. The SQLite database and uploaded media are local files and are not committed.
For the seven-category Drive phone prototype, stop the default backend and run
`powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\SNAPTURE_BACKEND\run_phone_prototype.ps1`.
Its results are explicitly labeled as prototype output; see
[`SNAPTURE_ML/DRIVE_PROTOTYPE_EVALUATION_2026-10-06.md`](SNAPTURE_ML/DRIVE_PROTOTYPE_EVALUATION_2026-10-06.md).

## Run the application

Open three PowerShell terminals at the repository root. In terminal 1, load the backend environment as above, then run:

```powershell
Set-Location .\SNAPTURE_BACKEND
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py migrate
& ..\SNAPTURE_ML\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

For the Django administrator, run `manage.py createsuperuser` with the same Python executable once, then open `http://127.0.0.1:8000/admin/` on the computer.

The mobile API address is the `API_BASE_URL` constant in `SNAPTURE_ANDROID/src/api.ts`. Keep its current value, `http://127.0.0.1:8000/api`, for both the Android emulator and a USB-connected phone. Use `adb reverse` as shown below to forward connections to the computer. See the [local runbook](RUNBOOK.md#4-build-and-launch-the-android-app) for separate step-by-step instructions for each target.

In terminal 2, start Metro:

```powershell
Set-Location .\SNAPTURE_ANDROID
npm.cmd start
```

In terminal 3, confirm that `adb devices` lists the target as `device`, then install and launch the app:

```powershell
Set-Location .\SNAPTURE_ANDROID
adb devices
$targetSerial = 'replace-with-target-serial'
adb -s $targetSerial reverse tcp:8000 tcp:8000
adb -s $targetSerial reverse tcp:8081 tcp:8081
npm.cmd run android -- --device $targetSerial --no-packager
```

Use the serial shown by `adb devices` for the emulator or USB phone. Explicit `--device` avoids a selection prompt. Repeat the forwarding commands after reconnecting the phone or restarting the emulator. Run only one Metro instance on port 8081. For a native build without a connected device, run:

```powershell
Set-Location .\SNAPTURE_ANDROID\android
.\gradlew.bat :app:assembleDebug --no-daemon
```

## Team Git workflow

Pull the team's latest changes before starting work. Use the repository's current branch (shown by `git branch --show-current`); for a `main` branch:

```powershell
git pull origin main
git status
# Make and review changes.
git add .
git commit -m "Describe changes"
git push origin main
```

Do not commit `.env`, keystores, `node_modules`, virtual environments, local databases, uploaded media, datasets, caches, or build output. Review `.gitignore` and `git status` before every commit.
