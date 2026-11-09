# Kart Race 3D Cup, part 3: computer racers and the 8-kart Cup. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kart Race 3D's setup gains **Field: ⚔️ 1v1 / 🏁 8-kart Cup** and **Computer: Easy / Normal / Hard**. The 8-kart Cup is five races on the five big tracks, the two players plus six computer racers, with points for every place. The player with more points after five races wins.

**Architecture:** This ships as two PRs.
- **3a (server, nothing visible yet):**
  - The computer driver's driving logic becomes a shared `driveKart`, with lanes and passing.
  - The race loop drives every kart that has a `cpu` entry.
  - `KartRace3D` gains the `field` / `cpu` options, the six computer entrants, the cup grid order, points and the cup's end.
  - The TV and phones don't list the new rows yet, so `field` stays at 1v1.
- **3b (screens):** the setup rows on the TV and phones, eight karts drawn in 3D, places out of eight, a live order list, eight dots on the course map, the 8-row leaderboard between races, and the phone's place and points. This switches the Cup on for players.

**Tech Stack:** Node 20 ES modules, `node:test`, plain browser JS, three.js.

**Spec:** `docs/superpowers/specs/2026-11-08-kart-race-3d-grand-prix-design.md` (build stage 3, "Computer racers and the 8-kart Cup").

## Global Constraints

- **Setup** (Kart Race 3D only):
  - `field: [0, 1]`: 0 = 1v1 (the default), 1 = 8-kart Cup.
  - `cpu: ['normal', 'easy', 'hard']`.
  - With the 8-kart Cup, Mode, Track and Races are ignored (and hidden in 3b). It's always races, always 5, items always on. Laps stays a choice.
- **The field:** karts 0 and 1 are the players. Karts 2-7 are six computer racers that neither player picked, chosen once per cup with the game's rng, on the default tyres.
- **Points per finishing place** (computers included): `[10, 8, 6, 5, 4, 3, 2, 1]`. After race 5, the player with more points wins. A tie goes to whoever placed higher in race 5.
- **The grid:**
  - Race 1: the computers in front (karts 2-7 in index order), the players on the back row.
  - Later races: by cup points, fewest at the front, so the **leader starts at the back**. Ties go to the lower index first.
- **A race ends** as today: the first player across the line starts the finish window (`TIMING.finishMs`). Karts still racing are placed by progress.
- **Stats:** a cup counts as a cup (`cup: true` in the view at the end). `scores` are the two players' cup points. The winner is the player slot with more points.
- **Computers drive like people:** decisions about 10 times a second, applied after a human reaction delay (`reactionMs` in `bot-human.js`). There's no hidden speed. The seat-filling computer opponent drives exactly as before.
- The 2D Kart Race and Kart Race 3D's 1v1 are unchanged. Every existing kart test passes **unedited**.
- **CHANGELOG:** 3b adds a line under the next unreleased heading. That's `## 0.1.37` if v0.1.37 still isn't released; otherwise add `## 0.1.38`.
- Commit messages: `Kart Race 3D: …` (or `Kart Race: …` for the shared engine).

## Review Focus

1. **A player's phone drops mid-cup:** that kart coasts as today. The race still ends on the other player plus the time limit. The cup carries on, and the dropped player scores whatever place they end in. Pinned in Task 4.
2. **A rematch after a cup** starts a fresh cup: points reset, new computer racers, the race 1 grid. Pinned in Task 4.
3. **Switching Field from 8-kart Cup back to 1v1 on the setup screen:** Mode, Track and Races keep their values, and a race starts with two karts. Pinned in Task 4.
4. **A computer stuck against a wall** backs out and carries on (the existing stuck logic applies per kart, each with its own memory). Pinned in Task 2.
5. **The seat-filling computer in an 8-kart Cup** (one player plus the seat computer): it drives kart 1 as one of the two "players" and scores like a player. Pinned in Task 4.

---

## PR 3a: computer racers and the Cup's rules (server)

### Task 1: One driving function, with lanes

**Files:**
- Modify: `server/games/kart-race-bot.js` (extract `driveKart`)
- Test: `test/kart-race-cpu.test.js` (new)

**Interfaces:**
- Produces:
  - `export function driveKart(view, level, rng, memory, lane = 0): { type: 'drive', steer, gas, brake, drift } | { type: 'item' } | null`. This is today's race and battle driving (lines 29-88 of `kartRaceBot`) without `botDelayMs`. The one change: each point in `view.road.ahead` is shifted `lane` units sideways before being aimed at, using the point's `angle`: `x - sin(angle) * lane`, `y + cos(angle) * lane`.
  - `export function driveDelayMs(level, rng): number`: `reactionMs(level, rng) * 0.6`, as today.
  - `kartRaceBot` keeps its signature. It handles the menus as now, then returns `{ ...driveKart(view, level, rng, memory, 0), botDelayMs: driveDelayMs(level, rng) }`. The stop-on-finish / not-racing cases stay as they are.

- [ ] **Step 1: Write the failing tests**
  - `'the seat computer drives exactly as before'`: for 200 recorded `botView`s from a 3D race (build them by running a `KartRace3D` race and saving `game.botView(0)` every 10 ticks, using a fixed rng), `kartRaceBot(view, 'normal', rngA, 0, memA)` deep-equals the output from main's `kart-race-bot.js`, kept as `test/fixtures/kart-race-bot-main.js` (a verbatim copy, with a header comment saying it's frozen for this comparison), given identical rngs and memories.
  - `'a lane shifts the line the driver takes'`: on a straight bit of Speedway Oval, `driveKart(view, 'hard', () => 0.5, {}, 2).steer` has the opposite sign to `driveKart(view, 'hard', () => 0.5, {}, -2).steer`, and lane 0 steers between them.
- [ ] **Step 2: Run them.** Run `node --test test/kart-race-cpu.test.js`. Expected: FAIL (there's no `driveKart`).
- [ ] **Step 3: Implement** `driveKart`, `driveDelayMs` and the slimmer `kartRaceBot`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass, including `kart-tracks-3d` (whose lap test uses `kartRaceBot`).
- [ ] **Step 5: Commit.** `Kart Race: one driving function for the computer, with lanes`.

### Task 2: The race loop drives the computer racers

**Files:**
- Modify: `server/games/kart-race.js` (`tick`, a new `driveComputers(now)`, kart driver state)
- Test: `test/kart-race-cpu.test.js`

**Interfaces:**
- Consumes: Task 1, and PR 1's `entrants()` / `kart.cpu`.
- Produces:
  - `export const CPU = { thinkMs: 100, lanes: [-2.2, -0.8, 0.8, 2.2], passGap: 4, passMs: 1500, sway: 0.1 }`.
  - Each kart with `cpu` gets `driver: { memory: {}, lane, nextAt: 0, queue: [] }` at `newRace`. Its home lane is `CPU.lanes[(i - 2) % 4]`.
  - `driveComputers(now)` runs in `tick` while the phase is `race` or `finish`, before driving. For each unfinished computer kart, every `CPU.thinkMs` it does this:
    - It builds `this.botView(i)`, adds `road.blocker`, and decides `driveKart(view, kart.cpu.level, this.rng, driver.memory, driver.lane)`.
    - It queues the decision to apply at `now + driveDelayMs(level, this.rng)`.
    - Queued inputs that are due are applied: `drive` sets the kart's `steer` / `gas` / `brake` / `drift` (as `onDrive` does, without the jump-start logic), and `item` calls `useItem(this, i, now)`.
  - **Passing:** if `view.road.blocker` (the nearest kart within `CPU.passGap` ahead and within 1.2 sideways of this kart's lane) is set, the driver moves to the nearest other lane for `CPU.passMs`, then returns home.
  - **Personal style:** each computer's `cpu.sway`, set at entry from the rng within ±`CPU.sway`, scales its steering wobble and braking point in `driveKart` via `memory.sway`.
  - The queue lives on the kart, so it's cleared with the race. There are no `ctx.setTimeout` calls per input.

- [ ] **Step 1: Write the failing tests** (a new shared helper `test/helpers-kart.js` with a `Field`-style class like the one in `kart-race-field.test.js`, which stays as it is, racing `KartRace3D` with 6 computers at `normal`, rng `() => 0.5`, items off)
  - `'six computers lap every big track without getting stuck'`: on each of the 5 tracks:
    - every computer completes a lap within 90 s of race time;
    - no computer's speed stays under 0.5 for more than 4 s after the first 5 s.
  - `'no pile-up at the start'`: 8 s after lights out, every kart has moved at least 25 units along the lap.
  - `'a computer passes a stopped kart in its lane'`: park kart 0 (no input) 6 units ahead of computer kart 2, in kart 2's lane, on Speedway Oval's top straight. Within 5 s, kart 2's progress is beyond kart 0's.
  - `'Easy is slower than Normal, Normal slower than Hard'`: the average of the six computers' first-lap times on Speedway Oval.
  - `'the players' karts are never driven by the race'`: in an 8-kart race with no player input, karts 0 and 1 don't move.
- [ ] **Step 2: Run them.** Run `node --test test/kart-race-cpu.test.js`. Expected: FAIL (computers sit still).
- [ ] **Step 3: Implement** `CPU`, the driver state, `driveComputers`, `road.blocker` in `botView`, and the lane switching.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass. Tune `CPU` values or the blocker rule if a test misses; never loosen the tests.
- [ ] **Step 5: Commit.** `Kart Race: the race loop drives computer racers, in lanes, passing when blocked`.

### Task 3: The 8-kart Cup's entrants, grid and points

**Files:**
- Modify: `server/games/kart-race-3d.js` (options, `entrants`, `gridOrder`, cup state)
- Modify: `server/games/kart-race.js` (hooks: `get cup8()` false in the base; `battle` and `cup` respect it; points at `endRace`; `seriesOver`; the view's `cupPoints`, kart `cpu` / `name`)
- Test: `test/kart-race-cup8.test.js` (new)

**Interfaces:**
- Produces:
  - `KartRace3D.options` adds `field: [0, 1]` and `cpu: ['normal', 'easy', 'hard']`.
  - `get cup8(): boolean`: `false` in `KartRace`, `this.settings.field === 1` in `KartRace3D`.
  - When `cup8` is true:
    - `battle` is false;
    - `cup` (the 4-track cup) is false;
    - the series is 5 races on `this.tracks` in shuffled order (rng);
    - items are on regardless of the setting.
  - `this.cpuRacers`: six racer ids chosen at `begin()` (the 12 minus both players' picks, shuffled with the rng, first six). `entrants()` returns the picks plus `{ racer, tyre: DEFAULT_TYRE, cpu: { level: this.settings.cpu, sway } }` for each.
  - `gridOrder(n)`: race 1 is `[2, 3, 4, 5, 6, 7, 0, 1]`; later races sort the indices by `this.points` ascending, ties to the lower index.
  - `export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1]`. At `endRace` in a cup8, `this.points[i] += CUP_POINTS[positions()[i] - 1]`. The history entry adds `places` (the ranks) and `points` (a copy of the totals). `this.scores = [points[0], points[1]]`.
  - `seriesOver()` in a cup8: `this.race >= 5`. `this.winner` is the player with more points; a tie goes to whoever has the better rank in race 5.
  - View additions:
    - `cupPoints: this.cup8 ? this.points : null`;
    - `cup: this.cup || this.cup8`;
    - each kart's view gains `cpu: Boolean(k.cpu)`, and `name` (the racer's name) for computer karts.

- [ ] **Step 1: Write the failing tests** (an 8-kart Cup via the settings `{ field: 1, cpu: 'normal' }`; races ended with `game.finishLine(slot, now)` plus places set with `placeAt`)
  - `'an 8-kart Cup: the players and six computers neither picked'`: 8 karts, karts 2-7 have `cpu.level === 'normal'`, the 8 racers are all different, and neither player's racer is among karts 2-7.
  - `'race 1 grid: computers in front, the players at the back'`: `gridOrder(8)` deep-equals `[2, 3, 4, 5, 6, 7, 0, 1]`.
  - `'points for every place, and the leader starts at the back'`:
    - end race 1 with places 1..8 set as `[3, 5, 1, 2, 4, 6, 7, 8]` (by kart index);
    - `points` deep-equals `[6, 4, 10, 8, 5, 3, 2, 1]`;
    - race 2's `gridOrder(8)` deep-equals `[7, 6, 5, 1, 4, 0, 3, 2]`.
  - `'five races on five different tracks, then the player with more points wins'`: over 5 races, the track names are unique; `phase === 'over'`; `winner` is the player with more points; the view's `scores` deep-equals those two points; `cup === true`.
  - `'a points tie between the players goes to the better place in the last race'`.
  - `"a cup's settings don't let a battle or a 4-track cup in"`: with `mode: 1, races: 4, field: 1`, it's a 5-race series with 8 karts and `battle === false`.
  - `'1v1 is untouched'`: `field: 0` gives 2 karts, `cupPoints === null`, and the same track rules as before.
- [ ] **Step 2: Run them.** Run `node --test test/kart-race-cup8.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the options, the hooks and the cup state.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race 3D: the 8-kart Cup, six computer racers, points for every place`.

### Task 4: Edge cases, then ship 3a

**Files:**
- Test: `test/kart-race-cup8.test.js`

- [ ] **Step 1: Write the Review Focus tests**
  - `"a dropped player's kart coasts and the cup goes on"`: mark `ctx.players[1].connected = false` mid-race; the race still ends when player 0 finishes (plus the finish window); player 1 gets the points for their place.
  - `'a rematch starts a fresh cup'`: after a full cup, `rematch` from both:
    - `points` are all 0;
    - `race === 1`;
    - `gridOrder(8)` is the race 1 order;
    - `cpuRacers` is chosen again (it may differ).
  - `'switching back to 1v1 on the setup screen'`: `field` 1, then 0; a race starts with 2 karts, and `mode`, `track` and `races` keep their earlier values.
  - `'the seat computer in an 8-kart Cup scores like a player'`: drive kart 1 with `kartRaceBot(game.botView(1), 'normal', …)` for a whole race; it finishes, gets points, and `scores[1] === points[1]`.
  - `'a computer stuck against a wall backs out'`: put computer kart 3 facing a wall at speed 0; within 5 s it's moving away and still lapping.
- [ ] **Step 2: Run them.** Fix anything they find, test-first.
- [ ] **Step 3: Confirm the existing tests are untouched and everything passes.** Run `git diff --stat main -- test/kart-race.test.js test/kart-race-battle.test.js test/kart-race-field.test.js test/kart-tracks-3d.test.js test/kart-racers.test.js` (expected: no output; Task 2's helper move must not edit these), then `npm test` and `node tools/games-catalog.mjs`.
- [ ] **Step 4: Review.** Get a fresh whole-branch review and the `two-player-sync-reviewer`, then do one fix pass (test-first).
- [ ] **Step 5: Push, PR and merge.** PR title: `Kart Race 3D: computer racers and the 8-kart Cup's rules (part 3a)`. No README or changelog change, since players can't reach it yet. Wait for CI, merge, and pull `main`.

## PR 3b: the 8-kart Cup on the screens

Start from `main` after 3a, on a new branch `kart-3d-cup-screens`.

### Task 5: Setup rows on the TV and phones

**Files:**
- Modify: `public/games/kart-race/host.js` and `public/games/kart-race/player.js` (`rowsFor`)
- Test: `test/kart-race-3d-ui.test.js` (extend), or a new `test/kart-race-setup-rows.test.js` running both files' `rowsFor` in a vm.

**Interfaces:**
- `rowsFor(v)` in both files:
  - When `v.options.field` exists, add a first row `{ key: 'field', title: 'Field', fmt: (n) => n ? '🏁 8-kart Cup' : '⚔️ 1v1' }`.
  - With `v.settings.field === 1`, the rows are exactly: Field, `{ key: 'cpu', title: 'Computer', fmt: (s) => ({ easy: 'Easy', normal: 'Normal', hard: 'Hard' })[s] }`, then Laps.
  - Without `options.field` (2D), the rows are exactly as today.
  - The TV gamepad's row count follows `rowsFor` as today (the racer and tyre rows come after).

- [ ] **Step 1: Write the failing tests:**
  - in 2D, `rowsFor` keys deep-equal today's;
  - in 3D 1v1, the keys are `['field', 'mode', 'track', 'laps', 'races', 'items']`;
  - in a 3D cup, they're `['field', 'cpu', 'laps']`.

  Do this for both host.js and player.js.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** in both files.
- [ ] **Step 4: Run the tests.** Run `npm test`.
- [ ] **Step 5: Commit.** `Kart Race 3D: Field and Computer on the setup screen`.

### Task 6: Eight karts in 3D

**Files:**
- Modify: `public/games/kart-race-3d/kart3d.js` (`setKarts` over all of `v.karts`; colours; P1/P2 markers)
- Modify: `public/games/kart-race-3d/karts3d.js` (an optional `marker` label)

**Interfaces:**
- `setKarts` makes and updates one placeholder per entry in `v.karts`, and drops extras when the list shrinks.
- **Head colour:** `--p1` / `--p2` for karts 0 and 1, the racer's `stripe` for computers.
- **Markers:** karts 0 and 1 carry a floating "P1" / "P2" label, a sprite 0.9 above the head, drawn from a small canvas in the player's colour.
- **Cameras:** still two, following karts 0 and 1. The smoother already handles any number of karts.

- [ ] **Step 1: Make the changes.**
- [ ] **Step 2: Check in the browser** (two scripted phones; a cup on Speedway Oval):
  - eight different karts on the grid, computers in front;
  - the computers race, pass and finish;
  - the P1 and P2 markers show;
  - leaving and coming back leaves one canvas;
  - the console is clean.

  Screenshot the grid and a race.
- [ ] **Step 3: Commit.** `Kart Race 3D: eight karts on the track, with P1 and P2 markers`.

### Task 7: The HUD, the leaderboard and the phones for eight

**Files:**
- Modify: `public/games/kart-race-3d/ui.js` (place, order list, map dots, the cup leaderboard)
- Modify: `public/games/kart-race-3d/style.css`
- Modify: `public/games/kart-race/player.js` (place out of N; cup points between races)
- Test: `test/kart-race-3d-ui.test.js` (extend, using `test/fixtures/kart-race-3d-views.js` plus a new 8-kart cup fixture view)

**Interfaces:**
- **Place:** `ordinal(rank) + ' / ' + v.karts.length` in each half's panel ("3rd / 8"). With 2 karts, today's "1st" / "2nd".
- **Order list** (8-kart only): a slim column down each half's outer edge.
  - It shows places 1-8, with the racer's name for computers and the player's name for players.
  - The two players' rows use their colour.
- **Course map:** a dot per kart. Computers get small (`field.w / 40`), muted dots without numbers; the players keep their numbered colour dots.
- **Cup leaderboard** (`standings` and `over` in a cup8): 8 rows sorted by total, with columns place, name, this race's place, points from this race, and total. The two players' rows are highlighted. `over` says "<player> wins the cup" and, if a computer had the most points, "<racer> (CPU) topped the table".
- **Phone:** during a race, "3rd of 8". Between races and at the end: "You: N pts · <rival>: M pts" and your place in the table.

- [ ] **Step 1: Write the failing tests** (with an 8-kart fixture):
  - the HUD shows "3rd / 8";
  - the order list has 8 rows, with the players' rows marked;
  - the map has 8 dots;
  - the standings show 8 rows sorted by total;
  - the phone status for an 8-kart race says "of 8".

  Two-kart fixtures still render today's text.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the tests** (`npm test`), and **play a whole cup** in the browser (5 races, scripted phones). Check that standings appear after each race and the podium at the end; screenshot both.
- [ ] **Step 5: Commit.** `Kart Race 3D: places out of eight, an order list, and the cup leaderboard`.

### Task 8: Docs, review, ship 3b

- [ ] **Step 1: Update the docs.**
  - README: the Kart Race 3D row describes the 8-kart Cup (five races, six computer racers neither of you picked, Easy/Normal/Hard, points 10-8-6-5-4-3-2-1, the leader starts at the back). The setup-table row lists Field and Computer.
  - CHANGELOG: a line such as `- 🏁 Kart Race 3D has an 8-kart Cup: you two and six computer racers, five races on the big tracks, points for every place.`
  - Run `node --test test/changelog.test.js`.
- [ ] **Step 2: Review.** Get a fresh whole-branch review and the `two-player-sync-reviewer`, and do one fix pass, test-first.
- [ ] **Step 3: Push, PR and merge.** PR title: `Kart Race 3D: the 8-kart Cup on screen (part 3b)`. Wait for CI, merge, and pull `main`.
