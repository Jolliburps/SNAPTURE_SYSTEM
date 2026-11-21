# Android debug update signing fix

ADB returned `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: the installed `com.snapture_android` package and the new APK had different signing certificates.

The installed TECNO app matches the existing workspace `.tools/android-user/debug.keystore`. The failed APK instead used the Windows profile `.android/debug.keystore`.

`SNAPTURE_ANDROID/android/app/build.gradle` now explicitly uses the existing workspace debug key when present. This keeps app signing independent of the ADB home selected for wireless pairing. The key stays outside the repository; no signing key was copied or replaced.

Validation:

- Pulled the installed APK without changing app data and verified its signing certificate.
- Verified that the workspace debug key matches the installed app.
- Ran `:app:assembleDebug --offline`: successful.
- Verified that the rebuilt APK has the same certificate as the installed app: SHA-256 `40d0744abf09d996e6c4b9d51000888158cb8d8320c87cad6bc250a9fd6c4b8f`.
- `git diff --check` passes for the Gradle change.

After the phone reconnected at its updated main Wireless debugging address, ADB installed the rebuilt APK with `install -r -d` and returned `Success`. Reverse mappings for ports 8081 and 8000 were restored. Starting `com.snapture_android/.MainActivity` returned `Status: ok` and `LaunchState: COLD`. No uninstall or application-data clearing was performed. This confirms installation and activity launch; the in-app workflow was not visually re-tested as part of this repair.
