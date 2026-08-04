# Instalar ImportExcel se necessario
if (-not (Get-Module -ListAvailable -Name ImportExcel)) {
    Write-Host "A instalar modulo ImportExcel..."
    Install-Module -Name ImportExcel -Force -Scope CurrentUser
}

Import-Module ImportExcel

$calendarioFile = "Calendario_Resultados_IMPORT.xlsx"
$omlFile = "_OML.xlsx"

Write-Host "A ler dados do calendario..."
$sheetName = (Get-ExcelSheetInfo -Path $calendarioFile | Select-Object -First 1).Name
$calendarioData = Import-Excel -Path $calendarioFile -WorksheetName $sheetName

Write-Host "A adicionar sheet ao _OML.xlsx..."
$calendarioData | Export-Excel -Path $omlFile -WorksheetName $sheetName -Append

Write-Host "Concluido! Sheet de calendario adicionada ao _OML.xlsx"
