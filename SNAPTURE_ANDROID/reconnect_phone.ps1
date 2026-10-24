param([string]$Serial, [switch]$DebugBuild, [switch]$Watch, [string]$PackageName)
$ErrorActionPreference = 'Stop'

# Reconnecting USB resets adb forwarding. Restore it without clearing app data.
$projectDir = Split-Path $PSScriptRoot -Parent
$adbCandidates = @(
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }),
    $((Get-Command adb -ErrorAction SilentlyContinue).Source),
    'C:\Android\Sdk\platform-tools\adb.exe',
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $projectDir '.tools\android-sdk\platform-tools\adb.exe')
)
$adb = $adbCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
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
if (-not $Watch -and $Serial -notin $readyPhones) { throw 'The selected phone is not authorized or connected. Unlock it and allow USB debugging.' }
if ($PackageName -and $PackageName -notmatch '^com\.snapture_android(?:\.prototype)?$') {
    throw 'PackageName must be com.snapture_android or com.snapture_android.prototype.'
}

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
$launched = $false
$lastState = ''
do {
    try {
        $state = & $adb -s $Serial get-state 2>&1
        if ($LASTEXITCODE -ne 0 -or "$state".Trim() -ne 'device') {
            throw 'Phone disconnected or unauthorized. Waiting for USB debugging.'
        }
        $mappings = & $adb -s $Serial reverse --list 2>&1
        if ($LASTEXITCODE -ne 0) { throw 'Waiting for the ADB connection to recover.' }
        foreach ($port in $ports) {
            if (-not ($mappings -match "\stcp:$port\s+tcp:$port(?:\s|$)")) {
                & $adb -s $Serial reverse "tcp:$port" "tcp:$port" | Out-Null
                if ($LASTEXITCODE -ne 0) { throw "Could not restore port $port. Waiting for the phone." }
                Write-Output "Restored phone forwarding on port $port."
            }
        }
        if (-not $launched) {
            if (-not $PackageName) {
                $prototype = & $adb -s $Serial shell pm path com.snapture_android.prototype
                if ($LASTEXITCODE -ne 0) { throw 'Could not inspect the installed app. Waiting for the phone.' }
                $PackageName = if ($prototype -match '^package:') { 'com.snapture_android.prototype' } else { 'com.snapture_android' }
            }
            & $adb -s $Serial shell am start -n "$PackageName/com.snapture_android.MainActivity" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not open SNAPTURE. Build and install the Android app first.' }
            $launched = $true
            Write-Output "Opened $PackageName on $Serial."
        }
        if ($lastState -ne 'connected') {
            Write-Output 'Phone forwarding is ready. Keep the USB cable connected.'
            $lastState = 'connected'
        }
    } catch {
        if (-not $Watch) { throw }
        if ($lastState -ne $_.Exception.Message) {
            Write-Output $_.Exception.Message
            $lastState = $_.Exception.Message
        }
    }
    if ($Watch) { Start-Sleep -Seconds 2 }
} while ($Watch)
