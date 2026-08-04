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

# ── Encontrar pdftotext (Poppler) ───────────────────────────
function Find-Pdftotext {
    # 1. Tentar diretamente no PATH
    $cmd = Get-Command pdftotext -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # 2. Procurar em locais comuns de instalação (winget, chocolatey, manual)
    $searchPaths = @(
        "$env:ProgramFiles\poppler*\Library\bin\pdftotext.exe",
        "$env:ProgramFiles\poppler*\bin\pdftotext.exe",
        "$env:ProgramFiles (x86)\poppler*\bin\pdftotext.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*oppler*\*\bin\pdftotext.exe",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\*oppler*\*\Library\bin\pdftotext.exe",
        "C:\tools\poppler*\Library\bin\pdftotext.exe",
        "C:\ProgramData\chocolatey\lib\poppler*\tools\pdftotext.exe"
    )
    foreach ($pattern in $searchPaths) {
        $found = Get-Item $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($found) {
            $env:PATH += ";$($found.DirectoryName)"
            Write-Host "  pdftotext encontrado em: $($found.FullName)" -ForegroundColor Green
            return $found.FullName
        }
    }
    return $null
}

# ── Extrair texto de PDF sem ferramentas externas (fallback) ─
# Funciona para PDFs de texto simples (ex: DataGolf)
function Extract-TextFromPdf($pdfPath) {
    $bytes  = [System.IO.File]::ReadAllBytes($pdfPath)
    $latin1 = [System.Text.Encoding]::Latin1.GetString($bytes)

    # Recolher strings entre parênteses dos operadores Tj/TJ (blocos de texto PDF)
    $tokens = [System.Text.RegularExpressions.Regex]::Matches(
        $latin1, '\(([^\)\\]{1,120})\)\s*(?:Tj|TJ)')
    $parts = $tokens | ForEach-Object { $_.Groups[1].Value.Trim() } | Where-Object { $_ -ne '' }

    # Agrupar tokens em linhas — uma nova linha a cada token que começa com dígitos (NFederado)
    $lines = @()
    $cur   = @()
    foreach ($p in $parts) {
        if ($p -match '^\d{2,6}$' -and $cur.Count -gt 0) {
            $lines += $cur -join ' '
            $cur = @($p)
        } else {
            $cur += $p
        }
    }
    if ($cur.Count -gt 0) { $lines += $cur -join ' ' }
    return $lines
}


# ── Ler ficheiro HCP (PDF ou TXT) ───────────────────────────
Write-Host ""
Write-Host "A ler $([System.IO.Path]::GetFileName($hcpPath)) ..." -ForegroundColor Cyan
$hcpMap = @{}   # numeroFederado -> @{ Nome; HcpWhs; Genero }

$ext = [System.IO.Path]::GetExtension($hcpPath).ToLower()

if ($ext -eq '.pdf') {
    # ── Extrair texto do PDF ──────────────────────────────────
    $pdftotextPath = Find-Pdftotext
    $lines = @()

    if ($pdftotextPath) {
        # Método 1: pdftotext (melhor qualidade)
        $tmpTxt = [System.IO.Path]::GetTempFileName()
        try {
            & $pdftotextPath -layout "$hcpPath" "$tmpTxt" 2>$null
            $lines = Get-Content $tmpTxt -Encoding UTF8
        } finally {
            Remove-Item $tmpTxt -ErrorAction SilentlyContinue
        }
        Write-Host "  Extracao via pdftotext." -ForegroundColor DarkGray
    } else {
        # Método 2: extração direta do binário PDF (sem dependências)
        Write-Host "  pdftotext nao encontrado. A usar extracao de texto nativa..." -ForegroundColor Yellow
        $lines = Extract-TextFromPdf $hcpPath
        Write-Host "  Extracao nativa concluida ($($lines.Count) linhas)." -ForegroundColor DarkGray
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
