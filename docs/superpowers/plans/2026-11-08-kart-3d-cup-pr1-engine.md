# Kart Race 3D Cup, PR 1: an engine for any number of karts. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `KartRace` races any number of karts (the two players plus extra ones), with no visible change: the 2D game and 3D 1v1 still create exactly two and play exactly as before.

**Architecture:** The game builds its karts from a new `entrants()` list (the two players' picks by default). Every rule that assumed a pair (grid, positions, item odds, item targets, bumping, ? box ties, slipstream, the finish line, lap records) works over the whole list, and reduces to today's behaviour with two. Nothing in this PR adds a third kart in play; the tests add extra karts through a test-only subclass that overrides `entrants()`.

**Tech Stack:** Node 20 ES modules, `node:test`.

**Spec:** `docs/superpowers/specs/2026-11-08-kart-race-3d-grand-prix-design.md` (build stage 1, "N-kart engine").

## Global Constraints

- Karts 0 and 1 are always the two players; extra karts start at index 2. `karts[you]` lookups stay valid.
- With two karts every rule gives today's result: every existing test in `test/kart-race*.test.js`, `test/kart-racers.test.js` and `test/sounds.test.js` passes **unchanged** (no edits to them).
- Battle always has exactly two karts (`entrants()` is ignored in a battle).
- Item targets: Thunder hits every other kart; Freeze, Swap and Seeker go for the kart just ahead (the one just behind if you lead); a Magnet's slipstream works behind any kart.
- Item odds by place: front half of the field (`rank <= N / 2`) rolls `ODDS.first`, back half `ODDS.second`.
- Grid: two per row, staggered, all past the start line (as today's single row is), front row furthest on; row spacing `GRID.rowGap = 2.6`; sides ±0.75 from the middle, first kart in a row on the left (−0.75).
- Only the players decide a race: a kart at index ≥ 2 crossing the line just finishes (no result, no score, no finish phase, no lap record).
- Server only; no client, view-shape, README or CHANGELOG change (players notice nothing).
- Comments short and plain-English, matching `kart-race.js`. Commit messages: `Kart Race: …`.

## Review Focus

1. **An extra kart reaching player-only code:** lap records read `ctx.players[slot].name`, which has no entry for index ≥ 2. Expected: no crash, no record. Pinned in Task 5.
2. **A battle with extra entrants:** a subclass that adds entrants must still get a two-kart battle. Pinned in Task 1.
3. **Next race or rematch with extra karts:** controls held over from the last race (`before[slot]`) must carry over per kart index, with no crash when the list grows. Pinned in Task 1.
4. **A Seeker never chases its own thrower,** even when places change mid-flight. Pinned in Task 4.
5. **A ? box reached by three karts in one tick** goes to the nearest, and a dead heat alternates among the tied karts only. Pinned in Task 3.

---

Shared test helper: put these at the top of a new `test/kart-race-field.test.js` and use them in every task.

```js
import { KartRace, TIMING, ITEMS, ODDS, pointAt, locate } from '../server/games/kart-race.js';
import { useItem } from '../server/games/kart-items.js';
import { fakeCtx } from './helpers.js';

/** A race with `extra` more karts (index 2 up), like the 8-kart Cup's computers. */
class Field extends KartRace {
  constructor(ctx, rng, extra) { super(ctx, rng); this.extra = extra; }
  entrants() {
    const more = ['rex', 'zip', 'swift', 'boulder', 'rascal', 'roxy'].slice(0, this.extra).map((racer) => ({ racer, tyre: 'standard', cpu: { level: 'normal' } }));
    return super.entrants().concat(more);
  }
}

/** Setup, both ready, lights out: racing with 2 + extra karts. */
function field(extra = 6, settings = {}) {
  const ctx = fakeCtx();
  const game = new Field(ctx, () => 0, extra);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

/** Put kart i at fraction p of the lap (laps done: `laps`), stopped. */
function placeAt(game, i, p, laps = 0) {
  const at = pointAt(game.track, p);
  Object.assign(game.karts[i], { x: at.x, y: at.y, angle: at.angle, speed: 0, progress: p, laps, seg: Math.round(p * game.track.line.length) % game.track.line.length });
}
```

Use the real tyre id from `public/games/kart-race/racers.js` (`DEFAULT_TYRE`) if `'standard'` isn't it.

### Task 1: Karts from an entrants list, on a grid of any size

**Files:**
- Modify: `server/games/kart-race.js` (`newRace()`'s kart creation and `grid`; a new `entrants()`; a `GRID` constant)
- Test: `test/kart-race-field.test.js`

**Interfaces:**
- Produces:
  - `entrants(): Array<{ racer: string, tyre: string, cpu?: { level: 'easy'|'normal'|'hard' } }>`. Default: `this.picks` (the two players). Ignored in a battle (always the two players).
  - Each kart gains `cpu: entry.cpu || null`.
  - `gridOrder(n: number): number[]`: kart indices from the front row back. Default `[0, 1, …, n - 1]`; PR 3 overrides it for the cup.
  - `export const GRID = { rowGap: 2.6, side: 0.75 }`.
  - Race grid for kart at order position `j` of `n`: row `r = floor(j / 2)`, `rows = ceil(n / 2)`, lap fraction `0.012 + (rows - 1 - r) * GRID.rowGap / track.length`, sideways `j % 2 ? +GRID.side : -GRID.side`. With n = 2 that's today's grid exactly.
  - Held controls carry over per index: `was = before ? before[i] || null : null`.

- [ ] **Step 1: Write the failing tests**
  - `'extra entrants race too: 8 karts, players first, computers flagged'`: `field(6)`; `game.karts.length === 8`; `karts[0].cpu === null && karts[1].cpu === null`; `karts[2].cpu.level === 'normal'`; `karts[2].racer === 'rex'`.
  - `'the grid: two a row, all past the line, front row furthest on'`: `field(6)`. For order positions j = 0..7: kart `game.gridOrder(8)[j]` has progress `0.012 + (3 - floor(j / 2)) * 2.6 / game.track.length` (±1e-9); karts j and j+1 in a row are 1.5 apart sideways (±0.01); every kart is on the road (`locate(...).d <= width / 2`).
  - `'two karts: the grid is today's'`: plain `new KartRace` race. Both karts at progress 0.012, 1.5 apart.
  - `'a battle is always two karts, whatever the entrants'`: `field(6, { mode: 1 })`; `game.karts.length === 2`.
  - `'the next race keeps each kart's held controls, all eight'`: in a best of 3, set `karts[5].gas = true` before the race ends (`game.finishLine(0, ctx.now())`, advance `TIMING.finishMs + 100`, both `go`, advance the countdown); the new `karts[5].gas === true`.
- [ ] **Step 2: Run them and see them fail.** Run `node --test test/kart-race-field.test.js`. Expected: FAIL (`karts.length` is 2).
- [ ] **Step 3: Implement** `entrants()`, `gridOrder()`, `GRID` and the generalised kart creation in `newRace()`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass, with every existing kart test unchanged.
- [ ] **Step 5: Commit.** `Kart Race: karts come from an entrants list, on a grid of any size`.

### Task 2: Places 1 to N, item odds and targets by place

**Files:**
- Modify: `server/games/kart-race.js` (`positions()`, new `targetOf()`)
- Modify: `server/games/kart-items.js` (`rollItem`)
- Test: `test/kart-race-field.test.js`

**Interfaces:**
- Consumes: Task 1's entrants.
- Produces:
  - `positions(): number[]`: a rank 1..N per kart index. Race: by `finishedAt` (earlier first) for finished karts, then by `laps + progress`; ties go to the lower index (today's `a >= b` rule). Battle: by balloons, ties to the lower index.
  - `targetOf(i: number): number`: the index of the kart ranked just ahead of kart i, or the one ranked 2nd if kart i leads. With 2 karts, the other one.
  - `rollItem(game, slot)`: `ODDS.battle` in a battle; else `ODDS.first` if `rank <= karts.length / 2`, else `ODDS.second`.

- [ ] **Step 1: Write the failing tests**
  - `'places 1 to 8 by laps and progress, finished karts first'`: `field(6)`. Place karts so the order is known: kart 3 at lap 1, p 0.2; kart 1 at lap 0, p 0.9; the rest lower. Set `karts[6].finishedAt = 1` (with laps 3). Assert `positions()[6] === 1`, `positions()[3] === 2`, `positions()[1] === 3`, and the ranks are a permutation of 1..8.
  - `'two karts: places as before'`: plain race; equal progress gives `[1, 2]`; kart 1 ahead gives `[2, 1]`.
  - `'targets: the kart just ahead, or just behind for the leader'`: with places set as above, `targetOf(1)` is the kart ranked 2nd (index 3), and `targetOf(6)` (the leader) is index 3 too.
  - `'item odds: the front half rolls the leader's odds, the back half the catch-up ones'`: with `game.rng` set to return 0.999 so the roll picks the last kind, compare `rollItem(game, i)` for a rank-4 kart against `Object.keys(ODDS.first).at(-1)`, and for a rank-5 kart against `Object.keys(ODDS.second).at(-1)`. If the last kinds of the two tables match, use a rng that lands on a kind where they differ: choose it from the tables in the test.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-race-field.test.js`. Expected: the new tests FAIL (`positions()` returns two values; no `targetOf`).
- [ ] **Step 3: Implement** `positions()`, `targetOf()` and the place-based `rollItem`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race: places, item odds and item targets for any number of karts`.

### Task 3: Every pair bumps; ? boxes and slipstream for a pack

**Files:**
- Modify: `server/games/kart-race.js` (`bump()`, `boxCheck()`, `slipstream()`)
- Test: `test/kart-race-field.test.js`

**Interfaces:**
- Produces:
  - `bump()`: runs today's push-apart for every pair `i < j` (the body becomes `bumpPair(a, b)`); `events.bumps` counts each pair that touched.
  - `boxCheck`: among karts in reach, the nearest takes the box; karts tied at the nearest distance (within 1e-9) take turns via `this.boxTies` (`tied[(this.boxTies = (this.boxTies || 0) + 1) % tied.length]`, `tied` in index order). With two that's today's alternation.
  - `slipstream(k)`: a slipstream if **any** other kart is ahead within `ITEMS.slipR`.

- [ ] **Step 1: Write the failing tests**
  - `'karts bump in a pack: three in a pile all end up apart'`: `field(6)`. Put karts 2, 3 and 4 at the same point; one tick (`ctx.advance(17)`); each pair's distance is greater than it was (all three moved). Also `events.bumps >= 2`.
  - `'a ? box reached by three karts goes to the nearest; a three-way dead heat takes turns'`: put karts 2, 3, 4 equidistant from a box, run `boxCheck` three times with the box respawned between (`box.backAt = 0`, items cleared). Each of 2, 3, 4 gets it once. Then move kart 3 nearer: it gets the box.
  - `'a Magnet's slipstream works behind any kart'`: kart 0 with `magnetUntil` in the future, kart 5 just ahead within `ITEMS.slipR`, kart 1 far away: `slipstream(karts[0], now) === ITEMS.slipSpeed`.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-race-field.test.js`. Expected: the new tests FAIL (only karts 0 and 1 bump).
- [ ] **Step 3: Implement** `bumpPair` with the all-pairs loop, the tie list in `boxCheck`, and the any-kart slipstream.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass (the existing two-kart box-tie and bump tests unchanged).
- [ ] **Step 5: Commit.** `Kart Race: every kart bumps, grabs boxes and slipstreams in a pack`.

### Task 4: Targeted items for a pack

**Files:**
- Modify: `server/games/kart-items.js` (`useItem`, the Seeker in `stepShots`)
- Test: `test/kart-race-field.test.js`

**Interfaces:**
- Consumes: Task 2's `game.targetOf(i)`.
- Produces:
  - Thunder: `zap` and shrink **every other** kart (each counted in `events.zapped`).
  - Freeze and Swap: the kart `game.targetOf(slot)`.
  - Seeker: each step, chases `game.karts[game.targetOf(s.owner)]`, never its owner.
  - With two karts every target is the other kart, as today.

- [ ] **Step 1: Write the failing tests** (give kart i the item: `karts[i].items = ['thunder']`, then `useItem(game, i, ctx.now())`)
  - `'Thunder shrinks every other kart'`: `field(6)`; kart 4 uses Thunder; karts 0-3 and 5-7 have `shrinkUntil > now`, kart 4 doesn't.
  - `'Freeze and Swap go for the kart just ahead'`: places set so kart 1's target is kart 3; Freeze from kart 1 freezes kart 3 only. Swap from kart 1 trades items with kart 3 only.
  - `'the leader's Freeze goes back to second'`: the leader's Freeze freezes the 2nd-placed kart.
  - `'a Seeker chases the kart ahead and never its thrower'`: kart 2 fires a Seeker with kart 6 just ahead on the same stretch within `ITEMS.seekerHome`. After a few ticks it hits kart 6. Over 60 ticks it never hits kart 2.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-race-field.test.js`. Expected: FAIL (items hit `karts[1 - slot]`).
- [ ] **Step 3: Implement** the targets in `useItem` and `stepShots`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass, including the existing item tests unchanged.
- [ ] **Step 5: Commit.** `Kart Race: Thunder hits the field; Freeze, Swap and Seekers go for the kart ahead`.

### Task 5: Only the players decide a race

**Files:**
- Modify: `server/games/kart-race.js` (`finishLine()`, `recordCheck()`)
- Test: `test/kart-race-field.test.js`

**Interfaces:**
- Produces:
  - `finishLine(i, now)`: always sets `karts[i].finishedAt`. Only a player (`i < 2`) in the `race` phase sets `result`, adds to `scores` and enters `finish`.
  - `recordCheck(i, …)`: does nothing for `i >= 2`, so there's no `ctx.players[i]` lookup.
  - Views and history keep listing every kart. The room only records slots 0 and 1, so stats don't change.

- [ ] **Step 1: Write the failing tests**
  - `'a computer crossing the line first doesn't end the race'`: `field(6)`; `game.finishLine(4, ctx.now())`; `game.phase === 'race'`, `game.result === null` (or unchanged), `scores` unchanged, `karts[4].finishedAt !== null`, `positions()[4] === 1`.
  - `'then the first player across wins it, as today'`: then `game.finishLine(1, ctx.now())`; `game.phase === 'finish'`, `game.result.winner === 1`, `scores[1] === 1`.
  - `'a computer's lap sets no record and doesn't crash'`: `field(6)`; drive kart 3 over the line after halfway (set `halfway = true`, progress 0.95, then a tick at progress 0.02 via `placeAt` and `lapCheck(karts[3], 3, now)`); `karts[3].laps === 1`; `game.record` unchanged; no throw.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-race-field.test.js`. Expected: FAIL (a computer's finish sets the result; its lap throws on `ctx.players[3]`).
- [ ] **Step 3: Implement** the player-only branches.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race: only the players decide a race; computers' laps set no records`.

### Task 6: Prove nothing changed for players, then ship

**Files:** none new.

- [ ] **Step 1: Confirm the existing tests are untouched.** Run `git diff --stat main -- test/kart-race.test.js test/kart-race-battle.test.js test/kart-racers.test.js test/kart-race-3d.test.js test/sounds.test.js`. Expected: no output.
- [ ] **Step 2: Run everything.** Run `npm test` and `node tools/games-catalog.mjs`. Expected: all pass; `docs/GAMES.md` unchanged apart from line endings (the new test imports `kart-race.js`, so the catalog may list it under Kart Race: if so, commit that).
- [ ] **Step 3: Play it.** Using the dev server and two scripted phones, play a 2D Kart Race and a Kart Race 3D race (one of each to the end, plus a Battle). Expected: they look and play as before, and the console is clean.
- [ ] **Step 4: Review.** Run the `two-player-sync-reviewer` agent on the branch and fix what it confirms (each fix test-first).
- [ ] **Step 5: Push, PR and merge.** Push `kart-3d-cup` (it also carries the spec and this plan), open a ready PR `Kart Race: an engine for any number of karts (8-kart Cup, part 1)`, wait for CI to pass, merge, pull `main`.
