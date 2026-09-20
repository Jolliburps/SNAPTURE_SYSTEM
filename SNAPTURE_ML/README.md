# SNAPTURE_ML

SNAPTURE_ML is the local machine-learning backend for the SNAPTURE mobile prototype. It trains a TensorFlow image classifier from the existing dataset and exposes the trained model through a small FastAPI server.

The current TrashNet-based model discovers the class folders that are present in the dataset. With the current data, the classes are:

```text
cardboard, glass, metal, paper, plastic, trash
```

`glass` and `trash` are treated as unsupported by default. Any prediction below the confidence threshold is also returned as `unknown_unsupported`. Confidence is only a practical rejection rule; it is not a perfect unknown-object detector or a safety certification.

## Project structure

```text
SNAPTURE_ML/
├── .venv/
├── data/raw/trashnet/dataset-resized/
│   ├── cardboard/
│   ├── glass/
│   ├── metal/
│   ├── paper/
│   ├── plastic/
│   └── trash/
├── models/
│   ├── snapture_baseline.keras
│   ├── labels.json
│   ├── model_config.json
│   └── training_summary.json
├── scripts/
│   ├── api_server.py
│   ├── inference.py
│   ├── predict_image.py
│   └── train_model.py
├── requirements.txt
└── train_model.py
```

The root `train_model.py` is only a compatibility entry point. The maintained trainer is `scripts/train_model.py`.

## Setup

Open PowerShell in the project root:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ML"
```

The project uses Python 3.13 and the existing `.venv`. PowerShell activation is optional; direct interpreter paths avoid execution-policy problems.

Install the pinned dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Dataset

Keep the original dataset folders unchanged. The trainer first checks `data/raw/trashnet/dataset-resized`, then the other project-local fallback locations. To use another local dataset root, set `SNAPTURE_DATA_DIR`:

```powershell
$env:SNAPTURE_DATA_DIR = ".\data\raw\my-dataset"
```

Each immediate subfolder becomes a class. Do not rename a broad `plastic` or `metal` folder to `plastic_bottle` or `metal_can` unless every image in that folder has been verified to match the new label.

## Train the model

```powershell
.\.venv\Scripts\python.exe .\scripts\train_model.py
```

The trainer validates image files, automatically discovers classes, uses an 80/20 training/validation split, applies MobileNetV2 transfer learning and augmentation, and saves:

- `models/snapture_baseline.keras` — trained Keras model
- `models/labels.json` — class order used by the model
- `models/model_config.json` — image size, preprocessing, threshold, and dataset metadata
- `models/training_summary.json` — measured validation results

There is currently no separate test folder, so validation accuracy is evaluation evidence, not an independent test-set score.

## Test one image

```powershell
.\.venv\Scripts\python.exe .\scripts\predict_image.py ".\data\raw\trashnet\dataset-resized\paper\paper1.jpg"
```

The command prints JSON containing the model class, confidence, threshold, and final decision. The image is passed as raw RGB pixels because MobileNetV2 preprocessing is stored inside the trained model.

The threshold can be changed for a local experiment without editing source code:

```powershell
$env:SNAPTURE_CONFIDENCE_THRESHOLD = "0.60"
```

For a classroom demo you can experiment with `0.50` to return more borderline plastic/metal results, but a lower threshold also increases false positives. Restart the API after changing the variable.

The unsupported labels can also be configured:

```powershell
$env:SNAPTURE_UNSUPPORTED_CLASSES = "glass,trash"
```

## Start the API

Install dependencies first, then start the server from the project root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn scripts.api_server:app --reload --host 0.0.0.0 --port 8000
```

The alternative command below is useful when importing the script directly:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api_server:app --app-dir ".\scripts" --host 0.0.0.0 --port 8000
```

Endpoints:

```text
GET  /health
POST /predict   (multipart/form-data field name: file)
```

Open `http://127.0.0.1:8000/health` to confirm that the model loaded. Open `http://127.0.0.1:8000/docs` to test an image interactively.

Example request with PowerShell:

```powershell
$image = Get-Item ".\data\raw\trashnet\dataset-resized\metal\metal1.jpg"
Invoke-RestMethod -Uri "http://127.0.0.1:8000/predict" -Method Post -Form @{ file = $image }
```

Example response:

```json
{
  "class": "paper",
  "confidence": 0.648793,
  "decision": "paper",
  "threshold": 0.6,
  "unsupported_class": false,
  "label": "paper",
  "model_class": "paper",
  "title": "Paper",
  "preparation": [
    "Remove wet or heavily contaminated parts.",
    "Keep the paper dry.",
    "Separate tape, plastic, and metal attachments."
  ],
  "reuse_options": [
    "Paper organizer",
    "Gift wrapping",
    "Paper craft"
  ]
}
```

The confidence and class in this example come from the current trained model; they will vary with the image. A low-confidence result is intentionally returned as `unknown_unsupported` instead of presenting an uncertain material as fact.

## Mobile app connection

The Expo app is in the separate `SNAPTURE` project. Its `src/app/index.tsx` sends the captured photo to the local API and displays the returned preparation and reuse information.

The mobile upload uses Expo SDK 57's `File` object from `expo-file-system` together with `expo/fetch`. Do not replace it with the older React Native `{ uri, name, type }` FormData object; Expo SDK 57's multipart encoder rejects that object with `Unsupported FormDataPart implementation`.

For a physical Android phone, use the computer's local IPv4 address in `API_BASE_URL` and keep both devices on the same Wi-Fi network. Do not use `localhost` on the phone. For the Android emulator, `http://10.0.2.2:8000` normally points to the host computer.

Start the mobile project in a second terminal:

```powershell
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE"
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
& ".\node_modules\.bin\expo.cmd" start -c
```

### Open the app on multiple devices over the LAN

`localhost` always means the device where the browser or app is running. Other devices must use the computer's LAN IPv4 address. Start the API on all interfaces and start Expo in LAN mode:

```powershell
# Terminal 1: backend
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE_ML"
.\.venv\Scripts\python.exe -m uvicorn scripts.api_server:app --host 0.0.0.0 --port 8000

# Terminal 2: Expo/Metro
cd "C:\Users\My PC\Documents\SNAPTURE_SYSTEM\SNAPTURE"
& ".\node_modules\.bin\expo.cmd" start --lan --clear
```

If the computer's IPv4 address is `192.168.1.171`:

- Open the web app on another computer or phone at `http://192.168.1.171:8081`.
- On iPhone, open Expo Go and scan the LAN QR code (`exp://192.168.1.171:8081`). Expo CLI and Expo Go must be signed in to the same Expo account on a physical iOS device.
- The app sends predictions to `http://192.168.1.171:8000`; the backend already enables cross-origin requests for local development.

All devices must be on the same Wi-Fi/LAN, and Windows Firewall must allow Python/Node on the Private network if it prompts. If the IPv4 address changes, restart Metro after updating `.env`; during development the app also derives the API host from the browser/Expo development host when available.

## Common fixes

- **`No matching distribution found for tensorflow`**: use the project Python 3.13 environment, not Python 3.14.
- **PowerShell blocks `npm.ps1` or `npx.ps1`**: use `npm.cmd` or `npx.cmd`.
- **`Model is not ready`**: train the model first and confirm the files in `models/` exist.
- **Phone cannot connect**: start the API with `--host 0.0.0.0`, use the computer's IPv4 address, check same Wi-Fi, and allow the development server on the Private network if Windows asks.
- **`unknown_unsupported`**: the model was below the configured confidence threshold or predicted a configured unsupported class. This is intentionally conservative.

## Limitations

TrashNet is a broad classroom-style dataset; its `plastic` and `metal` classes do not guarantee plastic bottles or metal cans. The current backend is an educational decision-support prototype. It cannot determine hidden contamination, chemical residue, microbial load, internal structural damage, material strength, or food-contact safety.
