# Ark 2P Hub desktop app

The hub as one app: the server runs inside it and the TV screen opens full screen in its own
window. There's no Docker and no Node.js install.

Download both from the repository's **Releases** page. On a Steam Deck, follow the step-by-step
[Steam Deck guide](../docs/STEAM-DECK.md): download, add to Steam, controller layout, artwork.

| Platform | File | How to run |
|---|---|---|
| Steam Deck / Linux | `Ark-2P-Hub-x86_64.AppImage` (up to v0.1.1: `Ark-2P-Hub-<version>-x86_64.AppImage`) | Make it executable, then run it. On the Deck, add it to Steam as a non-Steam game to play from Game Mode. |
| Windows | `Ark-2P-Hub-<version>-x64.exe` (installer) | Run the installer. It isn't signed yet, so Windows may say "Windows protected your PC": choose **More info → Run anyway**. Allow network access when Windows asks; phones need it to join. |

- **Port:** the hub uses port 3000, or the next free one if something else has it, such as a
  Docker hub that's still running. Phones join by the QR code on the TV as usual.
- **Your data:** settings, stats and the https certificate are kept in the app's data folder and
  survive updates.
  - Steam Deck / Linux: `~/.config/Ark 2P Hub/data`
  - Windows: `%APPDATA%\Ark 2P Hub\data`
- **Log:** each run writes `logs/main.log` next to the data folder (the run before is
  `main.old.log`): versions, how it was started, the graphics status, the displays, and any error
  (the page's too). Look there first when the window stays black. A crash in Electron itself
  leaves a dump in `Crashpad/` next to it.
- **Window:** ⛶ on the TV's top bar (or F11) switches between full screen and a window; Esc leaves
  full screen. **Quit** (tap it, then **Quit?**) closes the app. Closing the window stops the hub too.
- **Updates** (from v0.1.2): a few seconds after it starts, the app checks the Releases page. When
  there's a newer version, the lobby shows **Version x is out · Update** at the bottom left. Tap
  it, or press **RT** on a controller. It downloads, then **Restart now** installs it and brings the
  app back (or it installs the next time you quit). Settings and stats are kept.
  - Started from Steam (Game Mode), the button says **Install and close** instead: start the game
    again from Steam, so it keeps Steam's controller layout.
  - The AppImage is replaced in place under the same name, so a Steam shortcut to it keeps working.
    Keep the name without a version (`Ark-2P-Hub-x86_64.AppImage`), or any name without one.
  - Windows runs the new installer silently (no wizard), then starts the app again.
  - If a download fails, the banner offers the **Download page** instead. Offline, nothing shows.
  - `ARK_NO_UPDATE=1` turns the check off.

## Steam artwork (Steam Deck)

Steam doesn't take pictures from a non-Steam game, so set them once by hand. Each release has
`Ark-2P-Hub-steam-artwork.zip` (the same pictures are in `desktop/steam/`):

| File | Where it goes in Steam |
|---|---|
| `library-600x900.png` | The library tile (portrait) |
| `wide-920x430.png` | The wide tile (recent games) |
| `hero-3840x1240.png` | The header behind the game's page |
| `logo-1280x720.png` | The logo over that header |
| `icon-256.png` | The icon |

Where each picture goes, step by step: [Steam Deck guide, step 4](../docs/STEAM-DECK.md#4-the-library-pictures-optional).

The icon and artwork are drawn by `tools/desktop-art.mjs` (needs Playwright). Change the drawing
there and run it again; it rewrites the PNGs and `public/shared/icon.svg`, the browser tab icon.

## Making a release

GitHub builds both files (`.github/workflows/desktop.yml`):

1. On GitHub, open **Actions → Desktop app → Run workflow**.
2. Type the new version, e.g. `0.2.0`, and run it.
3. A few minutes later, the release **v0.2.0** is on the Releases page with these attached:
   - the AppImage and the installer;
   - `latest.yml`, `latest-linux.yml` and the installer's `.blockmap`, which self-update reads;
   - the Steam artwork zip.

   Apps from v0.1.2 on offer the new version in the lobby.

Pull requests that change the desktop app also build both. The files can be downloaded from the
run's page under **Artifacts**, without making a release.

## Building it yourself

```sh
npm ci
npm run desktop      # run the app from the source
npm run dist:linux   # dist/Ark-2P-Hub-x86_64.AppImage
npm run dist:win     # dist/Ark-2P-Hub-<version>-x64.exe (build on Windows)
```

The app's code lives in this folder:
- `main.js` is the Electron window;
- `preload.cjs` is the bridge the TV page gets (`window.arkDesktop`);
- `updates.js` is self-update (around electron-updater);
- `applog.js` is the log file;
- `hub.js` starts the server on a free port;
- `electron-builder.yml` is the packaging config.

The Docker image (`server/index.js`) is unaffected; it skips electron-updater (an optional
dependency).
