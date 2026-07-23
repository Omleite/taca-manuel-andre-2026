# Export filled Excel data to CSV
# Uses XML manipulation instead of COM objects

$xlsxPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx'
$csvPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.csv'
$workDir = 'c:\temp\xlsx_export'

Write-Host "Iniciando exportacao para CSV..." -ForegroundColor Cyan

# Verify file exists
if (-not (Test-Path $xlsxPath)) {
    Write-Host "ERRO: Ficheiro nao encontrado: $xlsxPath" -ForegroundColor Red
    exit 1
}

# Clean and create working directory
if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -ItemType Directory -Path $workDir | Out-Null

# Extract XLSX
Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $workDir)
    Write-Host "XLSX extraido" -ForegroundColor Yellow
} catch {
    Write-Host "ERRO ao extrair XLSX: $_" -ForegroundColor Red
    exit 1
}

# Read and parse XML
$xmlPath = "$workDir\xl\worksheets\sheet1.xml"
if (-not (Test-Path $xmlPath)) {
    Write-Host "ERRO: sheet1.xml nao encontrado" -ForegroundColor Red
    exit 1
}

$xml = New-Object System.Xml.XmlDocument
$xml.Load($xmlPath)

# Create namespace manager
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("main", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Get shared strings (for text values)
$stringsXml = New-Object System.Xml.XmlDocument
$stringsXml.Load("$workDir\xl\sharedStrings.xml")
$nsStr = New-Object System.Xml.XmlNamespaceManager($stringsXml.NameTable)
$nsStr.AddNamespace("main", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$strings = @()
foreach ($si in $stringsXml.SelectNodes("//main:si", $nsStr)) {
    $t = $si.SelectSingleNode("main:t", $nsStr)
    if ($t) {
        $strings += $t.InnerText
    }
}

Write-Host "Carregados $($strings.Count) valores compartilhados" -ForegroundColor Yellow

# Function to get cell value
function Get-CellValue {
    param($cell)
    
    $t = $cell.GetAttribute("t")
    $v = $cell.SelectSingleNode("main:v", $ns)
    
    if ($null -eq $v) {
        return ""
    }
    
    $value = $v.InnerText
    
    # If it's a shared string reference
    if ($t -eq "s") {
        return $strings[[int]$value]
    }
    
    return $value
}

# Extract data
$sheetData = $xml.SelectSingleNode("//main:sheetData", $ns)
$rows = $sheetData.SelectNodes("main:row", $ns)

$csvLines = @()
$csvLines += '"matchId","result","score"'

$imported = 0
$skipped = 0

foreach ($row in $rows) {
    $rAttr = $row.GetAttribute("r")
    
    # Skip header (row 1)
    if ($rAttr -eq "1") { continue }
    
    $cells = $row.SelectNodes("main:c", $ns)
    
    $matchId = ""
    $resultado = ""
    $score = ""
    
    # Extract cell values by column (A=matchId, F=resultado, G=score)
    foreach ($cell in $cells) {
        $ref = $cell.GetAttribute("r")
        $col = $ref -replace '\d+', ''  # Extract column letters
        
        $cellValue = Get-CellValue $cell
        
        switch ($col) {
            "A" { $matchId = $cellValue }
            "F" { $resultado = $cellValue }
            "G" { $score = $cellValue }
        }
    }
    
    # Check if both resultado and score are empty
    if ([string]::IsNullOrWhiteSpace($resultado) -and [string]::IsNullOrWhiteSpace($score)) {
        $skipped++
        continue
    }
    
    # Validate resultado
    if (-not [string]::IsNullOrWhiteSpace($resultado)) {
        if ($resultado -notmatch '^(Vence A|Vence B|A/S)$') {
            Write-Host "AVISO Linha $rAttr : Resultado invalido '$resultado' - pulado" -ForegroundColor Yellow
            continue
        }
    }
    
    # Validate score
    if (-not [string]::IsNullOrWhiteSpace($score)) {
        if ($score -notmatch '^\d+&\d+$') {
            Write-Host "AVISO Linha $rAttr : Score invalido '$score' - pulado" -ForegroundColor Yellow
            continue
        }
    }
    
    # Add to CSV (only matchId, result, score)
    $csvLines += "`"$matchId`",`"$resultado`",`"$score`""
    $imported++
}

# Save CSV
$csvLines | Out-File -FilePath $csvPath -Encoding UTF8 -Force
Write-Host "`nCSV exportado com sucesso!" -ForegroundColor Green
Write-Host "Ficheiro: $csvPath" -ForegroundColor Cyan
Write-Host "Linhas importadas: $imported" -ForegroundColor Cyan
Write-Host "Linhas puladas (vazias): $skipped" -ForegroundColor Yellow

# Cleanup
Remove-Item $workDir -Recurse -Force

# Show preview
Write-Host "`nPrimeiras linhas do CSV:" -ForegroundColor Cyan
$csvLines[0..5] | ForEach-Object { Write-Host $_ }
