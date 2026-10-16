#!/usr/bin/env bash
# Full-screen TV mode for the Pi: wait for the hub, then show the TV screen in
# Chromium kiosk mode, and bring it back if it ever closes or crashes.
# Started at login by the desktop's autostart (install.sh sets that up).
#
# To get to the desktop: run `touch ~/.ark-kiosk-stop`, then press Alt+F4.
# Delete that file (or reboot after deleting it) to go back to kiosk mode.
set -uo pipefail

URL="${ARK_URL:-http://localhost:3000/host/}"
HEALTH="${URL%/host/}/healthz"
STOP="$HOME/.ark-kiosk-stop"
BROWSER="$(command -v chromium || command -v chromium-browser)"
PREFS="$HOME/.config/chromium/Default/Preferences"

rm -f "$STOP"

while true; do
  # Wait for the hub (up to ~2 minutes after boot or an update).
  for _ in $(seq 1 60); do
    curl -fsS "$HEALTH" >/dev/null 2>&1 && break
    sleep 2
  done

  # Chromium remembers a "crashed" state after power cuts; clear it so no restore bar appears.
  if [ -f "$PREFS" ]; then
    sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"[^"]*"/"exit_type":"Normal"/' "$PREFS"
  fi

  "$BROWSER" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-features=Translate \
    --overscroll-history-navigation=0 \
    --password-store=basic \
    --check-for-update-interval=31536000 \
    --autoplay-policy=no-user-gesture-required \
    "$URL"

  [ -f "$STOP" ] && exit 0
  sleep 3
done
