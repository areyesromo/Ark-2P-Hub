#!/usr/bin/env bash
# Full-screen TV mode for the Pi: wait for the hub, then open the host screen
# in Chromium kiosk mode. Started from the desktop autostart (see docs/raspberry-pi.md).
set -euo pipefail

URL="${ARK_URL:-http://localhost:3000/host/}"
HEALTH="${URL%/host/}/healthz"

# Wait up to ~2 minutes for the container to come up after boot.
for _ in $(seq 1 60); do
  curl -fsS "$HEALTH" >/dev/null 2>&1 && break
  sleep 2
done

BROWSER="$(command -v chromium || command -v chromium-browser)"

# Chromium remembers a "crashed" state after power cuts; clear it so no restore bar appears.
PREFS="$HOME/.config/chromium/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
fi

exec "$BROWSER" \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  "$URL"
