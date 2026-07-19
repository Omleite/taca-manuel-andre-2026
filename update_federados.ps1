# Script para cruzar numeros federados com os jogadores
# Com fuzzy matching e normalizacao de nomes com acentos

function Normalize-Name {
    param([string]$name)
    $normalized = $name -replace '[àáâãäåā]', 'a' `
                         -replace '[èéêëē]', 'e' `
                         -replace '[ìíîïī]', 'i' `
                         -replace '[òóôõöōø]', 'o' `
                         -replace '[ùúûüū]', 'u' `
                         -replace '[çć]', 'c' `
                         -replace '[ñń]', 'n' `
                         -replace '[ýÿ]', 'y'
    return ($normalized -replace '\s+', ' ').Trim().ToLower()
}

function Get-LevenshteinDistance {
    param([string]$str1, [string]$str2)
    
    $len1 = $str1.Length
    $len2 = $str2.Length
    
    if ($len1 -eq 0) { return $len2 }
    if ($len2 -eq 0) { return $len1 }
    
    $d = New-Object 'int[,]' ($len1 + 1), ($len2 + 1)
    
    for ($i = 0; $i -le $len1; $i++) { $d.Set($i, 0, $i) }
    for ($j = 0; $j -le $len2; $j++) { $d.Set(0, $j, $j) }
    
    for ($i = 1; $i -le $len1; $i++) {
        for ($j = 1; $j -le $len2; $j++) {
            $cost = if ($str1[$i-1] -eq $str2[$j-1]) { 0 } else { 1 }
            $val1 = $d.Get($i-1, $j) + 1
            $val2 = $d.Get($i, $j-1) + 1
            $val3 = $d.Get($i-1, $j-1) + $cost
            $minVal = [Math]::Min([Math]::Min($val1, $val2), $val3)
            $d.Set($i, $j, $minVal)
        }
    }
    
    return $d.Get($len1, $len2)
}

Write-Host "Lendo ficheiro de numeros federados..."
$fedLines = Get-Content -Path "federated_numbers.txt" -Encoding UTF8

$fedData = @{}
foreach ($line in $fedLines) {
    $parts = $line -split ','
    if ($parts.Count -eq 2) {
        $fedNum = $parts[0].Trim()
        $fedName = $parts[1].Trim()
        $normalizedFedName = Normalize-Name -name $fedName
        $fedData[$normalizedFedName] = @{
            numero = $fedNum
            name = $fedName
        }
    }
}

Write-Host "Total de jogadores no PDF: $($fedData.Count)"

Write-Host "Lendo data-backup.json..."
$json = Get-Content -Path "data-backup.json" -Encoding UTF8 | ConvertFrom-Json

$matchedCount = 0
$unmatchedCount = 0
$unmatchedPlayers = @()

Write-Host "Fazendo cruzamento de nomes..."
foreach ($player in $json.players) {
    $normalizedPlayerName = Normalize-Name -name $player.name
    
    if ($fedData.ContainsKey($normalizedPlayerName)) {
        $player | Add-Member -MemberType NoteProperty -Name "numeroFederado" -Value $fedData[$normalizedPlayerName].numero -Force
        $matchedCount++
        Write-Host "[OK] $($player.name) -> $($fedData[$normalizedPlayerName].numero)"
    }
    else {
        $bestMatch = $null
        $bestDistance = 999
        
        foreach ($fedKey in $fedData.Keys) {
            $distance = Get-LevenshteinDistance -str1 $normalizedPlayerName -str2 $fedKey
            
            if ($distance -le 3 -and [Math]::Abs($normalizedPlayerName.Length - $fedKey.Length) -le 5) {
                if ($distance -lt $bestDistance) {
                    $bestDistance = $distance
                    $bestMatch = $fedKey
                }
            }
        }
        
        if ($bestMatch) {
            $player | Add-Member -MemberType NoteProperty -Name "numeroFederado" -Value $fedData[$bestMatch].numero -Force
            $matchedCount++
            Write-Host "[~] $($player.name) -> $($fedData[$bestMatch].numero)"
        }
        else {
            $player | Add-Member -MemberType NoteProperty -Name "numeroFederado" -Value "" -Force
            $unmatchedCount++
            $unmatchedPlayers += $player.name
            Write-Host "[X] $($player.name)"
        }
    }
}

Write-Host ""
Write-Host "Salvando ficheiro atualizado..."
$jsonOutput = $json | ConvertTo-Json -Depth 10
Set-Content -Path "data-backup.json" -Value $jsonOutput -Encoding UTF8

Write-Host ""
Write-Host "=========================================="
Write-Host "RESULTADOS DO CRUZAMENTO"
Write-Host "=========================================="
Write-Host "Total de jogadores: $($json.players.Count)"
Write-Host "Encontrados: $matchedCount"
Write-Host "Nao encontrados: $unmatchedCount"

if ($unmatchedPlayers.Count -gt 0) {
    Write-Host ""
    Write-Host "Jogadores nao encontrados:"
    $unmatchedPlayers | ForEach-Object { Write-Host "  - $_" }
}

Write-Host ""
Write-Host "OK: data-backup.json atualizado!"
