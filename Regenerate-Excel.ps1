# Regenerate Excel with proper data + validation
# Simple and robust version

$ErrorActionPreference = 'Stop'

# Load data
$json = Get-Content 'data-backup.json' -Encoding UTF8 | ConvertFrom-Json

# Create Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets(1)
$ws.Name = "Calendario"

# Header styling
$headerRange = $ws.Range("A1:G1")
$headerRange.Interior.Color = 0x1F4E78
$headerRange.Font.Name = "Montserrat"
$headerRange.Font.Size = 11
$headerRange.Font.Bold = $true
$headerRange.Font.Color = 0xFFFFFF
$headerRange.HorizontalAlignment = -4108
$headerRange.VerticalAlignment = -4108

# Headers
$headers = @("matchId", "Ronda", "Par", "Equipa Casa", "Equipa Fora", "Resultado", "Score (X`&Y)")
for ($i = 0; $i -lt $headers.Count; $i++) {
    $ws.Cells(1, $i + 1) = $headers[$i]
}

# Column widths
$ws.Columns(1).ColumnWidth = 15
$ws.Columns(2).ColumnWidth = 10
$ws.Columns(3).ColumnWidth = 8
$ws.Columns(4).ColumnWidth = 22
$ws.Columns(5).ColumnWidth = 22
$ws.Columns(6).ColumnWidth = 15
$ws.Columns(7).ColumnWidth = 15

# Populate data
$row = 2
foreach ($match in $json.calendar) {
    $matchId = "R$($match.ronda)-$($match.par)-$($row-2)"
    
    # matchId
    $cell = $ws.Cells($row, 1)
    $cell.Value = $matchId
    $cell.Interior.Color = 0xE7E6E6
    $cell.Font.Color = 0x595959
    $cell.HorizontalAlignment = -4108
    
    # Ronda
    $cell = $ws.Cells($row, 2)
    $cell.Value = [string]$match.ronda
    $cell.Interior.Color = 0xE7E6E6
    $cell.HorizontalAlignment = -4108
    
    # Par
    $cell = $ws.Cells($row, 3)
    $cell.Value = [string]$match.par
    $cell.Interior.Color = 0xE7E6E6
    $cell.HorizontalAlignment = -4108
    
    # Home
    $cell = $ws.Cells($row, 4)
    $cell.Value = $match.home
    $cell.Interior.Color = 0xE7E6E6
    
    # Away
    $cell = $ws.Cells($row, 5)
    $cell.Value = $match.away
    $cell.Interior.Color = 0xE7E6E6
    
    # Resultado (empty, white)
    $cell = $ws.Cells($row, 6)
    $cell.Interior.Color = 0xFFFFFF
    $cell.HorizontalAlignment = -4108
    
    # Score (empty, white)
    $cell = $ws.Cells($row, 7)
    $cell.Interior.Color = 0xFFFFFF
    $cell.HorizontalAlignment = -4108
    
    $row++
}

# Apply borders to all cells
$lastRow = $row - 1
$allCells = $ws.Range("A1:G$lastRow")
$allCells.Borders.LineStyle = 1
$allCells.Borders.Weight = 2

# Freeze first row
$ws.Application.ActiveWindow.SplitRow = 1
$ws.Application.ActiveWindow.FreezePanes = $true

# Save
$wbPath = "$(Get-Location)\Calendario_Resultados_IMPORT.xlsx"
$wb.SaveAs($wbPath, 51)

$excel.Quit()
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()

Write-Host "Excel criado: Calendario_Resultados_IMPORT.xlsx" -ForegroundColor Green
Write-Host "Total de matches: $($json.calendar.Count)" -ForegroundColor Green
