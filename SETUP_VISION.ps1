param([string]$Model = 'gpt-6.1-terra')
$ErrorActionPreference = 'Stop'
if ($Model -notmatch '^[A-Za-z0-9._-]+$') { throw 'Use a valid provider model ID.' }
$configuration = Join-Path $PSScriptRoot 'SNAPTURE_BACKEND\.env'
if (-not (Test-Path -LiteralPath $configuration)) { throw 'Set up the backend .env first.' }
Write-Output 'Cloud assessment sends item and project evidence photos to OpenAI and incurs API usage charges.'
$consent = Read-Host 'Type ENABLE to configure cloud-photo assessment'
if ($consent -cne 'ENABLE') { Write-Output 'No settings changed.'; return }
$secureKey = Read-Host 'Enter the API key (hidden; do not paste it into chat)' -AsSecureString
$keyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPointer)
    if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -match '[\r\n]') { throw 'A nonempty single-line API key is required.' }
    $updates = @{
        OPENAI_API_KEY = $apiKey.Trim()
        SNAPTURE_VISION_MODEL = $Model
        SNAPTURE_CLOUD_PHOTOS_ENABLED = 'true'
        SNAPTURE_VISUAL_ASSESSOR = 'upcycling.cloud_vision.assess'
    }
    $lines = [Collections.Generic.List[string]]::new()
    foreach ($line in [IO.File]::ReadAllLines($configuration)) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=') {
            $settingName = $matches[1]
            if ($updates.ContainsKey($settingName)) { continue }
        }
        $lines.Add($line)
    }
    foreach ($settingName in $updates.Keys) { $lines.Add($settingName + '=' + $updates[$settingName]) }
    [IO.File]::WriteAllLines($configuration, $lines, [Text.UTF8Encoding]::new($false))
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPointer)
    $apiKey = $null
    if ($updates) { $updates.Clear() }
    $secureKey.Dispose()
}
Write-Output 'Saved backend-only settings. No key was printed. Restart START_BACKEND.ps1 to load them.'
Write-Output 'The API is not automatically marked validated. Evaluate real images and review project requirements before approval.'
