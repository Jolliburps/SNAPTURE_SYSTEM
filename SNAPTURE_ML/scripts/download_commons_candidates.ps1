$ErrorActionPreference = 'Continue'

$scope = Join-Path $PSScriptRoot '..\data\scope_dataset'
$root = Join-Path $scope 'candidate_data'
New-Item -ItemType Directory -Force -Path $root | Out-Null

$jobs = @(
    @{ label = 'pete_bottles'; query = 'PET bottle'; limit = 60 },
    @{ label = 'hdpe_containers'; query = 'HDPE bottle'; limit = 60 },
    @{ label = 'fabric_scraps'; query = 'fabric scraps'; limit = 60 },
    @{ label = 'coconut_shells'; query = 'coconut shell'; limit = 60 },
    @{ label = 'dry_untreated_wood_scraps'; query = 'wood scraps'; limit = 60 }
)

$headers = @{ 'User-Agent' = 'SNAPTURE dataset preparation/1.0' }
$manifest = New-Object System.Collections.Generic.List[object]

foreach ($job in $jobs) {
    $out = Join-Path $root ($job.label + '_commons')
    New-Item -ItemType Directory -Force -Path $out | Out-Null
    $encoded = [Uri]::EscapeDataString($job.query)
    $api = "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=$encoded&gsrnamespace=6&gsrlimit=$($job.limit)&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=640&format=json"

    try {
        $response = Invoke-RestMethod -Uri $api -Headers $headers -TimeoutSec 30
    } catch {
        Write-Warning "$($job.label): API request failed: $($_.Exception.Message)"
        continue
    }

    $pages = @($response.query.pages.PSObject.Properties.Value)
    $index = 0
    foreach ($page in $pages) {
        $info = $page.imageinfo | Select-Object -First 1
        if (-not $info.thumburl) { continue }

        $extension = '.jpg'
        if ($info.mime -eq 'image/png') { $extension = '.png' }
        elseif ($info.mime -eq 'image/webp') { $extension = '.webp' }

        $index++
        $name = 'commons_{0:D4}{1}' -f $index, $extension
        $destination = Join-Path $out $name

        try {
            Invoke-WebRequest -Uri $info.thumburl -OutFile $destination -Headers $headers -TimeoutSec 60
            $size = (Get-Item $destination).Length
            if ($size -lt 1000) {
                Remove-Item -LiteralPath $destination -Force
                continue
            }

            $metadata = $info.extmetadata
            $manifest.Add([ordered]@{
                target_label = $job.label
                source = 'Wikimedia Commons'
                title = $page.title
                source_url = 'https://commons.wikimedia.org/wiki/' + [Uri]::EscapeDataString($page.title.Replace(' ', '_'))
                download_url = $info.thumburl
                license = if ($metadata.LicenseShortName) { $metadata.LicenseShortName.value } else { 'unspecified' }
                license_url = if ($metadata.LicenseUrl) { $metadata.LicenseUrl.value } else { '' }
                artist = if ($metadata.Artist) { $metadata.Artist.value } else { '' }
                path = 'candidate_data/' + $job.label + '_commons/' + $name
                label_verified = $false
                query = $job.query
            }) | Out-Null
        } catch {
            if (Test-Path $destination) { Remove-Item -LiteralPath $destination -Force }
        }

        Start-Sleep -Milliseconds 80
    }

    Write-Output "$($job.label): $index candidates"
}

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $root 'commons_manifest.json') -Encoding UTF8
Write-Output "Total downloaded: $($manifest.Count)"
