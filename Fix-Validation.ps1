# Add Data Validation to Excel file using ZIP XML manipulation
# Corrected version

$xlsxPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx'
$workingDir = 'c:\temp\xlsx_work'

# Create working directory
if (Test-Path $workingDir) { Remove-Item $workingDir -Recurse -Force }
New-Item -ItemType Directory -Path $workingDir | Out-Null

# Extract XLSX (ZIP file)
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($xlsxPath, $workingDir)

# Read worksheet XML
$worksheetPath = "$workingDir\xl\worksheets\sheet1.xml"
$xmlContent = Get-Content $worksheetPath -Raw -Encoding UTF8

# Load as XML
$xml = New-Object System.Xml.XmlDocument
$xml.LoadXml($xmlContent)

# Count total rows to find max row number
$rows = $xml.GetElementsByTagName("row")
$maxRow = 0
foreach ($row in $rows) {
    $r = [int]$row.GetAttribute("r")
    if ($r -gt $maxRow) { $maxRow = $r }
}

Write-Host "Detected max row: $maxRow"

# Create or get dataValidations element
$sheetData = $xml.GetElementsByTagName("sheetData")[0]
$dataValidations = $xml.GetElementsByTagName("dataValidations")

if ($dataValidations.Count -eq 0) {
    $dataValidations = $xml.CreateElement("dataValidations")
    $sheetData.ParentNode.InsertBefore($dataValidations, $sheetData) | Out-Null
} else {
    $dataValidations = $dataValidations[0]
    # Remove existing validations
    while ($dataValidations.HasChildNodes) {
        $dataValidations.RemoveChild($dataValidations.FirstChild) | Out-Null
    }
}

# Add DV1 for Resultado (F2:F$maxRow)
$dv1 = $xml.CreateElement("dataValidation")
$dv1.SetAttribute("type", "list")
$dv1.SetAttribute("allowBlank", "1")
$dv1.SetAttribute("showDropDown", "1")
$dv1.SetAttribute("sqref", "F2:F$maxRow")
$formula1 = $xml.CreateElement("formula1")
$formula1.InnerText = '"Vence A,Vence B,A/S"'
$dv1.AppendChild($formula1) | Out-Null
$dataValidations.AppendChild($dv1) | Out-Null

Write-Host "Added validation F2:F$maxRow"

# Add DV2 for Score (G2:G$maxRow)
$dv2 = $xml.CreateElement("dataValidation")
$dv2.SetAttribute("type", "list")
$dv2.SetAttribute("allowBlank", "1")
$dv2.SetAttribute("showDropDown", "1")
$dv2.SetAttribute("sqref", "G2:G$maxRow")
$formula2 = $xml.CreateElement("formula1")
$formula2.InnerText = '"1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3"'
$dv2.AppendChild($formula2) | Out-Null
$dataValidations.AppendChild($dv2) | Out-Null

Write-Host "Added validation G2:G$maxRow"

# Save XML
$xml.Save($worksheetPath)

# Repackage as XLSX
Remove-Item $xlsxPath
[System.IO.Compression.ZipFile]::CreateFromDirectory($workingDir, $xlsxPath)

# Cleanup
Remove-Item $workingDir -Recurse -Force

Write-Host "Success! File updated with validations." -ForegroundColor Green
