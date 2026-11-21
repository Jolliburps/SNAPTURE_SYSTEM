param([switch]$DownloadModel, [string]$Model = 'qwen3-vl:2b')
$ErrorActionPreference = 'Stop'
if ($Model -notmatch '^[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?$' -or $Model -match 'cloud') {
    throw 'Use a downloaded local model tag, not a cloud model or remote host.'
}
$runtime = Join-Path $PSScriptRoot '.tools\ollama\runtime\ollama.exe'
if (-not (Test-Path -LiteralPath $runtime -PathType Leaf)) {
    $installed = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if (-not $installed) { throw 'Ollama is missing. Install Ollama locally before running this launcher.' }
    $runtime = $installed.Source
}
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
# Keep the portable runtime and its model files within this workspace.
if ($runtime -eq (Join-Path $PSScriptRoot '.tools\ollama\runtime\ollama.exe')) {
    $env:OLLAMA_MODELS = Join-Path $PSScriptRoot '.tools\ollama\models'
}
$base = 'http://127.0.0.1:11434'
$ready = $false
try { $null = Invoke-RestMethod "$base/api/version" -TimeoutSec 2; $ready = $true } catch {}
if (-not $ready) {
    $logs = Join-Path $PSScriptRoot 'outputs\runtime'
    New-Item -ItemType Directory -Path $logs -Force | Out-Null
    Start-Process -FilePath $runtime -ArgumentList @('serve') -WindowStyle Hidden -WorkingDirectory $PSScriptRoot -RedirectStandardOutput (Join-Path $logs 'ollama.stdout.log') -RedirectStandardError (Join-Path $logs 'ollama.stderr.log') | Out-Null
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 500
        try { $null = Invoke-RestMethod "$base/api/version" -TimeoutSec 2; $ready = $true; break } catch {}
    }
    if (-not $ready) { throw 'Local vision server did not start. See outputs/runtime/ollama.stderr.log.' }
}
if ($DownloadModel) {
    & $runtime pull $Model
    if ($LASTEXITCODE -ne 0) { throw 'Local model download failed.' }
}
$tags = Invoke-RestMethod "$base/api/tags" -TimeoutSec 5
$installedNames = @($tags.models | ForEach-Object { $_.name })
if ($Model -notin $installedNames -and ($Model + ':latest') -notin $installedNames) {
    throw "Model $Model is not installed. Run this launcher with -DownloadModel to download it."
}
Write-Output "Local vision ready at 127.0.0.1:11434 with $Model."
Write-Output 'No cloud fallback. Starting a model does not validate its assessment accuracy.'
