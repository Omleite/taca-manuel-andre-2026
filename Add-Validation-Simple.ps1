# Add Data Validation to Excel file using ZIP XML manipulation
# Simplified version without problematic characters

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

# Load as XML with namespace
$xml = New-Object System.Xml.XmlDocument
$xml.LoadXml($xmlContent)

# Add namespace
$ns = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$ns.AddNamespace("main", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

# Find elements with namespace
$sheetData = $xml.SelectSingleNode("//main:sheetData", $ns)
$maxRow = ([int]($sheetData.SelectNodes("main:row/@r", $ns) | Sort-Object -Property '#text' -Descending | Select-Object -First 1).'#text')

# Create or get dataValidations
$dataValidations = $xml.SelectSingleNode("//main:dataValidations", $ns)
if ($null -eq $dataValidations) {
    $dataValidations = $xml.CreateElement("dataValidations", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
    $sheetData.ParentNode.InsertBefore($dataValidations, $sheetData) | Out-Null
}

# Add DV1
$dv1 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv1.SetAttribute("type", "list")
$dv1.SetAttribute("allowBlank", "1")
$dv1.SetAttribute("showDropDown", "1")
$dv1.SetAttribute("sqref", "F2:F$maxRow")
$formula1 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula1.InnerText = '"Vence A,Vence B,A/S"'
$dv1.AppendChild($formula1) | Out-Null
$dataValidations.AppendChild($dv1) | Out-Null

# Add DV2
$dv2 = $xml.CreateElement("dataValidation", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$dv2.SetAttribute("type", "list")
$dv2.SetAttribute("allowBlank", "1")
$dv2.SetAttribute("showDropDown", "1")
$dv2.SetAttribute("sqref", "G2:G$maxRow")
$formula2 = $xml.CreateElement("formula1", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")
$formula2.InnerText = '"1&0,1&1,1&2,1&3,2&0,2&1,2&2,2&3,3&0,3&1,3&2,3&3"'
$dv2.AppendChild($formula2) | Out-Null
$dataValidations.AppendChild($dv2) | Out-Null

# Save XML
$xml.Save($worksheetPath)

# Repackage as XLSX
Remove-Item $xlsxPath
[System.IO.Compression.ZipFile]::CreateFromDirectory($workingDir, $xlsxPath)

# Cleanup
Remove-Item $workingDir -Recurse -Force

Write-Host "Done! Validations added."
