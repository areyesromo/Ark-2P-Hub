# Kart Race: Cup, Ready Rematch and Jump Starts

**Owner's asks:**
- the rematch waits for both players;
- a cup: a batch of races with a leaderboard, where the most wins takes the cup;
- a jump-start penalty.

**Owner's choices:**
- a cup is 4 races on 4 different random tracks, and every race is played;
- a tie on wins goes to a sudden-death race on a fifth track;
- a jump start costs a 1 s stall.

## Cup

- **Setting:** the `races` setting gains `4`, shown as "Cup (4 tracks)". The setting is now
  `[1, 3, 4]`: one race, best of 3, or a cup.
- **Tracks:** `begin()` shuffles 5 different track indices with the game's rng. Races 1 to 4 use
  the first four; a sudden death uses the fifth. The Track setting is ignored in a cup, and the
  setup screen says so.
- **Who wins:** the most race wins after 4 takes the cup. At 2–2, race 5 is sudden death, and
  its winner takes the cup.
- **History:** every race in any series is recorded in `history`, as
  `{ race, track, winner, times: [ms | null, ms | null] }`. A time is null if that player hadn't
  finished when the race closed.

## Between races (best of 3 and the cup)

- **Standings phase:** after each race that isn't the last, the game enters a new
  `standings` phase. The physics loop stops while it lasts.
- **TV:** a leaderboard with one row per race (the track, the winner, both times), the wins so
  far, and "Next: <track>" (or "Sudden death!").
- **Next race:** it starts when both players are ready (Start / A). A player whose phone has
  dropped out counts as ready, as on the setup screen.

## Rematch

- **End screen:** `rematch` toggles your ready. When both are ready, `begin()` starts a fresh
  series. The ✓ ticks show on the end screen.
- **Ready reset:** ready is reset when entering `standings` and `over`.
- **Leaving:** `setup` (back to the settings) still works at once.
- **TV end screen:** shows the leaderboard for a best of 3 or a cup, with "🏆 <name> wins the
  cup!" for a cup.

## Jump start

- **The rule:** pressing GAS during the lights (the countdown phase) is a jump start. This means
  the gas going from not held to held. A GAS still held from before the lights doesn't count.
- **The penalty:** after lights out, a jumped kart can't drive for `JUMP.stallMs` = 1000 ms. It
  stays at speed 0 and ignores GAS, then goes as normal.
- **View:** `k.jumped` is true while the stall lasts, and `events.jumpStarts` is counted.
- **Screens:**
  - TV: "JUMP START" next to that player's HUD, and the `wrong` sound;
  - phone: "Jump start! 1 s penalty" in the status line.
- **Help text:** the countdown hint now reads "wait for the lights to go out, then GAS". It used
  to say "hold GAS to go".

## Tasks

- [ ] **Failing tests:**
  - cup: 4 different tracks, all 4 played, standings between races, most wins takes it;
  - cup: 2–2 goes to sudden death on a fifth track;
  - best of 3: standings between races, and the next race waits for both;
  - rematch: one player doesn't restart; both do; ready is cleared on entering over and standings;
  - jump start: a press during the lights stalls 1 s; a held-over GAS or a press after lights
    out doesn't.
- [ ] **Server:** then `npm test`, after updating the existing best-of-3 test for the standings
  screen.
- [ ] **TV and phone:** leaderboard, cup setting label, ready on rematch and standings, jump-start
  labels; browser e2e with screenshots.
- [ ] **Finish:** review (opus); PR; merge on green.
