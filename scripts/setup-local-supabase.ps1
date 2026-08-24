# Starts local Supabase and writes .env.local for AMG Stores
# Requires Docker Desktop running.

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "Checking Docker..."
docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker is not running. Start Docker Desktop, wait until it is ready, then re-run this script."
}

Write-Host "Starting Supabase (first run may take several minutes)..."
npx supabase start

$statusJson = npx supabase status -o env
# Parse KEY=value lines from supabase status -o env
$envMap = @{}
foreach ($line in ($statusJson -split "`n")) {
  if ($line -match '^\s*([A-Z0-9_]+)=(.*)\s*$') {
    $envMap[$matches[1]] = $matches[2].Trim('"')
  }
}

$apiUrl = $envMap["API_URL"]
if (-not $apiUrl) { $apiUrl = $envMap["NEXT_PUBLIC_SUPABASE_URL"] }
$anonKey = $envMap["ANON_KEY"]
if (-not $anonKey) { $anonKey = $envMap["NEXT_PUBLIC_SUPABASE_ANON_KEY"] }
$serviceKey = $envMap["SERVICE_ROLE_KEY"]
if (-not $serviceKey) { $serviceKey = $envMap["SUPABASE_SERVICE_ROLE_KEY"] }

if (-not $apiUrl -or -not $anonKey) {
  Write-Host "Could not parse keys from 'supabase status -o env'. Printing status for manual copy:"
  npx supabase status
  throw "Failed to write .env.local automatically."
}

@"
NEXT_PUBLIC_SUPABASE_URL=$apiUrl
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anonKey
SUPABASE_SERVICE_ROLE_KEY=$serviceKey
NEXT_PUBLIC_DEMO_MODE=false
"@ | Set-Content -Path ".env.local" -Encoding UTF8

Write-Host ""
Write-Host "Wrote .env.local (demo mode OFF)."
Write-Host "Studio: http://127.0.0.1:54323"
Write-Host "API:    $apiUrl"
Write-Host ""
Write-Host "Create an admin user in Studio (Authentication), then run in SQL editor:"
Write-Host "  update public.profiles set role = 'admin' where id = '<user-uuid>';"
Write-Host ""
Write-Host "Then: npm run dev"
