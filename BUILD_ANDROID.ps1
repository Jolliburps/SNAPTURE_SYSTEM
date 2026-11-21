param([ValidateSet('arm64-v8a', 'x86_64', 'arm64-v8a,x86_64')][string]$Architecture = 'arm64-v8a')
$ErrorActionPreference = 'Stop'

$jdk = $env:JAVA_HOME
if (-not $jdk -or -not (Test-Path -LiteralPath (Join-Path $jdk 'bin\javac.exe'))) {
    $installed = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Programs\Eclipse Adoptium') -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    $jdk = if ($installed) { $installed.FullName } else { $null }
}
if (-not $jdk) { throw 'JDK 17 is required. Configure JAVA_HOME as described in RUNBOOK.md.' }
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path -LiteralPath $sdk -PathType Container)) { throw 'Android SDK missing. Follow RUNBOOK.md.' }
$env:JAVA_HOME = $jdk
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:Path = "$jdk\bin;$env:LOCALAPPDATA\Programs\nodejs;$sdk\platform-tools;$env:Path"

$android = Join-Path $PSScriptRoot 'SNAPTURE_ANDROID\android'
$localProperties = Join-Path $android 'local.properties'
if (-not (Test-Path -LiteralPath $localProperties)) {
    $sdkPath = $sdk.Replace('\', '/')
    [IO.File]::WriteAllText($localProperties, "sdk.dir=$sdkPath`ncmake.dir=$sdkPath/cmake/3.31.6`n", [Text.UTF8Encoding]::new($false))
}
Push-Location $android
try {
    & .\gradlew.bat :app:assembleDebug --no-daemon --max-workers=4 "-PreactNativeArchitectures=$Architecture"
    if ($LASTEXITCODE -ne 0) { throw 'Android build failed. See the Gradle error above.' }
    Write-Output ('APK: ' + (Join-Path $android 'app\build\outputs\apk\debug\app-debug.apk'))
} finally {
    Pop-Location
}
