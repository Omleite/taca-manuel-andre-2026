$json = Get-Content "data-backup.json" -Encoding UTF8 | ConvertFrom-Json

$remainingData = @{}
$lines = Get-Content "remaining_federados.txt" -Encoding UTF8
foreach ($line in $lines) {
    $parts = $line -split ','
    if ($parts.Count -eq 2) {
        $num = $parts[0].Trim()
        $name = $parts[1].Trim()
        $remainingData[$name] = $num
    }
}

Write-Host "Atualizando 30 jogadores restantes..."
$updated = 0

foreach ($player in $json.players) {
    if ($remainingData.ContainsKey($player.name)) {
        $player.numeroFederado = $remainingData[$player.name]
        Write-Host "[OK] $($player.name) -> $($remainingData[$player.name])"
        $updated++
    }
}

Write-Host ""
Write-Host "Salvando ficheiro..."
$jsonOutput = $json | ConvertTo-Json -Depth 10
Set-Content -Path "data-backup.json" -Value $jsonOutput -Encoding UTF8

Write-Host ""
Write-Host "=========================================="
Write-Host "ATUALIZACAO COMPLETA"
Write-Host "=========================================="
Write-Host "Jogadores atualizados: $updated"
Write-Host "Total: $($json.players.Count)"
Write-Host ""
Write-Host "OK: data-backup.json completo!"
