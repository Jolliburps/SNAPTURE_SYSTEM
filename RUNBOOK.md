# Running the SNAPTURE system on Windows

Use this guide for the integrated system: **one database, one Django API, the Android app, and the CESD web admin**. All commands use PowerShell. Examples assume the repository is at `C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM`; change that path if you move it.

If dependencies and accounts already exist, begin at [3. Start the shared backend](#3-start-the-shared-backend-terminal-1). If you changed Wi-Fi or internet provider, read [6. Switching networks and changing IP addresses](#6-switching-networks-and-changing-ip-addresses) first.

Jump to: [first-time setup](#1-first-time-setup) | [database/settings](#2-database-and-backend-configuration) | [backend](#3-start-the-shared-backend-terminal-1) | [Android](#4-build-and-launch-the-android-app) | [web admin](#5-start-the-cesd-web-admin-terminal-4) | [networks/IP changes](#6-switching-networks-and-changing-ip-addresses) | [troubleshooting](#7-daily-restart-shutdown-and-troubleshooting) | [APK/backups](#8-optional-apk-without-metro-and-backups) | [MySQL](#9-optional-mysql-database)

## What runs where

| Component | Address or storage | When needed |
| --- | --- | --- |
| Shared Django API, including ML inference | `http://127.0.0.1:8000` on the computer | Mobile and web admin |
| SQLite database, the default | `SNAPTURE_BACKEND/db.sqlite3` | Django opens it automatically; no database server to start |
| Uploaded files | `SNAPTURE_BACKEND/media` | Shared by mobile and admin |
| Metro, Android JavaScript development server | `http://127.0.0.1:8081` on the computer | Debug Android app only |
| CESD web admin, Vite | `http://127.0.0.1:5173` on the computer | Web admin |
| Optional Django management interface | `http://127.0.0.1:8000/admin/` | Detailed model/data/guidance management |

**Start only one API on port 8000.** Both clients use it. The admin's `npm.cmd run dev:api` is an alternative launcher for that same backend; do not run it alongside the Django command below. Ports **8001 and 5174** belong to isolated browser tests and are not normal startup addresses.

Normal startup loads the saved ML checkpoint through Django. Do not start the old FastAPI server, train a model, or start XAMPP/MySQL when using SQLite.

## 1. First-time setup

Skip this section when the environments and dependencies are already installed. After pulling dependency changes, reinstall only the dependencies that changed.

### Install the tools

- Python **3.13** with the Windows `py` launcher.
- Node.js **22.12 or newer** in the 22.x series, with npm.
- JDK **17** and Android Studio.
- Android SDK Platform **37**, Build Tools **37.0.0**, Platform-Tools, NDK **29.0.14206865**, and CMake **3.31.6**, through Android Studio's SDK Manager.

Check Python and Node in PowerShell:

```powershell
py -3.13 --version
node --version
npm.cmd --version
```

Install the shared Python environment and both client dependencies from the repository root:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM'

# Create this environment only if it does not already exist.
py -3.13 -m venv .\SNAPTURE_ML\.venv
& .\SNAPTURE_ML\.venv\Scripts\python.exe -m pip install -r .\SNAPTURE_ML\requirements.txt

npm.cmd ci --prefix .\SNAPTURE_ANDROID
npm.cmd ci --prefix .\SNAPTURE_ADMIN
```

The full system uses **`SNAPTURE_ML/.venv`** for Django and inference. You do not need to activate it; the commands call its Python executable directly. The separate `SNAPTURE_ADMIN/.venv` is optional for its isolated test tools; it is not needed by the startup commands in this guide.

### Configure Android tooling

Set your JDK/SDK paths in Windows user environment variables, or run this in **each new terminal used for Android commands**. Replace the paths with your installed locations:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
$env:ANDROID_HOME = 'C:\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:Path"
java -version
adb version
```

Open `SNAPTURE_ANDROID/android` in Android Studio so it creates the local SDK configuration. If needed, put your actual SDK path in the ignored `SNAPTURE_ANDROID/android/local.properties`:

```properties
sdk.dir=C:\\Android\\Sdk
cmake.dir=C:\\Android\\Sdk\\cmake\\3.31.6
```

If Gradle reports a missing debug keystore, follow the debug-keystore setup in [README.md](README.md#first-time-setup-powershell). Use `npm.cmd`, rather than `npm`, if PowerShell blocks `npm.ps1`.

## 2. Database and backend configuration

### Use SQLite for the normal local setup

The mobile app and web admin both use **`SNAPTURE_BACKEND/db.sqlite3`**. Keep this file to retain accounts, policies, schedules, scan history, and projects. Keep `SNAPTURE_BACKEND/media` with it to retain uploads. Switching Wi-Fi does not change or reset either folder.

Django's migration command in section 3 creates the database/tables if missing and applies new schema changes if they already exist. There is no separate SQLite service and no need to open phpMyAdmin or start XAMPP. If your team deliberately uses MySQL, follow [the optional MySQL section](#9-optional-mysql-database) instead.

### Create or edit the local `.env` file

From the repository root:

```powershell
if (-not (Test-Path -LiteralPath '.\SNAPTURE_BACKEND\.env')) {
    Copy-Item -LiteralPath '.\SNAPTURE_BACKEND\.env.example' -Destination '.\SNAPTURE_BACKEND\.env'
}
notepad .\SNAPTURE_BACKEND\.env
```

For the normal computer + USB/emulator setup, use these values. Replace the secret placeholder once with a private random value and keep it stable. Keep any already configured private secret:

```dotenv
DJANGO_SECRET_KEY=replace-with-a-private-random-value
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
SNAPTURE_DB_ENGINE=sqlite
TZ=Asia/Manila
ADMIN_WEB_URL=http://127.0.0.1:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
```

Use plain `KEY=value` lines without quotes or `export`. Leave unused optional fields blank. `.env` holds settings; **`.venv` is the Python environment directory**. They are different files/folders. Do not commit secrets, databases, or media to Git.

The backend does not automatically read `.env`. Section 3 explicitly loads it into the backend terminal. Editing `.env` requires loading it again and restarting Django; browser refresh alone does not apply backend settings.

## 3. Start the shared backend (terminal 1)

### A. Load configuration and prepare the database

In a new PowerShell terminal, run this complete block from the repository root:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM'

Get-Content .\SNAPTURE_BACKEND\.env | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settingName = $matches[1]
        $settingValue = $matches[2].Trim()
        if ($settingValue.Length -gt 0) {
            [Environment]::SetEnvironmentVariable($settingName, $settingValue, 'Process')
        } else {
            [Environment]::SetEnvironmentVariable($settingName, $null, 'Process')
        }
    }
}

& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py check
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py migrate
```

Continue only if both commands succeed. `No migrations to apply` is normal. Run this block in each new backend terminal so it uses the intended database/settings.

### B. Accounts/import - first installation only

**Already have an imported CESD owner on this computer? Skip to C.** Your existing mobile/admin data was integrated previously; daily startup does not require importing it again or creating another owner.

On another installation with an old `SNAPTURE_ADMIN/.local/admin.sqlite3`, import it **before** creating an owner:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd
# Review the preview, then apply the import:
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py import_legacy_cesd --apply
```

Apply creates backups under `SNAPTURE_BACKEND/.local/backups`, preserves the source, and remaps imported IDs. Conflicting accounts/owners stop the import. See [the integration notes](SHARED_BACKEND_INTEGRATION.md#existing-local-data) for limitations.

For a genuinely new database with no imported/existing CESD owner:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py create_cesd_owner
```

Enter the requested owner email, name, and password. There are no default credentials. If it says `An owner already exists`, use that owner's login or password assistance; do not replace the database.

| Account | How to create/use it |
| --- | --- |
| Resident/mobile | Register in the Android app. Used for scans and projects. |
| CESD owner/staff | Owner command above; additional staff through web **Settings > Staff Access**. Used at port 5173. |
| Optional Django superuser | Run `manage.py createsuperuser` with the same Python environment/settings. Used at `/admin/`; it does not automatically grant CESD web-panel access. |

Staff setup/password mail is saved in `SNAPTURE_BACKEND/.local/mail` during development. Follow the newest applicable setup link; old links signed by the former isolated backend must be requested again.

### C. Start Django

Still in terminal 1 at the repository root:

```powershell
& .\SNAPTURE_ML\.venv\Scripts\python.exe .\SNAPTURE_BACKEND\manage.py runserver 0.0.0.0:8000
```

Leave this terminal running. **`0.0.0.0` is the server's listening address; do not enter it as the app/browser destination.**

Check these on the computer:

- `http://127.0.0.1:8000/api/materials/`: quick API connection check.
- `http://127.0.0.1:8000/api/cesd/csrf/`: web-admin API check; JSON includes `csrf`.
- `http://127.0.0.1:8000/api/health/`: model readiness check. First access can take time while TensorFlow loads. For scanning, check `status: ok` and `model.loaded: true`; inspect the error if degraded.

A 404 at `/` or `/api/` does not mean the API is down. Backend-only content administration can work even if model loading is degraded; image analysis still needs the model/runtime ready.

## 4. Build and launch the Android app

### Start Metro - terminal 2

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM\SNAPTURE_ANDROID'
npm.cmd start
```

Leave Metro and Django running. Open **terminal 3** for ADB/install commands, apply the Android environment setup from section 1 if needed, and run:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM\SNAPTURE_ANDROID'
adb devices -l
```

Choose **one** connection option below. Options A-C use forwarding and keep `SNAPTURE_ANDROID/src/api.ts` as:

```ts
export const API_BASE_URL = 'http://127.0.0.1:8000/api';
```

Here `127.0.0.1` refers to the phone/emulator itself; **ADB forwarding** carries requests to the computer. Without forwarding, use the direct-LAN instructions in section 6 instead.

### Option A: Android emulator

Open Android Studio > Device Manager and start a virtual device. This computer has `Medium_Phone_API_37.0`. Wait for its home screen; configure a rear camera as Webcam/VirtualScene if testing capture. Use the exact emulator serial from `adb devices -l`:

```powershell
$targetSerial = 'emulator-5554' # Replace if your serial differs.
adb -s $targetSerial reverse tcp:8000 tcp:8000
adb -s $targetSerial reverse tcp:8081 tcp:8081
adb -s $targetSerial reverse --list
npm.cmd run android -- --device $targetSerial --no-packager
```

### Option B: Android phone with USB

Connect a data-capable USB cable. Enable USB debugging, unlock the phone, and accept its authorization prompt. `adb devices -l` must show status `device`; `unauthorized` or `offline` is not ready.

```powershell
$targetSerial = Read-Host 'Phone serial from adb devices -l'
adb -s $targetSerial reverse tcp:8000 tcp:8000
adb -s $targetSerial reverse tcp:8081 tcp:8081
adb -s $targetSerial reverse --list
npm.cmd run android -- --device $targetSerial --no-packager
```

Keep USB connected. Computer and phone do not need the same Wi-Fi for this forwarding workflow. Repeat forwarding after reconnection; an already installed app can simply be reopened/reloaded when a rebuild is unnecessary.

### Option C: Android phone over wireless debugging (Android 11+)

Connect computer and phone to the same Wi-Fi. On the phone, enable **Developer options > Wireless debugging**, then open **Pair device with pairing code**. In terminal 3:

```powershell
$pairingAddress = Read-Host 'Phone pairing IP:port from the pairing-code dialog'
adb pair $pairingAddress
```

Enter the pairing code at ADB's prompt. Return to the phone's main **Wireless debugging** screen; its **connection IP:port differs from the pairing address**:

```powershell
$phoneAddress = Read-Host 'Phone connection IP:port from the main Wireless debugging screen'
adb connect $phoneAddress
adb devices -l
$targetSerial = Read-Host 'Exact connected phone serial from adb devices -l'
adb -s $targetSerial reverse tcp:8000 tcp:8000
adb -s $targetSerial reverse tcp:8081 tcp:8081
adb -s $targetSerial reverse --list
npm.cmd run android -- --device $targetSerial --no-packager
```

Keep Wireless debugging enabled. On another Wi-Fi network, use the **phone's newly displayed connection address/port**, reconnect, and recreate forwarding. Pair again only if needed. The mobile API address remains `127.0.0.1`; do not put the phone's wireless-debugging IP in `API_BASE_URL`.

If you previously set a custom Metro host in the app's **Dev Settings > Debug server host & port for device**, clear it for localhost forwarding. Wireless ADB setup follows [Android's official instructions](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi).

## 5. Start the CESD web admin (terminal 4)

With the shared Django API already running, open another PowerShell terminal:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM\SNAPTURE_ADMIN'
# Clear a temporary test/remote proxy override in this terminal, if present.
Remove-Item Env:SNAPTURE_API_PROXY -ErrorAction SilentlyContinue
npm.cmd run dev
```

Open **`http://127.0.0.1:5173`** and use the CESD owner/staff credentials. Vite forwards `/api` to `http://127.0.0.1:8000` on the computer. Opening the login page alone does not prove Django is running; test `http://127.0.0.1:5173/api/cesd/csrf/` as well.

Keep terminal 4 running. `npm.cmd run build` builds frontend files; it does not start Django. `npm.cmd run preview` is not the normal integrated startup command.

### Confirm both clients are connected

1. Publish a policy/material or announcement in web admin.
2. Refresh the mobile reference library or Home updates; confirm it appears. Drafts should stay hidden.
3. Set the resident's barangay in mobile Profile. Add a schedule for that exact barangay/month in admin; refresh the corresponding mobile calendar month.
4. Complete the mobile capture/analyze/project flow. Check saved history/projects and refresh web Dashboard/Reports for the relevant creation-date range.

Changes are fetched on refresh/screen entry/foreground return; they are not pushed instantly. Educational uploads do not retrain the model or change classifier categories.

## 6. Switching networks and changing IP addresses

**Changing internet connection does not always require an IP change in the code.** Choose the row that matches how devices reach the computer:

| Connection | What changes on a new network? |
| --- | --- |
| Web admin opened on the same computer | Nothing: keep `127.0.0.1:5173` and the local Vite proxy. |
| Android emulator or USB + ADB forwarding | Nothing in API code: keep `127.0.0.1:8000/api` and recreate forwarding if disconnected. |
| Wireless ADB + forwarding | Reconnect to the phone's new wireless-debugging IP/port and repeat both reverse commands. API code stays at `127.0.0.1`. |
| Phone or another computer connecting directly over the LAN | Update the **backend computer's** LAN IP in the settings/addresses below. |
| Phone and backend computer are on separate, unrelated networks | Private LAN IPs alone will not connect them. Use a deployed backend/web URL or a deliberately configured VPN/tunnel; the local commands below assume the same reachable LAN. |

### A. Find the computer's current LAN IPv4 address

On the **computer running Django**, run:

```powershell
ipconfig
```

Read **IPv4 Address** under the active Wi-Fi/Ethernet adapter, for example `192.168.1.25`. Do not use the default gateway/router address, phone address, VPN/virtual-adapter address, or public internet IP. The example below assumes `192.168.1.25`; replace every occurrence with your actual computer IP.

### B. Allow that address in Django

Edit `SNAPTURE_BACKEND/.env`. Preserve your secret and database settings. For direct LAN access, set:

```dotenv
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,192.168.1.25
ADMIN_WEB_URL=http://192.168.1.25:5173
DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://192.168.1.25:5173
```

`DJANGO_ALLOWED_HOSTS` contains host/IP names **without** `http://` or port numbers. CSRF origins and `ADMIN_WEB_URL` contain the **full web-admin origin**, including `http://` and port `5173`. `ADMIN_WEB_URL` determines the address in staff setup/reset links.

Stop Django with `Ctrl+C`, rerun section 3A to reload `.env`, then start section 3C again. Keep `runserver 0.0.0.0:8000`; that binding works across interface/IP changes.

From the phone/other computer's browser, first test `http://192.168.1.25:8000/api/materials/`. If unreachable, resolve the network/firewall issue before editing or rebuilding the app.

### C. Direct LAN access from Android - no API forwarding

Only for this mode, edit **`SNAPTURE_ANDROID/src/api.ts`**:

```ts
export const API_BASE_URL = 'http://192.168.1.25:8000/api';
```

Computer and phone must share a reachable Wi-Fi/LAN. This is the computer's address, not the phone's. Changing the backend `.env` does not update this TypeScript constant automatically.

- **Debug app with ADB available:** keep/recreate port-8081 forwarding for Metro. Port-8000 forwarding is not used by this LAN API URL.
- **Debug app without forwarding:** start Metro with `npm.cmd start -- --host 0.0.0.0`; in the phone's developer menu, set **Dev Settings > Debug server host & port for device** to `192.168.1.25:8081`, then reload. Update this setting when the computer IP changes. Install the debug app by USB/wireless ADB first if needed.
- **Bundled release app:** rebuild and reinstall after changing `API_BASE_URL`; Metro reload cannot change the JavaScript inside an already bundled APK. See section 8.

When switching back to USB/emulator forwarding, restore `API_BASE_URL` to `http://127.0.0.1:8000/api`, clear any custom Metro host, recreate reverse mappings, and reload/rebuild as appropriate.

### D. Open web admin from another device on the LAN

The default Vite setup listens only on the computer's loopback address. Stop terminal 4 and start it with LAN access:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM\SNAPTURE_ADMIN'
Remove-Item Env:SNAPTURE_API_PROXY -ErrorAction SilentlyContinue
npm.cmd run dev -- --host 0.0.0.0
```

Open **`http://192.168.1.25:5173`** on the other device. Also test `http://192.168.1.25:5173/api/cesd/csrf/`. Use this same web address consistently during sign-in. Staff setup links generated before an IP change may contain the old address; request a fresh link after updating `ADMIN_WEB_URL`.

**Keep the Vite API proxy at `http://127.0.0.1:8000` when Vite and Django run on this same computer.** That proxy connection is made by Vite on the computer, not by the remote browser. You do not need to edit `vite.config.ts` for each Wi-Fi change. The host override follows [Vite's server options](https://vite.dev/config/server-options#server-host).

### E. If LAN connections are blocked

Check that both devices are on the same reachable network; guest Wi-Fi, client isolation, VPNs, or a hotspot's device-isolation settings can prevent this. A new Windows network may also have a different firewall profile.

On a trusted home/development network, use its **Private** network profile. If Windows Firewall still blocks the services, an administrator can create this local-subnet rule in an elevated PowerShell terminal **once**, provided a rule with this name does not already exist:

```powershell
New-NetFirewallRule -Name 'SNAPTURE-Local-Development' -DisplayName 'SNAPTURE local development' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000,5173,8081 -Profile Private -RemoteAddress LocalSubnet
```

Port 8000 is the direct API, 5173 is remote web admin, and 8081 is direct debug Metro. USB forwarding does not need this LAN rule. Keep the firewall enabled; these are local development services, not a public deployment. Rule parameters follow [Microsoft's firewall command documentation](https://learn.microsoft.com/en-us/powershell/module/netsecurity/new-netfirewallrule).

### F. Example: home Wi-Fi to school Wi-Fi

If the backend computer changes from `192.168.1.25` to `10.20.30.40`:

1. **Using USB/ADB forwarding?** Keep the mobile URL unchanged. For wireless ADB, reconnect using the phone's newly displayed address and repeat forwarding.
2. **Using direct LAN?** Replace the old computer IP with `10.20.30.40` in `.env` hosts/origins/web URL, then reload settings and restart Django.
3. Replace it in `API_BASE_URL` for direct-LAN mobile access; reload debug or rebuild/reinstall release. Update direct Metro's host setting to `10.20.30.40:8081` if used.
4. For remote web access, keep Vite on `--host 0.0.0.0` and browse to `http://10.20.30.40:5173`. The local Vite proxy stays unchanged.
5. Recheck the network profile/firewall and browser connection tests. The database remains the same; no migration/import/owner recreation is needed solely because the IP changed.

If school Wi-Fi isolates devices, use the USB workflow or a permitted shared network. Changing an IP string cannot bypass isolation. A stable hosted URL is the appropriate setup when users must connect from unrelated internet connections.

## 7. Daily restart, shutdown, and troubleshooting

For a normal debug session: **terminal 1 Django -> terminal 2 Metro -> terminal 3 connect/install/open Android -> terminal 4 Vite**. Web-only work needs Django + Vite; a bundled release app needs Django but not Metro.

To stop, press `Ctrl+C` in Django, Metro, and Vite terminals. Stop any reconnect helper too. Keep database/media files. Next time repeat sections 3A/3C, 4, and 5; skip dependency installation, imports, and owner creation unless required.

After pulling code: run `npm.cmd ci` in a client folder only when its dependencies changed; update the ML Python requirements when those changed; run `manage.py migrate` for database changes. Rebuild Android for native changes, or for any change to a bundled release app.

| Symptom | Action |
| --- | --- |
| `no such table` / unapplied migrations | Load the intended `.env`, run section 3A, and restart Django. |
| Missing accounts or unexpectedly empty database | Check `SNAPTURE_DB_ENGINE` and whether you started an old isolated server. Do not recreate/delete the database. |
| Web login loads but API unavailable | Check Django on 8000 and both direct/proxied `/api/cesd/csrf/` URLs. Do not start a second API on 8001. |
| `Invalid HTTP_HOST` / `DisallowedHost` | Add the actual backend request host/IP to `DJANGO_ALLOWED_HOSTS`, reload `.env`, restart Django. |
| CSRF 403 when signing in over LAN | Use the correct web origin including `http://IP:5173` in trusted origins, restart Django, reload the login page. |
| Invalid CESD login | Use imported owner/staff credentials; resident accounts and Django superusers alone do not grant CESD panel access. |
| Phone cannot reach API | Forwarded mode: verify `adb devices -l` and `reverse --list`. LAN mode: test the computer's current `IP:8000/api/materials/` on the phone. |
| Web works on PC but not another device | Start Vite with `--host 0.0.0.0`; check current IP, shared network, and firewall. |
| App cannot load JavaScript | Keep Metro running; restore 8081 forwarding or update the direct Metro host to `computer-IP:8081`. |
| Health degraded / scans fail while content works | Inspect model error and backend terminal; use the full ML environment and configured checkpoint. Do not retrain just to start the service. |
| Port 8000/8081/5173 already in use | Find the existing service terminal and use it or stop it with `Ctrl+C`; run one instance per port. |
| `adb`/Java not found | Reapply section 1's actual SDK/JDK paths in that terminal. |
| ADB `unauthorized` / `offline` | Unlock/authorize the phone, reconnect, or restart the emulator; then recreate mappings. |
| No schedules/content on mobile | Check publication status, resident barangay, selected month, shared backend address, and refresh the screen. |

Optional USB reconnect helper, from the repository root in an extra terminal:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\SNAPTURE_ANDROID\reconnect_phone.ps1 -Watch -DebugBuild
```

It restores forwarding and prefers an installed prototype app when present. Use it only for a USB phone using forwarding; omit `-DebugBuild` for a bundled app, and add `-Serial 'actual-phone-serial'` if needed. For wireless ADB, use section 4C instead.

## 8. Optional APK without Metro and backups

To build a bundled APK, set the desired API address first and run these in the Android-tools terminal:

```powershell
Set-Location 'C:\Users\MJ Barrameda\Documents\Projects\SNAPTURE_SYSTEM\SNAPTURE_ANDROID\android'
.\gradlew.bat :app:assembleRelease --no-daemon
$targetSerial = Read-Host 'Target serial from adb devices -l'
adb -s $targetSerial install -r .\app\build\outputs\apk\release\app-release.apk
```

This repository's release variant currently uses the debug signing configuration for local testing. It bundles JavaScript and does not require Metro. It still requires the running API: keep port-8000 forwarding for a localhost URL, or use the current reachable computer IP for direct LAN. Rebuild/reinstall after changing a bundled API URL. For a debug APK without installation, use `:app:assembleDebug` instead.

For a simple SQLite backup, stop Django first and copy **both** `SNAPTURE_BACKEND/db.sqlite3` and `SNAPTURE_BACKEND/media` to a dated local backup directory. Keep private backups outside Git; `.local/backups` is ignored. Staff mail/setup links are also private. Switching Wi-Fi does not require restoring or replacing database files.

## 9. Optional MySQL database

Skip this if using SQLite. MySQL is a deliberate database choice, not a requirement for networking the app/web admin. Both clients still talk to Django, never directly to port 3306.

1. Install/start your MySQL server (or MySQL in XAMPP if that is your team's setup).
2. Create the `snapture` database and a database user with access to that database through your MySQL administration tool.
3. In `SNAPTURE_BACKEND/.env`, configure:

```dotenv
SNAPTURE_DB_ENGINE=mysql
MYSQL_DATABASE=snapture
MYSQL_USER=snapture
MYSQL_PASSWORD=your-database-user-password
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
```

4. For a new empty installation, run section 3A to create tables, create/import accounts as applicable, and start section 3C. Importing an old isolated CESD SQLite database is supported only into a SQLite target; import it before moving the shared database to MySQL.
5. For existing shared SQLite data, back up database/media and use the migration workflow in [SNAPTURE_BACKEND/README.md](SNAPTURE_BACKEND/README.md#switch-to-mysql) and `SNAPTURE_BACKEND/scripts/migrate_sqlite_to_mysql.ps1`. Run the helper from a disposable terminal; it changes database environment values. Review its result before switching daily startup to MySQL. Its exported data contains account records; keep it private and out of Git.

Keep `MYSQL_HOST=127.0.0.1` when MySQL runs on the backend computer, even if that computer changes Wi-Fi IP. Change it only when the database server itself is elsewhere. A blank MySQL database does not automatically contain existing SQLite accounts/content.

Training is separate from system startup. For the current dataset/model workflow, use [SNAPTURE_ML/README.md](SNAPTURE_ML/README.md); do not run training as part of daily startup.
