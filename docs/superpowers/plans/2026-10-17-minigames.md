# Minigames (Micro Mayhem + Party Minigames) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two new competitive lobby games, Micro Mayhem and Party Minigames, running 13 minigames (8 micro, 5 party) on one shared engine.

**Architecture:** A shared server base class (`MiniGame` in `server/games/minis/runner.js`) runs a playlist of minigame modules (`server/games/minis/<id>.js`) through intro → play → result phases; the two lobby games subclass it and add lives/speed or first-to-N scoring. On the client, `ArkMini` (`public/games/minis/mini.js`) is a registry each minigame renderer (`public/games/minis/<id>.js`) joins; the two lobby games' renderers draw the frame and mount the current minigame inside it.

**Tech Stack:** Node 22 ESM, Socket.IO hub (existing), vanilla browser JS renderers, `node --test`, Playwright (e2e in scratchpad).

**Spec:** `docs/superpowers/specs/2026-10-17-minigames-design.md`

## Global Constraints

- 2 players; any mix of phones and controllers; no minigame needs a phone (`needsPhone` unset).
- 2D only.
- Both lobby games: `category: 'competitive'`; views carry `winner`, `draw`, `scores` (stats/tournaments).
- All timers through the ctx (`ctx.setTimeout`); minigame timers are cleared when a minigame ends.
- Randomness only through an injected `rng` (default `Math.random`) so tests can seed it.
- Timing clamp: use the phone's `t` when `0 ≤ t ≤ serverElapsed + 150`, else `serverElapsed`.
- Micro Mayhem: lives 3 or 5 (default 3); pace normal or fast (fast starts at level 3); level rises every 5 micros; duration scale `max(0.45, 0.85 ** (level - 1))`; both out on the same micro → sudden death on 1 life each.
- Party Minigames: first to 3, 4 or 5 wins (default 3); draws score nobody; Next-up card waits for both Ready or 8 s.
- Phases: micro intro 1500 ms, micro result 1500 ms, party result 3000 ms.
- CSS prefix for shared minigame styles: `mi-`. Wrapper CSS prefixes: `mx-` (Micro Mayhem), `pm-` (Party Minigames).
- Commits end with the session attribution lines.

## Review Focus

1. A tap that arrives during `intro`/`result`, or after a minigame ended (late network) → ignored, never counted for the next minigame. (Task 1 test.)
2. Rematch (or a new minigame) while an old minigame's timers or `api.end` are still pending → the stale end is ignored. (Task 1 test.)
3. Garbage `t` from a phone (negative, NaN, string, far future) → clamped to the server's elapsed time. (Task 1 test.)
4. Spammed input: repeated picks, a mash bot → first pick counts; pumps closer than 40 ms apart ignored. (Tasks 4 and 5 tests.)
5. A controller player who never presses Ready → the party minigame starts after 8 s anyway. (Task 3 test.)

---

### Task 1: Minigame engine (server)

**Files:**
- Create: `server/games/minis/runner.js`
- Create: `server/games/minis/index.js` (exports `MICROS = []`, `PARTIES = []`, filled in Tasks 4 and 5)
- Test: `test/minis-runner.test.js`

**Interfaces:**
- Produces:
  - `TIMING = { introMicroMs: 1500, readyMaxMs: 8000, resultMicroMs: 1500, resultPartyMs: 3000 }`
  - `T_SLACK_MS = 150`; `plausibleT(t, serverElapsed) -> number`
  - `class Playlist { constructor(ids: string[], rng); next() -> string }`: shuffles, no repeats until all used, and never the same id twice in a row across a reshuffle (when more than one id).
  - `class MiniGame { constructor(ctx, pool: MiniDef[], rng = Math.random) }`, with:
    - `start()`: calls `this.reset()`, sets `count = 0`, `winner = null`, `draw = false`, then `this.nextMini()`.
    - `nextMini()`: phase `'intro'`. A micro auto-plays after `introMicroMs`; a party mini waits for both `{type:'ready'}` or `readyMaxMs`.
    - `play()`: phase `'play'`, records `playAt = ctx.now()`, calls `instance.start()`, schedules time-up at `round(def.durationMs * this.scale())`. Time-up calls `instance.onTimeUp()` when defined, else `end(def.kind === 'micro' ? { pass: [false, false] } : { winner: null })`.
    - `end(result)`: ignored unless phase is `'play'` and the call comes from the current instance's api. It clears the minigame's timers, sets phase `'result'`, `lastResult = result`, `count++`, then calls `this.score(result)`. After `resultMicroMs`/`resultPartyMs` it calls `this.finish()` when `this.isOver()`, else `nextMini()`.
    - `finish()`: phase `'over'`; subclasses set `winner`/`draw` in `score` or `isOver`.
    - `onInput(slot, input)`: `rematch` in `over` → `start()`; `ready` in a party intro; otherwise forwards to the instance only in `play`.
    - `view(slot) -> { phase, count, mini: {id, name, order, howTo, kind}, durationMs, timeLeftMs, ready: [bool, bool], state: instance.view(slot), lastResult, winner, draw, scores, players }`. Subclasses add fields via `extraView()`.
    - `hostView()` = `view(null)`; `playerView(slot)` = `view(slot)` plus `you: slot`.
    - Subclass hooks: `reset()`, `scale() -> number` (default 1), `score(result)`, `isOver() -> bool`, `extraView() -> object`, `scores` (array).
  - Minigame def: `{ id, kind: 'micro'|'party', name, order, howTo, durationMs, create(api) }`.
  - `api`: `{ players, rng, speed, now, elapsed() -> ms since play(), update, setTimeout, clearTimeout, end(result) }`. `speed` = `this.scale()`.
  - Instance: `start()`, `onInput(slot, input)`, `view(slot)`, optional `onTimeUp()`.

- [ ] **Step 1: Write the failing tests** in `test/minis-runner.test.js`. Use two stub minis (one micro, `durationMs: 1000`, which ends when both send `{type:'go'}`; one party) and a test subclass:
  - `plausibleT`:
    - `plausibleT(120, 500) === 120`
    - `plausibleT(-5, 500) === 500`
    - `plausibleT(NaN, 500) === 500`
    - `plausibleT('9', 500) === 500`
    - `plausibleT(651, 500) === 500`
    - `plausibleT(650, 500) === 650`
  - `Playlist`: over 3 ids × 10 rounds, each block of 3 holds all ids, and no two neighbours are equal.
  - Micro flow: `start()` → phase `intro`; `advance(1500)` → `play`; both send `go` → `result` with `lastResult.pass`; `advance(1500)` → next `intro`.
  - Time-up: no input → after `durationMs * scale()` the result is `{pass: [false, false]}`.
  - Review focus 1: a `go` during `intro`/`result` doesn't reach the instance (instance input count unchanged).
  - Review focus 2: keep the first instance's `api`, call `start()` again (rematch), then call the old `api.end(...)` → phase and `count` unchanged.
  - Party intro: both `ready` → `play` at once; one `ready` only → `play` after `advance(8000)` (review focus 5).
  - `over`: when `isOver()` is true after a result → phase `over`; `rematch` → `intro` with `count === 0`.

- [ ] **Step 2: Run them to verify they fail**
  Run: `node --test test/minis-runner.test.js`
  Expected: FAIL (`Cannot find module .../runner.js`).

- [ ] **Step 3: Implement `runner.js` and an empty `minis/index.js`** to the interface above. Give each instance its own timer list, so `end()` can clear only that minigame's timers. Store an `epoch` that each `api.end` checks, so stale calls are ignored.

- [ ] **Step 4: Run the tests to verify they pass**
  Run: `node --test test/minis-runner.test.js`, then `node --test test/*.test.js`
  Expected: all PASS.

- [ ] **Step 5: Commit** (`Minigames: shared engine (playlist, phases, timing clamp)`).

### Task 2: Micro Mayhem (server)

**Files:**
- Create: `server/games/micro-mayhem.js`
- Modify: `server/games/index.js` (import, plus `withSetup` entry after Sumo)
- Test: `test/micro-mayhem.test.js`

**Interfaces:**
- Consumes: `MiniGame`, `TIMING` (Task 1); `MICROS` from `minis/index.js` (the tests pass their own stub pool).
- Produces:
  - `class MicroMayhem extends MiniGame { constructor(ctx, pool = MICROS, rng) }`, with `LEVEL_EVERY = 5`, `SCALE_STEP = 0.85`, `SCALE_MIN = 0.45`.
  - View extras: `{ lives: [n, n], startLives, level, suddenDeath: bool }`; `scores = lives`.
  - Def: `{ id: 'micro-mayhem', name: 'Micro Mayhem', category: 'competitive', music: 'action', tagline }`.
  - Settings: `lives` `{title:'Lives', values:[3, 5]}`; `pace` `{title:'Pace', values:['normal', 'fast'], label: Normal / Fast (starts at speed 3)}`.

- [ ] **Step 1: Write the failing tests** (stub micro pool where inputs `{type:'pass'}`/`{type:'fail'}` end the micro):
  - Level is `1` for micros 1-5 and `2` from micro 6; `scale()` at level 2 is `0.85`, and at level 10 it is `0.45`. With `pace: 'fast'` the first level is `3`.
  - A fail costs that player a life; at 0 lives → `over`, `winner` is the other player, `scores` is lives.
  - Both reach 0 on the same micro → `suddenDeath: true`, lives `[1, 1]`. Both fail again → still sudden death. One fails → `over` with the other the winner.
  - Settings: `lives: 5` gives `lives [5, 5]`.
  - Lobby: `micro-mayhem` is listed and its category is `competitive`.

- [ ] **Step 2: Run them to verify they fail** (`node --test test/micro-mayhem.test.js` → module not found).
- [ ] **Step 3: Implement** `micro-mayhem.js` and register it with `withSetup(microMayhem, {...})`.
- [ ] **Step 4: Run** `node --test test/*.test.js` → all PASS.
- [ ] **Step 5: Commit** (`Micro Mayhem: lives, speed levels, sudden death`).

### Task 3: Party Minigames (server)

**Files:**
- Create: `server/games/party-minis.js`
- Modify: `server/games/index.js`
- Test: `test/party-minis.test.js`

**Interfaces:**
- Consumes: `MiniGame` (Task 1), `PARTIES`.
- Produces:
  - `class PartyMinis extends MiniGame { constructor(ctx, pool = PARTIES, rng) }`.
  - View extras: `{ wins: [n, n], target }`; `scores = wins`.
  - Def: `{ id: 'party-minis', name: 'Party Minigames', category: 'competitive', music: 'casual', tagline }`.
  - Setting: `firstTo('Wins needed', [3, 4, 5])`, i.e. key `wins`.

- [ ] **Step 1: Write the failing tests** (stub party pool):
  - `{winner: 0}` adds a win to player 0; `{winner: null}` scores nobody.
  - Reaching `target` wins → `over`, `winner` set, `draw: false`.
  - The `wins: 4` setting gives `target === 4`.
  - Ready flow (review focus 5) as in Task 1, but through `PartyMinis`.
  - Lobby: `party-minis` is listed as `competitive`.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement and register.**
- [ ] **Step 4: Run** `node --test test/*.test.js` → all PASS.
- [ ] **Step 5: Commit** (`Party Minigames: first-to-N playlist`).

### Task 4: The 8 micro minigames (server)

**Files:**
- Create: `server/games/minis/{tap-it,stop-it,shake-it,odd-one,count-em,swipe-it,dont-touch,quick-math}.js`
- Modify: `server/games/minis/index.js` (`MICROS`)
- Test: `test/minis-micro.test.js`

**Interfaces:**
- Consumes: def/api/instance contract and `plausibleT` (Task 1).
- Produces: each def `kind: 'micro'`. Every micro ends early (`api.end({pass})`) once both players are decided. Each player is decided at most once: their first decisive input counts, and later inputs are ignored. The view and exported helpers below are what the client (Task 7) draws.

| id | durationMs | State in view | Input | Pass |
| --- | --- | --- | --- | --- |
| tap-it | 4000 | `seed`; exported `targetAt(ms, seed) -> {x, y}` in 0..1 (Lissajous path); `TARGET_R = 0.12` | `{type:'tap', x, y, t}` | distance to `targetAt(plausibleT(t))` ≤ `TARGET_R`; misses don't decide |
| stop-it | 3500 | `zone: {from, to}` (width 0.18, `from` in 0.1..0.72); `periodMs = 1400 * speed`; exported `needleAt(ms, periodMs)` (triangle wave 0..1) | `{type:'stop', t}` | `needleAt(plausibleT(t))` within the zone |
| shake-it | 4000 | `need: 15`, `got: [n, n]` | `{type:'shake'}` | `got` reaches 15 (decides pass) |
| odd-one | 4000 | `cells: 9 emoji` (one differs), from an emoji pair list | `{type:'pick', i}` | `i` is the odd one |
| count-em | 4000 | `sheep: [{x, y}]` (3..9), `choices: 4 numbers` incl. the answer | `{type:'pick', n}` | `n` is right |
| swipe-it | 4000 | `arrows: 3 of 'up'/'down'/'left'/'right'`, `done: [n, n]` | `{type:'swipe', dir}` | all 3 right; a wrong one fails |
| dont-touch | 3000 | none | any input | any input fails; time-up passes the rest (`onTimeUp`) |
| quick-math | 4500 | `q: 'a op b'` (`+`, `−`, `×`; operands 2..12), `choices: 4` | `{type:'pick', n}` | `n` is the answer |

Every micro implements `onTimeUp()`: players already decided keep their result; undecided players fail (dont-touch: undecided players pass).

- [ ] **Step 1: Write the failing tests**, one `test(...)` per micro, with seeded `rng`, `fakeCtx`, and the instance driven through a `MicroMayhem` built with `pool = [def]`, or directly via a small `api` stub:
  - The right input → pass, the wrong input → fail. For tap-it, compute a hit with `targetAt` and a miss 0.5 away. For stop-it, compute `t` with the needle in the zone and out of it.
  - Review focus 4: a second pick after a wrong first pick doesn't flip to pass; a duplicate `shake` past 15 is harmless.
  - dont-touch: one input fails that player; on time-up the other passes.
  - `MICROS.length === 8` and the ids are unique.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement the 8 modules and fill `MICROS`.**
- [ ] **Step 4: Run** `node --test test/*.test.js` → all PASS.
- [ ] **Step 5: Commit** (`Minigames: 8 micro-games`).

### Task 5: The 5 party minigames (server)

**Files:**
- Create: `server/games/minis/{balloon,hot-potato,quick-draw,memory-path,sweet-spot}.js`
- Modify: `server/games/minis/index.js` (`PARTIES`)
- Test: `test/minis-party.test.js`

**Interfaces:** each def `kind: 'party'`; it ends with `api.end({winner: 0|1|null})`.

| id | durationMs | Rules (pinned values) | State in view | Input |
| --- | --- | --- | --- | --- |
| balloon | 30000 | 40 pumps pops it; pumps < 40 ms after that player's last are ignored; time-up: more pumps wins, equal → draw | `pumps: [n, n]`, `need: 40` | `{type:'pump'}` |
| hot-potato | 25000 | holder starts at random; only the holder can pass; a pass is in flight 600 ms (the target counts as holding); fuse = 8000-20000 ms from `rng`, hidden; at the bang the holder loses | `holder`, `flying: bool`, `passes` | `{type:'pass'}` |
| quick-draw | 40000 | up to 3 duels; each waits 2000-6000 ms (`rng`) then `bang`; firing before the bang loses that duel; after a first valid shot, wait 300 ms for a faster `t`, then the lowest `plausibleT(t) - bangAt` wins; no shot within 3000 ms → that duel is a draw; first to 2 duel wins; after 3 duels, more duel wins, else draw | `duel`, `stage: 'wait'/'bang'/'done'`, `duelWins`, `last: {winner, ms: [..], early}` | `{type:'fire', t}` |
| memory-path | 30000 | sequence of cells 0-8, starting length 3, +1 each round; show 600 ms per step; then each player enters it (10 s limit, out of time = mistake); a mistake knocks out that player at that length; one out and the other completes → the other wins; both out the same round → draw; both complete → next round; time-up → draw | `stage: 'show'/'input'`, `seq` (only while `show`), `step: [n, n]`, `out: [bool, bool]`, `length` | `{type:'cell', i}` |
| sweet-spot | 25000 | each player stops 3 spins; exported `wheelValue(ms, offset) = 1 + floor((ms + offset) / 110) % 10`; spin n starts at the previous stop + 800 ms (first at 0) with an `rng` offset; the value is at `plausibleT(t) - spinStart`; unstopped spins at time-up score 0; higher total wins, equal → draw | `spins: [[v...], [v...]]`, `spinStart: [ms, ms]`, `offset: [o, o]` | `{type:'stop', t}` |

- [ ] **Step 1: Write the failing tests**, one per minigame (seeded `rng`, `fakeCtx`):
  - balloon: 40 pumps 50 ms apart → winner; pumps 10 ms apart count once per 40 ms (review focus 4); a time-up tie → draw.
  - hot-potato: a non-holder `pass` is ignored; at the fuse (`advance(20000)`) the holder's rival wins; an in-flight pass at the bang → the target loses.
  - quick-draw: an early fire loses the duel; a faster `t` wins; two duel wins end it; no shots → draw after 3 duels.
  - memory-path: the right sequence advances `length`; one wrong → the other wins; both wrong → draw; `seq` absent from the view during `input`.
  - sweet-spot: `wheelValue(0, 0) === 1`, `wheelValue(110, 0) === 2`, `wheelValue(1100, 0) === 1`; totals decide; time-up gives 0 for unstopped spins.
  - `PARTIES.length === 5`.
- [ ] **Step 2: Run them to verify they fail.**
- [ ] **Step 3: Implement the 5 modules and fill `PARTIES`.**
- [ ] **Step 4: Run** `node --test test/*.test.js` → all PASS.
- [ ] **Step 5: Commit** (`Minigames: 5 party minigames`).

### Task 6: Client frame (ArkMini + both lobby games' renderers)

**Files:**
- Create: `public/games/minis/mini.js`, `public/games/minis/style.css`
- Create: `public/games/micro-mayhem/{host.js,player.js,style.css}`, `public/games/party-minis/{host.js,player.js,style.css}`
- Modify: `public/host/host.js` and `public/play/play.js` only if lobby icons/labels need it (check how other games get their card emoji)
- Test: `test/sounds.test.js` (two new tests)

**Interfaces:**
- Produces:
  - `window.ArkMini = { register(id, r), load(id) -> Promise<r>, timerBar(el, durationMs, timeLeftMs) }`.
  - Each `r`: `{ host: {mount(el), update(state, v), unmount()}, phone: {mount(el, api), update(state, v), unmount()}, pad?(btn, state, slot, v) -> input|null, padPoll?(pad, state, slot, v) -> input|null, sounds?(prevState, state) -> string[] }`.
  - The minigame phone `api`: `{ send(input) }` adds `t = performance.now() - playSeenAt` (ms since this screen first saw this `count` in `play`) plus `vibrate`. The wrapper host does the same for `pad` and `padPoll` inputs.
- Wrappers (same shape for both games):
  - The frame shows lives (mx) or wins (pm), the level / sudden death (mx), the timer bar and `mi-stage`.
  - The intro card shows `order` and `howTo`, with a party Ready button on phones; A = ready on controllers.
  - The result card shows pass/fail per player (mx) or the winner (pm).
  - The over card has Rematch.
  - The current minigame renderer is (re)mounted when `v.count` or `v.mini.id` changes.
  - `sounds(prev, v)`: `['go']` on intro→play; on play→result, micro gives `['wrong']` if anyone failed else `['correct']`, party gives `['point']` when there's a winner; on →over `['fanfare']`; plus the minigame's own `sounds(prev.state, v.state)` while the same `count` is in `play`.
  - `padHint`: `'Follow the order on screen · D-pad / stick + A · A: ready / rematch'`.

- [ ] **Step 1: Write the failing sounds tests**: drive `MicroMayhem`/`PartyMinis` with a stub pool through intro→play→result→over and assert `['go']`, `['wrong']` or `['correct']` (micro), `['point']` (party) and `['fanfare']`. In the vm loader, `Ark.loadScript` returns a never-resolving promise (already the case), so minigame scripts don't load.
- [ ] **Step 2: Run** `node --test test/sounds.test.js` → FAIL (no renderer files).
- [ ] **Step 3: Implement `mini.js`, both wrappers and the CSS.** Lazy-load minigame scripts with `Ark.loadScript('/games/minis/' + id + '.js')`, and load `/games/minis/style.css` once.
- [ ] **Step 4: Run** `node --test test/*.test.js` → all PASS (this includes "every TV renderer has a sounds hook").
- [ ] **Step 5: Commit** (`Minigames: client frame and lobby renderers`).

### Task 7: Micro minigame renderers

**Files:** Create `public/games/minis/{tap-it,stop-it,shake-it,odd-one,count-em,swipe-it,dont-touch,quick-math}.js`.

**Interfaces:**
- Consumes: `ArkMini.register` (Task 6) and each micro's view/input (Task 4). tap-it and stop-it re-implement `targetAt`/`needleAt` client-side with the same formula (copy the function, and add a comment pointing to the server file).
- Per-micro specifics:
  - tap-it:
    - Phone: the target moves on the phone, and a tap sends normalised x/y.
    - Controller: `padPoll` moves a cursor drawn on the TV; A sends `{type:'tap', x, y}`.
  - stop-it: the needle animates from `playSeenAt`.
  - shake-it:
    - Phone: a `devicemotion` magnitude above 18 m/s² (with a 120 ms gap) sends `shake`. A big "SHAKE or TAP" button also sends one per tap.
    - Controller: `padPoll` sends `shake` when the stick crosses ±0.6 on alternate sides, and A sends `shake`.
  - swipe-it:
    - Phone: touch swipes over 40 px, plus arrow buttons.
    - Controller: D-pad.
  - Pick games:
    - Phone: big buttons.
    - Controller: D-pad moves a highlight on the TV, A picks.
  - dont-touch: any phone tap or controller button sends `{type:'touch'}`.
  - The TV shows each player's state side by side, P1 on the left and P2 on the right: their own target, needle, meter, picks and ✓/✗ when decided.
- [ ] **Step 1:** Write the 8 renderers.
- [ ] **Step 2:** Run `node --test test/*.test.js` → PASS (the vm loads only wrapper host files; also run `node --check` on each new file).
- [ ] **Step 3: Commit** (`Minigames: micro renderers`).

### Task 8: Party minigame renderers

**Files:** Create `public/games/minis/{balloon,hot-potato,quick-draw,memory-path,sweet-spot}.js`.

**Interfaces:** consumes Task 5 views. sweet-spot copies `wheelValue`.
- balloon: two balloons grow with `pumps/need`; a big PUMP button; A to pump; the sound `'drop'` per 5 pumps.
- hot-potato: 💣 on the holder's side, sliding while `flying`; the holder's phone flashes PASS!; A passes; a sound on each pass.
- quick-draw: "Wait…" then a big BANG! flash; FIRE button / A; shows ms and "Too early!".
- memory-path: a 3×3 grid; tiles light in sequence during `show` (TV and phones); during `input`, phones tap tiles and controllers use D-pad + A; each player's progress is shown.
- sweet-spot: each player's wheel number cycles; STOP / A; shows the 3 spins and the total.
- [ ] **Step 1:** Write the 5 renderers.
- [ ] **Step 2:** Run `node --test test/*.test.js` and `node --check` on each → PASS.
- [ ] **Step 3: Commit** (`Minigames: party renderers`).

### Task 9: README, end-to-end check, ship

**Files:** Modify `README.md`; scratchpad e2e script `minis-e2e.cjs`.

- [ ] **Step 1: README.**
  - Add Micro Mayhem and Party Minigames rows under ⚔️ Competitive, listing the minigames.
  - Add settings rows: Micro Mayhem 3 or 5 lives, Normal or Fast pace; Party Minigames first to 3, 4 or 5.
  - Add a controller row.
  - Remove Micro Mayhem from the wishlist.
  - Add "Adding a minigame: write `server/games/minis/<id>.js` + `public/games/minis/<id>.js`, list it in `minis/index.js`".
- [ ] **Step 2: E2E (in the background, logging to a file).**
  - Setup: TV + two phones (the HOOK init script).
  - Micro Mayhem: play 6+ micros, answering from `window.__view.state` where possible.
  - Party Minigames: play 2 party minigames.
  - Expected: no `pageerror`, a phase progression is seen, and screenshots of the intro/play/result cards are checked by eye.
- [ ] **Step 3:** Run `node --test test/*.test.js` → all PASS. Then commit, push, open the PR, subscribe, and set the 50-minute check-in. Merge when `test` and `image` are green, sync the branch and report.
