$ErrorActionPreference = 'Stop'

$backendDir = $PSScriptRoot
$projectDir = Split-Path $backendDir -Parent
$modelDir = Join-Path $projectDir 'SNAPTURE_ML\models\candidates\snapture-drive-20261006'
$python = Join-Path $projectDir 'SNAPTURE_ML\.venv\Scripts\python.exe'

foreach ($name in @('snapture_baseline.keras', 'labels.json', 'model_config.json', 'training_summary.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $modelDir $name) -PathType Leaf)) {
        throw "Prototype model is incomplete: $name is missing from $modelDir"
    }
}

$env:SNAPTURE_MODEL_DIR = $modelDir
Push-Location $backendDir
try {
    & $python manage.py runserver 0.0.0.0:8000 --noreload
} finally {
    Pop-Location
}
