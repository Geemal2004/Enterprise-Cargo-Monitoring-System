$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\\..").Path

Write-Host "Starting backend and frontend in local dev mode..."
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$root\\backend'; npm run dev"
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "Set-Location '$root\\frontend'; npm run dev"

Write-Host "Backend and frontend started in separate terminals."
