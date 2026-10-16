#!/usr/bin/env bash
# Pair a Bluetooth game controller with the Pi. Run it once per controller:
#
#   /opt/ark/pair-controller.sh
#
# The controller is also "trusted", so after this it reconnects by itself
# whenever you switch it on.
#
# Pairing mode: Xbox: hold the small pair button on top until the logo flashes
# fast. PlayStation: hold Share (or Create) + PS until the light bar flashes.
# Switch Pro: hold the sync button on top. 8BitDo: see its manual (often Start + X or Y).
#
# Older Xbox controllers that pair but won't connect: run it with --xbox-fix once.
set -euo pipefail

if [ "${1:-}" = "--xbox-fix" ]; then
  echo 'options bluetooth disable_ertm=Y' | sudo tee /etc/modprobe.d/ark-xbox.conf >/dev/null
  echo "Done. Reboot the Pi, then run this script again without --xbox-fix."
  exit 0
fi

command -v bluetoothctl >/dev/null || { echo "bluetoothctl not found: sudo apt install bluez"; exit 1; }

PATTERN='controller|gamepad|xbox|dualsense|dualshock|wireless controller|pro controller|8bitdo|joy-con|joycon|gamesir|stadia'
SCAN="${SCAN_SECONDS:-20}"

bluetoothctl power on >/dev/null
bluetoothctl agent NoInputNoOutput >/dev/null 2>&1 || true
bluetoothctl default-agent >/dev/null 2>&1 || true

echo "Put your controller in pairing mode now. Looking for ${SCAN} seconds…"
bluetoothctl --timeout "$SCAN" scan on >/dev/null 2>&1 || true

mapfile -t FOUND < <(bluetoothctl devices | grep -iE "$PATTERN" || true)
if [ "${#FOUND[@]}" -eq 0 ]; then
  echo "No controller found. Check it's in pairing mode (flashing quickly) and try again."
  echo "Everything nearby that was found:"
  bluetoothctl devices || true
  exit 1
fi

CHOICE=0
if [ "${#FOUND[@]}" -gt 1 ]; then
  echo "Found more than one:"
  for i in "${!FOUND[@]}"; do echo "  $((i + 1))) ${FOUND[$i]#Device }"; done
  read -r -p "Which one? [1-${#FOUND[@]}] " n
  CHOICE=$((n - 1))
fi

MAC="$(echo "${FOUND[$CHOICE]}" | awk '{print $2}')"
NAME="$(echo "${FOUND[$CHOICE]}" | cut -d' ' -f3-)"
echo "Pairing with $NAME ($MAC)…"
bluetoothctl pair "$MAC" || true
bluetoothctl trust "$MAC"
if bluetoothctl connect "$MAC"; then
  echo "✓ $NAME is connected. On the TV, press A on it to join the lobby."
else
  echo "Paired, but it didn't connect yet. Press the controller's home button; it should connect now."
  echo "If it keeps failing on an Xbox controller, try: $0 --xbox-fix"
fi
