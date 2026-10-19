# Kart Race: racer selection (design)

## Goal

Before a race, each player picks a **racer**: a character with their own kart and stats, like
early Mario Kart. Different racers drive differently (trade-offs, not upgrades), so the pick
matters without making a race unfair. The roster is defined once and shared, so a future
**Kart Race 3D** module (see `docs/DREAMS.md`) can reuse the same racers with 3D models.

Agreed with the owner:
- One combined pick (racer = character + kart + stats), not separate character and kart picks.
- Stats only (no special perks): Speed, Acceleration, Handling, Weight, each 1–5.
- Six stat types, each in a male and a female version with identical stats: 12 racers.

## Roster

Shared module `public/games/kart-race/racers.js`: a plain script setting
`globalThis.ArkKartRacers` (same pattern as `track.js`). The server imports it for its side
effect; screens load it with `Ark.loadScript`.

| type | id (m / f) | name (m / f) | emoji | Spd | Acc | Hnd | Wgt | shape |
|---|---|---|---|---|---|---|---|---|
| speed | rex / roxy | Rex / Roxy | 🔥 | 5 | 2 | 2 | 3 | long nose |
| accel | zip / zara | Zip / Zara | ⚡ | 2 | 5 | 3 | 2 | short, stubby |
| handling | swift / sky | Swift / Sky | 🌀 | 3 | 3 | 5 | 1 | low, wide wings |
| heavy | boulder / bella | Boulder / Bella | 🪨 | 4 | 1 | 2 | 5 | wide, boxy |
| allround | dash / daisy | Dash / Daisy | ⚖️ | 3 | 3 | 3 | 3 | classic (today's kart) |
| tricky | rascal / ruby | Rascal / Ruby | 🦊 | 2 | 4 | 5 | 1 | narrow, pointed |

Every type totals 12 points. Each racer entry: `{ id, name, type, gender: 'm'|'f', emoji,
stats: { speed, accel, handling, weight }, shape, stripe }` (stripe: a type colour). Exports:
`LIST`, `byId(id)`, `DEFAULT` (`['dash', 'daisy']`, one per slot), and
`physics(stats)` → per-kart driving numbers (below), so the 2D server and any future 3D module
turn stats into handling the same way.

## Stats → driving

A rating of 3 gives exactly today's kart; each step is a fixed fraction either side.

| stat | drives | 1 … 3 … 5 |
|---|---|---|
| Speed | `maxSpeed` | 7.6 … 8.5 … 9.4 (boost speed stays maxSpeed + 4) |
| Acceleration | `accel` | 6.5 … 9 … 11.5 |
| Handling | `turnRate`, `grip` | turnRate 2.5 … 2.8 … 3.1; grip 1.4 … 1.2 … 1.0 (lower = full steering sooner) |
| Weight | bump share, `grassSpeed` | in a bump, each kart moves by the other's share of the total weight; grass speed 2.9 … 3.2 … 3.5 |

Everything else (coast, brake, reverse, drift, walls, items) stays shared. `KART` keeps the base
values; each kart gets `k.car = Racers.physics(stats)` at race start and `drive()`/`bump()` read
from `k.car` instead of `KART` for those fields.

## Picking

- Game state gains `racers: [id, id]`, starting at `DEFAULT`, kept across rematches and races.
- Input `{ type: 'racer', id }` from a player during `setup` (or `over`) sets their own slot;
  unknown ids are ignored. Both players may pick the same racer.
- No blocking: nobody has to confirm a racer before Start (an unpicked player races the default).
- **Phone** (setup screen): a "Your racer" grid of 12 cards (emoji, name, ♂/♀ pairs side by side),
  the chosen card highlighted, with the selected racer's four stat bars below. The last pick is
  remembered on the phone (`localStorage`) and sent when the setup screen opens.
- **Controller** (setup screen): a new "Racer" row in the controller's setup focus: ←→ cycles
  that player's racer. (The existing rows stay as they are.)
- **TV setup**: both players' picks side by side (emoji, name, stat bars) next to the track preview.
- **During the race**: the HUD shows each player's racer emoji and name next to their name.

## Drawing (2D)

- Kart keeps the player's colour (P1 / P2). The **shape** varies by type (body outline path per
  shape) and a **stripe** in the type colour runs down the body; the helmet is unchanged.
- No emoji on the canvas (a kiosk browser may have no colour emoji font); emoji appear only in
  HTML (cards, HUD).

## Views

`common()` adds `racers` (the two chosen ids). The roster itself is not sent: screens load
`racers.js` directly. Karts in the view gain `racer` (id).

## Testing

- Unit (`test/kart-race.test.js`):
  - Each racer's stats total 12; ids unique; every type has an m and an f racer with equal stats.
  - `physics()` at all-3s equals today's KART values.
  - Rex reaches a higher top speed than Zip; Zip reaches 5 speed sooner than Rex.
  - Swift turns further than Boulder in the same time.
  - In a bump, Bella pushes Ruby further than Ruby pushes Bella.
  - `racer` input: own slot only, setup/over only, bad ids ignored; picks survive a rematch.
- Browser e2e: a phone picks a racer from the grid, a controller cycles its Racer row, the TV
  shows both, then a race runs with no errors.
- README rows (phone and controller) and `docs/GAMES.md` regenerated.

## Out of scope

Perks/special abilities, unlockables, separate kart parts, 3D (see `docs/DREAMS.md`).
