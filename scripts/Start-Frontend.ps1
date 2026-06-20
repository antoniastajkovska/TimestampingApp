# Start-Frontend.ps1 — Run from the repo root: .\scripts\Start-Frontend.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent

# Load .env (SSL_CRT_FILE / SSL_KEY_FILE tell react-scripts which cert to use)
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

Write-Host "Starting frontend on https://localhost:3001 ..." -ForegroundColor Cyan
Set-Location (Join-Path $root "frontend")
npm start
