# sync-db.ps1
# Synchronize Prisma schema with the runtime SQLite database used by the app.

param(
    [string]$DatabasePath = (Join-Path $env:APPDATA 'MP3 Sync App\mp3-sync-app-sync_data.db')
)

Write-Host "Using database path: $DatabasePath"

$dir = [System.IO.Path]::GetDirectoryName($DatabasePath)
if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$env:DATABASE_URL = "file:$DatabasePath"

npx prisma db push --schema=packages/main/prisma/schema.prisma --skip-generate

$env:DATABASE_URL = $null
