# Kart Race 3D: 8-kart Cup on big tracks (design)

Date: 2026-11-08. Status: draft for review.

## Goal

Make Kart Race 3D worth playing in 3D: bigger tracks with longer laps, and a Grand Prix style cup where the
two players race six computer racers. The 2D Kart Race stays exactly as it is.

Success looks like:

- An **8-kart Cup**: five races on five different big tracks, the two players plus six computer racers, points
  for every finishing place, and the player with more points at the end wins the match.
- The computer racers drive believably in traffic: they hold a lane, pass slower karts, and don't pile up at
  the start or get stuck.
- Big tracks with laps of about 40-60 seconds, wide enough for a pack of eight.
- Everything runs inside the game on the hub's server (no separate process or service), at a steady frame
  rate on the Steam Deck.
- The 2D game's existing tests pass unchanged.

## Decisions

| Question | Decision |
| --- | --- |
| How 8 karts fit | A setup choice in Kart Race 3D: **Field: 1v1 / 8-kart Cup**. |
| 8-kart format | Cup only: 5 races, each on a different big track. No single race, no Battle. |
| Scoring | Points per finish (10, 8, 6, 5, 4, 3, 2, 1), computers included; the player with more points wins. |
| Tracks | Built in stages: Sunset Canyon (new) plus four of today's tracks remade at the new scale; each later themed track replaces one of the remade ones. |
| Engine | The shared `KartRace` engine handles any number of karts (approach A). The 2D game always runs with 2. |
| Computer racers | Run inside the game, using the existing computer driver's logic, plus lane-keeping and passing. No rubber-banding. |
| Elevation | Still flat (see the first 3D spec): `heightAt` stays 0. |

## What players get

**Setup** (the Kart Race 3D garage) gains rows:

- **Field:** ⚔️ 1v1 (default) or 🏁 8-kart Cup.
- **Computer:** Easy, Normal or Hard (shown only for the 8-kart Cup).
- With the 8-kart Cup the Mode (Race / Battle), Track and Races rows are hidden: it's always a 5-race cup on
  the big tracks. Laps (3, 5, 8) stays; items are always on.

**1v1** is today's Kart Race 3D (a race, best of 3, a 4-track cup or a Battle), with races on the big tracks
instead of the small ones. Battle keeps its arenas.

**8-kart Cup:**

- The six computer racers are racers neither player picked, each with their own kart and stats, so the grid
  has eight different racers.
- After every race, a leaderboard of all eight with the race's places and the running points total, on the
  TV and both phones.
- After five races, the player with more points wins the match (that's what stats, trophies and the
  tournament record). A tie between the players goes to whoever finished higher in the last race. The
  leaderboard still shows the computers (e.g. "Rex (CPU) won the cup, but Ana beat Ben").
- A race ends when both players have finished, or at the time limit after the first one finishes (as
  today). Computers still on track are placed by how far round they've got. Nobody waits on a computer.

## Engine: any number of karts

`KartRace` keeps a list of karts instead of a fixed pair. Karts 0 and 1 are always the two players, so every
`karts[you]` lookup stays valid; karts 2 to 7 are computer racers, each with a racer, tyres and a driving
level. The 2D game, 3D 1v1 and Battle create exactly two.

- **Positions:** a rank 1..N for every kart (by laps and progress, or finish time once finished). The view's
  `positions` becomes an array of N ranks.
- **Grid:** two per row, staggered, behind the line. Race 1 of a cup: the computers fill the front rows and
  the players start on the back row. Later races: in cup-standings order with the **leader at the back**.
  1v1 keeps today's two-kart grid.
- **Bumping and pickups:** every pair of karts can bump; any kart picks up boxes and coins (first come, first
  served), as the two do today.
- **Targeted items** (today they hit "the rival", `karts[1 - slot]`):
  - 🌩️ Thunder: every other kart.
  - 🧊 Freeze, 🔄 Swap, 🎯 Seeker: the kart just ahead (the one just behind if you lead).
  - 🧲 Slipstream: behind any kart.
  - Item odds by place in the field: the front gets defensive items, the back the catch-up ones (today's
    two-kart rule is the N = 2 case).
- **Race end:** both players finished, or the time limit; the computers still racing are placed by progress.
- **Cup points:** a points table per kart, added after each race. Nothing is hidden, so the TV and both phones
  get the same table.
- With two karts every rule above reduces to today's behaviour. The 2D game's tests are the proof and must
  pass unchanged.

## Computer racers

- **One driver, two uses.** The driving part of `server/games/kart-race-bot.js` becomes a shared function,
  `drive(view, level, memory, rng)`, used both by the seat-filling computer opponent (unchanged for players)
  and by the in-game racers.
- **In the race loop:** about ten times a second, each computer kart gets its driver's view (`botView(i)`)
  and `drive` decides steering, gas, brake, drift or item. The decision applies after a human reaction delay
  (`bot-human.js`), held in a small queue the race loop drains. No per-input timers, so nothing outlives a
  race or a rematch.
- **Traffic (new):** each computer keeps its own lane (a sideways offset from the road's middle), moves over
  to pass when a kart is close ahead in its lane, and moves back after.
- **Difficulty:** one Easy / Normal / Hard for the field, using today's three driving styles, plus a small
  per-racer variation (steering wobble, braking point) on top of each racer's own kart stats.
- **No rubber-banding:** computers get no hidden speed; catching up comes only from the place-based item odds.

## Big tracks

- **Scale:** road 7 wide (today 3.4); fields about four times bigger (e.g. 128 x 72, 16:9), with the field size
  set per track; laps of about 40-60 seconds (a 3-lap race 2-3 minutes, a cup about 15 minutes). Kart speed and
  handling stay as they are.
- **Field per track:** the engine's single `FIELD` (used for the walls at the field's edge and the views)
  becomes the current track's field. The 2D tracks keep 32 x 18.
- **Track data:** a new `server/games/kart-tracks-3d.js` lists the 3D tracks: control points, road width,
  field size, boost pads, rows of ? boxes about every 60 units, coin runs spread round the lap, and an
  8-kart grid. `KartRace3D` uses this list; the 2D game keeps its six tracks.
- **Road resolution:** the centre line's sample count scales with a track's length (today it's a fixed 240),
  so long tracks stay smooth for the road, the walls and the progress tracking (the shortcut check works in
  fractions of a lap and is scaled to match).
- **The first five:**
  1. **Sunset Canyon Rally** (new): laid out from the top-down concept
     (`asset-references/tracks/sunset-canyon/v0.1/whole-track-top-view-v1.png`): the Festival Paddock start,
     the Arch Sweep S-bends, the long back straight and the Mining Cut. Its look is in build stage 4.
  2. **Speedway, Grand Prix, Serpent and Zigzag**, remade at the new scale: laid out again, not just
     enlarged, so their bends stay interesting at speed.
- **Records:** lap records are per track name, so the big tracks start fresh.

## The 3D view with 8 karts

- **Karts:** all eight drawn with the existing placeholders (each racer's shape and colour). Computer drivers'
  heads wear their racer's colour; the players' wear `--p1` / `--p2`. A small P1 / P2 marker floats over each
  player's kart.
- **HUD (per half):** place as "3rd / 8", and a slim live order list down the screen edge with both players
  highlighted. The course map shows eight dots: computers small and grey, the players in their colours.
- **Between races:** the eight-row leaderboard (race places, points, total).
- **Garage:** the Field and Computer rows.
- **Phones:** your place out of eight during a race; your points and your rival's between races.
- **Stand-ins:** the ? box and coin stand-ins get room for the bigger tracks' counts. Smoothing already handles
  any number of karts.
- **Performance:** eight placeholder karts are cheap. Eight real models later (about 15k triangles each) is
  about 120k triangles, well within the Steam Deck's budget. Eight karts in the views add little to each update.

## Errors and edge cases

- A player's phone drops mid-cup: their kart coasts as today; the race still ends on the other player plus the
  time limit, and the computers are placed by progress.
- A rematch after a cup starts a fresh cup (points reset, race 1 grid).
- Switching Field between 1v1 and 8-kart Cup on the setup screen re-validates the other rows (as switching Mode
  does today).
- The seat-filling computer opponent (one player plus the computer) works in both fields: in an 8-kart Cup it
  is simply one more computer driver in a player's seat.

## Testing

- The 2D game's existing tests pass unchanged.
- Engine (N karts): positions 1..8, grid order (race 1 and by standings), bumping in a pack, each targeted item
  hits the right kart, a race ends once both players finish with the computers placed by progress, points add
  up and decide the winner (with the tie rule), a rematch resets the cup.
- Computer racers (fixed seed): a computer completes laps on every big track without getting stuck, six don't
  pile up at the start, a computer passes a slower kart, and each level's lap times fall in its expected range.
- Tracks: every big track is a clean loop on its field, no bend tighter than the minimum, boxes and coins on
  the road, the grid fits behind the line.
- Live checks in the browser for each PR (garage, a race of eight, the leaderboard, a full cup).

## Build order

One PR each, merged when CI passes:

1. **N-kart engine:** no visible change; the 2D game and 3D 1v1 play exactly as before.
2. **Big tracks:** field per track, road resolution by length, the four remade tracks and Sunset Canyon's
   layout, 3D 1v1 on them, the world builder and stand-ins scaled up.
3. **Computer racers and the 8-kart Cup:** shared `drive()`, lanes and passing, the setup rows, points, and the
   8-kart HUD, leaderboard and phone views.
4. **Sunset Canyon's look:** code-built canyon scenery (rock walls and mesas, two rock arches over the road, the
   dam in the distance, the festival paddock), ready to swap for ComfyUI models later.

## Later (not in this project)

- More themed tracks from ChatGPT concepts, replacing the remade ones.
- Real racer and kart models (the model pipeline in the first 3D spec).
- Tracks with height.
- Battle with more than two karts.
