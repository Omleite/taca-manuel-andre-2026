# Create Excel Template from scratch using XML/ZIP - NO COM objects, NO Excel needed
# Taça Manuel André 2026

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$outPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\Calendario_Resultados_IMPORT.xlsx'
$workDir = 'c:\temp\xlsx_build'
$jsonPath = 'c:\Work\VSCode-Teste\taca-manuel-andre-2026\data-backup.json'

Write-Host "Criando Excel via XML (sem COM objects)..." -ForegroundColor Cyan

# Load data
$json = Get-Content $jsonPath -Encoding UTF8 | ConvertFrom-Json
$matchCount = $json.calendar.Count
Write-Host "Matches carregados: $matchCount" -ForegroundColor Yellow

# Helper: escape XML special chars
function Xml-Escape($s) { $s -replace '&','&amp;' -replace '<','&lt;' -replace '>','&gt;' -replace '"','&quot;' }

# Helper: column index to letter(s)
function Col-Letter($n) {
    $result = ''
    while ($n -gt 0) {
        $n--
        $result = [char](65 + ($n % 26)) + $result
        $n = [math]::Floor($n / 26)
    }
    $result
}

# Prepare work dir
if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -ItemType Directory -Path "$workDir\_rels"              | Out-Null
New-Item -ItemType Directory -Path "$workDir\xl\_rels"           | Out-Null
New-Item -ItemType Directory -Path "$workDir\xl\worksheets"      | Out-Null

# ─── Shared strings ───────────────────────────────────────────
$strings = [System.Collections.Generic.List[string]]::new()
$strIdx  = @{}
function Get-StrIdx($s) {
    if (-not $strIdx.ContainsKey($s)) { $strIdx[$s] = $strings.Count; $strings.Add($s) }
    return $strIdx[$s]
}

$headers = @('matchId','Ronda','Par','Equipa Casa','Equipa Fora','Resultado','Score (X&Y)')
foreach ($h in $headers) { Get-StrIdx $h | Out-Null }

$idx = 0
foreach ($m in $json.calendar) {
    Get-StrIdx "R$($m.ronda)-$($m.par)-$idx" | Out-Null
    Get-StrIdx ([string]$m.ronda)              | Out-Null
    Get-StrIdx ([string]$m.par)               | Out-Null
    Get-StrIdx ($m.home)                       | Out-Null
    Get-StrIdx ($m.away)                       | Out-Null
    $idx++
}

$ssXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n"
$ssXml += "<sst xmlns=`"http://schemas.openxmlformats.org/spreadsheetml/2006/main`" count=`"$($strings.Count)`" uniqueCount=`"$($strings.Count)`">`r`n"
foreach ($s in $strings) { $ssXml += "  <si><t xml:space=`"preserve`">$(Xml-Escape $s)</t></si>`r`n" }
$ssXml += "</sst>"
[System.IO.File]::WriteAllText("$workDir\xl\sharedStrings.xml", $ssXml, [System.Text.Encoding]::UTF8)

# ─── Styles ───────────────────────────────────────────────────
# cellXfs index: 0=normal+border, 1=header(bold white on blue), 2=readonly(gray bg), 3=editable(white bg)
$stylesXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n" + @'
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="11"/><color rgb="FF595959"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE7E6E6"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFB2B2B2"/></left>
      <right style="thin"><color rgb="FFB2B2B2"/></right>
      <top style="thin"><color rgb="FFB2B2B2"/></top>
      <bottom style="thin"><color rgb="FFB2B2B2"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"><alignment horizontal="center" vertical="center"/></xf>
  </cellXfs>
</styleSheet>
'@
[System.IO.File]::WriteAllText("$workDir\xl\styles.xml", $stylesXml, [System.Text.Encoding]::UTF8)

# ─── Sheet1 ───────────────────────────────────────────────────
$lastDataRow = $matchCount + 1

$shXml  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n"
$shXml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + "`r`n"
$shXml += '  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' + "`r`n"
$shXml += '  <sheetFormatPr defaultRowHeight="18"/>' + "`r`n"
$shXml += '  <cols><col min="1" max="1" width="16" customWidth="1"/><col min="2" max="2" width="10" customWidth="1"/><col min="3" max="3" width="8" customWidth="1"/><col min="4" max="5" width="24" customWidth="1"/><col min="6" max="7" width="16" customWidth="1"/></cols>' + "`r`n"
$shXml += '  <sheetData>' + "`r`n"

# Header row (style 1 = blue bold white)
$shXml += '    <row r="1">' + "`r`n"
for ($c = 1; $c -le 7; $c++) {
    $cl = Col-Letter $c
    $si = Get-StrIdx $headers[$c-1]
    $shXml += "      <c r=`"${cl}1`" t=`"s`" s=`"1`"><v>$si</v></c>`r`n"
}
$shXml += '    </row>' + "`r`n"

# Data rows
$rowNum = 2
$idx = 0
foreach ($m in $json.calendar) {
    $matchId = "R$($m.ronda)-$($m.par)-$idx"
    $shXml += "    <row r=`"$rowNum`">`r`n"
    $vals = @($matchId, [string]$m.ronda, [string]$m.par, $m.home, $m.away)
    for ($c = 1; $c -le 5; $c++) {
        $cl = Col-Letter $c
        $si = Get-StrIdx $vals[$c-1]
        $shXml += "      <c r=`"${cl}${rowNum}`" t=`"s`" s=`"2`"><v>$si</v></c>`r`n"
    }
    $shXml += "      <c r=`"F${rowNum}`" s=`"3`"/>`r`n"
    $shXml += "      <c r=`"G${rowNum}`" s=`"3`"/>`r`n"
    $shXml += "    </row>`r`n"
    $rowNum++; $idx++
    if ($idx % 10 -eq 0) { Write-Host "  $idx matches..." -ForegroundColor Gray }
}

$shXml += '  </sheetData>' + "`r`n"
$shXml += "  <dataValidations count=`"2`">`r`n"
$shXml += "    <dataValidation type=`"list`" allowBlank=`"1`" sqref=`"F2:F${lastDataRow}`"><formula1>`"Vence A,Vence B,A/S`"</formula1></dataValidation>`r`n"
$shXml += "    <dataValidation type=`"list`" allowBlank=`"1`" sqref=`"G2:G${lastDataRow}`"><formula1>`"1&amp;0,1&amp;1,1&amp;2,1&amp;3,2&amp;0,2&amp;1,2&amp;2,2&amp;3,3&amp;0,3&amp;1,3&amp;2,3&amp;3`"</formula1></dataValidation>`r`n"
$shXml += "  </dataValidations>`r`n"
$shXml += '</worksheet>'
[System.IO.File]::WriteAllText("$workDir\xl\worksheets\sheet1.xml", $shXml, [System.Text.Encoding]::UTF8)

# ─── workbook.xml ─────────────────────────────────────────────
$wbXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n" + @'
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Calendario" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>
'@
[System.IO.File]::WriteAllText("$workDir\xl\workbook.xml", $wbXml, [System.Text.Encoding]::UTF8)

# ─── Relationships ────────────────────────────────────────────
$rootRel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n" + @'
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText("$workDir\_rels\.rels", $rootRel, [System.Text.Encoding]::UTF8)

$xlRel = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n" + @'
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@
[System.IO.File]::WriteAllText("$workDir\xl\_rels\workbook.xml.rels", $xlRel, [System.Text.Encoding]::UTF8)

# ─── [Content_Types].xml ──────────────────────────────────────
$ctXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + "`r`n" + @'
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>
'@
[System.IO.File]::WriteAllText("$workDir\[Content_Types].xml", $ctXml, [System.Text.Encoding]::UTF8)

# ─── Package into XLSX ────────────────────────────────────────
if (Test-Path $outPath) { Remove-Item $outPath -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($workDir, $outPath)
Remove-Item $workDir -Recurse -Force

$size = [math]::Round((Get-Item $outPath).Length / 1KB, 2)
Write-Host "`nExcel criado com sucesso!" -ForegroundColor Green
Write-Host "Tamanho: $size KB" -ForegroundColor Cyan
Write-Host "Matches: $matchCount + 1 header" -ForegroundColor Cyan
Write-Host "Validacao dropdowns: F2:F${lastDataRow} e G2:G${lastDataRow}" -ForegroundColor Cyan
