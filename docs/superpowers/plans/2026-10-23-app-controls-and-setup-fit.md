# Desktop App Controls and Long Setups on the TV (v0.1.0 test feedback)

**Feedback:** the app opens full screen, but there is no way out: no quit button, and ⛶ doesn't
leave full screen. Party Board's setup ran off the top and bottom of the TV.

## Design

**App controls.** A sandboxed preload (`desktop/preload.cjs`) gives the TV page `window.arkDesktop`
with two calls only, `toggleFullScreen()` and `quit()`. The main process answers them only from the
hub's own page in the app window.
- ⛶ switches the app window between full screen and windowed. In a browser it works as before.
- Quit (app only): the first tap shows "Quit?", a second tap within 3 s closes the app.
- Esc leaves full screen; F11 still toggles it.

**Long setups.** The cause was the shared `.hub-setup`, which centred with `justify-content`, so a
setup taller than the screen spilled above the top where it couldn't be scrolled to. Phones had the
same problem.
- Centre with auto margins instead, and scroll when it's too tall (TV and phone).
- On the TV, a setup with 5+ rows uses two columns, with a many-choice row (the map list) across
  both. Its text scales with the screen height, so it fits 1080p and the Steam Deck's 800 px.

## Tasks
- [x] Failing checks: an app e2e (bridge, ⛶, Quit) and a setup fit e2e at 1280x800 and 1920x1080.
- [x] Bridge, buttons and Esc; CSS fix. Both e2e pass; short setups (Pong) still centred.
- [x] Package check includes the preload; rebuild (the packaged app passes the same e2e).
- [x] Review fixes: scroll the controller's row into view, a quick double-click doesn't quit, "Quit"
  label (⏻ may be missing from a font), px floor for the setup text.
- [ ] PR; merge on green; release v0.1.1.
