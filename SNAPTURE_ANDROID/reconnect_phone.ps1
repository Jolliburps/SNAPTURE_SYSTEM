param([string]$Serial, [switch]$DebugBuild, [switch]$Watch, [string]$PackageName)
$ErrorActionPreference = 'Stop'

# Windows PowerShell turns redirected native stderr into terminating errors
# under Stop. Expected ADB disconnects must reach our connection checks.
function Get-PhoneState([string]$DeviceSerial) {
    $ErrorActionPreference = 'Continue'
    $result = & $adb -s $DeviceSerial get-state 2>&1
    if ($LASTEXITCODE -eq 0 -and "$result".Trim() -eq 'device') { return 'device' }
    return 'disconnected'
}

function Select-PhoneTransport([string[]]$Transports) {
    if ($Transports.Count -eq 1) { return $Transports[0] }

    # The same phone can be listed by USB, mDNS, and its explicit IP:port.
    # Check the hardware serial before choosing between ready transports.
    $ErrorActionPreference = 'Continue'
    $hardwareSerials = @(foreach ($transport in $Transports) {
        $value = (& $adb -s $transport shell getprop ro.serialno 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -eq 0 -and $value -match '^[A-Za-z0-9_-]+$' -and $value -notmatch '^(unknown|null|0+)$') {
            $value
        }
    })
    if ($hardwareSerials.Count -ne $Transports.Count -or @($hardwareSerials | Select-Object -Unique).Count -ne 1) {
        throw 'Multiple phone connections could not be identified as one phone. Run adb devices -l and supply the intended connection with -Serial.'
    }

    $usb = $Transports | Where-Object { $_ -notmatch '(:\d+$|\._adb-tls-connect\._tcp\.?$)' } | Select-Object -First 1
    if ($usb) { return $usb }
    $discovered = $Transports | Where-Object { $_ -match '\._adb-tls-connect\._tcp\.?$' } | Select-Object -First 1
    if ($discovered) { return $discovered }
    return $Transports[0]
}

# Reconnecting USB or wireless ADB can reset forwarding. Keep existing app data.
$projectDir = Split-Path $PSScriptRoot -Parent
$adbCandidates = @(
    $(if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe' }),
    $((Get-Command adb -ErrorAction SilentlyContinue).Source),
    'C:\Android\Sdk\platform-tools\adb.exe',
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    (Join-Path $projectDir '.tools\android-sdk\platform-tools\adb.exe'),
    (Join-Path $projectDir '.tools\platform-tools-setup-37.0.1\platform-tools\adb.exe')
)
$adb = $adbCandidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
if (-not $adb) { throw 'Android platform tools were not found. Install them through Android Studio.' }

$deviceList = & $adb devices
if ($LASTEXITCODE -ne 0) { throw 'Could not check the ADB debugging connection.' }
$readyPhones = @($deviceList | Where-Object { $_ -match '^\S+\s+device\s*$' -and $_ -notmatch '^emulator-' } | ForEach-Object { ($_ -split '\s+')[0] })
if (-not $Serial -and $readyPhones.Count -eq 0) {
    # Discovery does not always create a transport automatically. Connect only
    # when exactly one wireless debugging endpoint is advertised; ADB still
    # enforces the phone's existing pairing authorization.
    $services = & $adb mdns services
    if ($LASTEXITCODE -ne 0) { throw 'Wireless discovery failed. Use the current phone IP:port with adb connect first.' }
    $endpoints = @($services | ForEach-Object {
        if ($_ -match '^\S+\s+_adb-tls-connect\._tcp\.?\s+(\S+:\d+)\s*$') { $matches[1] }
    } | Select-Object -Unique)
    if ($endpoints.Count -eq 1) {
        $endpoint = $endpoints[0]
        Write-Output "Connecting to discovered wireless phone at $endpoint..."
        & $adb connect $endpoint
        $state = Get-PhoneState $endpoint
        if ($state -ne 'device') {
            throw "The advertised address $endpoint is unreachable or stale. Check that the PC and phone use the same Wi-Fi. Read the current IP address & Port on the phone's MAIN Wireless debugging screen, then rerun with -Serial IP:port. Pair again only if ADB reports an authentication error."
        }
        $Serial = $endpoint
        $readyPhones = @($endpoint)
    } elseif ($endpoints.Count -gt 1) {
        throw 'Multiple wireless phones were discovered. Connect the intended phone using its current MAIN-screen IP:port, then supply -Serial.'
    }
}
if (-not $Serial) {
    if ($readyPhones.Count -eq 0) { throw 'No connected or discoverable phone. Enable Wireless debugging on the same Wi-Fi, or use the current MAIN-screen IP:port with adb connect.' }
    $Serial = Select-PhoneTransport $readyPhones
}
if ($Serial -and $Serial -notin $readyPhones -and $Serial -match '^\S+:\d+$') {
    Write-Output "Connecting to selected wireless phone at $Serial..."
    & $adb connect $Serial
    if ((Get-PhoneState $Serial) -eq 'device') { $readyPhones += $Serial }
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
        $state = Get-PhoneState $Serial
        if ($state -ne 'device') {
            throw 'Phone disconnected or unauthorized. Waiting for USB or wireless debugging.'
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
            # `pm path` exits 1 for an absent package even on a healthy phone.
            # A filtered list distinguishes absence from an ADB/package-manager error.
            $packageRows = & $adb -s $Serial shell pm list packages com.snapture_android
            if ($LASTEXITCODE -ne 0) { throw 'Could not query installed SNAPTURE packages. Check the phone connection.' }
            $installedPackages = @($packageRows | Where-Object { $_ -match '^package:com\.snapture_android(?:\.prototype)?\s*$' } | ForEach-Object { ($_ -replace '^package:', '').Trim() })
            if (-not $PackageName) {
                if ('com.snapture_android.prototype' -in $installedPackages) { $PackageName = 'com.snapture_android.prototype' }
                elseif ('com.snapture_android' -in $installedPackages) { $PackageName = 'com.snapture_android' }
                else { throw 'Phone connected, but SNAPTURE is not installed. Install the project APK before opening it. No app data was cleared.' }
            }
            if ($PackageName -notin $installedPackages) { throw "Phone connected, but $PackageName is not installed. Choose an installed SNAPTURE variant or install its APK." }
            & $adb -s $Serial shell am start -n "$PackageName/com.snapture_android.MainActivity" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not open SNAPTURE. Build and install the Android app first.' }
            $launched = $true
            Write-Output "Opened $PackageName on $Serial."
        }
        if ($lastState -ne 'connected') {
            Write-Output 'Phone forwarding is ready. Keep the USB or wireless debugging connection active.'
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
