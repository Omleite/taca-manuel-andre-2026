$json = Get-Content "data-backup.json" -Encoding UTF8 | ConvertFrom-Json

$player = $json.players | Where-Object { $_.name -like '*Feij*' }

if ($player) {
    Write-Host "Encontrado: $($player.name)"
    Write-Host "ID: $($player.id)"
    Write-Host "NºFederado atual: '$($player.numeroFederado)'"
    
    $player.numeroFederado = "13450"
    
    $jsonOutput = $json | ConvertTo-Json -Depth 10
    Set-Content -Path "data-backup.json" -Value $jsonOutput -Encoding UTF8
    
    Write-Host ""
    Write-Host "Atualizado para: 13450"
}
