# Create Excel Template for Taca Manuel Andre 2026
# Simple and robust version

$ErrorActionPreference = 'Stop'

Write-Host "Iniciando criacao do Excel..." -ForegroundColor Cyan

# Load data
$json = Get-Content 'data-backup.json' -Encoding UTF8 | ConvertFrom-Json
$matchCount = $json.calendar.Count
Write-Host "Total de matches: $matchCount" -ForegroundColor Yellow

# Create Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets(1)
$ws.Name = "Calendario"

Write-Host "Workbook criado" -ForegroundColor Yellow

# Format header row
$ws.Cells(1,1) = "matchId"
$ws.Cells(1,2) = "Ronda"
$ws.Cells(1,3) = "Par"
$ws.Cells(1,4) = "Equipa Casa"
$ws.Cells(1,5) = "Equipa Fora"
$ws.Cells(1,6) = "Resultado"
$ws.Cells(1,7) = "Score (X&Y)"

# Style header
$headerRange = $ws.Range("A1:G1")
$headerRange.Interior.Color = 0x1F4E78
$headerRange.Font.Bold = $true
$headerRange.Font.Color = 0xFFFFFF
$headerRange.Font.Size = 11
$headerRange.HorizontalAlignment = -4108

# Set column widths
$ws.Columns(1).ColumnWidth = 15
$ws.Columns(2).ColumnWidth = 10
$ws.Columns(3).ColumnWidth = 8
$ws.Columns(4).ColumnWidth = 22
$ws.Columns(5).ColumnWidth = 22
$ws.Columns(6).ColumnWidth = 15
$ws.Columns(7).ColumnWidth = 15

Write-Host "Header formatado" -ForegroundColor Yellow

# Add data rows
$row = 2
$idx = 0
foreach ($match in $json.calendar) {
    $matchId = "R$($match.ronda)-$($match.par)-$idx"
    
    # Set values
    $ws.Cells($row, 1) = $matchId
    $ws.Cells($row, 2) = [string]$match.ronda
    $ws.Cells($row, 3) = [string]$match.par
    $ws.Cells($row, 4) = $match.home
    $ws.Cells($row, 5) = $match.away
    $ws.Cells($row, 6) = ""
    $ws.Cells($row, 7) = ""
    
    # Style read-only cells (gray)
    for ($col = 1; $col -le 5; $col++) {
        $cell = $ws.Cells($row, $col)
        $cell.Interior.Color = 0xE7E6E6
        $cell.Font.Color = 0x595959
        $cell.HorizontalAlignment = -4108
    }
    
    # Style editable cells (white)
    for ($col = 6; $col -le 7; $col++) {
        $cell = $ws.Cells($row, $col)
        $cell.Interior.Color = 0xFFFFFF
        $cell.HorizontalAlignment = -4108
    }
    
    $row++
    $idx++
    
    if ($idx % 10 -eq 0) {
        Write-Host "  Adicionados $idx matches..." -ForegroundColor Gray
    }
}

Write-Host "Dados adicionados: $idx matches" -ForegroundColor Yellow

# Add borders
$lastRow = $row - 1
$allCells = $ws.Range("A1:G$lastRow")
$allCells.Borders.LineStyle = 1
$allCells.Borders.Weight = 2

Write-Host "Bordas aplicadas" -ForegroundColor Yellow

# Freeze first row
$ws.Application.ActiveWindow.SplitRow = 1
$ws.Application.ActiveWindow.FreezePanes = $true

Write-Host "Primeira linha congelada" -ForegroundColor Yellow

# Save to file
$outPath = "$(Get-Location)\Calendario_Resultados_IMPORT.xlsx"
Write-Host "Guardando em: $outPath" -ForegroundColor Cyan

try {
    $wb.SaveAs($outPath, 51)  # 51 = xlOpenXMLWorkbook
    Write-Host "Ficheiro guardado com sucesso" -ForegroundColor Green
} catch {
    Write-Host "ERRO ao guardar: $_" -ForegroundColor Red
    throw
}

# Close Excel
$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()

Write-Host "`nExcel criado com sucesso!" -ForegroundColor Green
Write-Host "Ficheiro: Calendario_Resultados_IMPORT.xlsx" -ForegroundColor Cyan
Write-Host "Matches: $matchCount" -ForegroundColor Cyan
