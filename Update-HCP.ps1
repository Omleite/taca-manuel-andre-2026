# ============================================================
#  Update-HCP.ps1
#  Atualiza nome e handicap dos jogadores no data-backup.json
#  a partir do PDF exportado do DataGolf (Listagem de Handicaps)
#  ou de um ficheiro TXT intermedio (NFederado | Nome | HCP)
#
#  Uso:
#    .\Update-HCP.ps1 -HcpFile "C:\Downloads\ListagemHandicapsEstelaAtual.pdf"
#    .\Update-HCP.ps1 -HcpFile "C:\Downloads\ListagemHandicapsEstelaAtual.pdf" -DryRun
#    .\Update-HCP.ps1 -HcpFile "HCP Atualizado 20260804.txt"   (formato TXT alternativo)
#
#  Requer pdftotext (Poppler) para leitura de PDF.
#  Se nao estiver instalado, o script instala automaticamente via winget.
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$HcpFile,
    [string]$JsonFile = "data-backup.json",
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$hcpPath  = if ([System.IO.Path]::IsPathRooted($HcpFile)) { $HcpFile } else { Join-Path $scriptDir $HcpFile }
$jsonPath = Join-Path $scriptDir $JsonFile

# ── Validar ficheiros ────────────────────────────────────────
if (-not (Test-Path $hcpPath))  { Write-Error "Ficheiro HCP nao encontrado: $hcpPath";  exit 1 }
if (-not (Test-Path $jsonPath)) { Write-Error "Ficheiro JSON nao encontrado: $jsonPath"; exit 1 }

# ── Formula HCP de Campo Estela (WHS oficial) ────────────────
#  Homens   (Amarelas) : CR 71,2 / SR 128 / Par 72
#  Senhoras (Vermelhas): CR 73,7 / SR 126 / Par 72
#  HCP Campo = Round(WHS x SR/113 + (CR - Par))  — max 36
function Get-GameHandicap([double]$whs, [string]$genero) {
    if ($genero -eq 'F') {
        $ph = [Math]::Round($whs * (126.0 / 113.0) + (73.7 - 72.0))
    } else {
        $ph = [Math]::Round($whs * (128.0 / 113.0) + (71.2 - 72.0))
    }
    return [Math]::Min($ph, 36)
}

# ── Garantir pdftotext disponivel ───────────────────────────
function Ensure-Pdftotext {
    if (Get-Command pdftotext -ErrorAction SilentlyContinue) { return }
    Write-Host "  pdftotext nao encontrado. A instalar Poppler via winget..." -ForegroundColor Yellow
    try {
        winget install -e --id Poppler.Poppler --accept-source-agreements --accept-package-agreements | Out-Null
        # Refreshar PATH da sessao
        $env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' +
                    [System.Environment]::GetEnvironmentVariable('PATH','User')
        if (-not (Get-Command pdftotext -ErrorAction SilentlyContinue)) {
            # Tentar encontrar manualmente em locais comuns
            $candidates = @(
                "$env:ProgramFiles\Poppler\Library\bin\pdftotext.exe",
                "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*Poppler*\*\bin\pdftotext.exe"
            )
            foreach ($c in $candidates) {
                $found = Get-Item $c -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($found) {
                    $env:PATH += ";$($found.Directory.FullName)"
                    break
                }
            }
        }
        if (-not (Get-Command pdftotext -ErrorAction SilentlyContinue)) {
            Write-Error "Nao foi possivel localizar pdftotext apos instalacao. Adicione a pasta do Poppler ao PATH e tente novamente."
            exit 1
        }
        Write-Host "  Poppler instalado com sucesso." -ForegroundColor Green
    } catch {
        Write-Error "Falha ao instalar Poppler: $_`nInstale manualmente: https://github.com/oschwartz10612/poppler-windows/releases"
        exit 1
    }
}

# ── Ler ficheiro HCP (PDF ou TXT) ───────────────────────────
Write-Host ""
Write-Host "A ler $([System.IO.Path]::GetFileName($hcpPath)) ..." -ForegroundColor Cyan
$hcpMap = @{}   # numeroFederado -> @{ Nome; HcpWhs; Genero }

$ext = [System.IO.Path]::GetExtension($hcpPath).ToLower()

if ($ext -eq '.pdf') {
    # ── Converter PDF para texto via pdftotext ────────────────
    Ensure-Pdftotext
    $tmpTxt = [System.IO.Path]::GetTempFileName()
    try {
        & pdftotext -layout "$hcpPath" "$tmpTxt" 2>$null
        $lines = Get-Content $tmpTxt -Encoding UTF8
    } finally {
        Remove-Item $tmpTxt -ErrorAction SilentlyContinue
    }

    # Formato DataGolf:
    #  <NFederado> <Nome...> <HCP> <Est.HCP> <Sexo(M/F)> <Est.Fed.> <Escalão>
    # Exemplo: "20363 Abilio Nascimento Ramos    16,0   Válido   M   Activo   Senior"
    $pattern = '^\s*(\d+)\s+(.+?)\s+([\d,]+)\s+(?:Válido|Inválido|Suspenso)\s+(M|F)\s+(?:Activo|Inactivo)'

    foreach ($line in $lines) {
        if ($line -match $pattern) {
            $nfed   = $Matches[1].Trim()
            $nome   = $Matches[2].Trim()
            $hcpStr = $Matches[3].Trim() -replace ',', '.'
            $genero = $Matches[4].Trim()
            $hcp    = 0.0
            if ([double]::TryParse($hcpStr, [System.Globalization.NumberStyles]::Any,
                [System.Globalization.CultureInfo]::InvariantCulture, [ref]$hcp)) {
                $hcpMap[$nfed] = @{ Nome = $nome; HcpWhs = $hcp; Genero = $genero }
            }
        }
    }
} else {
    # ── Ler TXT no formato "NFederado | Nome | HCP" ──────────
    Get-Content $hcpPath -Encoding UTF8 | Select-Object -Skip 1 | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq '') { return }
        $parts = $line -split '\|'
        if ($parts.Count -lt 3) { return }
        $nfed   = $parts[0].Trim()
        $nome   = $parts[1].Trim()
        $hcpStr = $parts[2].Trim() -replace ',', '.'
        $hcp    = 0.0
        if ([double]::TryParse($hcpStr, [System.Globalization.NumberStyles]::Any,
            [System.Globalization.CultureInfo]::InvariantCulture, [ref]$hcp)) {
            $hcpMap[$nfed] = @{ Nome = $nome; HcpWhs = $hcp; Genero = $null }
        }
    }
}

Write-Host "  $($hcpMap.Count) jogadores carregados." -ForegroundColor Yellow

# ── Ler data-backup.json ─────────────────────────────────────
Write-Host "A ler $JsonFile ..." -ForegroundColor Cyan
$jsonRaw = Get-Content $jsonPath -Encoding UTF8 -Raw
$json    = $jsonRaw | ConvertFrom-Json

$updated  = 0
$notFound = 0
$changes  = @()

# ── Cruzar e atualizar ───────────────────────────────────────
foreach ($player in $json.players) {
    $nfed = "$($player.numeroFederado)".Trim()

    if ($hcpMap.ContainsKey($nfed)) {
        $entry      = $hcpMap[$nfed]
        $newWhs     = $entry.HcpWhs
        $newNome    = $entry.Nome
        # Se o PDF incluiu o genero, usa-o; caso contrario mantem o do JSON
        $genero     = if ($entry.Genero) { $entry.Genero } elseif ($player.genero) { $player.genero } else { 'M' }
        $newHcpCampo = Get-GameHandicap $newWhs $genero

        $oldWhs  = $player.handicapWhs
        $oldHcp  = $player.handicap
        $oldNome = $player.name

        # Comparar com tolerancia para floats
        $whsChanged  = ([Math]::Abs([double]$oldWhs - $newWhs) -gt 0.001)
        $hcpChanged  = ($oldHcp -ne $newHcpCampo)
        $nomeChanged = ($oldNome -ne $newNome)

        if ($whsChanged -or $hcpChanged -or $nomeChanged) {
            $changes += [PSCustomObject]@{
                NFederado  = $nfed
                NomeAntes  = $oldNome
                NomeDepois = $newNome
                WhsAntes   = $oldWhs
                WhsDepois  = $newWhs
                HcpAntes   = $oldHcp
                HcpDepois  = $newHcpCampo
            }

            if (-not $DryRun) {
                $player.name        = $newNome
                $player.handicapWhs = $newWhs
                $player.handicap    = $newHcpCampo
            }
            $updated++
        }
    } else {
        $notFound++
        Write-Host "  [AVISO] N $nfed ($($player.name)) nao encontrado no ficheiro HCP." -ForegroundColor DarkYellow
    }
}

# ── Mostrar alteracoes ───────────────────────────────────────
if ($changes.Count -gt 0) {
    Write-Host ""
    Write-Host "Alteracoes detetadas:" -ForegroundColor Green
    foreach ($c in $changes) {
        $parts = @()
        if ($c.NomeAntes -ne $c.NomeDepois) { $parts += "Nome: '$($c.NomeAntes)' -> '$($c.NomeDepois)'" }
        if ([Math]::Abs([double]$c.WhsAntes - $c.WhsDepois) -gt 0.001) {
            $parts += "WHS: $($c.WhsAntes) -> $($c.WhsDepois)"
        }
        if ($c.HcpAntes -ne $c.HcpDepois)  { $parts += "HCP Campo: $($c.HcpAntes) -> $($c.HcpDepois)" }
        Write-Host "  [$($c.NFederado)] $($parts -join ' | ')" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "Nenhuma alteracao necessaria - dados ja atualizados." -ForegroundColor Green
}

# ── Gravar JSON ──────────────────────────────────────────────
if (-not $DryRun -and $updated -gt 0) {
    $jsonOut = $json | ConvertTo-Json -Depth 20
    # UTF-8 sem BOM
    [System.IO.File]::WriteAllText($jsonPath, $jsonOut, [System.Text.UTF8Encoding]::new($false))
    Write-Host ""
    Write-Host "Ficheiro $JsonFile atualizado com sucesso." -ForegroundColor Green
} elseif ($DryRun) {
    Write-Host ""
    Write-Host "[DRY RUN] Nenhum ficheiro foi alterado." -ForegroundColor Magenta
}

# ── Resumo ───────────────────────────────────────────────────
Write-Host ""
Write-Host "=== RESUMO ===" -ForegroundColor Cyan
Write-Host "  Jogadores atualizados : $updated" -ForegroundColor $(if ($updated -gt 0) { 'Green' } else { 'White' })
Write-Host "  Nao encontrados no HCP: $notFound" -ForegroundColor $(if ($notFound -gt 0) { 'Yellow' } else { 'White' })
Write-Host "  Total no JSON          : $($json.players.Count)" -ForegroundColor White
Write-Host ""
