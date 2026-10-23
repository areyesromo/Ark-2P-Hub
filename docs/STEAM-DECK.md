# Steam Deck: set it up once, play from Game Mode

The desktop app runs the whole hub on the Deck: the server, the TV screen and the controllers.
Dock the Deck to the TV (or play on its own screen), phones join over Wi-Fi, and the Deck's own
controls work as a controller. This is a one-time setup of about 10 minutes; after it, the app
keeps itself up to date.

```
Steam Deck (docked) ──HDMI──► TV
 └─ Ark 2P Hub app  ◄──Wi-Fi──  📱📱 phones (scan the QR code)
                    ◄─────────  🎮 the Deck's controls / Bluetooth controllers
```

## 1. Download the app (Desktop Mode)

1. Press the **Steam** button → **Power** → **Switch to Desktop**.
2. Open a web browser and go to the repository's **Releases** page:
   <https://github.com/areyesromo/Ark-2P-Hub/releases/latest>. (No browser yet? Open **Discover**,
   the store app on the taskbar, and install Firefox.)
3. Download **`Ark-2P-Hub-x86_64.AppImage`**. Also download **`Ark-2P-Hub-steam-artwork.zip`**
   if you want the library pictures (step 4).
4. Open **Dolphin** (the file manager) and go to **Downloads**. Make a folder for the app in your
   home folder, such as `Applications`, and move the AppImage into it. Steam remembers where the
   file is, so pick its home now: updates replace the file in the same place.
5. Right-click the AppImage → **Properties** → **Permissions** → tick **Is executable** (on newer
   SteamOS it reads **Allow executing file as program**) → **OK**.
6. Double-click it to check that it starts: the TV screen opens full screen with a QR code. Press
   **Quit**, then **Quit?**, to close it.

> Keep the name `Ark-2P-Hub-x86_64.AppImage`, or any name without a version number in it. Updates
> overwrite the file under its name, so Steam's shortcut keeps working.

## 2. Add it to Steam

1. Open **Steam** (still in Desktop Mode).
2. **Games** menu (top left) → **Add a Non-Steam Game to My Library…** → **Browse…**.
3. Set the file type at the bottom of the window to **All Files**, pick the AppImage, then
   **Add Selected Programs**.
4. It shows up in your library as *Ark-2P-Hub-x86_64.AppImage*. To rename it, right-click it →
   **Properties** → **Shortcut** and change the name at the top to **Ark 2P Hub**.

## 3. Choose the controller layout

Back in Game Mode (the **Return to Gaming Mode** icon on the desktop), open the game's page and
press the **controller** icon (or **Steam** button → **Controller settings** while it's running):

- Open the layout (its name at the top) → **Templates** → **Gamepad** → **Apply**. The hub reads
  the Deck's controls as a normal gamepad (the same as an Xbox controller), and the hints on the TV
  use Xbox names. On the Deck: **RT** = **R2**, **LB / RB** = **L1 / R1**, **Back** = **View** (⧉),
  **Start** = **Menu** (☰).
- In the lobby, **A** takes a seat and then picks the game under the cursor, **B** gives the seat
  back, and **R2** presses the update banner. In a game, **View** goes back to the lobby.
- The touchscreen works too: tap any button on the TV screen, such as ⛶, **Quit** or a game card.

The Steam overlay (pop-ups, Steam screenshots) doesn't show inside the app: Steam's overlay
library freezes the window, so the app starts without it. The **Steam** and **⋯** buttons, the
quick-access menu and your controller layout all still work.

The Deck's controls count as one player. For the second player, use a phone (scan the QR code) or
pair a Bluetooth controller (**Steam** button → **Settings** → **Bluetooth**).

## 4. The library pictures (optional)

Steam doesn't take pictures from a non-Steam game, so set them by hand once in **Desktop Mode**.
Unzip `Ark-2P-Hub-steam-artwork.zip` (right-click → **Extract** → **Extract archive here**):

| Picture | Where it goes in Steam (Desktop Mode) |
|---|---|
| `library-600x900.png` | Right-click the game in the library → **Manage** → **Set custom artwork** |
| `hero-3840x1240.png` | On the game's page, right-click the big header → **Set custom background** |
| `logo-1280x720.png` | On the game's page, right-click the header → **Set custom logo** |
| `icon-256.png` | Right-click the game → **Properties** → **Shortcut** → click the empty icon square |
| `wide-920x430.png` | The wide tile in *Recent games*. Steam only asks for it in some places, so skip it if there's nowhere to set it. |

Steam's menus move around between updates. If a menu item isn't where the table says, right-click
the spot where the picture shows: Steam usually offers to change it there.

## 5. Play

1. Dock the Deck to the TV, go to Game Mode, and start **Ark 2P Hub** from your library. It opens
   full screen on the TV.
2. Phones must be on the **same Wi-Fi** as the Deck. They scan the QR code, or open the address
   under it and type the room code.
3. Pick a game on a phone, or with the controller: press **A** to take a seat, then (once both
   seats are taken) **D-pad** + **A** to pick a game.

The hub uses port 3000, or the next free one, for both `http://` and `https://`. Tilt and motion
controls need the https page: phones offer **🔒 Switch to the secure page** when a game needs it
(see [Secure page (https)](../README.md#secure-page-https)).

## Updates

A few seconds after it starts (and every 6 hours while it's open), the app checks for a new
version:

1. The lobby shows **⬆ Version x is out · Update** in the bottom-left corner (only in the lobby,
   not during a game). Tap it, or press **R2**.
2. It downloads (**Downloading version x… 42 %**), then shows **Install and close**.
3. Press it: the app installs the update and closes. Start **Ark 2P Hub** again from your library
   and it opens on the new version. (Started from Dolphin instead of Steam, the button says
   **Restart now** and the app comes back by itself.)

Downloaded it but don't want to restart now? Just quit when you're done playing: it installs on
the way out. Settings, stats and player names are kept. The version you're on is in the small grey text at the bottom right of
the TV screen.

## If something's wrong

- **Phones can't connect.** Check they're on the same Wi-Fi as the Deck (not mobile data or a
  guest network). Try the address shown under the QR code by hand.
- **A black screen when started from Steam** (it works when you double-click it). Up to v0.1.4,
  Steam's overlay library froze the window. From v0.1.5 the app works around it by itself, so
  update in Desktop Mode (double-click it, then the banner's **Update** → **Restart now**). If you
  put `LD_PRELOAD= %command%` in the game's **Launch Options** as a stopgap, you can delete it now.
  Still black? Press the **Steam** button and choose **Exit Game** to get out. Then check, in order:
  1. Game Mode, the game's page → ⚙ → **Properties** → **Compatibility**: **Force the use of a
     specific Steam Play compatibility tool** must be **off**. Proton is for Windows games and
     can't run this Linux app.
  2. Still black? Start it once more from Game Mode (press Play just once), exit, then in Desktop
     Mode open the log: `~/.config/Ark 2P Hub/logs/main.log` (in Dolphin, **Ctrl + H** shows
     hidden folders like `.config`). It says how the app started and what went wrong; send it to
     whoever helps you.
  3. No `main.log`, or the times in it are older than your try? Then the app never started at all:
     check step 1 again, and that **Properties → Shortcut → Target** points at the AppImage.
- **The app doesn't open from Steam.** Start the AppImage from Dolphin in Desktop Mode to see if it
  runs, and check the shortcut's **Properties → Shortcut → Target** points at the file.
- **The Steam shortcut stopped working after an update.** If the old file had a version number in
  its name (`…-0.1.2-…`), the update saved the new one as `Ark-2P-Hub-x86_64.AppImage` in the same
  folder. Point the shortcut at it: **Properties → Shortcut → Target**.
- **No update banner.** It only shows in the lobby. If the Deck was offline when the app started,
  it looks again 6 hours later; restarting the app checks straight away. If a download fails, the
  banner offers **Download page**: in Desktop Mode, download the new AppImage from the Releases
  page and replace the old file (same name).
- **The B button drops the app out of full screen.** The layout is sending Esc instead of a gamepad
  button. Pick **Templates → Gamepad** (step 3), or press ⛶ on the TV screen to go back to full
  screen.
- **Where's my data?** In `~/.config/Ark 2P Hub/data`: settings, stats and the https certificate.
  Back it up before wiping the Deck. The log of the last two runs is next to it, in `logs/`.
