# Black Screen When Started From Steam (v0.1.5)

**Symptom:** on the Deck the app works when double-clicked, but started from Steam (Game Mode, and
Desktop Mode too) the window stays black and can't be closed.

**Evidence (v0.1.4's log):**
- Steam runs: the hub starts, then no "page loaded" / "window ready", and no error.
- Ruled out: Proton (no compat env), Wayland (Game Mode gives X11), the GPU (frozen with
  `--disable-gpu` too), gamescope (frozen from Steam in Desktop Mode too).
- The only difference: `LD_PRELOAD=…gameoverlayrenderer.so` (Steam's overlay library, loaded
  even with the overlay switched off). The launch option `LD_PRELOAD= %command%` fixed it.
- Reproduced here with a stand-in library that hangs Electron's utility (network) process: the
  same log, and the app ignores a stop signal.

**Fix:** `desktop/steam.js` + the top of `main.js`. Started with the overlay library, the app
replaces itself (`process.execve`, same process) with a fresh one without it, before Electron
starts any helper or the crash reporter. Steam keeps tracking the same process, so Exit Game and
the app's own Quit work as usual, and nothing is left behind.

A first version started a second copy and waited for it; review found the waiting process's own
helpers (the hung network one, the crash reporter) were left running, so Steam would still show
the game as running. Verified here: the in-place restart leaves no process behind.

## Tasks
- [x] `withoutSteamOverlay(env)` + tests.
- [x] Restart in main.js; reproduce (before: frozen, can't stop) and verify (after: loads, closes,
  nothing left).
- [x] Guide: the black-screen entry, the overlay note.
- [x] Review (spawn-and-wait → in-place restart).
- [ ] PR; merge; release v0.1.5.
