$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..\").Path
$schemaSource = Join-Path $root "database\schema.sql"
$seedSource = Join-Path $root "database\seed.sql"
$schemaTarget = Join-Path $root "backend\migrations\001_initial_schema.sql"
$seedTarget = Join-Path $root "backend\seeds\001_demo_seed.sql"

if (-not (Test-Path $schemaSource)) {
  throw "Missing source schema file: $schemaSource"
}
if (-not (Test-Path $seedSource)) {
  throw "Missing source seed file: $seedSource"
}

Copy-Item -Path $schemaSource -Destination $schemaTarget -Force
Copy-Item -Path $seedSource -Destination $seedTarget -Force

$schemaSourceHash = (Get-FileHash -Path $schemaSource -Algorithm SHA256).Hash
$schemaTargetHash = (Get-FileHash -Path $schemaTarget -Algorithm SHA256).Hash
$seedSourceHash = (Get-FileHash -Path $seedSource -Algorithm SHA256).Hash
$seedTargetHash = (Get-FileHash -Path $seedTarget -Algorithm SHA256).Hash

if ($schemaSourceHash -ne $schemaTargetHash -or $seedSourceHash -ne $seedTargetHash) {
  throw "SQL sync verification failed. Source and target hashes differ."
}

Write-Host "SQL mirrors synchronized successfully."
Write-Host "schema.sql -> backend/migrations/001_initial_schema.sql"
Write-Host "seed.sql   -> backend/seeds/001_demo_seed.sql"
