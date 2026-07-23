# Add Data Validation to Excel file using ZIP/XML manipulation
# This avoids COM objects entirely by directly modifying the XLSX file structure

$xlsxPath = "c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx"
$workingDir = "c:\temp\xlsx_work"

# Create working directory
if (Test-Path $workingDir) { Remove-Item $workingDir -Recurse -Force }
New-Item -ItemType Directory -Path $workingDir | Out-Null

# Extract XLSX (which is a ZIP file)
Write-Host "Extraindo ficheiro Excel..." -ForegroundColor Cyan
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $workingDir)

# Read the worksheet XML
$worksheetPath = "$workingDir\xl\worksheets\sheet1.xml"
$xmlContent = Get-Content $worksheetPath -Raw -Encoding UTF8

# Load as XML
$xml = New-Object System.Xml.XmlDocument
$xml.LoadXml($xmlContent)

# Get namespace
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Find sheetData element
$sheetData = $xml.SelectSingleNode("//sheetData")

# Find maximum row
$maxRow = [int]($sheetData.SelectNodes("row/@r") | Sort-Object -Property "#text" -Descending | Select-Object -First 1).'#text'
Write-Host "Ultima linha: $maxRow" -ForegroundColor Yellow

# Create dataValidations element if it doesn't exist
$dataValidations = $xml.SelectSingleNode("//dataValidations")
if ($null -eq $dataValidations) {
    $dataValidations = $xml.CreateElement("dataValidations", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $dataValidations.SetAttribute("count", "2")
    $sheetData.ParentNode.AppendChild($dataValidations) | Out-Null
} else {
    $dataValidations.SetAttribute("count", "2")
}

# Add validation for Resultado (F2:F$maxRow)
$dv1 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv1.SetAttribute("type", "list")
$dv1.SetAttribute("allowBlank", "1")
$dv1.SetAttribute("showDropDown", "1")
$dv1.SetAttribute("showErrorMessage", "1")
$dv1.SetAttribute("showInputMessage", "0")
$dv1.SetAttribute("error", "Selecione: Vence A, Vence B ou A/S")
$dv1.SetAttribute("errorTitle", "Valor Inválido")
$dv1.SetAttribute("prompt", "")
$dv1.SetAttribute("promptTitle", "")
$dv1.SetAttribute("sqref", "F2:F$maxRow")

$formula1 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula1.InnerText = "`"Vence A,Vence B,A/S`""
$dv1.AppendChild($formula1) | Out-Null

$dataValidations.AppendChild($dv1) | Out-Null
Write-Host "✓ Validacao RESULTADO adicionada (F2:F$maxRow)" -ForegroundColor Green

# Add validation for Score (G2:G$maxRow)
$dv2 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv2.SetAttribute("type", "list")
$dv2.SetAttribute("allowBlank", "1")
$dv2.SetAttribute("showDropDown", "1")
$dv2.SetAttribute("showErrorMessage", "1")
$dv2.SetAttribute("showInputMessage", "0")
$dv2.SetAttribute("error", "Use X`&Y (exemplo: 2`&1)")
$dv2.SetAttribute("errorTitle", "Formato Inválido")
$dv2.SetAttribute("prompt", "")
$dv2.SetAttribute("promptTitle", "")
$dv2.SetAttribute("sqref", "G2:G$maxRow")

$formula2 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula2.InnerText = "`"1`&0,1`&1,1`&2,1`&3,2`&0,2`&1,2`&2,2`&3,3`&0,3`&1,3`&2,3`&3`""
$dv2.AppendChild($formula2) | Out-Null

$dataValidations.AppendChild($dv2) | Out-Null
Write-Host "✓ Validacao SCORE adicionada (G2:G$maxRow)" -ForegroundColor Green

# Save modified XML
$settings = New-Object System.Xml.XmlWriterSettings
$settings.Encoding = [System.Text.Encoding]::UTF8
$settings.Indent = $true
$writer = [System.Xml.XmlWriter]::Create($worksheetPath, $settings)
$xml.WriteTo($writer)
$writer.Close()

Write-Host "✓ Ficheiro XML atualizado" -ForegroundColor Green

# Repackage as XLSX
Write-Host "Recompactando ficheiro..." -ForegroundColor Cyan
Remove-Item $xlsxPath
[System.IO.Compression.ZipFile]::CreateFromDirectory($workingDir, $xlsxPath)

# Cleanup
Remove-Item $workingDir -Recurse -Force

Write-Host "`n=== Sucesso ===" -ForegroundColor Green
Write-Host "Ficheiro atualizado: Calendario_Resultados_IMPORT.xlsx" -ForegroundColor Green
Write-Host "Validacoes adicionadas com sucesso!" -ForegroundColor Green
