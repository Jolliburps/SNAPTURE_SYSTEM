# Local Android build and wireless installation

18 November 2026. Built from the existing project and installed on the paired
TECNO CK8n over wireless ADB. No app uninstall, data reset or account creation
was performed by the build task.

## Result

- `BUILD_ANDROID.ps1` builds an ARM64 debug APK using the existing Gradle project.
- Gradle 9.4.1: **BUILD SUCCESSFUL**, 226 tasks, 11 minutes 17 seconds on the
  successful first full build after tool installation.
- APK: `SNAPTURE_ANDROID/android/app/build/outputs/apk/debug/app-debug.apk`
  (56,782,300 bytes; approximately 54.2 MiB).
- ADB installation returned **Success**; package `com.snapture_android` was found
  afterward. The existing reconnect helper opened it and retained 8000/8081
  forwarding. The process remained running and React Native logged its login
  screen; device inspection subsequently confirmed the registration screen.
- Metro's Android bundle request returned HTTP 200. No login, registration,
  camera, inference or upcycling interaction was performed by this verification.

## Local tools

Installed Temurin JDK 17.0.21+9 under `%LOCALAPPDATA%/Programs/Eclipse Adoptium`
and Android command-line tools under `%LOCALAPPDATA%/Android/Sdk`. Download
checksums were checked against the official Adoptium/Google repository metadata.
Android packages installed: Platform 37.0, Build Tools 37.0.0, NDK
29.0.14206865, CMake 3.31.6. Gradle also installed Platform 35 and Build Tools
36.0.0 for module requirements. Existing platform-tools 37.0.1 were retained.

The latest Android CLI uses slash package paths, e.g. `platforms/android-37.0`.
The initial legacy `sdkmanager` invocation did not install the requested
semicolon-separated packages; using the supplied `android.exe sdk install`
completed installation. A build started before the NDK installation completed
failed its SDK/license check. It passed after installation finished.

The helper creates ignored `SNAPTURE_ANDROID/android/local.properties` only when
absent. It sets JDK, SDK and Node paths for its own process. It does not change
project dependency versions, ports, source behavior or persistent system PATH.
No app source changes were needed for this build. The prior focused reconnect
helper correction and other existing workspace edits were preserved.

## Repeat commands

From the project root in PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\BUILD_ANDROID.ps1
```

The helper builds only. Keep the existing backend and Metro terminals running
when using the installed debug app. For wireless reconnection, use the current
phone main-screen connection IP:port with `reconnect_phone.ps1 -Serial` as shown
in the runbook. Addresses may change; no permanent device address is required.

## Limits

Existing Kotlin/KSP, deprecated Gradle API, CMake and Windows object-path
warnings appeared but did not prevent this build. They were not suppressed or
resolved by unrelated dependency/source changes. Build output is a local debug
APK requiring Metro, not a public release.

Backend model files in this downloaded workspace remain Git LFS pointers.
Installing the Android client does not make camera inference/privacy models
ready. Obtain the actual matching model binaries before testing scanning.
No model data, database reset or publication was part of this build.

Build/setup logs are local ignored files in `.run-logs/`. No phone screenshot or
personal account data is included in this report. Build tools/downloads and
generated Android outputs are ignored local development artifacts.
