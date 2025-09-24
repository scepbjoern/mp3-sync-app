# sync-db.ps1
# Synchronize Prisma schema with the runtime SQLite database used by the app.

param(
    [string]$DatabasePath = (Join-Path $env:APPDATA 'mp3-sync-app\mp3-sync-app-sync_data.db')
)

Write-Host "Using database path: $DatabasePath"

$env:DATABASE_URL = "file:$DatabasePath"

npx prisma db push --schema=packages/main/prisma/schema.prisma --skip-generate

$env:DATABASE_URL = $null
