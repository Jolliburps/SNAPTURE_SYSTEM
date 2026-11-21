# Developing the SNAPTURE Android app

The Android target uses `SNAPTURE_ANDROID/index.js`, `App.tsx`, `src/` and the existing Django API. Keep the directory and registration name `SNAPTURE_ANDROID` and the existing application code.

## Tools and checks

Use the checked-in lockfile. React Native 0.87.1 requires Node `^22.13.0 || ^24.3.0 || >=26.0.0`. Use JDK 17 and the existing Android SDK, Build Tools, NDK and Gradle versions specified in the [Windows runbook](../../RUNBOOK.md#4-build-and-launch-the-android-app).

Run these from `SNAPTURE_ANDROID`:

```sh
npm ci
npm run mobile:doctor
npm run check:types
npm run lint
npm run test:dev-tools
npm run test:reliable
npm run bundle:check
```

Use `npm.cmd` in PowerShell if execution policy blocks `npm.ps1`. Install dependencies only when missing or the lockfile changes. `bundle:check` resolves Android JavaScript and assets; it does not compile native code or verify a phone. `mobile:doctor` checks installed React Native metadata, required shared/Android files and public API configuration; it does not certify native compilation or device readiness. Use `android:doctor` separately for the existing ADB/SDK/JDK and development-server checks.

## API configuration and Android routes

`api-environment.json` retains the existing development default `http://127.0.0.1:8000/api`. An optional `platforms.android` URL selects an Android-specific route to the same backend. No endpoint override is added by this cleanup.

```sh
npm run api:configure -- --show
npm run api:configure -- --platform android development http://YOUR-BACKEND-LAN-IP:8000/api
```

Replace the example host with the address of the machine actually running Django. USB/wireless development can continue using the existing ADB reverse forwarding for ports 8000 and 8081. Android emulator `10.0.2.2` refers to the emulator's host. Start Django on the intended reachable interface using the runbook, and check the firewall and network route.

Production requires a reachable public HTTPS API. To switch environments, update the default and every configured override together in the JSON, or remove obsolete overrides; the existing validator rejects production settings that retain a development endpoint. API URLs are public configuration and must never contain credentials. Changing API origin selects a separate local token/cache scope; users may need to sign in again. Existing API validation and session behavior are unchanged.

## Android development

Keep using the [Windows runbook](../../RUNBOOK.md#4-build-and-launch-the-android-app), current SDK, Gradle, debug package and ADB tools. Typical commands remain:

```sh
npm start
npm run android -- --no-packager
```

For a native compile check, use `android/gradlew` or `android/gradlew.bat` with `:app:assembleDebug`. Installation/runtime checks remain separate. Existing Release signing still uses a debug key; this is not a production signing setup. Native dependency changes require an Android rebuild.

Use the [Android wireless guide](ANDROID_WIRELESS_DEBUGGING_AND_TROUBLESHOOTING.md) for pairing, connection, port forwarding, probes and recovery. A bundled APK still requires a reachable backend.

## Feature acceptance on Android

Keep platform conditions in existing shared helpers narrow and preserve shared screens. Run the following matrix on the supported Android phone/emulator:

| Area | Required checks |
| --- | --- |
| Startup/navigation | Fresh launch, restored session, logout, visible back/close controls, tab and project transitions, hardware back |
| Display and keyboard | Small screens, large text, status/navigation bars, scrollable sheets and close controls; login/register/reset, assessment, profile and barangay fields remain reachable |
| Authentication/storage | Register/login/logout, resident role restrictions, token restore/expiry, restart, API-origin scope changes, notification/cache scope |
| Permissions | Camera grant, denial, blocked permission/Open Settings, picker cancel, selected photos |
| Camera | Open/close, inactive/background/foreground, gallery return, completed capture after unmount, torch readiness, devices without camera hardware |
| Images | JPEG/PNG/WebP, Android content and cached file URIs, supported MIME preservation and clear failure for unsupported formats |
| Network | USB/wireless/emulator routes, server outage/timeout, environment switch, saved schedule fallback boundaries |
| Existing flows | Assessment, scan/history, saved ideas, project progress/restart/change idea, profile, barangay, external references/files and in-app updates |

Camera capture requests JPEG; the shared picker requests compatible files without extra EXIF data. The upload helper preserves supported image types. Unresolved asset identifiers must not be converted to fake file paths. Latest-photo discovery remains the optional Android native preview. Face blurring is performed by the server before preview, with existing limitations.

The app remains under development. Model accuracy, local guidance approval and production email delivery are independent of native compatibility; Google sign-in, operating-system background push, video instructions and offline detection/write queue remain unimplemented.

## Reference basis

Version-specific package source and the checked-in Android configuration remain the basis for this project. Existing upstream references: [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment), [keyboard avoidance](https://reactnative.dev/docs/keyboardavoidingview), [networking](https://reactnative.dev/docs/network), and [image picker options](https://github.com/react-native-image-picker/react-native-image-picker#options).
