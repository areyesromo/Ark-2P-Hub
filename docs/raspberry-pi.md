# Raspberry Pi 4 setup

The Pi does both jobs: it runs the hub in Docker **and** shows the TV screen
over HDMI in a full-screen browser. Phones join over Wi-Fi. When you merge to
`main`, GitHub builds a new image and the Pi picks it up within ~10 minutes.

```
GitHub (push to main) ──► Actions builds arm64 image ──► ghcr.io
                                                          │  pulled every 10 min
Raspberry Pi 4 ◄──────────────────────────────────────────┘
 ├─ Docker: ark-2p-hub (port 3000)
 └─ Chromium kiosk ──HDMI──► TV          📱📱 phones ──Wi-Fi──► Pi:3000
```

## 1. Flash the OS

Use **Raspberry Pi Imager** → *Raspberry Pi OS (64-bit)* **with desktop**.
In the Imager's settings, set a hostname (e.g. `ark`), your Wi-Fi, a user and
enable SSH. Ethernet is better than Wi-Fi for the Pi if you can.

Give the Pi a fixed IP (a DHCP reservation in your router is easiest) so the
QR code never changes.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in afterwards
```

## 3. Run the hub

```bash
sudo mkdir -p /opt/ark && sudo chown $USER /opt/ark
cd /opt/ark
curl -fsSLO https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/docker-compose.yml
docker compose up -d
```

> **Private image?** GHCR packages start private. Either make the package
> public (GitHub → your profile → *Packages* → `ark-2p-hub` → *Package
> settings* → *Change visibility*), or log the Pi in once with a personal
> access token that has `read:packages`:
> `echo <token> | docker login ghcr.io -u <github-user> --password-stdin`

Check it: open `http://<pi-ip>:3000/host/` from any computer.

The compose file uses `network_mode: host` so the server sees the Pi's real
LAN address and puts it in the QR code, even though the kiosk browser itself
opens `localhost`.

## 4. Auto-update from GitHub

```bash
cd /opt/ark
curl -fsSLO https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/ark-update.service
curl -fsSLO https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/ark-update.timer
sudo cp ark-update.service ark-update.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ark-update.timer
```

Every 10 minutes it pulls `:latest` and restarts the container only if the
image changed. Force an update right away with
`sudo systemctl start ark-update.service`.

> **Prefer building from source on the Pi?** Skip the GHCR image and the
> timer: clone the repo and use `./update.sh` instead (see the
> README's *Update and redeploy from GitHub*). Building on a Pi 4 takes a
> minute or two.

## 5. Kiosk mode (TV screen on boot)

```bash
cd /opt/ark
curl -fsSLO https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/kiosk.sh
chmod +x kiosk.sh
```

Then make the desktop start it at login. Enable auto-login first:
`sudo raspi-config` → *System Options* → *Boot / Auto Login* → *Desktop Autologin*.

Recent Pi OS (Bookworm, **labwc**):

```bash
mkdir -p ~/.config/labwc
echo '/opt/ark/kiosk.sh &' >> ~/.config/labwc/autostart
```

Older Bookworm (**Wayfire**): add to `~/.config/wayfire.ini`:

```ini
[autostart]
ark = /opt/ark/kiosk.sh
```

Reboot. The TV should show the lobby with a QR code. To get out of kiosk mode,
plug in a keyboard and press `Alt+F4`, or SSH in.

### Tips

- **Screen blanking:** `sudo raspi-config` → *Display Options* → *Screen Blanking* → off.
- **TV overscan / resolution:** set in *Screen Configuration* on the desktop, or
  `raspi-config` → *Display Options*.
- **Real controllers:** Bluetooth gamepads pair through the desktop Bluetooth
  menu. Controller support in games is on the roadmap.
