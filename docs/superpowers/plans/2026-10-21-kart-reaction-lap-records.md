# Kart Race: Reaction Time and Lap Records

## Reaction time
- **Measuring:** the time from lights out (`raceStart`) to the kart's first GAS press after it.
  - A press is GAS going from not held to held.
  - The value is saved as `k.reactionMs` in ms. It stays null if there's no press, if GAS was
    already held at lights out, or if the kart jumped the start.
- **View:** `reaction` (ms) for `REACTION_SHOW_MS` = 3000 after it is set; null otherwise.
- **TV:** the lap line in that player's HUD says "⚡ Reaction 0.32 s" while it shows.
- **Phone:** the same text in the status line.

## Lap records
- **Recording:**
  - each race's `history` entry gains `best: [ms | null, ms | null]`, both karts' best laps;
  - the view gains `lapTimes: [{ track, slot, ms }]`, built from the history (nulls dropped).
- **Saving:** `rooms.recordResult` copies valid `lapTimes` into the match as
  `laps: [{ track, player, ms }]`, where player is the slot.
- **Stats:** `leaderboard().lapRecords` lists, for each track, the fastest lap of any match:
  `{ game, track, name, ms, at }`. The list is sorted by track name.
- **Stats page:** a "⏱️ Lap records" section with track, holder, time and when.

## Tasks
- [ ] Failing tests:
  - reaction: measured from lights out, shown for 3 s, null after a jump start or when GAS was
    already held;
  - lap times reach the view and the history;
  - the room saves them;
  - the stats keep the fastest per track, by name, across matches and seats.
- [ ] Implement; `npm test`; e2e screenshots (HUD reaction, stats page); review; PR.
