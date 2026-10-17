# Minigames: Micro Mayhem and Party Minigames

Status: design approved in chat (2026-10-17); this spec is for review before planning.

## Goal

Add two lobby games built on one shared minigame engine:

- **Micro Mayhem**: WarioWare-style 3-5 s micro-games, both players at once, lives, speeding up.
- **Party Minigames**: a Mario Party-style playlist of 20-40 s head-to-head minigames, first to N wins.

Out of scope for now: a Mario Party-style board (dice, coins, stars). The user will ask for it if wanted.

Constraints: 2 players, TV + phones or controllers (any mix), 2D only (runs on a Pi), the existing hub
conventions (game modules, `withSetup` settings, renderers, sounds hooks, stats, tournaments).

## Architecture

### Minigame modules (server)

`server/games/minis/<id>.js`, collected by `server/games/minis/index.js` (`MICROS`, `PARTIES`).

```js
export default {
  id: 'stop-it',
  kind: 'micro',            // 'micro' | 'party'
  name: 'Stop it!',
  order: 'STOP IT!',        // the one-line instruction shown big
  howTo: 'Stop the needle in the green', // phone/controller hint
  durationMs: 4000,         // base length; micros are scaled by speed
  create(api) { ... },      // returns an instance
};
```

`api` (given by the wrapper): `{ players, now, rng, speed, update, setTimeout, clearTimeout, end(result) }`.
`api.setTimeout` timers are cleared by the wrapper when the minigame ends.

Instance: `start()`, `onInput(slot, input)`, `view(slot)` (slot `null` for the TV), optional `onTimeUp()`.

- A micro calls `end({ pass: [bool, bool] })`. When time runs out the wrapper calls `onTimeUp()`, which
  must call `end` (default if absent: nobody passes).
- A party mini calls `end({ winner: 0 | 1 | null })` (null: draw, nobody scores). If time runs out,
  `onTimeUp()` decides (most progress wins, else draw).

Minigames take their randomness from `api.rng` so tests can seed them.

### Wrappers (lobby games)

`server/games/micro-mayhem.js` and `server/games/party-minis.js`, both `category: 'competitive'`, both
built on a shared runner `server/games/minis/runner.js` that owns:

- the playlist: shuffle, then no repeats until every minigame has been played;
- phases: `intro` (title card + 3-2-1, micro 1.5 s, party: "Next up" until both press Ready or 8 s),
  `play`, `result` (1.5 s micro, 3 s party), `over`;
- timers (all via `ctx.setTimeout`, cleared between minigames);
- routing: `onInput` goes to the current minigame only in `play`; `ready` / `rematch` are handled by the runner.

View sent to renderers: `{ phase, mini: {id, name, order, howTo, kind}, endsAt (ms from now), state
(the minigame's view), lastResult, …wrapper fields }`, plus `winner`, `draw`, `scores` for stats.

### Micro Mayhem rules

- Lives 3 (setting: 3 or 5). Speed level starts at 1; every 5 micros it rises by one and durations scale
  by 0.85 each level (floor 0.45). Setting `pace`: normal, or fast (start at level 3).
- After each micro, each player who failed loses a life.
- Game over when someone is at 0. If both reach 0 on the same micro: sudden death (both on 1 life
  again, the next micro decides; repeats while both fail or both pass).
- `scores` = lives left; `winner` = the survivor.

### Party Minigames rules

- First to 3 wins (setting: 3, 4 or 5).
- `scores` = wins; a draw minigame scores nobody.

### Client

- Each minigame: `public/games/minis/<id>.js` calls
  `ArkMini.register(id, { host: {mount, update, unmount}, phone: {mount, update, unmount}, pad(btn, state, slot), padPoll?(pad, state, slot), sounds?(prev, state) })`.
- `public/games/minis/mini.js` defines `ArkMini` and helpers (loading, countdown bar).
- Wrapper renderers `public/games/micro-mayhem/{host,player}.js` and `public/games/party-minis/{host,player}.js`
  draw the frame (lives / scores, speed level, timer bar, title and result cards) and mount the current
  minigame's renderer inside it, loading its script on first use. The wrapper forwards `pad`/`padPoll`
  and merges minigame sounds with its own (`go` on start, `correct`/`wrong` on results, `fanfare` at the end).
- Shared minigame CSS: `public/games/minis/style.css`, classes prefixed `mi-`.

### Timing fairness

Reaction Duel times taps by server arrival. For the minigames where a few tens of ms matter
(Stop it!, Quick Draw, Sweet Spot), the phone instead sends `t`: ms since it rendered the start of
`play`. The server uses `t` when it is plausible (0 ≤ t ≤ its own elapsed time + 150 ms) and falls back
to its own elapsed time otherwise. Controllers are on the TV, so their inputs use the TV's elapsed time
the same way. Inputs after the minigame ends are ignored.

## First batch

Micro (8), all both-at-once, phone and controller:

| id | Order | Phone | Controller | Pass |
| --- | --- | --- | --- | --- |
| tap-it | TAP IT! | tap the moving 🎯 | stick/D-pad moves a cursor, A taps | hit it once before time |
| stop-it | STOP IT! | tap to stop the needle | A | needle in the green zone |
| shake-it | SHAKE IT! | shake the phone (devicemotion; a "tap fast" fallback if no sensor) | wiggle stick / mash A | reach the shake meter |
| odd-one | ODD ONE OUT! | tap the different emoji in a 3×3 | D-pad + A | right pick (first pick counts) |
| count-em | COUNT 'EM! | pick the number of 🐑 from 4 choices | D-pad + A | right number |
| swipe-it | SWIPE IT! | swipe the arrow's way (3 arrows) | D-pad | all 3 right, a wrong one fails |
| dont-touch | DON'T TOUCH! | anything fails | any button fails | no input |
| quick-math | QUICK MATH! | pick the answer from 4 | D-pad + A | right answer |

Party (5):

| id | Name | Play | Winner | Time-out |
| --- | --- | --- | --- | --- |
| balloon | Balloon Pump | mash (phone button / A) to inflate; 40 pumps pops it | first to pop | more pumps; tie draw |
| hot-potato | Hot Potato | the holder taps to pass it; a pass takes 0.6 s to land; the fuse is 8-20 s, hidden | the one not holding it at the bang | (no time-out) |
| quick-draw | Quick Draw | wait for BANG! after a random 2-6 s, then tap; tapping early loses | fastest valid tap, best of 3 | no tap: draw |
| memory-path | Memory Path | watch a growing sequence on a 3×3, both repeat it on their own phone | the first mistake loses; both fail the same length: draw | 30 s cap: longest wins |
| sweet-spot | Sweet Spot | a wheel spins on each phone/TV; stop it on a number 1-10 | higher total over 3 spins | unstopped spin scores 0 |

## Errors and edge cases

- A player leaves mid-game: the hub's existing pause/reconnect handling applies; minigame timers are
  game timers, so they stop with the game.
- Unknown or malformed inputs are ignored by each minigame (validated like the other games).
- `needsPhone`: not required. A controller plays every minigame. Shake-it uses the stick/A for
  controllers and on phones without motion permission.

## Testing

- `test/minis.test.js`: each minigame with a seeded `rng` and `fakeCtx`: pass/fail or winner, time-out,
  bad inputs, plus the `t` plausibility clamp.
- `test/micro-mayhem.test.js` and `test/party-minis.test.js`: playlist with no repeats, lives, speed-up,
  sudden death, first-to-N, ready/auto-start, rematch, settings, the stats view fields.
- `test/sounds.test.js`: hooks for both wrappers.
- Lobby test: both games are listed under Competitive.
- A Playwright run: TV + two phones, several micros and one or two party rounds, no page errors, screenshots checked.

## README

Games table rows, settings rows, controller rows, remove Micro Mayhem from the wishlist, and an "Adding
a minigame" note under "Adding a game".
