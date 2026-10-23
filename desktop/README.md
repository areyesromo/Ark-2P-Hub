# Ark 2P Hub desktop app

The hub as one app: the server runs inside it and the TV screen opens full screen in its own
window. There's no Docker and no Node.js install.

Download both from the repository's **Releases** page.

| Platform | File | How to run |
|---|---|---|
| Steam Deck / Linux | `Ark-2P-Hub-<version>-x86_64.AppImage` | Make it executable, then run it. On the Deck, add it to Steam as a non-Steam game to play from Game Mode. |
| Windows | `Ark-2P-Hub-<version>-x64.exe` (installer) | Run the installer. It isn't signed yet, so Windows may say "Windows protected your PC": choose **More info → Run anyway**. Allow network access when Windows asks; phones need it to join. |

- **Port:** the hub uses port 3000, or the next free one if something else has it, such as a
  Docker hub that's still running. Phones join by the QR code on the TV as usual.
- **Your data:** settings, stats and the https certificate are kept in the app's data folder and
  survive updates.
  - Steam Deck / Linux: `~/.config/Ark 2P Hub/data`
  - Windows: `%APPDATA%\Ark 2P Hub\data`
- **Window:** F11 toggles full screen. Closing the window stops the hub.

## Making a release

GitHub builds both files (`.github/workflows/desktop.yml`):

1. On GitHub, open **Actions → Desktop app → Run workflow**.
2. Type the new version, e.g. `0.2.0`, and run it.
3. A few minutes later, the release **v0.2.0** is on the Releases page with the AppImage and the
   installer attached.

Pull requests that change the desktop app also build both. The files can be downloaded from the
run's page under **Artifacts**, without making a release.

## Building it yourself

```sh
npm ci
npm run desktop      # run the app from the source
npm run dist:linux   # dist/Ark-2P-Hub-<version>-x86_64.AppImage
npm run dist:win     # dist/Ark-2P-Hub-<version>-x64.exe (build on Windows)
```

The app's code lives in this folder:
- `main.js` is the Electron window;
- `hub.js` starts the server on a free port;
- `electron-builder.yml` is the packaging config.

The Docker image (`server/index.js`) is unaffected.
