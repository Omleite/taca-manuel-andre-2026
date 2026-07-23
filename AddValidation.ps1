# Add Data Validation Dropdowns to Excel
# Using ZIP/XML manipulation

$xlsxPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx'
$workDir = 'c:\temp\xlsx_validation'

Write-Host "Iniciando adicao de validacao..." -ForegroundColor Cyan

# Clean and create working directory
if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -ItemType Directory -Path $workDir | Out-Null

# Extract XLSX
Add-Type -AssemblyName System.IO.Compression.FileSystem
try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $workDir)
    Write-Host "XLSX extraido" -ForegroundColor Yellow
} catch {
    Write-Host "ERRO ao extrair: $_" -ForegroundColor Red
    throw
}

# Read and parse XML
$xmlPath = "$workDir\xl\worksheets\sheet1.xml"
$xml = New-Object System.Xml.XmlDocument
$xml.Load($xmlPath)

# Create namespace manager
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("main", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Find sheetData
$sheetData = $xml.SelectSingleNode("//main:sheetData", $ns)

# Count rows to find last data row
$rows = $sheetData.SelectNodes("main:row", $ns)
$maxRow = 0
foreach ($row in $rows) {
    $rAttr = $row.GetAttribute("r")
    if ([int]$rAttr -gt $maxRow) {
        $maxRow = [int]$rAttr
    }
}

Write-Host "Encontradas $($rows.Count) linhas, max row: $maxRow" -ForegroundColor Yellow

# Create dataValidations element
$dvElement = $xml.CreateElement("dataValidations", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# DV1: Resultado (F2:F$maxRow)
$dv1 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv1.SetAttribute("type", "list")
$dv1.SetAttribute("allowBlank", "1")
$dv1.SetAttribute("showDropDown", "1")
$dv1.SetAttribute("sqref", "F2:F$maxRow")

$formula1 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula1.InnerText = '"Vence A,Vence B,A/S"'
$dv1.AppendChild($formula1) | Out-Null

$dvElement.AppendChild($dv1) | Out-Null
Write-Host "Validacao F2:F$maxRow (Resultado)" -ForegroundColor Yellow

# DV2: Score (G2:G$maxRow)
$dv2 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv2.SetAttribute("type", "list")
$dv2.SetAttribute("allowBlank", "1")
$dv2.SetAttribute("showDropDown", "1")
$dv2.SetAttribute("sqref", "G2:G$maxRow")

$formula2 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula2.InnerText = '"1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3"'
$dv2.AppendChild($formula2) | Out-Null

$dvElement.AppendChild($dv2) | Out-Null
Write-Host "Validacao G2:G$maxRow (Score)" -ForegroundColor Yellow

# Insert dataValidations before sheetData
$sheetData.ParentNode.InsertBefore($dvElement, $sheetData) | Out-Null

# Save XML
$xml.Save($xmlPath)
Write-Host "XML atualizado" -ForegroundColor Yellow

# Repackage XLSX
Remove-Item $xlsxPath -ErrorAction SilentlyContinue
[System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $xlsxPath)
Write-Host "XLSX recompactado" -ForegroundColor Yellow

# Cleanup
Remove-Item $workDir -Recurse -Force

Write-Host "`nValidacao adicionada com sucesso!" -ForegroundColor Green
Write-Host "Ficheiro: $xlsxPath" -ForegroundColor Cyan

# Show file size
$fileSize = (Get-Item $xlsxPath).Length
Write-Host "Tamanho: $([Math]::Round($fileSize/1KB, 2)) KB" -ForegroundColor Cyan
