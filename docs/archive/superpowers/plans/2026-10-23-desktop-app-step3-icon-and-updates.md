# Desktop App, Step 3: an Icon, Steam Artwork and Self-Update

**Goal:** the app looks like itself (window, installer, shortcuts, Steam library) and keeps itself
up to date from GitHub Releases, so a new version needs no re-download on the Deck.

## Icon and artwork
- An original "2P" monogram: a cyan 2 and a pink P (the hub's player colours) on the navy tile.
  No console-style shapes.
- Drawn as SVG in `tools/desktop-art.mjs`, which renders the PNGs with Playwright's Chromium (run it
  by hand; the PNGs are committed):
  - `desktop/icons/icon.png` (1024): electron-builder makes the Windows .ico and the AppImage icon
    from it; the window uses it too.
  - `public/shared/icon.svg`: the browser tab icon for the TV, phone, admin and stats pages.
  - `desktop/steam/`: library tile 600x900, wide tile 920x430, header 3840x1240, logo (transparent),
    icon. Releases attach them as `Ark-2P-Hub-steam-artwork.zip`. Steam doesn't read art from a
    non-Steam game, so you set them once in the game's Properties (desktop/README.md says how).

## Self-update (electron-updater)
- `electron-builder.yml` gets `publish: github` (owner/repo), so builds write `latest.yml` /
  `latest-linux.yml` (plus blockmaps); the release job attaches them.
- `electron-updater` is an optional dependency: packed into the app, skipped by the Docker image
  (`npm ci --omit=dev --omit=optional`). `check-package.mjs` asserts it's in the app.
- `desktop/updates.js`: a small state machine around the updater (given to it, so it's testable
  without Electron). States: `idle` → `available {version}` → `downloading {percent}` →
  `ready {version}`, or `error {url}`.
  - Checks once, 5 s after launch, without downloading (`autoDownload: false`).
  - A failed check (offline) stays quiet. A failed download shows the error with the releases page.
  - `act()` does the next step: download, restart and install, or open the releases page.
  - Not chosen now: installs when the app next quits (`autoInstallOnAppQuit`).
- Only in the packaged app (and on Linux only when running as an AppImage). `ARK_NO_UPDATE=1` turns it
  off; `ARK_UPDATE_URL` points it at a generic feed (for testing).
- Bridge: `arkDesktop.onUpdate(cb)` and `arkDesktop.update()`; main sends the state to the hub's page.
- TV: a banner in the lobby, bottom-left: "Version 0.1.2 is out · Update" → "Downloading 42 %" →
  "Restart now" ("Install and close" under Steam) (or "Couldn't update · Download page"). Tap it, or press RT on a controller.

## Tasks
- [x] Failing tests: `test/desktop-updates.test.js` (states, quiet check errors, act()).
- [x] `desktop/updates.js`; wire main.js, preload, host banner + RT; CSS with tokens.
- [x] Icon + artwork tool, assets; electron-builder icon; favicons; window icon.
- [x] Workflow: attach latest*.yml, blockmaps and the artwork zip. Docker `--omit=optional`.
- [x] e2e: build a 0.0.1 and a 0.0.2 AppImage, serve 0.0.2 as a generic feed, run 0.0.1: banner,
  download, restart, and the file is replaced by 0.0.2.
- [x] README + desktop/README.
- [ ] Review; PR; merge on green.
