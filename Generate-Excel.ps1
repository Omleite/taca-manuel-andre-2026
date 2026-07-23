# Gera um ficheiro Excel formatado com validação para importação de resultados
# Taça Manuel André 2026 - Estela Golf Club

$ErrorActionPreference = 'Stop'

# Carregar dados
$json = Get-Content 'data-backup.json' -Encoding UTF8 | ConvertFrom-Json

# Criar Excel
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$wb = $excel.Workbooks.Add()
$ws = $wb.Sheets(1)
$ws.Name = "Resultados"

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
$headers = @("matchId", "Ronda", "Par", "Equipa Casa", "Equipa Fora", "Resultado", "Score (X&Y)")
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

# Congelar primeira linha
$ws.Application.ActiveWindow.SplitRow = 1
$ws.Application.ActiveWindow.FreezePanes = $true

# Adicionar sheet com instruções
$instr = $wb.Sheets.Add()
$instr.Name = "Instruções"

$instructions = @(
    "TACA MANUEL ANDRE 2026 - IMPORTACAO DE RESULTADOS"
    ""
    "[INFO] Preenchimento:"
    "1. Preencha APENAS as colunas 'Resultado' e 'Score (X&Y)'"
    "2. As outras colunas sao de REFERENCIA (nao edite)"
    ""
    "[INFO] Valores validos para Resultado:"
    "   - Vence A (Equipa de casa vence)"
    "   - Vence B (Equipa visitante vence)"
    "   - A/S (Empate - All Square)"
    ""
    "[INFO] Formato para Score:"
    "   - X&Y onde X=pontos casa, Y=pontos fora"
    "   - Exemplos: 2&1, 1&0, 3&2"
    ""
    "[INFO] Como exportar para CSV:"
    "   1. Preencha os resultados e scores"
    "   2. Guarde o ficheiro Excel"
    "   3. Execute: Export-CSVDoExcel.ps1 (script incluido)"
    "   4. Importe na app (Admin - Configuracoes)"
)

$irow = 1
foreach ($line in $instructions) {
    $instr.Cells($irow, 1) = $line
    if ($line -like "*[INFO]*" -or $line -like "TACA*") {
        $instr.Cells($irow, 1).Font.Bold = $true
        $instr.Cells($irow, 1).Font.Color = 0x1F4E78
    }
    $instr.Cells($irow, 1).Font.Name = "Montserrat"
    $instr.Columns(1).ColumnWidth = 80
    $irow++
}

# Guardar
$wb.SaveAs("$(Get-Location)\Calendario_Resultados_IMPORT.xlsx")
$excel.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
[GC]::Collect()

Write-Host "Ficheiro Excel criado: Calendario_Resultados_IMPORT.xlsx" -ForegroundColor Green
Write-Host "Total de matches: $($json.calendar.Count)" -ForegroundColor Green
