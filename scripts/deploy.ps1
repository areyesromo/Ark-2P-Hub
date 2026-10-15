<#
.SYNOPSIS
  Pull the latest code from GitHub and (re)deploy Ark 2P Hub with Docker Compose.

.EXAMPLE
  .\scripts\deploy.ps1
  Update the current branch and redeploy if it changed.

.EXAMPLE
  .\scripts\deploy.ps1 -Branch main
  Switch to / update a specific branch.

.EXAMPLE
  .\scripts\deploy.ps1 -Force
  Rebuild and restart even if nothing changed.

.NOTES
  If script execution is blocked, run once per session:
    Set-ExecutionPolicy -Scope Process Bypass
  Works with Windows PowerShell 5.1 and PowerShell 7+ (Windows, Linux, macOS).
#>
[CmdletBinding()]
param(
  [string]$Branch = "",
  [switch]$Force,
  [int]$Port = $(if ($env:ARK_PORT) { [int]$env:ARK_PORT } else { 3000 }),
  [int]$HealthTimeoutSeconds = 60
)

# 'Continue' on purpose: in Windows PowerShell 5.1, 'Stop' turns harmless stderr
# output from git/docker (progress, warnings) into fatal errors. Exit codes are
# checked explicitly instead.
$ErrorActionPreference = 'Continue'

function Log([string]$Message) {
  Write-Host ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

function Fail([string]$Message) {
  Write-Host ("[{0}] ERROR: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) -ForegroundColor Red
  exit 1
}

# Run a native command and stop if it fails (PowerShell 5.1 doesn't do this on its own).
function Invoke-Native {
  param([Parameter(Mandatory)][string]$Exe, [string[]]$Arguments = @(), [string]$ErrorMessage = "")
  & $Exe @Arguments
  if ($LASTEXITCODE -ne 0) {
    if (-not $ErrorMessage) { $ErrorMessage = "'$Exe $($Arguments -join ' ')' failed (exit $LASTEXITCODE)." }
    Fail $ErrorMessage
  }
}

# Run a native command and return its trimmed output.
function Get-NativeOutput([string]$Exe, [string[]]$Arguments) {
  $out = & $Exe @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { Fail "'$Exe $($Arguments -join ' ')' failed (exit $LASTEXITCODE)." }
  return ($out | Out-String).Trim()
}

# Always work from the repo root, wherever the script is called from.
Set-Location -ErrorAction Stop (Split-Path -Parent $PSScriptRoot)

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git is not installed." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "docker is not installed." }

& docker compose version *> $null
if ($LASTEXITCODE -eq 0) {
  $ComposeExe = 'docker'; $ComposeBase = @('compose')
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
  $ComposeExe = 'docker-compose'; $ComposeBase = @()
} else {
  Fail "Docker Compose is not installed (need 'docker compose' or 'docker-compose')."
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Cannot talk to Docker. Is Docker Desktop / the Docker service running?" }

function Invoke-Compose([string[]]$Arguments) {
  Invoke-Native -Exe $ComposeExe -Arguments ($ComposeBase + $Arguments)
}

# ---- update the code ------------------------------------------------------

$dirty = Get-NativeOutput git @('status', '--porcelain', '--untracked-files=no')
if ($dirty) { Fail "There are uncommitted local changes. Commit or stash them first (git stash)." }

$CurrentBranch = Get-NativeOutput git @('rev-parse', '--abbrev-ref', 'HEAD')
if (-not $Branch) { $Branch = $CurrentBranch }
if ($Branch -eq 'HEAD') { Fail "Detached HEAD. Pass -Branch NAME." }

$Before = Get-NativeOutput git @('rev-parse', 'HEAD')
Log "Fetching origin/$Branch..."
Invoke-Native git @('fetch', '--prune', 'origin', $Branch)

if ($Branch -ne $CurrentBranch) {
  Log "Switching from $CurrentBranch to $Branch"
  & git show-ref --verify --quiet "refs/heads/$Branch"
  if ($LASTEXITCODE -eq 0) {
    Invoke-Native git @('checkout', $Branch)
  } else {
    Invoke-Native git @('checkout', '-b', $Branch, '--track', "origin/$Branch")
  }
}

# Fast-forward only: never silently merge or throw away local commits.
Invoke-Native -Exe git -Arguments @('merge', '--ff-only', "origin/$Branch") `
  -ErrorMessage "Local $Branch has diverged from origin/$Branch. Fix it by hand."
$After = Get-NativeOutput git @('rev-parse', 'HEAD')

$running = (& $ComposeExe @($ComposeBase + @('ps', '-q')) 2>$null | Out-String).Trim()
if ($Before -eq $After -and -not $Force -and $running) {
  $short = Get-NativeOutput git @('rev-parse', '--short', 'HEAD')
  Log "Already up to date ($short) and running. Nothing to do."
  exit 0
}

if ($Before -ne $After) {
  Log ("Updated {0} -> {1}:" -f $Before.Substring(0, 7), $After.Substring(0, 7))
  & git --no-pager log --oneline "$Before..$After" | ForEach-Object { Write-Host "    $_" }
}

# ---- deploy ---------------------------------------------------------------

Log "Building and starting containers..."
$upArgs = @('up', '-d', '--build', '--remove-orphans')
if ($Force) { $upArgs += '--force-recreate' }
Invoke-Compose $upArgs

$url = "http://localhost:$Port/healthz"
Log "Waiting for $url ..."
$deadline = (Get-Date).AddSeconds($HealthTimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  try {
    $res = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
    if ($res.StatusCode -eq 200) {
      $short = Get-NativeOutput git @('rev-parse', '--short', 'HEAD')
      Log "Ark 2P Hub is up on port $Port ($short)."
      & docker image prune -f *> $null
      exit 0
    }
  } catch {
    # not up yet
  }
  Start-Sleep -Seconds 1
}

& $ComposeExe @($ComposeBase + @('logs', '--tail', '40'))
Fail "The hub did not become healthy within $HealthTimeoutSeconds seconds. Logs are above."
