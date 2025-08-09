param(
  [Parameter(Mandatory=$true)][string]$HostName,
  [Parameter(Mandatory=$true)][string]$User,
  [Parameter(Mandatory=$false)][string]$RemoteDir = "/var/www/fringematrix",
  [Parameter(Mandatory=$false)][string]$AppName = "fringematrix"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# SSH options: fail fast if no key auth, auto-accept new host key
$sshArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new')
$scpArgs = @('-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new')

function New-TempDir {
  $dir = Join-Path $env:TEMP ("fringematrix-" + (Get-Date -Format "yyyyMMddHHmmss"))
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  New-Item $dir -ItemType Directory | Out-Null
  return $dir
}

Write-Host "Building locally..." -ForegroundColor Cyan
npm ci
npm --prefix client ci
npm run build

$temp = New-TempDir
Write-Host "Staging runtime files in $temp" -ForegroundColor Cyan

Copy-Item server.js $temp/
Copy-Item package.json $temp/
Copy-Item package-lock.json $temp/ -ErrorAction SilentlyContinue
Copy-Item data -Destination (Join-Path $temp "data") -Recurse
if (Test-Path avatars) { Copy-Item avatars -Destination (Join-Path $temp "avatars") -Recurse }
New-Item (Join-Path $temp "client") -ItemType Directory | Out-Null
Copy-Item client\dist -Destination (Join-Path $temp "client\dist") -Recurse

$archiveName = "release-" + (Get-Date -Format "yyyyMMddHHmmss") + ".tar.gz"
$archivePath = Join-Path $env:TEMP $archiveName

Push-Location $temp
tar -czf $archivePath *
Pop-Location

Write-Host "Uploading $archiveName to ${User}@${HostName}:${RemoteDir}" -ForegroundColor Cyan
ssh @sshArgs "${User}@${HostName}" "mkdir -p '${RemoteDir}/app'" | Out-Null
scp @scpArgs $archivePath "${User}@${HostName}:${RemoteDir}/" | Out-Null

Write-Host "Deploying remotely..." -ForegroundColor Cyan
$remoteCmd = @"
set -euo pipefail
mkdir -p "$RemoteDir/app"
cd "$RemoteDir/app"
tar -xzf "$RemoteDir/$archiveName"
rm -f "$RemoteDir/$archiveName"
if [ -f package-lock.json ]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
if pm2 list | grep -q "$AppName"; then
  pm2 reload "$AppName"
else
  pm2 start server.js --name "$AppName"
  pm2 save
fi
"@

# Normalize newlines and escape for safe remote execution
$remoteCmd = $remoteCmd -replace "`r", ""
# Send the script via STDIN to avoid quoting issues
$remoteCmd | ssh @sshArgs "${User}@${HostName}" "bash -s -e"

Write-Host "Done. App should be running on port 3000 behind Nginx if configured." -ForegroundColor Green


