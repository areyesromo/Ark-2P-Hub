#!/bin/sh
# update.sh - pull from GitHub, rebuild the image, redeploy the container (Docker Compose).
#
#   ./update.sh                 pull the current branch, build, redeploy
#   ./update.sh --branch main   switch to (and follow) another branch first
#   ./update.sh --force         recreate the container even if the image didn't change
#
# Linux / macOS / Raspberry Pi. Safe to run from cron:
#   */10 * * * * /opt/Ark-2P-Hub/update.sh >> /var/log/ark-update.log 2>&1
set -eu

BRANCH=""
FORCE=""
PORT="${ARK_PORT:-3000}"

while [ $# -gt 0 ]; do
  case "$1" in
    -b|--branch) BRANCH="${2:?--branch needs a name}"; shift 2 ;;
    -f|--force) FORCE=1; shift ;;
    -p|--port) PORT="${2:?--port needs a number}"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
done

fail() { echo "$*" >&2; exit 1; }

# ---- find the repo -----------------------------------------------------------
# Works whether this file sits in the repo root or a subfolder, and from any current directory.

command -v git >/dev/null 2>&1 || fail "git is not installed."
command -v docker >/dev/null 2>&1 || fail "docker is not installed (curl -fsSL https://get.docker.com | sh)."

HERE="$(cd "$(dirname "$0")" && pwd)"
if ! TOP="$(git -C "$HERE" rev-parse --show-toplevel 2>&1)"; then
  echo "$TOP" >&2
  case "$TOP" in
    *"dubious ownership"*)
      fail "
Git doesn't trust this folder because it's owned by a different user (e.g. cloned with sudo).
Run the 'git config --global --add safe.directory ...' command shown above once, or
sudo chown -R \"\$(whoami)\" \"$HERE\", then re-run ./update.sh" ;;
    *"not a git repository"*)
      fail "
This folder isn't a git clone (downloaded as a ZIP?). Get it with:
  git clone https://github.com/areyesromo/Ark-2P-Hub.git
then run ./update.sh inside the Ark-2P-Hub folder." ;;
    *) fail "
git can't read this folder - see the message above." ;;
  esac
fi
cd "$TOP"

docker info >/dev/null 2>&1 || fail "Can't talk to Docker. Is it running, and is $(whoami) in the 'docker' group? (sudo usermod -aG docker $(whoami), then log in again)"

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  compose() { docker-compose "$@"; }
else
  fail "Docker Compose is missing (sudo apt install docker-compose-plugin)."
fi

# ---- git pull ----------------------------------------------------------------

echo "== git pull =="
if [ -n "$BRANCH" ]; then
  git fetch origin "$BRANCH" || fail "Couldn't fetch branch '$BRANCH' from GitHub."
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH" || fail "Couldn't switch to '$BRANCH' (local changes in the way? see above)."
  else
    git checkout -b "$BRANCH" --track "origin/$BRANCH" || fail "Couldn't switch to '$BRANCH'."
  fi
fi

CHANGES="$(git status --porcelain --untracked-files=no)"
if [ -n "$CHANGES" ]; then
  echo "Local changes (git will refuse to pull if they clash with the update):"
  echo "$CHANGES" | sed 's/^/    /'
fi

# A release checked out by tag/commit (rolling back) isn't on a branch: keep it.
if git symbolic-ref -q HEAD >/dev/null; then
  BEFORE="$(git rev-parse HEAD)"
  if git pull --ff-only; then
    AFTER="$(git rev-parse HEAD)"
    [ "$BEFORE" = "$AFTER" ] || git --no-pager log --oneline "$BEFORE..$AFTER" | sed 's/^/    /'
  else
    echo "Couldn't pull (see above) - deploying the code that's already here."
  fi
else
  echo "On $(git describe --tags --always) (not a branch) - not pulling. git checkout main to follow updates again."
fi

SHA="$(git rev-parse --short HEAD)"
[ -z "$CHANGES" ] || SHA="${SHA}+dirty"
GIT_SHA="$SHA"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export GIT_SHA BUILD_TIME

# ---- build -------------------------------------------------------------------
# A failed build never touches the running container.

echo "== build ark-2p-hub ($SHA) =="
if ! compose build --pull; then
  echo "Build with a fresh base image failed - retrying with the base image already on this machine."
  compose build || fail "Build failed - the running container was left as it is. Fix the error above (or try again later) and re-run ./update.sh"
fi

# ---- redeploy ----------------------------------------------------------------

echo "== redeploy =="
if [ -n "$FORCE" ]; then
  compose up -d --remove-orphans --force-recreate || fail "docker compose up failed - see the error above."
else
  compose up -d --remove-orphans || fail "docker compose up failed - see the error above."
fi

# ---- check -------------------------------------------------------------------

fetch() {
  if command -v curl >/dev/null 2>&1; then curl -fsS "$1" 2>/dev/null; else wget -qO- "$1" 2>/dev/null; fi
}
i=0
while [ "$i" -lt 60 ]; do
  if V="$(fetch "http://localhost:$PORT/version")"; then
    echo "OK - Ark 2P Hub $V on http://localhost:$PORT/host/"
    docker image prune -f >/dev/null 2>&1 || true
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
compose logs --tail 30 || true
fail "Not answering on http://localhost:$PORT/version after 60s - logs are above (watch: docker compose logs -f)."
