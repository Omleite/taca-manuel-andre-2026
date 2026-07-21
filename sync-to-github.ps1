# ============================================================
#  TACA MANUEL ANDRE 2026 - Sincronizar dados com GitHub
#  Uso recomendado: correr no terminal PowerShell
# ============================================================

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false

$projectPath = $PSScriptRoot
$backupFile = Join-Path $projectPath 'data-backup.json'
$downloadsPath = Join-Path $env:USERPROFILE 'Downloads'

function Write-Info([string]$m) { Write-Host $m -ForegroundColor Cyan }
function Write-Ok([string]$m) { Write-Host $m -ForegroundColor Green }
function Write-WarnMsg([string]$m) { Write-Host $m -ForegroundColor Yellow }
function Write-ErrMsg([string]$m) { Write-Host $m -ForegroundColor Red }

function Wait-And-Exit([int]$code) {
    Write-Host ''
    Write-Host 'Pressione qualquer tecla para fechar...'
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit $code
}

function Assert-BackupHasUsers([string]$path) {
    $json = Get-Content $path -Raw | ConvertFrom-Json
    $hasUsers = $false
    if ($json.auth -and $json.auth.users -and $json.auth.users.Count -gt 0) { $hasUsers = $true }
    if ($json.users -and $json.users.Count -gt 0) { $hasUsers = $true }
    if (-not $hasUsers) {
        throw 'Backup sem utilizadores (auth.users/users vazio).'
    }
}

function Get-GitCommand() {
    $gitFromPath = Get-Command git -ErrorAction SilentlyContinue
    if ($gitFromPath) { return 'git' }

    $gitExe = 'C:\Users\oleite\AppData\Local\Programs\Git\cmd\git.exe'
    if (Test-Path $gitExe) { return $gitExe }

    throw 'Git nao encontrado. Instale Git ou ajuste o PATH.'
}

Write-Host ''
Write-Host '=======================================' -ForegroundColor Green
Write-Host '  TACA MANUEL ANDRE - Sync GitHub' -ForegroundColor Green
Write-Host '=======================================' -ForegroundColor Green
Write-Host ''

# 1) Encontrar ultimo ficheiro exportado
$downloadedFile = Get-ChildItem "$downloadsPath\taca-manuel-andre-2026*.json" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($downloadedFile) {
    $fileAge = (Get-Date) - $downloadedFile.LastWriteTime
    Write-Info "Ficheiro encontrado: $($downloadedFile.Name)"
    Write-Info "Exportado ha $([int]$fileAge.TotalMinutes) minutos"
    Write-Host ''

    if ($fileAge.TotalMinutes -ge 30) {
        Write-WarnMsg 'Ficheiro com mais de 30 minutos.'
        Write-WarnMsg 'Sugestao: exportar novamente antes do sync.'
        Write-Host ''
        Write-Host 'Pressione qualquer tecla para continuar, ou Ctrl+C para cancelar...'
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    }

    Copy-Item $downloadedFile.FullName $backupFile -Force
    Write-Ok 'data-backup.json atualizado a partir de Downloads.'
}
else {
    Write-WarnMsg 'Nenhum ficheiro exportado encontrado em Downloads.'
    Write-WarnMsg 'Vou usar data-backup.json existente no projeto.'
}

# 2) Validar backup antes do push
try {
    Assert-BackupHasUsers $backupFile
    Write-Ok 'Validacao OK: backup contem utilizadores.'
}
catch {
    Write-ErrMsg "Erro de validacao: $($_.Exception.Message)"
    Write-WarnMsg 'Exporte novamente em Configuracoes > Exportar Dados e volte a correr o script.'
    Wait-And-Exit 1
}

# 3) Git add/commit/push
Write-Host ''
Write-Info 'A fazer git add/commit/push...'

Push-Location $projectPath
try {
    $git = Get-GitCommand

    & $git add data-backup.json
    if ($LASTEXITCODE -ne 0) { throw 'git add falhou.' }

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
    & $git commit -m "Sincronizar dados [$timestamp]"
    if ($LASTEXITCODE -ne 0) {
        # Sem alteracoes para commitar nao e erro fatal; continuar para push.
        Write-WarnMsg 'git commit sem alteracoes novas (ou outro aviso). Vou tentar push na mesma.'
    }

    & $git push origin master
    if ($LASTEXITCODE -ne 0) { throw 'git push falhou.' }

    Write-Host ''
    Write-Ok 'CONCLUIDO! Dados sincronizados com GitHub.'
    Write-Info 'GitHub Pages atualiza em 1-3 minutos.'
    Write-Info 'URL: https://omleite.github.io/taca-manuel-andre-2026/'
    Wait-And-Exit 0
}
catch {
    Write-Host ''
    Write-ErrMsg "Erro: $($_.Exception.Message)"
    Wait-And-Exit 1
}
finally {
    Pop-Location
}
