# ============================================================
#  TAÇA MANUEL ANDRÉ 2026 - Sincronizar dados com GitHub
#  Uso: Clique com o botão direito → "Run with PowerShell"
# ============================================================

$projectPath = $PSScriptRoot
$backupFile  = Join-Path $projectPath "data-backup.json"
$downloadsPath = "$env:USERPROFILE\Downloads"

Write-Host ""
Write-Host "=======================================" -ForegroundColor Green
Write-Host "  TAÇA MANUEL ANDRÉ - Sync GitHub" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green
Write-Host ""

# Verificar se há um ficheiro novo nos Downloads
$downloadedFile = Get-ChildItem "$downloadsPath\taca-manuel-andre-2026*.json" |
                  Sort-Object LastWriteTime -Descending |
                  Select-Object -First 1

if ($downloadedFile) {
    $fileAge = (Get-Date) - $downloadedFile.LastWriteTime
    if ($fileAge.TotalMinutes -lt 30) {
        Write-Host "✓ Ficheiro encontrado: $($downloadedFile.Name)" -ForegroundColor Cyan
        Write-Host "  Exportado há $([int]$fileAge.TotalMinutes) minutos"
        Write-Host ""
        
        # Copiar para o projeto
        Copy-Item $downloadedFile.FullName $backupFile -Force
        Write-Host "✓ data-backup.json atualizado!" -ForegroundColor Green
    } else {
        Write-Host "⚠ Ficheiro encontrado mas tem mais de 30 minutos." -ForegroundColor Yellow
        Write-Host "  Exporte novamente na app antes de sincronizar." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Pressione qualquer tecla para continuar de qualquer forma, ou Ctrl+C para cancelar..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        Copy-Item $downloadedFile.FullName $backupFile -Force
    }
} else {
    Write-Host "ℹ Nenhum ficheiro exportado encontrado nos Downloads." -ForegroundColor Yellow
    Write-Host "  Usando data-backup.json existente no projeto." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "A fazer git commit e push..." -ForegroundColor Cyan

Push-Location $projectPath

try {
    git add data-backup.json
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    git commit -m "Sincronizar dados [$timestamp]" 2>&1
    git push origin master 2>&1
    
    Write-Host ""
    Write-Host "✅ CONCLUÍDO! Dados sincronizados com GitHub." -ForegroundColor Green
    Write-Host ""
    Write-Host "O Netlify vai atualizar o site em 1-2 minutos." -ForegroundColor Cyan
    Write-Host "URL: https://taca-manuel-andre.netlify.app" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "❌ Erro: $_" -ForegroundColor Red
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Pressione qualquer tecla para fechar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
