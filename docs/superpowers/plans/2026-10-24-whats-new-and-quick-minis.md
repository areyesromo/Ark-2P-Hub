# Release A (v0.1.7): What's new + the quick minigames

One PR, one release, built one batch at a time (design → yes → build → review → commit), so
the AppImage / Steam builds don't pile up. Release B (v0.1.8) is the arcade games.

## Step 1: What's new card
- `CHANGELOG.md` (repo root): player-friendly lines, one `## x.y.z` per desktop release.
- `server/changelog.js`: parse it; `/whats-new.json?since=x.y.z` gives the notes after that
  version up to the running one. Packaged with the desktop app (not in the Docker image).
- TV (desktop app only): after an update, a card with the new notes, once (the last version run
  is kept in localStorage); tapping the version number shows the current notes again. A / B /
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
- [ ] Step 1 review.
- [ ] Steps 2-5.
- [ ] PR ready, merge, release v0.1.7.
