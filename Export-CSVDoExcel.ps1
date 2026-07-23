# Script para exportar dados preenchidos do Excel para CSV
# Taça Manuel André 2026

$ErrorActionPreference = 'Stop'

# Verificar se ficheiro existe
if (-not (Test-Path 'Calendario_Resultados_IMPORT.xlsx')) {
    Write-Host "Erro: Ficheiro Calendario_Resultados_IMPORT.xlsx nao encontrado!" -ForegroundColor Red
    exit 1
}

# Criar Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false

# Abrir workbook
$wb = $excel.Workbooks.Open("$(Get-Location)\Calendario_Resultados_IMPORT.xlsx")
$ws = $wb.Sheets('Resultados')

# Preparar CSV
$csvLines = @()
$csvLines += '"matchId","result","score"'

# Ler dados (começar em linha 2, até encontrar vazio)
$row = 2
$imported = 0
$errors = 0

while ($true) {
    $matchId = $ws.Cells($row, 1).Value
    if ([string]::IsNullOrEmpty($matchId)) { break }
    
    $result = $ws.Cells($row, 6).Value  # Coluna F
    $score = $ws.Cells($row, 7).Value   # Coluna G
    
    # Validar
    if ([string]::IsNullOrEmpty($result) -and [string]::IsNullOrEmpty($score)) {
        # Sem dados - pular
        $row++
        continue
    }
    
    # Validar resultado se preenchido
    if (-not [string]::IsNullOrEmpty($result)) {
        if ($result -notmatch '^(Vence A|Vence B|A/S)$') {
            Write-Host "AVISO Linha $row : Resultado invalido '$result' - pulado" -ForegroundColor Yellow
            $errors++
            $row++
            continue
        }
    }
    
    # Validar score se preenchido
    if (-not [string]::IsNullOrEmpty($score)) {
        if ($score -notmatch '^\d+&\d+$') {
            Write-Host "AVISO Linha $row : Score invalido '$score' - pulado" -ForegroundColor Yellow
            $errors++
            $row++
            continue
        }
    }
    
    # Adicionar ao CSV
    $csvLines += "`"$matchId`",`"$result`",`"$score`""
    $imported++
    $row++
}

# Fechar Excel
$wb.Close($false)
$excel.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()

# Guardar CSV
$csvContent = $csvLines -join "`n"
$csvContent | Out-File -FilePath 'Calendario_Resultados_IMPORT.csv' -Encoding UTF8

Write-Host ""
Write-Host "CSV exportado: Calendario_Resultados_IMPORT.csv" -ForegroundColor Green
Write-Host "Resultados importados: $imported" -ForegroundColor Green
if ($errors -gt 0) {
    Write-Host "Erros encontrados: $errors" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Proximo passo: Importe o CSV na app" -ForegroundColor Cyan
Write-Host "Admin - Configuracoes - Importar Resultados (CSV)" -ForegroundColor Cyan
