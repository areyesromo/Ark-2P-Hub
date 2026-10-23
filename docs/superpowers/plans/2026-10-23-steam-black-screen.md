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

**Fix:** `desktop/steam.js` + `main.js`. Started with the overlay library, the app starts a copy
of itself without it and waits. That copy runs the hub and window; the first one just waits (Steam
still sees the game running), cancels its own quit (which would freeze), passes Exit Game on to the
copy, and ends once the copy has closed (or after 5 s).

## Tasks
- [x] `withoutSteamOverlay(env)` + tests.
- [x] Restart in main.js; reproduce (before: frozen, can't stop) and verify (after: loads, both close).
- [x] Guide: the black-screen entry, the overlay note.
- [ ] Review; PR; merge; release v0.1.5.
