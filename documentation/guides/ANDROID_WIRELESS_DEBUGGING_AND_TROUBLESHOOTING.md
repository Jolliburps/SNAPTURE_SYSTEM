# Android wireless debugging and troubleshooting

Updated 16 November 2026. This guide covers the existing React Native CLI app,
local Django API and CESD web panel. It does not add a remote recognition service,
change waste models, create offline login or promise connectivity across unrelated
networks. Commands below run in PowerShell.

## What the project actually runs

| Part | Current configuration |
| --- | --- |
| Mobile | React Native CLI 0.87.1, React 19.2.3, TypeScript; not Expo Go |
| Native build | JDK 17, Gradle 9.4.1, compile SDK 37, target 36, minimum 24, Build Tools 37.0.0, NDK 29.0.14206865 |
| Metro | `npm.cmd start` through `scripts/android-dev.cjs`; chooses 8081 or the next free port through 8099 |
| Shared backend | Django 5.2.17, port 8000, SQLite default; optional deliberate MySQL configuration |
| Web admin | React/Vite, port 5173, proxy to the same Django API/database |
| Recognition | TensorFlow material classifier and optional local OWL-ViT run on the backend computer |
| Existing storage | Resident token and notification read markers in AsyncStorage; scans/projects in Django |
| New schedule storage | Bounded, dated AsyncStorage snapshots; no image/private-history cache or write queue |

`App.tsx` keeps its current screen router, camera and scan state. `src/api.ts`
remains the single API client. `api-environment.json` now supplies its public
environment/base URL. `src/apiEnvironment.ts` validates it; the configuration
command and doctor show the active environment without printing server secrets.

## Initial wireless setup on Android 11 or later

Use the unified Android helper for ADB status, discovery, pairing, connect/
reconnect, device selection, reverse mappings and Metro port selection. From
PowerShell in `SNAPTURE_ANDROID`, run:

```powershell
npm.cmd run dev -- menu
```

The legacy `scripts/wireless-debug.ps1` remains a compatibility wrapper. You can
also run `npm.cmd run dev -- status|device-check|discover|pair|connect|reconnect|
disconnect|verify|forward|help`. mDNS is only a discovery aid. ADB requires a
reachable route; different or isolated networks need a permitted common network,
VPN route or USB.

1. Connect the PC and phone through a reachable network route. They can use
   different networks only when a permitted VPN/routed path lets them reach one
   another. Guest/client isolation may block device communication.
2. On the TECNO, enable Developer options and **Wireless debugging**. The exact
   HiOS menu location varies; keep the phone unlocked during setup.
3. Pair only if this phone is not already paired with the ADB key selected by
   the helper, or Android reports that pairing is required. Choose **Pair device
   with pairing code** and keep that dialog open. It shows a temporary pairing
   address/port and code.
4. If pairing is required, in PowerShell at `SNAPTURE_ANDROID`, run:

```powershell
npm.cmd run dev -- pair
```

Enter the temporary code only in that terminal when ADB prompts. Do not put it
in source files, chat, screenshots, scripts or saved shell arguments. Android
Studio's **Pair Devices Using Wi-Fi** is an alternative to these ADB commands.

5. Return to the main Wireless debugging screen. Connect using its current
   **IP address & Port**, which is different from the temporary pairing port.

```powershell
npm.cmd run dev -- connect
```

Enter the current MAIN-screen IP:port when prompted. The helper first checks
mDNS, but permits manual entry when discovery is blocked. `offline` and
`unauthorized` are not successful connections. USB and wireless can list the
same phone twice; select the wireless serial explicitly if multiple devices are
ready.

6. Start Django and Metro if they are not already running, using T1 and T2 in
`RUN_COMMANDS.txt`. Metro uses port 8081 when free, then checks through 8099.
The helper reuses a healthy workspace Metro and passes its selected port to the
Android build and reverse mapping.

7. Verify transport, reverse mappings and (in localhost mode) phone HTTP access:

```powershell
npm.cmd run dev -- verify
```

Expected: **Backend from phone: HTTP 200** and **Metro from phone: HTTP 200**.
The probe tests the default localhost-forwarding configuration. For a LAN or
hosted API, test its actual `/api/materials/` URL in the phone browser instead.
Doctor's host checks alone do not prove phone connectivity.

8. For an already installed app, open it without rebuilding or clearing data:

```powershell
npm.cmd run dev -- open
```

For first installation or native changes, use the existing build command:

```powershell
npm.cmd run android
```

The Android command uses the currently ready device, prompts for a current MAIN
screen endpoint if none is ready, configures reverse mappings, and builds with
the active Metro port. If several devices are ready, pass
`-- --serial <current-serial>` to select one.

The helper and port selection were validated locally, including reuse of a
healthy server on port 8082 while 8081 was occupied. A live phone pairing,
Wi-Fi change and phone-side HTTP probe still require a device session.

## Daily commands and recovery

From the Android directory:

| Command | Purpose |
| --- | --- |
| `wireless-debug.ps1 -Action status` | Show ADB server, devices and discovery status |
| `wireless-debug.ps1 -Action devices` | List USB, emulator and wireless transports |
| `wireless-debug.ps1 -Action discover` | Show mDNS endpoints, if reachable |
| `npm.cmd run android:wireless -- $connectionAddress` | Connect an already paired endpoint |
| `npm.cmd run android:forward -- --serial $connectionAddress` | Restore API 8000 and Metro 8081 without reload |
| `wireless-debug.ps1 -Action verify -Serial $connectionAddress` | Verify device, mappings and phone HTTP in forwarded mode |
| `npm.cmd run android:doctor` | Node, Java, SDK, device, configuration and host-service diagnostics |
| `npm.cmd run android:logs -- --serial $connectionAddress` | Finite warning/error log dump for the app PID |
| `npm.cmd run android:disconnect -- $connectionAddress` | Disconnect that wireless transport only |
| `npm.cmd run api:configure -- --show` | Show the public API environment/URL |

If the address changes, use `wireless-debug.ps1 -Action reconnect`, enter the
new MAIN-screen address, then verify again. Pair only if Android asks for it.
This reconnects the selected ADB transport and restores reverse rules; it does
not bypass network isolation or discover a changed address automatically.

At the end, disconnect the selected endpoint and turn Wireless debugging off
on the phone if no longer needed. Do not expose ADB ports on the public internet.

## API environments and backend addresses

Use the configuration command instead of editing URLs in several components:

```powershell
# USB, wireless ADB or an emulator with reverse mappings
npm.cmd run api:configure -- development http://127.0.0.1:8000/api

# Alternative: emulator host alias without API reverse forwarding
npm.cmd run api:configure -- development http://10.0.2.2:8000/api

# Direct LAN: read the computer's actual address; do not use the phone's address
$computerApiUrl = Read-Host 'Actual reachable computer HTTP(S) /api URL'
npm.cmd run api:configure -- development $computerApiUrl

# Production: only after a backend has actually been deployed
$hostedApiUrl = Read-Host 'Actual deployed public HTTPS /api URL'
npm.cmd run api:configure -- production $hostedApiUrl
```

No hosted backend is created or supplied by these commands. Production mode
rejects local/LAN/placeholder hosts and non-HTTPS URLs. A bundled APK can still
be a **development prototype**; release bundling alone does not deploy an API.
Reload debug JavaScript after configuration changes. Rebuild/reinstall a bundled
APK because its embedded settings cannot change through Metro.

The JSON file contains public build settings, not server secrets. Do not add
credentials, query tokens, passwords, database values or private API keys.
Review the file before committing. Tokens for another API URL use a separate
storage key; the previous local token is not forwarded to a newly configured host.

`localhost` on the physical phone refers to the phone. It works here only because
ADB explicitly forwards the phone port to the computer. LAN mode needs the
computer's reachable address and appropriate Django hosts/CSRF settings; follow
RUNBOOK.md. HTTPS hosting is independent of ADB/Metro. The Vite proxy stays on
127.0.0.1 when Vite and Django run on the same PC.

## Network situations

| Situation | What can work and what to check |
| --- | --- |
| Phone and PC on the same reachable Wi-Fi/LAN | Wireless ADB, reverse Metro/API; internet is not required for already installed local components |
| Phone Wi-Fi and PC on another isolated network | No automatic route to the PC; join a permitted common LAN or use USB |
| Phone uses mobile data, PC stays on Wi-Fi | Local wireless ADB normally drops; a public hosted API can remain reachable, but the debug bundle still needs Metro |
| Both devices change Wi-Fi together | Check new phone IP/connection port and mDNS, reconnect, restore mappings; pairing may remain valid but Android can require it again |
| Unrelated networks | Do not assume private IPs connect; use a deliberately configured permitted VPN/tunnel or deployed backend, not public ADB exposure |
| Backend hosted remotely | Configure its real HTTPS URL; a bundled production app needs no Metro/ADB, but recognition still needs that reachable API |

Wireless ADB authorization, Metro delivery and API reachability are three
separate checks. A Wi-Fi icon does not prove internet or backend access. This
project does not force OS network selection or infer a specific radio/DNS failure
from React Native's generic network error.

## Eight troubleshooting scenarios

### 1 ADB cannot detect the phone

Check Developer options, Android 11+ Wireless debugging availability, pairing and
the current connection port. Run `android:devices`, then `android:discover` if
needed. `adb.exe server-status` checks the ADB server without restarting it.
Unlock/authorize the phone. A connection-refused result can mean a stale port;
return to the main screen and read it again. Re-pair only if required.

USB debugging is the fallback on devices without wireless debugging. Legacy
`adb tcpip 5555` requires an authorized USB session first, exposes an additional
listener and is less desirable than Android 11 TLS pairing. On a trusted isolated
LAN, deliberately enable it only if the device supports it, connect its actual
Wi-Fi IP, and return to `adb -s <serial> usb` when finished. Do not open it to the
internet. No helper enables legacy TCP mode or restarts ADB automatically.

### 2 Phone connected but Metro does not load

Keep Metro running on 8081. Check `android:doctor`, then `android:probe` and
`adb -s <serial> reverse --list`. Restore 8081 for the selected wireless target.
In forwarded mode, clear an obsolete custom Debug server host setting if one
was set previously. Direct-LAN debug uses the computer's actual `IP:8081` under
Dev Settings, with Metro deliberately bound for LAN access.

Check guest isolation/VPN routes before changing firewall rules. Never disable
the firewall globally. Only deliberate direct-LAN serving may need a narrow
Private-profile/LocalSubnet exception for its selected 8000/8081/5173 ports;
RUNBOOK.md explains that optional administrator action. Reverse forwarding does
not require opening those development servers to the LAN.

### 3 App opens but API requests fail

Run `api:configure -- --show` and verify `/api/materials/` on that actual server.
Default forwarded mode also needs reverse 8000. HTTP 401/403 means authentication
or authorization, not proof of a network outage. HTTP 404 suggests an incorrect
base path; 5xx means a server-side failure. An unreachable host or exhausted
timeout gets a connection message and no automatic write retry. JavaScript fetch
does not reliably distinguish DNS from connection refusal; inspect scoped native
logs or an explicit host/port diagnostic rather than inventing a cause.

The first scan after Django restart loads models and can be slower. Keep the
backend warm. An upload timeout may occur after the server accepted work; inspect
Recent Scan/history before submitting a new photo. Existing scene request IDs
remain the scan retry safeguard. No photo is automatically re-uploaded here.

### 4 Wi-Fi changes to mobile data or back

Check the phone's current network manually. On return to the permitted LAN, read
the current wireless connection endpoint, connect, restore both mappings and
probe each service. Pair again only if Android requires it. A working API does
not deliver the debug bundle, and working Metro does not make Django available.
Address/port changes do not normally require an app rebuild in forwarded mode.

### 5 App crashes during testing

Record the exact screen/action, whether the failure reproduces, and whether the
phone probes succeed. Collect `android:logs -- --serial <serial>` while the app
process exists. It dumps only recent app-PID warnings/errors and redacts common
bearer/email/local-URI patterns; review remaining text before sharing. It is not
a complete secret sanitizer and must not be uploaded automatically.

Use Metro's JavaScript stack for JS errors, native Android exceptions for native
crashes and the backend terminal for HTTP/ML failures. A process that already
died may require a carefully scoped crash-buffer dump; do not share a whole-device
logcat history. Reproduce with synthetic test fixtures when possible.

### 6 Stale app or old code

First verify which package/build and Metro instance the phone uses. Reconnect
and restore mappings before reloading. Reload only after preserving an unsaved
photo/form. Native changes and bundled APK settings require rebuild/reinstall.
For an evidenced Metro cache problem, stop its one existing process and use
`npm.cmd start -- --reset-cache`. Do not erase project folders, node_modules,
the database, private media, app storage or every cache as an initial response.

### 7 Testing outside the development network

A bundled APK starts without Metro, but image analysis, login, current schedules,
recommendation decisions and server history still need the configured backend.
The new local cache provides only recently viewed schedule metadata in an
already verified session. It does not introduce offline login, on-device models,
private photo/history downloads, OS push notifications or background writes.

### 8 Quick recovery before rebuilding

1. Keep the selected network/USB transport available and the phone authorized.
2. Select the correct serial from `android:devices`.
3. Confirm Django and Metro are running once each.
4. Read the active API environment; restore reverse 8000/8081 if applicable.
5. Run phone probes or the actual LAN/hosted API browser check.
6. Retry once deliberately, preserving the selected photo and checking history.
7. Inspect the relevant timestamped log and HTTP status.
8. Rebuild only for a native or bundled-code change.

## Data use offline behavior and measurement

All API calls now have bounded timeouts (normally 30 seconds; scene uploads retain
180 seconds; token revocation retains 10 seconds). A timeout still rejects if a
transport ignores AbortSignal. No request retry loop or write queue was added.

Overlapping public materials/learning/announcement GETs share an in-flight
request. They are not served from a stale persistent cache, so later publication
withdrawal checks remain fresh. The notification bell keeps its existing active
30-second refresh and foreground/manual controls; no new connectivity polling
was introduced.

Schedule snapshots are keyed by API URL, account, saved barangay and month.
Fresh snapshots can satisfy navigation for 60 seconds; explicit Refresh bypasses
freshness. Concurrent reads share work. Network failure can show a snapshot up to
24 hours old with a visible last-checked date and cancellation/staleness warning.
Older/future-dated data is not used. HTTP/auth failures do not return cached
success. At most 12 records are retained. Cache errors do not hide a live response.
Logout/new sign-in and successful barangay changes invalidate snapshots; late
old-session writes cannot repopulate them.

No images were resized, recompressed or removed. Capture already uses JPEG
quality 0.85; changing its inputs needs a separate accuracy check. Original saved
history images, model files, recommendation rules and server records remain.

A repeatable synthetic ASCII schedule workload measured **10 uncached reads
versus 1 cached read**, with **1,160 versus 116 response-entry bytes** inside the
60-second window. This is a fixture-level count, excluding headers, TLS, images
and all other traffic. It is not a measurement of phone/carrier billing or a
claim that total mobile data fell by 90%.

## Test workflow and evidence

```powershell
npm.cmd run test:dev-tools
npx.cmd tsc --noEmit
npm.cmd run lint
npm.cmd test -- --runInBand --watchman=false
# Optional isolated runs, each file bounded to 60 seconds:
npm.cmd run test:reliable
# Or selected existing basenames:
npm.cmd run test:reliable -- NetworkReliability.test.ts DashboardSchedule.test.tsx
```

The isolated runner writes timestamped local logs/results under `.test-results/`
and returns nonzero for failures/timeouts. It does not skip broken tests or
raise assertion timeouts. The unit-test setup blocks accidental live fetches,
loads lazy native test components before timed assertions, and keeps React's
setImmediate scheduler real when fake application timers are requested.
The formerly stalled camera/project files pass with those harness changes.
See the task's WIRELESS_TESTING_REPORT.md for complete final results, failures
encountered and remaining manual checks.

## Web admin on this computer

Start the T4 block in `RUN_COMMANDS.txt` only when 5173 is free, then open
http://127.0.0.1:5173/ on the PC. It uses the same Django backend as
the phone. Use the existing CESD web account and private password. Mobile resident
tokens are not web administrator credentials. A protected `/api/cesd/me/` returning
401 before sign-in is expected. No account or password was changed for this task.

## Official references

- [Android hardware-device and wireless pairing setup](https://developer.android.com/studio/run/device)
- [Android Debug Bridge commands and connection limits](https://developer.android.com/tools/adb)
- [ADB TLS Wi-Fi design and distinct pairing/connect services](https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/docs/dev/adb_wifi.md)
- [React Native device and Metro connection workflow](https://reactnative.dev/docs/running-on-device)

The Word/PDF manual is a dated consolidated snapshot. This maintained Markdown
guide takes precedence for the later wireless, API-configuration and cache changes.
