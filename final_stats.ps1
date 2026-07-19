$json = Get-Content "data-backup.json" -Encoding UTF8 | ConvertFrom-Json

$total = $json.players.Count
$comFed = 0
$semFed = @()

foreach ($player in $json.players) {
    if ($player.numeroFederado -and $player.numeroFederado -ne "") {
        $comFed++
    } else {
        $semFed += $player.name
    }
}

Write-Host ""
Write-Host "=========================================="
Write-Host "RESUMO FINAL DO CRUZAMENTO" -ForegroundColor Cyan
Write-Host "=========================================="
Write-Host "Total de jogadores:        $total"
Write-Host "Com NºFederado:            $comFed" -ForegroundColor Green
Write-Host "Sem NºFederado:            $($semFed.Count)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cobertura: $([math]::Round(($comFed/$total)*100, 1))%" -ForegroundColor Green
Write-Host "=========================================="

if ($semFed.Count -gt 0) {
    Write-Host ""
    Write-Host "Jogadores ainda sem NºFederado:"
    $semFed | ForEach-Object { Write-Host "  - $_" }
}
