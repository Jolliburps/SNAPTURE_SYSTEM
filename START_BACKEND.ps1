param([switch]$CheckOnly, [switch]$MigrateOnly)
$ErrorActionPreference = 'Stop'

if ($CheckOnly -and $MigrateOnly) { throw 'Choose either -CheckOnly or -MigrateOnly.' }
$python = Join-Path $PSScriptRoot 'SNAPTURE_ML\.venv\Scripts\python.exe'
$configuration = Join-Path $PSScriptRoot 'SNAPTURE_BACKEND\.env'
$manage = Join-Path $PSScriptRoot 'SNAPTURE_BACKEND\manage.py'

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw 'Project Python environment missing. Complete SETUP in RUN_COMMANDS.txt.'
}
if (-not (Test-Path -LiteralPath $configuration -PathType Leaf)) {
    throw 'Backend .env missing. Complete CONFIG in RUN_COMMANDS.txt.'
}

# Match the existing runbook format. Never print configuration values/secrets.
Get-Content -LiteralPath $configuration | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $settingName = $matches[1]
        $settingValue = $matches[2].Trim()
        if ($settingValue.Length -gt 0) {
            [Environment]::SetEnvironmentVariable($settingName, $settingValue, 'Process')
        } else {
            [Environment]::SetEnvironmentVariable($settingName, $null, 'Process')
        }
    }
}

Push-Location $PSScriptRoot
try {
    & $python $manage check
    if ($LASTEXITCODE -ne 0) { throw 'Django check failed. Resolve the error above.' }
    if ($CheckOnly) { return }
    if ($MigrateOnly) {
        & $python $manage migrate
        if ($LASTEXITCODE -ne 0) { throw 'Database migration failed. Review the error above.' }
        return
    }
    & $python $manage runserver 0.0.0.0:8000
    if ($LASTEXITCODE -ne 0) { throw 'Backend stopped with an error. Review the output above.' }
} finally {
    Pop-Location
}
