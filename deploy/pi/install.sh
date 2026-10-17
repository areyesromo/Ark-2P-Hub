#!/usr/bin/env bash
# One-command setup that turns a Raspberry Pi 4/5 into an Ark 2P Hub console:
# it runs the hub, shows the TV screen full-screen at boot, and updates itself
# from GitHub. Run it as your normal user on Raspberry Pi OS (64-bit) with desktop:
#
#   curl -fsSL https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/install.sh | bash
#
# Safe to run again (to repair or update the setup). Options, as environment variables:
#   ARK_DIR=/opt/ark     where the hub lives
#   ARK_SOURCE=1         build from source instead of pulling the prebuilt image
#   ARK_NO_KIOSK=1       just the server (no TV screen on this Pi)
#   ADMIN_PASSWORD=...   set the /admin/ password (otherwise create it at /admin/)
#   PUBLIC_URL=...       fix the address phones use, e.g. http://192.168.1.50:3000
set -euo pipefail

REPO="areyesromo/Ark-2P-Hub"
RAW="https://raw.githubusercontent.com/$REPO/main/deploy/pi"
IMAGE="ghcr.io/areyesromo/ark-2p-hub:latest"
DIR="${ARK_DIR:-/opt/ark}"
DRY="${ARK_DRY_RUN:-0}" # 1: print the system changes instead of making them (used by the tests)
FILES="docker-compose.yml docker-compose.source.yml ark-update.sh ark-update.service ark-update.timer kiosk.sh pair-controller.sh"
# Run from a clone (deploy/pi/install.sh): use the files next to it. Piped from curl: download them.
HERE=""
if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; fi

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
say() { printf '    %s\n' "$*"; }
die() { printf '\n\033[1;31mError: %s\033[0m\n' "$*" >&2; exit 1; }
# System changes go through run, so a dry run can show them without doing them.
run() { if [ "$DRY" = 1 ]; then printf '    + %s\n' "$*"; else "$@"; fi; }

[ "$DRY" = 1 ] || [ "$(id -u)" -ne 0 ] || die "Run this as your normal user (not with sudo); it asks for sudo when it needs it."
ME="$(id -un)"

# ---- 1. Docker -----------------------------------------------------------------
step "Docker"
DOCKER="docker" # may become "sudo docker" below, so it's used unquoted on purpose
if command -v docker >/dev/null 2>&1; then
  say "Already installed."
else
  say "Installing Docker (takes a few minutes)…"
  run sh -c "curl -fsSL https://get.docker.com | sh"
fi
if ! id -nG "$ME" | grep -qw docker; then
  run sudo usermod -aG docker "$ME"
  DOCKER="sudo docker" # the new group only applies after logging in again
fi

# ---- 2. Files ------------------------------------------------------------------
step "Files in $DIR"
run sudo mkdir -p "$DIR"
run sudo chown "$ME" "$DIR"
for f in $FILES; do
  if [ -n "$HERE" ] && [ -f "$HERE/$f" ] && [ "$HERE" != "$DIR" ]; then
    run cp "$HERE/$f" "$DIR/$f" # running from a clone: use its copies
  elif [ "$HERE" != "$DIR" ]; then
    run curl -fsSL -o "$DIR/$f" "$RAW/$f"
  fi
done
run chmod +x "$DIR/ark-update.sh" "$DIR/kiosk.sh" "$DIR/pair-controller.sh"

# ---- 3. Image or source --------------------------------------------------------
step "Getting the hub"
ENV_LINES=()
# shellcheck disable=SC2086
if [ "${ARK_SOURCE:-0}" != 1 ] && run $DOCKER pull "$IMAGE"; then
  say "Using the prebuilt image from GitHub."
else
  say "Building from source instead (the image couldn't be pulled, or ARK_SOURCE=1)."
  command -v git >/dev/null 2>&1 || run sudo apt-get install -y git
  if [ -d "$DIR/repo/.git" ]; then
    run git -C "$DIR/repo" pull --ff-only --quiet
  else
    run git clone --depth 50 "https://github.com/$REPO.git" "$DIR/repo"
  fi
  ENV_LINES+=("COMPOSE_FILE=docker-compose.source.yml")
fi
[ -n "${ADMIN_PASSWORD:-}" ] && ENV_LINES+=("ADMIN_PASSWORD=$ADMIN_PASSWORD")
[ -n "${PUBLIC_URL:-}" ] && ENV_LINES+=("PUBLIC_URL=$PUBLIC_URL")
if [ "$DRY" = 1 ]; then
  say "+ write $DIR/.env (${#ENV_LINES[@]} setting(s))"
else
  printf '%s\n' "${ENV_LINES[@]+"${ENV_LINES[@]}"}" >"$DIR/.env"
fi

# ---- 4. Start ------------------------------------------------------------------
step "Starting the hub"
run sh -c "cd '$DIR' && $DOCKER compose up -d --build --remove-orphans"

# ---- 5. Auto-update ------------------------------------------------------------
step "Auto-update every 10 minutes (never in the middle of a game)"
if [ "$DRY" = 1 ]; then
  say "+ install ark-update.service (User=$ME, $DIR) and ark-update.timer"
else
  sed -e "s#@USER@#$ME#g" -e "s#@DIR@#$DIR#g" "$DIR/ark-update.service" | sudo tee /etc/systemd/system/ark-update.service >/dev/null
  sudo cp "$DIR/ark-update.timer" /etc/systemd/system/ark-update.timer
fi
run sudo systemctl daemon-reload
run sudo systemctl enable --now ark-update.timer

# ---- 6. Kiosk ------------------------------------------------------------------
add_line() { # add_line FILE LINE: append LINE to FILE unless it's already there
  mkdir -p "$(dirname "$1")"
  touch "$1"
  grep -qxF "$2" "$1" || printf '%s\n' "$2" >>"$1"
}

if [ "${ARK_NO_KIOSK:-0}" = 1 ]; then
  say "Skipping the TV screen (ARK_NO_KIOSK=1)."
else
  step "TV screen at boot"
  if command -v raspi-config >/dev/null 2>&1; then
    run sudo raspi-config nonint do_boot_behaviour B4 # log in to the desktop automatically
    run sudo raspi-config nonint do_blanking 1 # never blank the screen
  else
    say "raspi-config not found: turn on desktop auto-login and turn off screen blanking yourself."
  fi
  # Colour emoji for the TV (Memory Match cards, power-up icons...).
  if [ "$DRY" = 1 ] || ! dpkg -s fonts-noto-color-emoji >/dev/null 2>&1; then
    run sudo apt-get install -y fonts-noto-color-emoji
  fi
  # Start the kiosk with whichever desktop this Pi OS uses.
  add_line "$HOME/.config/labwc/autostart" "$DIR/kiosk.sh &" # Bookworm, labwc (current default)
  if [ -f "$HOME/.config/wayfire.ini" ] || command -v wayfire >/dev/null 2>&1; then # older Bookworm
    ini="$HOME/.config/wayfire.ini"
    touch "$ini"
    if ! grep -q "^ark = " "$ini"; then
      if grep -q '^\[autostart\]' "$ini"; then
        sed -i "/^\[autostart\]/a ark = $DIR/kiosk.sh" "$ini"
      else
        printf '\n[autostart]\nark = %s\n' "$DIR/kiosk.sh" >>"$ini"
      fi
    fi
  fi
  if [ -d /etc/xdg/lxsession/LXDE-pi ]; then # Bullseye and older (X11)
    lx="$HOME/.config/lxsession/LXDE-pi/autostart"
    [ -f "$lx" ] || cp /etc/xdg/lxsession/LXDE-pi/autostart "$lx" 2>/dev/null || true
    add_line "$lx" "@$DIR/kiosk.sh"
  fi
fi

# ---- Done ----------------------------------------------------------------------
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
step "All set"
say "TV screen:   http://${IP:-<pi-ip>}:3000/host/   (shown full-screen after a reboot)"
say "Phones:      scan the QR code on the TV"
say "Settings:    http://${IP:-<pi-ip>}:3000/admin/"
say "Controllers: $DIR/pair-controller.sh   (once per Bluetooth controller)"
say "Update now:  sudo systemctl start ark-update.service"
if [ "${ARK_NO_KIOSK:-0}" != 1 ]; then
  say ""
  say "Reboot to start the TV screen:  sudo reboot"
fi
