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

## Follow-up (v0.1.6): closing slowly

**Report:** opening is fast, but Exit Game and the in-app Quit take about a minute, and after the
in-app Quit Steam doesn't seem to notice the game closed.

- The in-place restart still starts Electron once *with* the overlay library, and its first
  helpers (zygotes) keep it. Fix: a launcher script in front of the binary (`desktop/after-pack.cjs`,
  an electron-builder afterPack hook) drops the library before Electron starts, so no process ever
  has it. The in-place restart stays as a fallback for other ways of starting it.
- A real bug in Quit: the second `app.quit()` (after the hub closed) ran while Electron was still
  in the cancelled quit, so it was ignored and only the 2 s fallback quit the app (closing the
  window was already quick). Now deferred a turn: about 10 ms instead of 2 s.
- The log now records the closing: quit requested, closing, hub closed, exiting (with the helpers
  still running then), so if Steam is still slow on the Deck the log shows what it waits for.
- Docs: the data and log folder is `~/.config/ark-2p-hub` (the package name), not `Ark 2P Hub`.
