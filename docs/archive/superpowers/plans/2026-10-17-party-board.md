# Party Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Mario Party-style 2D board game (Party Board) for two players, with a party minigame after every round.

**Architecture:** `PartyBoard` (server/games/party-board.js) owns rounds, turns, prompts, movement and spaces; a looping map lives in `server/games/board/maps.js`; each round a `OneMini` (a `MiniGame` subclass in server/games/minis/runner.js) plays one party minigame and calls back with the result. The client renders the board and hands the screen to the existing ArkMini frame during minigames.

**Tech Stack:** Node 22 ESM, `node --test`, vanilla browser JS, Playwright (scratchpad e2e).

**Spec:** `docs/superpowers/specs/2026-10-17-party-board-design.md`

## Global Constraints

- Settings: `turns` [10, 15, 20]; `style` ['mix', '2d', '3d']; `bonus` [1, 0] (first = default).
- Dice 1-10 from the injected `rng`; Double Dice adds two rolls; Mushroom +3.
- Star costs 20; minigame win +10, draw +3 each; blue +3; red −3 (never below 0).
- Events (equal odds): shower +5 each, swap places, steal up to 5, lucky +10, star moves.
- Slot: 3 reels 1-5; three of a kind +15, a pair +5, else +1.
- Items (max 3): mushroom 5, double 10, warp 10, coin-thief 8 (steal up to 10), star-thief 35 (only if the rival has a star).
- Every prompt: 15 s limit, defaults item → none, roll → roll, star → no, shop → none, slot → stop the rest.
- Coins never go below 0. Stats view `scores` = stars. Category 'competitive', music 'casual', CSS prefix `pb-`.
- Commits end with the session attribution lines.

## Review Focus

1. An input from the player whose turn it isn't, or for a prompt that isn't open → ignored. (Task 3 test.)
2. A player who never answers (a controller left idle) → the prompt times out to its default; the game never stalls. (Task 3 test.)
3. Star Thief while the rival has 0 stars → not offered in the item prompt, and ignored if sent. (Task 3 test.)
4. Coins never negative after red spaces, thieves or events on a broke player. (Task 2 and Task 3 tests.)
5. Rematch during a walk or a minigame → no stale step / prompt timers fire into the new match. (Task 2 test.)

---

### Task 1: Map + OneMini

**Files:** Create `server/games/board/maps.js`; Modify `server/games/minis/runner.js`; Test `test/party-board.test.js`.

**Interfaces — Produces:**
- `MAPS = { island: { name: 'Party Island', spaces: [{ x, y, type, starCandidate? }] } }`, ~28 spaces in loop order; `type` ∈ 'blue' | 'red' | 'event' | 'bonus' | 'shop' | 'start'; space 0 is 'start' (counts as blue: +3 when landed on). Counts: 2 shop, 3 event, 2 bonus, 4-6 `starCandidate: true` (on blue spaces), blue:red ≈ 2:1.
- `class OneMini extends MiniGame { constructor(ctx, pool, rng, onDone(result)) }`: plays exactly one minigame; after its result phase, calls `onDone(lastResult)` instead of going to `over`.

- [ ] **Step 1:** tests — `map island: a loop of 24-32 spaces with the right counts` (assert counts above, x/y in 0..1, unique positions); `OneMini plays one party minigame and reports its result` (stub party pool; both ready → play → win → `advance(TIMING.resultPartyMs)` → onDone called once with `{winner}`; phase never 'over' afterwards on its own).
- [ ] **Step 2:** run `node --test test/party-board.test.js` → FAIL (missing modules).
- [ ] **Step 3:** implement both (OneMini: `isOver()` → `this.count >= 1`; override `finish()` → `this.onDone(this.lastResult)`).
- [ ] **Step 4:** run → PASS; full suite PASS.
- [ ] **Step 5:** commit `Party Board: map and one-minigame runner`.

### Task 2: PartyBoard core (turns, roll, walk, blue/red, minigame, end)

**Files:** Create `server/games/party-board.js`; Modify `server/games/index.js` (import + `withSetup` with the three settings, labels: '10 turns', 'Mix of 2D and 3D' / '2D only' / '3D only', 'Bonus stars' / 'No bonus stars'); Test `test/party-board.test.js`.

**Interfaces — Produces:**
- `TIMING = { stepMs: 250, promptMs: 15000, messageMs: 1500, bonusMs: 4000 }`; `PRICES`, `ITEMS` (ids above), `STAR_PRICE = 20`.
- `class PartyBoard { constructor(ctx, rng = Math.random, map = MAPS.island, pool = PARTIES) }` with `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`; def `{ id: 'party-board', name: 'Party Board', category: 'competitive', music: 'casual', tagline }`.
- Inputs: `{ type: 'choose', value }` (prompt answers); `{ type: 'rematch' }` in `over` → `start()`; during `minigame` every input goes to the OneMini.
- View (spec's list): `{ phase, round, turns, turn, players: [{ space, coins, stars, items, earned, minigames }], board: { spaces, star }, prompt: { slot, kind, options, msLeft } | null, dice: { values, total } | null, message, mini, bonusStars, winner, draw, scores }`; `playerView` adds `you`.
- Flow helpers (internal but tested through behaviour): `turnStart()` → item prompt if holding usable items else roll prompt; `walk(steps)` one space per `stepMs`; `land()`; `endTurn()`; `roundEnd()` → minigame; `finishGame()`.
- An `epoch` guards every timer callback (rematch / phase change makes old ones no-ops).

- [ ] **Step 1:** tests (seeded rng; helper `answer(game, slot, value)` and `settle(ctx)` = advance until a prompt is open or the phase changes):
  - `roll moves the token that many spaces, one per step` (track `players[0].space` after each `stepMs`).
  - `blue +3, red -3 and never below 0` (place the player via the map: find a blue/red space index and set `game.players[0].space` before rolling a known total using a stub rng).
  - `after both turns a minigame plays; winner +10, draw +3 each; then the next round` (stub party pool in constructor).
  - `after the last round: bonus stars then over; most stars wins, coins break ties, equal is a draw; scores are stars`.
  - `bonus off: no bonus stars`; `turns setting 15`.
  - `rematch mid-walk: no stale step fires` (start, roll, `start()` again, advance → positions stay 0 until a new roll).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement core (no shop/star/items/events/slot yet: those spaces act as blue for now).
- [ ] **Step 4:** run → PASS; full suite PASS (lobby tests include the new game).
- [ ] **Step 5:** commit `Party Board: turns, walking, minigames and the end`.

### Task 3: Star, shop, items, events, slot, time-outs

**Files:** Modify `server/games/party-board.js`; Test `test/party-board.test.js`.

- [ ] **Step 1:** tests:
  - `passing the star with 20 coins offers it; yes buys and moves the star; no keeps walking`; `passing with 19 coins: no prompt`.
  - `the shop offers only affordable items, only with a free slot; buying takes coins`; `max 3 items`.
  - `items before rolling: mushroom +3, double dice two rolls, warp swaps, coin thief takes up to 10, star thief takes a star`; `star thief not offered (and ignored) when the rival has no stars` (focus 3).
  - `each event` (force via stubbed rng): shower, swap, steal up to 5 (rival with 2 coins loses 2, focus 4), lucky, star moves to another candidate.
  - `slot: three stops; 3 same +15, pair +5, else +1`.
  - `prompt time-outs pick the defaults` for all five kinds (focus 2).
  - `inputs from the other player or for no open prompt are ignored`; `unknown values ignored` (focus 1).
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** implement.
- [ ] **Step 4:** run → PASS; full suite PASS.
- [ ] **Step 5:** commit `Party Board: star, shop, items, events and the slot machine`.

### Task 4: TV and phone renderers

**Files:** Create `public/games/party-board/{host.js,player.js,style.css}`; Modify `test/sounds.test.js`.

**Interfaces — Consumes:** the view (Task 2), `ArkMini.hostFrame` / `phoneFrame` (public/games/minis/mini.js) for the `minigame` phase, with a frame config whose top strip shows the board's coins / stars per player.
- TV: board spaces as coloured circles at x/y (icons: blue/red/❓/🎰/🛒, ⭐ on the star space), tokens (P1 cyan, P2 pink, offset when sharing a space), HUD per player (🪙 ⭐ items), round `n / turns`, big dice and `message`, the current prompt's options with a controller highlight; `bonus` phase reveals bonus stars; `over` shows the winner.
- Phone: your coins / stars / items; the open prompt (yours: big buttons; theirs: "Their turn…"); minigame phase via `ArkMini.phoneFrame`.
- Controllers (host `pad`): during `board` with a prompt for that slot: LEFT/RIGHT/UP/DOWN move a highlight over `prompt.options`, A sends `{type:'choose', value}`; during `minigame` delegate to the frame's `pad` / `padPoll`; `over`: A → `{type:'rematch'}`.
- Sounds: 'tick' per step, 'lock' on a buy, 'point' on coins gained, 'wrong' on coins lost, 'reveal' for events, 'fanfare' at `over`; during `minigame` use `ArkMini.miniSounds` + the frame's go/point.
- [ ] **Step 1:** sounds test `party board: steps tick, buys lock, the end fanfares` (seeded game driven through a roll and the end).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** `node --test test/*.test.js` + `node --check` on the new files → PASS.
- [ ] **Step 5:** commit `Party Board: TV and phone screens`.

### Task 5: README, e2e, ship

- [ ] README: a Party Board row (Competitive), settings row, controller row; wishlist: "3D board" stays.
- [ ] Playwright (background, log file): TV + 2 phones, a 10-turn match answering prompts (roll, yes to star, buy first shop item, use items), through at least 2 minigames to `over`; no page errors; screenshots of board, a prompt, the shop, a minigame, the bonus reveal and the end checked by eye.
- [ ] Final whole-branch review (fresh reviewer), fixes, then commit, push, PR, subscribe, check-in, merge on green, sync, report.
