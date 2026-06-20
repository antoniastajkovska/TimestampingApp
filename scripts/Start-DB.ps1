# Start-DB.ps1 — Run from the repo root: .\scripts\Start-DB.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
Write-Host "Starting PostgreSQL via Docker Compose..." -ForegroundColor Cyan
docker compose up -d
Write-Host "Database ready on localhost:5432" -ForegroundColor Green
