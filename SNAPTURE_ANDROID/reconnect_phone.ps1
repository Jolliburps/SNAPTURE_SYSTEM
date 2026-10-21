param([string]$Serial, [switch]$DebugBuild)
$ErrorActionPreference = 'Stop'

# Reconnecting USB resets adb forwarding. Restore it without clearing app data.
$projectDir = Split-Path $PSScriptRoot -Parent
$adbCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $projectDir '.tools\android-sdk\platform-tools\adb.exe')
)
$adb = $adbCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $adb) { throw 'Android platform tools were not found. Install them through Android Studio.' }

$deviceList = & $adb devices
if ($LASTEXITCODE -ne 0) { throw 'Could not check the USB debugging connection.' }
$readyPhones = @($deviceList | Where-Object { $_ -match '^\S+\s+device\s*$' -and $_ -notmatch '^emulator-' } | ForEach-Object { ($_ -split '\s+')[0] })
if (-not $Serial) {
    if ($readyPhones.Count -ne 1) {
        throw 'Connect one phone, unlock it, and allow USB debugging. For multiple phones, supply -Serial.'
    }
    $Serial = $readyPhones[0]
}
if ($Serial -notin $readyPhones) { throw 'The selected phone is not authorized or connected. Unlock it and allow USB debugging.' }

try {
    # A connection check must not wait for a classifier to load.
    $connectionTest = Invoke-WebRequest 'http://127.0.0.1:8000/api/materials/' -UseBasicParsing -TimeoutSec 10
    if ($connectionTest.StatusCode -ne 200) { throw 'The backend did not respond correctly.' }
} catch {
    throw 'Start the Django backend on port 8000, then run this helper again.'
}
if ($DebugBuild) {
    try {
        $metro = Invoke-WebRequest 'http://127.0.0.1:8081/status' -UseBasicParsing -TimeoutSec 10
        if ($metro.StatusCode -ne 200) { throw 'Metro is not ready.' }
    } catch {
        throw 'Start Metro with npm.cmd start for a debug build, or omit -DebugBuild for the installed release app.'
    }
}

$ports = @(8000)
if ($DebugBuild) { $ports += 8081 }
foreach ($port in $ports) {
    & $adb -s $Serial reverse "tcp:$port" "tcp:$port"
    if ($LASTEXITCODE -ne 0) { throw "Could not restore the phone connection on port $port." }
}
& $adb -s $Serial shell am start -n com.snapture_android/.MainActivity
if ($LASTEXITCODE -ne 0) { throw 'Could not open SNAPTURE. Build and install the Android app first.' }
Write-Output 'SNAPTURE opened. The USB backend connection is restored. Keep USB connected; reconnecting the cable resets this mapping.'
