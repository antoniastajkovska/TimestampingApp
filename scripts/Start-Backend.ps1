# Start-Backend.ps1 — Run from the repo root: .\scripts\Start-Backend.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# Load .env
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
    Write-Error ".env not found. Copy .env.example to .env first."
    exit 1
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), 'Process')
}

Write-Host "Starting backend on https://localhost:8443 ..." -ForegroundColor Cyan
Set-Location (Join-Path $root "backend")
& ".\mvnw.cmd" spring-boot:run
