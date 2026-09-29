# SNAPTURE Android client

This is the standalone React Native CLI Android client. It is separate from
the legacy Expo project and does not require Expo Go.

## Current UI flow

The app includes welcome, login/register, an in-app administrator sign-in and
privacy-safe dashboard, a clickable materials library, a native Android camera
flow, image-quality review, model identification, adaptive safety guidance,
multiple recommendations, private scan history, projects, and profile
settings. A high-confidence, low-risk scan goes directly to recommendations;
only uncertain materials or wood safety cases ask one focused follow-up. The
recommendations screen has an optional one-tap amount selector (one, a few, or
many) instead of requiring a long questionnaire.

The user navigation is `Home | Materials | My scans | Projects | Profile`.
Material cards open an educational guide first; scanning is a separate action.
The seven guides are available even while their category-specific training data
is being collected. Generic model outputs such as `plastic` are shown as
`Needs verification` rather than being mislabeled as PETE or HDPE.

Scan history belongs to the signed-in user and can be deleted one item at a
time or cleared completely. The administrator overview shows totals,
category-level statistics, and anonymized activity. An administrator must
explicitly open a record to inspect its non-identifying evaluation details.

The API client is in `src/api.ts`. It uses the Django backend at
`http://10.0.2.2:8000/api` for an Android emulator. For a physical phone,
replace `10.0.2.2` with the computer's LAN IPv4 address.

## Run after Android tooling is installed

Install a compatible JDK and Android Studio SDK, then run:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ANDROID"
npm.cmd install
npm.cmd run android
```

The camera uses React Native VisionCamera. The Android manifest already includes
the camera and local-network permissions. A native rebuild is required after
installing the camera package; Metro hot reload alone cannot install native
modules.

For a physical phone, set `API_BASE_URL` in `src/api.ts` to the computer's LAN
IPv4 address (for example `http://192.168.1.171:8000/api`) and keep the phone
and computer on the same Wi-Fi network. The Android emulator uses
`http://10.0.2.2:8000/api`.
