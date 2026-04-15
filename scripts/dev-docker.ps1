$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\\..").Path
Set-Location $root

Write-Host "Starting docker compose stack (backend + frontend)..."
docker compose up --build
