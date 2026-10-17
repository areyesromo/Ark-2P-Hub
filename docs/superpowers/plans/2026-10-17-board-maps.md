# Party Board Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five Party Board maps with forks, warps and difficulty tiers, plus a Harsh mode that scatters hazard spaces.

**Architecture:** Maps become graphs (`next` links per space, `warp` targets) in `server/games/board/maps.js` with a `validateMap()` checker; `PartyBoard` walks the graph, asks at forks, teleports on warps, prices by map, and (Harsh mode) converts some spaces to hazards at start. Renderers draw links with SVG.

**Tech Stack:** Node 22 ESM, `node --test`, vanilla browser JS + inline SVG, Playwright (scratchpad e2e).

**Spec:** `docs/superpowers/specs/2026-10-17-board-maps-design.md` (on top of `2026-10-17-party-board-design.md`).

## Global Constraints

- Space: `{ x, y, type, next: [index], starCandidate?, warp? }`; forks have exactly 2 `next`; `next[0]` is the default.
- Map: `{ name, tier: 'easy'|'medium'|'hard'|'expert', starPrice, shopMarkup, spaces }`; defaults starPrice 20, shopMarkup 1; item price = `Math.round(price * shopMarkup)`.
- Maps: island (easy, 20, 1), lagoons (easy, 20, 1), pipes (medium, 20, 1), haunted (hard, 25, 1), volcano (expert, 30, 1.5).
- Fork prompt: `kind: 'path'`, options `['0', '1']`, `extra.previews` = the types of the next 4 spaces along each branch; time-out → '0'.
- Warp: landing moves the token to `warp`, message "🌀 Warp!", no landing effect there, turn ends; passing does nothing.
- Harsh mode `harsh` [0, 1]: ~15 % of blue+red spaces (`Math.max(2, Math.round(n * 0.15))`), never 0, star candidates, forks or warp targets; hazards thunder / skull / tornado with equal odds.
- Thunder: lose `Math.floor(coins / 2)`. Skull: −1 ⭐, or −10 🪙 with no stars. Tornado: to a random space ≠ 0 and ≠ current, no landing effect.
- Settings: `map` ['random', 'island', 'lagoons', 'pipes', 'haunted', 'volcano']; `harsh` [0, 1]. 'random' picks at `start()`.
- View: `board: { name, tier, spaces, star, starPrice }`; item prices in `view.items` already include the markup.

## Review Focus

1. An idle player at a fork → it times out to '0' and the walk continues (Task 2 test).
2. A tornado or warp dropping a token on a fork / warp / star space → no chained effect; the next roll walks from there (Task 2 + Task 4 tests).
3. Hazards never replace the start, star candidates, forks or warp targets (Task 4 test, over many seeds).
4. Expert prices: no star prompt below 30 🪙; the shop lists only items affordable at ×1.5 (Task 3 test).
5. Every map has no dead ends: from every space, start is reachable (Task 1/3 validator over all maps).

---

### Task 1: Graph maps + validator (island converted)

**Files:** Modify `server/games/board/maps.js`, `server/games/party-board.js` (walk via `next[0]`); Test `test/board-maps.test.js`.

**Produces:** `validateMap(map) -> string[]` (problems; empty = valid) checking the spec's rules; `MAPS.island` with `next` links (same 28 spaces), `tier: 'easy'`, `starPrice: 20`, `shopMarkup: 1`.
- [ ] Tests: `validateMap: the island is valid`; `validateMap catches a dead end, a bad link, a 3-way fork, a self-link` (small hand-made maps); `island keeps its 28-space loop` (next[i] = (i + 1) % 28).
- [ ] Run → FAIL; implement; run → PASS (incl. the whole suite: the board tests must not change); commit `Party Board: maps as graphs, with a checker`.

### Task 2: Forks and warps in the walk

**Files:** Modify `server/games/party-board.js`; Test `test/party-board.test.js`.

**Consumes:** graph spaces (Task 1). **Produces:** `forkPrompt(next)`; walking logic `step()` that, on a space with 2 `next`, asks `path` before moving on; warp handling in `land()`.
- [ ] Tests (a tiny test map in the test file: 0 → 1 (fork: 2 or 5) → … with a warp space):
  `a fork pauses the walk and asks, with previews of each path`; `choosing 1 takes the second path`; `an idle player at a fork takes the first path after 15 s` (focus 1); `landing on a warp moves the token and ends the turn` (and no effect at the target, focus 2); `passing a warp does nothing`; `the star / shop pass-by checks still apply after a fork`.
- [ ] Run → FAIL; implement; PASS + suite; commit `Party Board: forks and warps`.

### Task 3: The four new maps, map prices, the map setting

**Files:** Modify `server/games/board/maps.js`, `server/games/party-board.js`, `server/games/index.js`; Test `test/board-maps.test.js`, `test/party-board.test.js`.

**Produces:** `MAPS.lagoons / pipes / haunted / volcano`; `PartyBoard` reads `settingOf(ctx, 'map', 'random')` (constructor arg `map` still overrides for tests); `this.starPrice`, `this.price(id)`.
- [ ] Tests: `every map is valid` (validator, focus 5); `tiers and prices` (table above); `forks / warps per map` (lagoons ≥1 fork; pipes ≥2 forks, ≥2 warps incl. one backward = target index < source; haunted ≥3 forks, ≥2 backward warps, red ≥ 35 % of blue+red; volcano ≥4 forks, ≥3 warps, red ≥ 50 %); `Expert prices: star prompt only from 30 coins; the shop lists items affordable at ×1.5 and charges that` (focus 4); `map setting picks the map; random picks one of the five` (scripted rng).
- [ ] Run → FAIL; implement (hand-author coordinates; keep spaces ≥ 0.07 apart); PASS + suite; commit `Party Board: four new maps with forks, warps and tiers`.

### Task 4: Harsh mode

**Files:** Modify `server/games/party-board.js`, `server/games/index.js`; Test `test/party-board.test.js`.

**Produces:** `placeHazards()` at `start()` when `harsh` = 1; `land()` effects for 'thunder' | 'skull' | 'tornado'.
- [ ] Tests: `harsh off: no hazards`; `harsh on: max(2, round(15 %)) hazards, never on start / star candidates / forks / warp targets` (100 seeds × all maps, focus 3); `thunder halves coins (rounded down lost)`; `skull takes a star, else 10 coins, never below 0`; `tornado moves to a random space, no effect there` (focus 2).
- [ ] Run → FAIL; implement; PASS + suite; commit `Party Board: Harsh mode hazards`.

### Task 5: Renderers, README, e2e, ship

**Files:** Modify `public/games/party-board/{host.js,player.js,style.css}`, `README.md`.
- TV: an `<svg viewBox="0 0 100 100" preserveAspectRatio="none">` under the spaces; a line per `next` link (`x*100`, `y*100`), an arrow marker on fork links, a dashed cyan line for each warp; hazard/warp icons ⚡ 💀 🌪️ 🌀 with classes `thunder skull tornado warp`; a header badge `name · tier` with tier colours (easy green, medium yellow, hard red, expert purple).
- Fork prompt: TV labels "Path 1" / "Path 2" + preview icons; phone buttons "Path 1: 🛒 ❓ 🔵 🔵"; star prompt text uses `board.starPrice`.
- README: Party Board row mentions maps + Harsh mode; settings row.
- [ ] `node --test` + `node --check` → PASS; Playwright (background): Pipe Works + Harsh mode match, through a fork and a warp, no page errors; screenshots of all five maps (start a match per map); checked by eye.
- [ ] Final fresh review, fixes, PR, merge on green, sync, report.
