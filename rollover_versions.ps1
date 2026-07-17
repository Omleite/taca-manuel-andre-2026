param(
    [string]$WorkspaceRoot = ".",
    [string]$ArchiveFolder = "versioning"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path -Path $WorkspaceRoot
$archivePath = Join-Path -Path $root -ChildPath $ArchiveFolder

if (-not (Test-Path -Path $archivePath)) {
    New-Item -Path $archivePath -ItemType Directory | Out-Null
}

$rolloverMap = @(
    @{ Current = "Expertise-VcsProfiler_V4.2.yaml"; New = "Expertise-VcsProfiler_V4.3.yaml" },
    @{ Current = "NumeracaoNOS v4.1.yaml"; New = "NumeracaoNOS v4.2.yaml" },
    @{ Current = "ServicosIN v1.1.yaml"; New = "ServicosIN v1.2.yaml" }
)

foreach ($entry in $rolloverMap) {
    $currentPath = Join-Path -Path $root -ChildPath $entry.Current
    $newPath = Join-Path -Path $root -ChildPath $entry.New
    $archiveTarget = Join-Path -Path $archivePath -ChildPath $entry.Current

    if (-not (Test-Path -Path $currentPath)) {
        Write-Host "SKIP: current file not found -> $($entry.Current)"
        continue
    }

    Copy-Item -Path $currentPath -Destination $newPath -Force
    Move-Item -Path $currentPath -Destination $archiveTarget -Force

    Write-Host "ROLLED: $($entry.Current) -> $($entry.New) | archived to $ArchiveFolder"
}

Write-Host "Done. Review version metadata/changelog in newly created files."
