# Gera um ficheiro Excel formatado com validacao para importacao de resultados
# Taca Manuel Andre 2026 - Estela Golf Club

$ErrorActionPreference = 'Stop'

# Carregar dados
$json = Get-Content 'data-backup.json' -Encoding UTF8 | ConvertFrom-Json

# Criar Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets(1)
$ws.Name = "Calendario"

# Estilos
$headerRange = $ws.Range("A1:G1")
$headerRange.Interior.Color = 0x1F4E78  # Azul escuro
$headerRange.Font.Name = "Montserrat"
$headerRange.Font.Size = 11
$headerRange.Font.Bold = $true
$headerRange.Font.Color = 0xFFFFFF  # Branco
$headerRange.HorizontalAlignment = -4108  # Centro
$headerRange.VerticalAlignment = -4108

# Cabeçalhos
$headers = @("matchId", "Ronda", "Par", "Equipa Casa", "Equipa Fora", "Resultado", "Score (X`&Y)")
for ($i = 0; $i -lt $headers.Count; $i++) {
    $ws.Cells(1, $i + 1) = $headers[$i]
}

# Larguras
$ws.Columns(1).ColumnWidth = 15   # matchId
$ws.Columns(2).ColumnWidth = 10   # Ronda
$ws.Columns(3).ColumnWidth = 8    # Par
$ws.Columns(4).ColumnWidth = 22   # Equipa Casa
$ws.Columns(5).ColumnWidth = 22   # Equipa Fora
$ws.Columns(6).ColumnWidth = 15   # Resultado
$ws.Columns(7).ColumnWidth = 15   # Score

# Popular dados
$row = 2
$idx = 0
foreach ($match in $json.calendar) {
    $matchId = "R$($match.ronda)-$($match.par)-$idx"
    
    # matchId
    $cell = $ws.Cells($row, 1)
    $cell.Value = $matchId
    $cell.Interior.Color = 0xE7E6E6  # Cinza leve
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.Font.Color = 0x595959
    $cell.HorizontalAlignment = -4108
    
    # Ronda
    $cell = $ws.Cells($row, 2)
    $cell.Value = [string]$match.ronda
    $cell.Interior.Color = 0xE7E6E6
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.HorizontalAlignment = -4108
    
    # Par
    $cell = $ws.Cells($row, 3)
    $cell.Value = [string]$match.par
    $cell.Interior.Color = 0xE7E6E6
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.HorizontalAlignment = -4108
    
    # Equipa Casa
    $cell = $ws.Cells($row, 4)
    $cell.Value = $match.home
    $cell.Interior.Color = 0xE7E6E6
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.WrapText = $true
    
    # Equipa Fora
    $cell = $ws.Cells($row, 5)
    $cell.Value = $match.away
    $cell.Interior.Color = 0xE7E6E6
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.WrapText = $true
    
    # Resultado (EDITÁVEL com validação)
    $cell = $ws.Cells($row, 6)
    $cell.Value = ""
    $cell.Interior.Color = 0xFFFFFF  # Branco
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.HorizontalAlignment = -4108
    
    # Score (EDITÁVEL)
    $cell = $ws.Cells($row, 7)
    $cell.Value = ""
    $cell.Interior.Color = 0xFFFFFF
    $cell.Font.Name = "Montserrat"
    $cell.Font.Size = 10
    $cell.HorizontalAlignment = -4108
    
    $row++
    $idx++
}

# Adicionar bordas a TODAS as celulas da tabela
$allCells = $ws.Range("A1:G$($row - 1)")
$allCells.Borders.LineStyle = 1  # xlContinuous
$allCells.Borders.Weight = 2     # xlThin

# Congelar primeira linha
$ws.Application.ActiveWindow.SplitRow = 1
$ws.Application.ActiveWindow.FreezePanes = $true

# Guardar ficheiro Excel
$wbPath = "$(Get-Location)\Calendario_Resultados_IMPORT.xlsx"
$wb.SaveAs($wbPath, 51)  # 51 = xlOpenXMLWorkbook

$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()

Write-Host "`n=== Excel Structure Created ===" -ForegroundColor Green
Write-Host "Ficheiro: Calendario_Resultados_IMPORT.xlsx" -ForegroundColor Green
Write-Host "Total de matches: $($json.calendar.Count)" -ForegroundColor Green
Write-Host "Ficheiros criados:" -ForegroundColor Yellow
Write-Host "  - Calendario_Resultados_IMPORT.xlsx (structure)" -ForegroundColor White
Write-Host "" -ForegroundColor White
Write-Host "Proximo passo: Executar Add-Validation.py para adicionar dropdowns" -ForegroundColor Cyan
Write-Host "  python Add-Validation.py" -ForegroundColor Cyan
