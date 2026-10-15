#!/usr/bin/env bash
# Pull the latest code from GitHub and (re)deploy Ark 2P Hub with Docker Compose.
#
#   ./scripts/deploy.sh                 update the current branch and redeploy if it changed
#   ./scripts/deploy.sh --branch main   switch to / update a specific branch
#   ./scripts/deploy.sh --force         rebuild and restart even if nothing changed
#
# Safe to run from cron, e.g. every 10 minutes:
#   */10 * * * * /opt/Ark-2P-Hub/scripts/deploy.sh >> /var/log/ark-deploy.log 2>&1
set -euo pipefail

BRANCH=""
FORCE=0
PORT="${ARK_PORT:-3000}"
HEALTH_TIMEOUT=60

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  echo "Options: -b|--branch NAME  -f|--force  -p|--port PORT (health check, default 3000)  -h|--help"
}

while [ $# -gt 0 ]; do
  case "$1" in
    -b|--branch) BRANCH="${2:?--branch needs a value}"; shift 2 ;;
    -f|--force) FORCE=1; shift ;;
    -p|--port) PORT="${2:?--port needs a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# Always work from the repo root, wherever the script is called from.
cd "$(dirname "$0")/.."

command -v git >/dev/null || die "git is not installed."
command -v docker >/dev/null || die "docker is not installed."
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null; then
  COMPOSE=(docker-compose)
else
  die "Docker Compose is not installed (need 'docker compose' or 'docker-compose')."
fi
docker info >/dev/null 2>&1 || die "Cannot talk to Docker. Is it running, and is $(whoami) in the 'docker' group?"

# Only one deploy at a time (cron + manual run).
exec 9>"${TMPDIR:-/tmp}/ark-2p-hub-deploy.lock"
if command -v flock >/dev/null; then
  flock -n 9 || die "Another deploy is already running."
fi

# ---- update the code ------------------------------------------------------

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  die "There are uncommitted local changes. Commit or stash them first (git stash)."
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
BRANCH="${BRANCH:-$CURRENT_BRANCH}"
[ "$BRANCH" != "HEAD" ] || die "Detached HEAD. Pass --branch NAME."

BEFORE="$(git rev-parse HEAD)"
log "Fetching origin/$BRANCH…"
git fetch --prune origin "$BRANCH"

if [ "$BRANCH" != "$CURRENT_BRANCH" ]; then
  log "Switching from $CURRENT_BRANCH to $BRANCH"
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH" --track "origin/$BRANCH"
  fi
fi

# Fast-forward only: never silently merge or throw away local commits.
git merge --ff-only "origin/$BRANCH" || die "Local $BRANCH has diverged from origin/$BRANCH. Fix it by hand."
AFTER="$(git rev-parse HEAD)"

running() { [ -n "$("${COMPOSE[@]}" ps -q 2>/dev/null)" ]; }

if [ "$BEFORE" = "$AFTER" ] && [ "$FORCE" -eq 0 ] && running; then
  log "Already up to date ($(git rev-parse --short HEAD)) and running. Nothing to do."
  exit 0
fi

if [ "$BEFORE" != "$AFTER" ]; then
  log "Updated $(git rev-parse --short "$BEFORE") → $(git rev-parse --short "$AFTER"):"
  git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/    /'
fi

# ---- deploy ---------------------------------------------------------------

log "Building and starting containers…"
UP_ARGS=(up -d --build --remove-orphans)
[ "$FORCE" -eq 1 ] && UP_ARGS+=(--force-recreate)
"${COMPOSE[@]}" "${UP_ARGS[@]}"

log "Waiting for http://localhost:$PORT/healthz …"
check() {
  if command -v curl >/dev/null; then curl -fsS "http://localhost:$PORT/healthz" >/dev/null 2>&1
  else wget -qO- "http://localhost:$PORT/healthz" >/dev/null 2>&1
  fi
}
if command -v curl >/dev/null || command -v wget >/dev/null; then
  for _ in $(seq 1 "$HEALTH_TIMEOUT"); do
    if check; then
      log "Ark 2P Hub is up on port $PORT ($(git rev-parse --short HEAD))."
      docker image prune -f >/dev/null || true
      exit 0
    fi
    sleep 1
  done
  "${COMPOSE[@]}" logs --tail 40 >&2 || true
  die "The hub did not become healthy within ${HEALTH_TIMEOUT}s. Logs are above."
else
  log "curl/wget not found; skipping health check."
  "${COMPOSE[@]}" ps
fi
