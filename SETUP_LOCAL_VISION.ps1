param([string]$Model = 'qwen3-vl:2b')
$ErrorActionPreference = 'Stop'
if ($Model -notmatch '^[A-Za-z0-9._-]+(:[A-Za-z0-9._-]+)?$' -or $Model -match 'cloud') { throw 'Use a local model tag.' }
$configuration = Join-Path $PSScriptRoot 'SNAPTURE_BACKEND\.env'
if (-not (Test-Path -LiteralPath $configuration -PathType Leaf)) { throw 'Set up backend .env first.' }
$updates = @{
    SNAPTURE_VISUAL_ASSESSOR = 'upcycling.local_vision.assess'
    SNAPTURE_LOCAL_VISION_MODEL = $Model
    SNAPTURE_CLOUD_PHOTOS_ENABLED = 'false'
    SNAPTURE_VISUAL_ASSESSOR_VALIDATION = '{}'
}
$lines = [Collections.Generic.List[string]]::new()
foreach ($line in [IO.File]::ReadAllLines($configuration)) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=' -and $updates.ContainsKey($matches[1])) { continue }
    $lines.Add($line)
}
foreach ($name in $updates.Keys) { $lines.Add($name + '=' + $updates[$name]) }
[IO.File]::WriteAllLines($configuration, $lines, [Text.UTF8Encoding]::new($false))
Write-Output 'Configured local assessment and disabled cloud photos. Existing credentials were preserved without being displayed.'
Write-Output 'Model approval was cleared. Unvalidated AI checks remain pending; human-assisted mode is a separate, explicit option.'
Write-Output 'Restart START_BACKEND.ps1 to load these settings. Use START_LOCAL_VISION.ps1 to start the local model.'
