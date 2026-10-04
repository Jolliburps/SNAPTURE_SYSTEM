param(
    [string]$MysqlDatabase = "snapture",
    [string]$MysqlUser = "snapture",
    [string]$MysqlHost = "127.0.0.1",
    [string]$MysqlPort = "3306"
)

$ErrorActionPreference = "Stop"
$backendDir = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path
$python = Join-Path $backendDir "..\SNAPTURE_ML\.venv\Scripts\python.exe"
$dumpDir = Join-Path $backendDir "migration"
$dumpFile = Join-Path $dumpDir "sqlite-data.json"

if (-not (Test-Path -LiteralPath $python)) {
    throw "SNAPTURE_ML virtual-environment Python was not found at $python"
}

New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null

$securePassword = Read-Host "MySQL password for '$MysqlUser'" -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $mysqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
}

Write-Host "Exporting the existing SQLite data to $dumpFile..."
$env:SNAPTURE_DB_ENGINE = "sqlite"
& $python (Join-Path $backendDir "manage.py") dumpdata --natural-foreign --natural-primary --exclude contenttypes --exclude auth.permission --exclude sessions --indent 2 | Set-Content -LiteralPath $dumpFile -Encoding utf8
if ($LASTEXITCODE -ne 0) { throw "SQLite export failed." }

$env:SNAPTURE_DB_ENGINE = "mysql"
$env:MYSQL_DATABASE = $MysqlDatabase
$env:MYSQL_USER = $MysqlUser
$env:MYSQL_PASSWORD = $mysqlPassword
$env:MYSQL_HOST = $MysqlHost
$env:MYSQL_PORT = $MysqlPort

Write-Host "Applying Django migrations to MySQL..."
& $python (Join-Path $backendDir "manage.py") migrate
if ($LASTEXITCODE -ne 0) { throw "MySQL migrations failed. The SQLite database was not changed." }

Write-Host "Importing the exported records into MySQL..."
& $python (Join-Path $backendDir "manage.py") loaddata $dumpFile
if ($LASTEXITCODE -ne 0) { throw "MySQL data import failed. The SQLite database remains available as the fallback." }

Write-Host "Migration completed. Keep the SNAPTURE_DB_ENGINE and MYSQL_* variables configured when starting Django."
