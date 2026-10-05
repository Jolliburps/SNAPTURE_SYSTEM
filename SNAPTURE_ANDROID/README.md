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

The user navigation is `Home | Learn | Camera | Waste | Profile`, with Camera
as the central action. The Waste tab opens the supported material guides.
Scan history and saved project selections are accessible from Profile.
The seven guides are available even while their category-specific training data
is being collected. Generic model outputs such as `plastic` are shown as
`Needs verification` rather than being mislabeled as PETE or HDPE.

Scan history belongs to the signed-in user and can be deleted one item at a
time or cleared completely. The administrator overview shows totals,
category-level statistics, and anonymized activity. An administrator must
explicitly open a record to inspect its non-identifying evaluation details.

The Home dashboard shows recommendations from the material API and the
highest-progress active project. A selected recommendation remains a saved
idea until the user explicitly starts it. My Projects tracks completed text
steps through the backend; completed projects use actual step completion.
Profile contains separate My Projects and Saved Ideas panels, plus Settings
for display name and profile picture. The display name does not change the
email used for sign-in. Local Updates has an empty state until an admin
announcement source is connected. Favorites beyond selected recommendations,
local policies, facilities, and barangay collection schedules remain unavailable.
Users can optionally enter their barangay during registration or in Profile;
the app does not request a street address.

The API client is in `src/api.ts`. It uses the Django backend at
`http://10.0.2.2:8000/api` for an Android emulator. For a physical phone,
replace `10.0.2.2` with the computer's LAN IPv4 address.

## Run after Android tooling is installed

Install a compatible JDK and Android Studio SDK, then run:

```powershell
cd .\SNAPTURE_ANDROID
npm.cmd install
npm.cmd run android
```

The camera uses React Native VisionCamera. The Android manifest already includes
the camera and local-network permissions. A native rebuild is required after
installing a native module such as the profile photo picker; Metro hot reload
alone cannot install native modules. The iOS photo picker also requires Pods
to be installed on a Mac before building there.

The material and scan recommendation APIs remain rule-based educational
guidance. A future recommendation model can replace their data service without
changing the project and saved-idea UI. Video project instructions are not
implemented.

For a physical phone, set `API_BASE_URL` in `src/api.ts` to the computer's LAN
IPv4 address (for example `http://192.168.1.171:8000/api`) and keep the phone
and computer on the same Wi-Fi network. The Android emulator uses
`http://10.0.2.2:8000/api`.
