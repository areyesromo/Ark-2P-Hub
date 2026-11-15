# Desktop App, Step 1: The Hub as One App (AppImage for the Steam Deck, Installer for Windows)

**Goal:** double-click one app and the hub runs. The server runs inside it and the TV screen opens
full screen in the app's own window, with no Docker and no separate Node.js install. The same
project builds:
- a Linux **AppImage** for the Steam Deck: add it to Steam as a non-Steam game, and it runs in
  Game Mode;
- a Windows **installer**.

**Owner's choices:**
- Windows gets an installer, not a portable .exe.
- If port 3000 is busy, use the next free port.
- The app starts full screen.

## Design

- **Electron:** Node.js plus a Chromium window. Electron and electron-builder are dev
  dependencies of the repo, so the Docker image (`npm ci --omit=dev`) is unchanged.
- **`desktop/hub.js`** is plain Node, with no Electron import, so it can be unit tested:
  - `findPort(from = 3000, tries = 20)`: the first port from `from` that can be listened on.
  - `startHub({ dataDir, port, commit })`:
    - finds a free port;
    - sets the version (ARK_COMMIT / ARK_BUILT) before loading the server;
    - calls `createApp({ port, dataDir })`, then `listen()`;
    - returns `{ port, url: 'http://localhost:<port>', close }`.
- **`desktop/main.js`**, the Electron entry:
  - single instance: a second launch focuses the open window;
  - the data folder is `<userData>/data`. That's `~/.config/Ark 2P Hub/data` on Linux and the
    Deck, and `%APPDATA%\Ark 2P Hub\data` on Windows. Stats, settings and the https certificate
    live there and survive updates.
  - the window opens `/host/` full screen with no menu bar, and F11 toggles full screen;
  - `autoplayPolicy: 'no-user-gesture-required'`, so sound plays without "Tap for sound";
  - links to other sites open in the system browser;
  - closing the window quits the app and closes the server.
- **Builds:** `desktop/electron-builder.yml`.
  - Linux: AppImage (x64, the Deck's architecture).
  - Windows: NSIS installer (x64).
  - Contents: `server/`, `public/`, `desktop/`, and the production dependencies.
- **Scripts:**
  - `npm run desktop` runs the app from source;
  - `npm run dist:linux` builds the AppImage;
  - `npm run dist:win` builds the installer. It needs Windows, or CI (that's step 2).
- **Docker:** stays as it is. Raspberry Pi and server installs keep using it.

## Tests

- **Unit tests** (`test/desktop.test.js`):
  - `findPort` skips a busy port;
  - `startHub` serves `/healthz` and the host page from the given data folder, on the next free
    port when 3000 is taken;
  - `close()` frees the port.
- **App e2e** (Playwright drives Electron):
  - launch from source: the window shows the host page with a room code, full screen;
  - a second instance doesn't open a second window.
- **AppImage smoke test:** build it, launch it (headless display), and check that `/healthz`
  answers and the window loads.

## Not in step 1
- **Step 2:** CI builds on release (the Windows installer is built on a Windows runner).
- **Step 3:** self-update, icon, Steam artwork, and Deck setup docs.
