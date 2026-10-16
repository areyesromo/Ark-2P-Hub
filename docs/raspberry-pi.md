# Raspberry Pi: a plug-in game console

A Raspberry Pi 4 (or 5) can be the whole thing: it runs the hub, shows the TV
screen full-screen over HDMI as soon as it boots, pairs Bluetooth
controllers, and updates itself from GitHub. Phones join over Wi-Fi as usual.

```
GitHub (merge to main) ──► Actions builds an arm64 image ──► ghcr.io
                                                              │  checked every 10 min
Raspberry Pi ◄────────────────────────────────────────────────┘
 ├─ Docker: ark-2p-hub (port 3000)       🎮🎮 Bluetooth controllers
 └─ Chromium kiosk ──HDMI──► TV          📱📱 phones ──Wi-Fi──► Pi:3000
```

## 1. Flash the OS

Use **Raspberry Pi Imager** → *Raspberry Pi OS (64-bit)* **with desktop**. In
the Imager's settings, set a hostname (e.g. `ark`), your Wi-Fi, a user, and
enable SSH. Ethernet is better than Wi-Fi if you can.

Give the Pi a fixed IP (a DHCP reservation in your router is easiest) so the
QR code never changes.

## 2. Run the installer

Plug the Pi into the TV, boot it, then open a terminal on it (or SSH in) and run,
as your normal user (not `sudo`):

```bash
curl -fsSL https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/install.sh | bash
sudo reboot
```

That's it. After the reboot the TV shows the lobby with a QR code.

What the installer does (it's safe to run again any time, e.g. to repair the setup):

1. Installs Docker if needed.
2. Puts everything in `/opt/ark` and starts the hub (the prebuilt image from
   GitHub; if that can't be downloaded, it builds from source instead).
3. Turns on **auto-update** every 10 minutes.
4. Sets the Pi to log in to the desktop by itself, turns off screen blanking,
   and starts the **kiosk** (full-screen TV screen) at login on any recent Pi OS
   desktop (labwc, Wayfire or LXDE).

Options go in front of `bash`, e.g. `curl … | ADMIN_PASSWORD=secret bash`:

| Option | Does |
| --- | --- |
| `ADMIN_PASSWORD=…` | Password for Settings (`/admin/`); otherwise you create one there |
| `PUBLIC_URL=http://192.168.1.50:3000` | Fix the address phones use |
| `ARK_SOURCE=1` | Build from source on the Pi instead of using the prebuilt image |
| `ARK_NO_KIOSK=1` | Only run the server (no TV screen on this Pi) |
| `ARK_DIR=/some/path` | Install somewhere other than `/opt/ark` |

The first two end up in `/opt/ark/.env`; edit it and run
`cd /opt/ark && docker compose up -d` to change them later.

> **Image can't be pulled?** GHCR packages can start out private. The
> installer then builds from source automatically. To use the prebuilt image
> instead, make the package public (GitHub → your profile → *Packages* →
> `ark-2p-hub` → *Package settings* → *Change visibility*) and run the
> installer again.

## 3. Pair controllers

Once per Bluetooth controller:

```bash
/opt/ark/pair-controller.sh
```

Put the controller in pairing mode when it asks:

| Controller | Pairing mode |
| --- | --- |
| Xbox | Hold the small pair button on top until the logo flashes fast |
| PlayStation (DualShock 4 / DualSense) | Hold **Share** (or **Create**) + **PS** until the light bar flashes |
| Switch Pro | Hold the sync button on top |
| 8BitDo | See its manual (often **Start** + **X** or **Y**) |

The script finds it, pairs it and *trusts* it, so from then on it reconnects by
itself when you switch it on. On the TV, press **A** to join. If an older Xbox
controller pairs but won't connect, run `/opt/ark/pair-controller.sh --xbox-fix`
once, reboot, and pair again.

USB controllers just work: plug them in.

## Updates

Every 10 minutes the Pi checks for a new version (merging to `main` on
GitHub builds one). A new version is downloaded in the background but only
installed **when nobody is in the middle of a game**. After an update the TV
reloads itself and keeps the **same room code**, and phones reconnect to
their seats on their own. The version is shown in the TV's bottom-right corner.

- Update right now: `sudo systemctl start ark-update.service`
- Update even if a game is running: `cd /opt/ark && FORCE=1 ./ark-update.sh`
- See what it did: `journalctl -u ark-update.service -n 20`

## Kiosk tips

- **Get to the desktop:** plug in a keyboard, run `touch ~/.ark-kiosk-stop` in a
  terminal (or over SSH), then press `Alt+F4`. The kiosk comes back at the next
  boot. Without that file, closing the browser just reopens it (it also comes
  back by itself if it ever crashes).
- **Sound** plays through HDMI straight away; the kiosk browser is allowed to
  play sound without a tap. If there's no sound, pick HDMI as the output in the
  desktop's volume menu.
- **TV overscan / resolution:** *Screen Configuration* on the desktop, or
  `sudo raspi-config` → *Display Options*.
- The mouse pointer hides itself after a few seconds.

## Doing it by hand

Everything the installer uses is in [`deploy/pi/`](../deploy/pi):
`docker-compose.yml` (prebuilt image) or `docker-compose.source.yml` (build
from a clone in `/opt/ark/repo`), `ark-update.sh` with its systemd
`.service`/`.timer`, `kiosk.sh` for the desktop's autostart, and
`pair-controller.sh`.
