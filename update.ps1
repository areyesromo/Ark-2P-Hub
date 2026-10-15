# update.ps1 - pull from GitHub, rebuild the image, redeploy the container (Docker Compose).
#
#   .\update.ps1                 pull the current branch, build, redeploy
#   .\update.ps1 -Branch main    switch to (and follow) another branch first
#   .\update.ps1 -Force          recreate the container even if the image didn't change
#
# If Windows blocks the script: Set-ExecutionPolicy -Scope Process Bypass
# Works in Windows PowerShell 5.1 and PowerShell 7 (Windows, Linux, macOS).
[CmdletBinding()]
param(
    [string]$Branch = "",
    [switch]$Force,
    [int]$Port = 3000
)
$ErrorActionPreference = "Stop"

function Info([string]$Msg) { Write-Host $Msg -ForegroundColor Cyan }
function Warn([string]$Msg) { Write-Host $Msg -ForegroundColor Yellow }
function Fail([string]$Msg) { Write-Host $Msg -ForegroundColor Red; exit 1 }

# Windows PowerShell 5.1 turns a native command's redirected stderr into a terminating error under
# $ErrorActionPreference = "Stop", so native commands run with "Continue" and are checked through
# their exit code. Returns @{ Code; Out } with stdout and stderr together, so errors can be shown.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $out = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $prev }
    # (5.1 wraps blank stderr lines as a bare RemoteException; drop those)
    $lines = $out | Where-Object { $_ -and $_ -ne "System.Management.Automation.RemoteException" }
    return @{ Code = $code; Out = ($lines -join "`n").Trim() }
}

# ---- find the repo -----------------------------------------------------------
# Works whether this file sits in the repo root or a subfolder, and from any current directory.

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Fail "git is not installed (https://git-scm.com/download/win)." }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Fail "docker is not installed (Docker Desktop: https://docs.docker.com/desktop/)." }

$r = Invoke-Native git @("-C", $PSScriptRoot, "rev-parse", "--show-toplevel")
if ($r.Code -ne 0) {
    Write-Host $r.Out
    if ($r.Out -match "dubious ownership") {
        Fail ("`nGit doesn't trust this folder because it's owned by a different Windows user " +
              "(e.g. it was cloned as Administrator). Run the 'git config --global --add safe.directory ...' " +
              "command shown above once, then re-run .\update.ps1")
    }
    if ($r.Out -match "not a git repository") {
        Fail ("`nThis folder isn't a git clone (downloaded as a ZIP?). Get it with:`n" +
              "  git clone https://github.com/areyesromo/Ark-2P-Hub.git`n" +
              "then run .\update.ps1 inside the Ark-2P-Hub folder.")
    }
    Fail "`ngit can't read this folder - see the message above."
}
Set-Location $r.Out

$d = Invoke-Native docker @("info")
if ($d.Code -ne 0) { Fail "Docker isn't running (start Docker Desktop / the Docker service), then re-run .\update.ps1" }

if ((Invoke-Native docker @("compose", "version")).Code -eq 0) {
    $ComposeExe = "docker"; $ComposeBase = @("compose")
} elseif (Get-Command docker-compose -ErrorAction SilentlyContinue) {
    $ComposeExe = "docker-compose"; $ComposeBase = @()
} else {
    Fail "Docker Compose is missing (it ships with Docker Desktop)."
}
function Compose([string[]]$Arguments) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    # Out-Host: show compose's output live instead of it becoming part of this function's return value.
    try { & $ComposeExe @($ComposeBase + $Arguments) | Out-Host; $code = $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
    return $code
}

# ---- git pull ----------------------------------------------------------------

Info "== git pull =="
if ($Branch) {
    $f = Invoke-Native git @("fetch", "origin", $Branch)
    if ($f.Code -ne 0) { Write-Host $f.Out; Fail "Couldn't fetch branch '$Branch' from GitHub." }
    $exists = (Invoke-Native git @("show-ref", "--verify", "--quiet", "refs/heads/$Branch")).Code -eq 0
    $c = if ($exists) { Invoke-Native git @("checkout", $Branch) } else { Invoke-Native git @("checkout", "-b", $Branch, "--track", "origin/$Branch") }
    Write-Host $c.Out
    if ($c.Code -ne 0) { Fail "Couldn't switch to '$Branch' (local changes in the way? see above)." }
}

$changes = (Invoke-Native git @("status", "--porcelain", "--untracked-files=no")).Out
if ($changes) {
    Warn "Local changes (git will refuse to pull if they clash with the update):"
    $changes -split "`n" | ForEach-Object { Write-Host "    $_" }
}

# A release checked out by tag/commit (rolling back) isn't on a branch: keep it.
if ((Invoke-Native git @("symbolic-ref", "-q", "HEAD")).Code -eq 0) {
    $before = (Invoke-Native git @("rev-parse", "HEAD")).Out
    $p = Invoke-Native git @("pull", "--ff-only")
    Write-Host $p.Out
    if ($p.Code -ne 0) {
        Warn "Couldn't pull (see above) - deploying the code that's already here."
    } else {
        $after = (Invoke-Native git @("rev-parse", "HEAD")).Out
        if ($before -ne $after) {
            (Invoke-Native git @("--no-pager", "log", "--oneline", "$before..$after")).Out -split "`n" |
                ForEach-Object { Write-Host "    $_" }
        }
    }
} else {
    $at = (Invoke-Native git @("describe", "--tags", "--always")).Out
    Warn "On $at (not a branch) - not pulling. git checkout main to follow updates again."
}

$sha = (Invoke-Native git @("rev-parse", "--short", "HEAD")).Out
if ($changes) { $sha = "$sha+dirty" }
$env:GIT_SHA = $sha
$env:BUILD_TIME = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# ---- build -------------------------------------------------------------------
# A failed build never touches the running container.

Info "== build ark-2p-hub ($sha) =="
if ((Compose @("build", "--pull")) -ne 0) {
    Warn "Build with a fresh base image failed - retrying with the base image already on this machine."
    if ((Compose @("build")) -ne 0) {
        Fail "Build failed - the running container was left as it is. Fix the error above (or try again later) and re-run .\update.ps1"
    }
}

# ---- redeploy ----------------------------------------------------------------

Info "== redeploy =="
$upArgs = @("up", "-d", "--remove-orphans")
if ($Force) { $upArgs += "--force-recreate" }
if ((Compose $upArgs) -ne 0) { Fail "docker compose up failed - see the error above." }

# ---- check -------------------------------------------------------------------

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    try {
        $v = Invoke-RestMethod "http://localhost:$Port/version" -TimeoutSec 3
        # PowerShell 7 parses ISO dates in JSON into DateTime; print it back as ISO.
        if ($v.built -is [datetime]) { $v.built = $v.built.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") }
        Write-Host ("OK - Ark 2P Hub {0} ({1}, built {2}) on http://localhost:{3}/host/" -f $v.version, $v.commit, $v.built, $Port) -ForegroundColor Green
        Invoke-Native docker @("image", "prune", "-f") | Out-Null
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}
Compose @("logs", "--tail", "30") | Out-Null
Fail "Not answering on http://localhost:$Port/version after 60s - logs are above (watch: docker compose logs -f)."
