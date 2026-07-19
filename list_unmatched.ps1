$json = Get-Content "data-backup.json" -Encoding UTF8 | ConvertFrom-Json
$unmatched = @()

foreach ($player in $json.players) {
    if (-not $player.numeroFederado -or $player.numeroFederado -eq "") {
        $unmatched += $player
    }
}

$unmatched = $unmatched | Sort-Object name

Write-Host "=== 30 JOGADORES SEM CORRESPONDENCIA ===" -ForegroundColor Cyan
Write-Host ""

$i = 1
foreach ($player in $unmatched) {
    Write-Host "$($i). $($player.name)"
    $i++
}

Write-Host ""
Write-Host "Total: $($unmatched.Count)" -ForegroundColor Green
