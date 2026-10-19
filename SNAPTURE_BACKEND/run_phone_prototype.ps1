$ErrorActionPreference = 'Stop'

$backendDir = $PSScriptRoot
$projectDir = Split-Path $backendDir -Parent
$modelDir = Join-Path $projectDir 'SNAPTURE_ML\models\candidates\snapture-7class-candidate-20261006'
$python = Join-Path $projectDir 'SNAPTURE_ML\.venv\Scripts\python.exe'

foreach ($name in @('snapture_7class_candidate_unverified.keras', 'labels.json', 'model_config.json', 'training_summary.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $modelDir $name) -PathType Leaf)) {
        throw "Prototype model is incomplete: $name is missing from $modelDir"
    }
}

$env:SNAPTURE_MODEL_PATH = Join-Path $modelDir 'snapture_7class_candidate_unverified.keras'
$env:SNAPTURE_LABELS_PATH = Join-Path $modelDir 'labels.json'
$env:SNAPTURE_CONFIG_PATH = Join-Path $modelDir 'model_config.json'
# A model-directory override would take precedence over these file paths.
Remove-Item Env:SNAPTURE_MODEL_DIR -ErrorAction SilentlyContinue
Push-Location $backendDir
try {
    & $python manage.py runserver 0.0.0.0:8000 --noreload
} finally {
    Pop-Location
}
