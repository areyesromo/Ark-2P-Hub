# Release A (v0.1.8): What's new + the quick minigames

One PR, one release, built one batch at a time (design → yes → build → review → commit), so
the AppImage / Steam builds don't pile up. Release B (v0.1.9) is the arcade games.

## Step 1: What's new card
- `CHANGELOG.md` (repo root): player-friendly lines, one `## x.y.z` per desktop release.
- `server/changelog.js`: parse it; `/whats-new.json?since=x.y.z` gives the notes after that
  version up to the running one. Packaged with the desktop app (not in the Docker image).
- TV (desktop app only): after an update, a card with the new notes, once (the last version run
  is kept by the app, see the review below); tapping the version number shows the current notes again. A / B /
  Start or "Got it" closes it, and that press doesn't also reach the lobby.
- The release workflow puts the version's changelog lines at the top of the GitHub release notes.
- CLAUDE.md: every change adds its line to CHANGELOG.md (both sessions).
- docs/GAMES.md ideas: the parked bigger projects.

## Steps 2-5: quick minigames (each its own design and yes)
- 2 Run & dodge: Hurdle Dash, Laser Dodge, Pop the Most.
- 3 Touch & feel: Safe Cracker, Reflex Grid, Mirror Me.
- 4 Aim & balance: Cannon Lob, Stack Attack.
- 5 3D arenas: Bumper Cars, Paint Grab.

## Tasks
- [x] Step 1: tests (parser, route), card, workflow, CLAUDE.md, ideas; browser check (first run,
  after update, controller A closes without taking a seat, version tap, Got it).
- [x] Step 1 review: the update that brings the card now shows it (the app keeps the last
  version in its data folder, desktop/lastrun.js, not per-port page storage), and the card is
  lobby-only. Checked in the real app (new install, older install, update, reload) and in a game.
- [x] Step 2: Hurdle Dash, Laser Dodge, Pop the Most (tests with a real-match clock offset; played in a
  browser from the lobby, phone + controller).
- [x] Step 2 review: the TV keeps elements between updates (ArkMini.keyed) so animations play,
  Laser Dodge only sends a view when the screen changes, Pop the Most measures on a 2:1 field
  (round hit zone = the ring), Hurdle Dash clears mid-jump only with a short landing pause, and
  two-finger / reload-safe ducking.
- [x] Step 3: Safe Cracker, Reflex Grid, Mirror Me (tests incl. hidden drawings and a controller
  player drawing on the TV; played in a browser, dial drag checked).
- [x] Step 3 review: Safe Cracker spaces each safe its own way (equal start distance and total
  turning), clears "Jammed!" on time, turns the short way past 0; Reflex Grid judges taps by
  when they were made, ignores a light you already got, never lights a square twice; Mirror Me
  is phones only (a controller player would draw in plain sight); controller cursors stop at
  row ends.
- [x] Step 4: Cannon Lob, Stack Attack (tests incl. a real shot over the wall from both sides,
  the charge timed by the phone, the same crates for both, lean and topple).
- [x] Step 4 review: Cannon Lob caps a charge's claimed press time, holds FIRE through the reload,
  draws when both towers fall at once, sends one update per aim; player 2's phone barrel, FIRE
  ignores pans; no replayed topple on reconnect.
- [x] Step 5: Bumper Cars, Paint Grab (tests incl. side / rear / head-on rams scored once, the
  rail, a shared tile staying put, bucket splashes clipped at the edges).
- [x] Step 5 review: a ram is judged per car (nose first, outside their front, hard enough by
  closing speed, once per contact), so a gentle nudge, backing in or grinding don't score or
  spam; a splash never takes the tile your rival stands on.
- [x] PR ready, merged (#111). v0.1.7 had already gone out from #110 (Anagram Duel, Word Hunt),
  so this ships as v0.1.8 and the arcade games as v0.1.9.
- [ ] Release v0.1.8.
