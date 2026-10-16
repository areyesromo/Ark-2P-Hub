#!/usr/bin/env bash
# Update the hub on the Pi (run every 10 minutes by ark-update.timer).
#
# Fetches the newest version (pulls the GHCR image, or pulls the repo and
# builds it in source mode), and restarts the hub only when the version
# changed AND nobody is in the middle of a game. Otherwise the new version
# waits for the next run. FORCE=1 restarts anyway.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")"

PORT="${PORT:-3000}"
CONTAINER=ark-2p-hub

if [ -d repo/.git ]; then
  # Source mode (see install.sh): follow main and rebuild when it moves.
  git -C repo fetch --quiet origin main
  if [ "$(git -C repo rev-parse HEAD)" != "$(git -C repo rev-parse origin/main)" ]; then
    git -C repo merge --ff-only --quiet origin/main
  fi
  GIT_SHA="$(git -C repo rev-parse HEAD)" docker compose build --quiet
else
  docker compose pull --quiet
fi

IMAGE="$(docker compose config --images | head -n 1)"
NEW="$(docker image inspect -f '{{.Id}}' "$IMAGE")"
RUNNING="$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)"
if [ "$NEW" = "$RUNNING" ]; then
  echo "Ark 2P Hub is up to date."
  exit 0
fi

if [ -n "$RUNNING" ] && [ "${FORCE:-0}" != 1 ]; then
  PLAYING="$(curl -fsS --max-time 3 "http://localhost:${PORT}/healthz" 2>/dev/null | sed -n 's/.*"playing":\([0-9]*\).*/\1/p')"
  if [ -n "$PLAYING" ] && [ "$PLAYING" -gt 0 ]; then
    echo "A new version is ready; it installs once nobody is playing ($PLAYING game(s) in progress)."
    exit 0
  fi
fi

docker compose up -d --remove-orphans
docker image prune -f >/dev/null
echo "Ark 2P Hub updated. Screens reload by themselves and the TV keeps its room code."
