# SNAPTURE System

SNAPTURE is split into two services:

- `SNAPTURE/` — Expo mobile/web client.
- `SNAPTURE_ML/` — local FastAPI and TensorFlow prediction API.

## Run locally

1. Start the ML API from `SNAPTURE_ML`:

   ```powershell
   & ".\.venv\Scripts\python.exe" -m uvicorn scripts.api_server:app --host 0.0.0.0 --port 8000
   ```

2. In a second terminal, start the Expo app from `SNAPTURE`:

   ```powershell
   npm.cmd install
   & ".\node_modules\.bin\expo.cmd" start --lan --clear
   ```

Keep the phone and computer on the same Wi-Fi. See each folder's README for
more detailed setup and LAN camera notes.
