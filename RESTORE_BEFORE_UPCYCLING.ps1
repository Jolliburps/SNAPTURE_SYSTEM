param([switch]$Preview)
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath($PSScriptRoot)
$snapshot=Join-Path $root 'history\upcycling-2026-11-20'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$original=[IO.Compression.ZipFile]::OpenRead((Join-Path $snapshot 'original-source.zip'))
try {
    $manifest=Get-Content -LiteralPath (Join-Path $snapshot 'change-manifest.json') -Raw | ConvertFrom-Json
    $paths=@($original.Entries | ForEach-Object {$_.FullName}) + @($manifest.added)
    $paths=@($paths | Select-Object -Unique)
    foreach($relative in $paths){
        $target=[IO.Path]::GetFullPath((Join-Path $root $relative))
        if(-not $target.StartsWith($root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid restore path.'}
    }
    if($Preview){$paths;return}
    $archivePath=Join-Path $snapshot ('before-restore-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.zip')
    $archive=[IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach($relative in $paths){
            $target=Join-Path $root $relative
            if(Test-Path -LiteralPath $target -PathType Leaf){[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$target,$relative) | Out-Null}
        }
    }finally{$archive.Dispose()}
    foreach($entry in $original.Entries){
        $target=Join-Path $root $entry.FullName
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$true)
    }
    foreach($relative in $manifest.added){
        $target=Join-Path $root $relative
        if(Test-Path -LiteralPath $target -PathType Leaf){Remove-Item -LiteralPath $target -Force}
    }
    Write-Output 'Previous source restored. Current source was archived. Database records and photos were preserved. Restart backend and Metro.'
}finally{$original.Dispose()}
