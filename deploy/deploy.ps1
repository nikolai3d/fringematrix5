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

Write-Host "Uploading remote deploy script..." -ForegroundColor Cyan
# Ensure LF endings for the shell script before upload
$remoteShLocal = Join-Path $PSScriptRoot 'deploy_remote.sh'
if (-not (Test-Path $remoteShLocal)) { throw "deploy_remote.sh not found at $remoteShLocal" }
$remoteShTemp = Join-Path $env:TEMP "deploy_remote.sh"
$remoteShContent = (Get-Content -Raw -Encoding UTF8 $remoteShLocal) -replace "`r", ""
[System.IO.File]::WriteAllText($remoteShTemp, $remoteShContent, [System.Text.UTF8Encoding]::new($false))

scp @scpArgs $remoteShTemp "${User}@${HostName}:${RemoteDir}/deploy_remote.sh" | Out-Null
ssh @sshArgs "${User}@${HostName}" "chmod +x '${RemoteDir}/deploy_remote.sh'" | Out-Null

Write-Host "Deploying remotely..." -ForegroundColor Cyan
ssh @sshArgs "${User}@${HostName}" "'${RemoteDir}/deploy_remote.sh' '$RemoteDir' '$archiveName' '$AppName'"

Write-Host "Done. App should be running on port 3000 behind Nginx if configured." -ForegroundColor Green


