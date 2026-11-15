# Kart Race 3D, PR 1: new tile, playable 3D. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new hub game, Kart Race 3D, that plays every Kart Race mode with a split-screen 3D chase-camera view on the TV, built from placeholders (no GLB models yet).

**Architecture:** The server subclasses the 2D `KartRace`, so the rules are shared. The phone reuses the 2D
controller, and the 3D TV reuses the 2D TV's HUD and overlays through a new `stage` hook that replaces only the
2D canvas. The 3D stage is three.js on `ArkMini.scene3d`, drawn twice a frame (left and right halves), with the
road, walls and karts built in code from the shared `ArkKartTrack` data. The pure maths sits in `geom3d.js`,
so `node:test` can check it.

**Tech Stack:** Node 20 ES modules, `node:test`, plain browser JS (IIFEs, no build), three.js 0.184 from `/vendor/three/`.

**Spec:** `docs/superpowers/specs/2026-10-25-kart-race-3d-design.md` (this plan is its build-order step 1).

## Global Constraints

- Game id `kart-race-3d`, name `Kart Race 3D`; the 2D Kart Race's behaviour and tests stay unchanged.
- Flat tracks: every scene height goes through `ArkKartGeom.heightAt(x, y)`, which returns 0.
- Field point (x, y) on the 32 x 18 field is scene point (x, heightAt(x, y), y); 1 unit = 1 metre; a kart is 1.75 long, 1 wide.
- Split-screen: P1 left half, P2 right half, one renderer, each half framed in `--p1` / `--p2`.
- Karts are drawn 50 ms behind the newest view, blended; a jump of more than 2 units in one view snaps.
- Steam Deck budget: pixel ratio capped at 1, no post-processing, no shadows in this PR.
- No WebGL: the TV shows "3D isn't available on this screen" and suggests Kart Race; no 2D fallback.
- Plain browser JS, no build step; CSS uses the hub's tokens (`--p1`, `--p2`, `--panel`, `--text`, `--muted`, `--r-md`, …).
- Comments short and plain-English, matching the file they're in. Commit messages: `Kart Race 3D: …`.

## Review Focus

1. **Rematch and race-to-race:** a new race (new track, Battle arena, cup race) rebuilds the world and snaps the karts to the grid; a rematch on the same track keeps the scene. Pinned in Task 4 (smoother snap) and checked in Task 7.
2. **Leaving mid-race:** unmount disposes the 3D scene and frees the GL context; re-entering the game builds a fresh one with no second draw loop. Checked in Task 7.
3. **Angle wrap:** a kart heading across ±π (west) must not spin a full turn when blended. Pinned in Task 4.
4. **Shared barriers:** where two stretches of road run close (Hairpins, Serpent), the wall runs down the middle and the camera must not see through it. Pinned in Task 4 (`clampEye` against both faces).
5. **Playing 2D after 3D (or the reverse) in one TV session:** both games share the 2D TV script; each must mount with its own stage (or none). Pinned in Task 3.

---

### Task 1: The game on the server

**Files:**
- Create: `server/games/kart-race-3d.js`
- Modify: `server/games/index.js` (import, and add `kartRace3d` right after `kartRace` in `GAMES`)
- Modify: `tools/games-catalog.mjs` (`EXTRA`)
- Regenerate: `docs/GAMES.md`
- Test: `test/kart-race-3d.test.js`

**Interfaces:**
- Consumes: `KartRace`, `TIMING` from `server/games/kart-race.js`.
- Produces: `export class KartRace3D extends KartRace` (no overrides yet); default export `{ id: 'kart-race-3d', name: 'Kart Race 3D', tagline, create: (ctx) => new KartRace3D(ctx) }`.

- [ ] **Step 1: Write the failing tests** in `test/kart-race-3d.test.js`:

```js
test('Kart Race 3D is its own game in the hub, after Kart Race', () => {
  const ids = listGames().map((g) => g.id);
  assert.ok(ids.includes('kart-race-3d'));
  assert.equal(ids.indexOf('kart-race-3d'), ids.indexOf('kart-race') + 1);
  const def = listGames().find((g) => g.id === 'kart-race-3d');
  assert.equal(def.name, 'Kart Race 3D');
  assert.match(def.tagline, /PC or Steam Deck/);
});

test('it plays a race to the end with the Kart Race rules', () => {
  const ctx = fakeCtx();
  const game = kartRace3d.create(ctx);
  assert.ok(game instanceof KartRace);
  game.start();
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'race');
  game.finishLine(1, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('a Battle round works too', () => {
  // same as above with { type: 'setting', key: 'mode', value: 1 } before 'go';
  // after lights out: game.battle === true and every kart has 3 balloons
});
```

If `listGames()` returns games without their place in `GAMES`, compare against the `GAMES` array order instead.

- [ ] **Step 2: Run them and see them fail.** Run `node --test test/kart-race-3d.test.js`. Expected: FAIL (cannot find module `kart-race-3d.js`).
- [ ] **Step 3: Write `server/games/kart-race-3d.js`.** Open with a short header comment: "Kart Race in 3D: the same race (see kart-race.js), shown on the TV as a split-screen 3D race. A subclass so it has its own id, setup memory and records, and room to grow (tracks with height later)." Tagline: `'Kart Race in 3D: split-screen, a chase camera behind each kart. Same racers, tracks, items and battles. Best on a PC or Steam Deck.'`. Register it in `index.js` with no `withSetup` (Kart Race has its own setup).
- [ ] **Step 4: Add the catalog entry** in `tools/games-catalog.mjs` `EXTRA`: `'kart-race-3d': ['server/games/kart-race.js', 'server/games/kart-items.js', 'public/games/kart-race/']`. Run `node tools/games-catalog.mjs`.
- [ ] **Step 5: Run the tests.** Run `npm test`. Expected: all pass, `catalog.test.js` included.
- [ ] **Step 6: Commit.** `Kart Race 3D: the game on the server, sharing Kart Race's rules`.

### Task 2: Its records, kept apart and labelled

Lap records and the in-game track record are already keyed by game (`rooms.js` passes `def.id`). Cups aren't,
and the stats page doesn't say which game a lap record is from.

**Files:**
- Modify: `server/stats.js` (`leaderboard().cups` entries gain `game`)
- Modify: `public/stats/stats.js` (`lapsTable`, `cupsTable`: a `3D` tag on `kart-race-3d` rows)
- Test: `test/stats.test.js`

**Interfaces:**
- Produces: `leaderboard().cups[i].game` (string game id); `lapRecords()` entries already carry `game`.

- [ ] **Step 1: Write the failing tests** in `test/stats.test.js`, building `Stats` the way the existing kart cup and lap tests there do:
  - `'lap records: Kart Race and Kart Race 3D keep their own record on the same track'`: record one `kart-race` match with a Speedway lap of 20000 ms and one `kart-race-3d` match with 25000 ms. Assert `lapRecord('kart-race', 'Speedway').ms === 20000`, `lapRecord('kart-race-3d', 'Speedway').ms === 25000`, and `lapRecords()` has 2 Speedway entries.
  - `'kart cups say which game they were won in'`: a cup match in `kart-race-3d`. Assert `leaderboard().cups[0].game === 'kart-race-3d'`.
- [ ] **Step 2: Run them.** Run `node --test test/stats.test.js`. Expected: the lap test PASSES already (records are keyed by game); the cups test FAILS (`game` undefined).
- [ ] **Step 3: Implement.** Add `game: m.game` to the cups `map`. In `public/stats/stats.js`, add `' <span class="tag">3D</span>'` after the track name in `lapsTable` and after the score in `cupsTable` when `r.game === 'kart-race-3d'` (`.tag` already exists on that page).
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race 3D: its lap records and cups are tagged 3D on the stats page`.

### Task 3: Sharing the 2D TV and phone

**Files:**
- Modify: `public/shared/common.js`: `register` doc comment says a renderer may be a promise of one. No code change is expected: `loadRenderer` already resolves with whatever was registered, and `resolve(promise)` adopts it. Confirm this by test.
- Modify: `public/games/kart-race/host.js`: the object passed to `Ark.register` becomes `make(opts)`.
- Create: `public/games/kart-race-3d/player.js`, `public/games/kart-race-3d/host.js` (shell; the stage arrives in Task 6).
- Test: `test/kart-race-3d-client.test.js`

**Interfaces:**
- Produces: `window.ArkKartTV = { make(opts) }`. `opts.stage` is optional, `{ mount(el: HTMLElement): void, update(view): void, unmount(): void }`. `make({})` is today's 2D renderer, unchanged. With a stage:
  - `mount` adds class `kr-3d` to `.kr-host`, removes the 2D `<canvas>` and doesn't start the 2D draw loop, then calls `stage.mount(arenaEl)`. The overlay stays above it.
  - `update` does what it does now, then `stage.update(v)`.
  - `unmount` calls `stage.unmount()` first.
- The stage is chosen per `make` call; the module-level state stays as it is (one TV game at a time). `mount` must reset the stage-or-canvas choice from its own `opts` each time (Review Focus 5).
- `public/games/kart-race-3d/player.js`: `Ark.register('player', 'kart-race-3d', Ark.loadRenderer('player', 'kart-race'));`
- `public/games/kart-race-3d/host.js`: `Ark.register('host', 'kart-race-3d', Ark.loadScript('/games/kart-race/host.js').then(() => window.ArkKartTV.make({ stage: <Task 6> })))`. Until Task 6, use a stage whose methods do nothing.

- [ ] **Step 1: Write the failing tests** (vm, as in `test/mini-client.test.js` and `test/setup-client.test.js`):
  - `'a renderer registered as a promise loads as the renderer it resolves to'`: run `common.js` in a vm. Stub `document.createElement('script')` and `document.head.appendChild(s)` so that appending runs `window.Ark.register('host', 'x', Promise.resolve({ mount() {} }))` and then `s.onload()`. Assert `await window.Ark.loadRenderer('host', 'x')` has a `mount` function.
  - `'the 2D Kart Race TV exposes make() and still registers kart-race'`: run `public/games/kart-race/host.js` in a vm with an `Ark` stub (`loadCss`, `loadScript: () => Promise.resolve()`, `register` recording calls, `escapeHtml: String`, `setup: {}`). Assert `window.ArkKartTV.make` is a function, `register` was called with `('host', 'kart-race', r)`, and `Object.keys(r)` equals `Object.keys(window.ArkKartTV.make({}))`.
  - `'Kart Race 3D's phone is the Kart Race phone'`: run `public/games/kart-race-3d/player.js` with `Ark.loadRenderer` returning a marker promise. Assert `register` got `('player', 'kart-race-3d', thatPromise)`.
- [ ] **Step 2: Run them.** Run `node --test test/kart-race-3d-client.test.js`. Expected: FAIL (no `ArkKartTV`, no 3D player file). The first test may already pass, which confirms no `common.js` code change is needed.
- [ ] **Step 3: Implement** `make(opts)` in the 2D `host.js` (keep its body in place: wrap the registered object literal in `function make(opts)`, add the stage branches above, then `window.ArkKartTV = { make: make }; Ark.register('host', 'kart-race', make({}));`), the doc line in `common.js`, and the two 3D files.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass (the 2D tests untouched).
- [ ] **Step 5: Check the 2D game by hand.** Start the dev server with preview_start; open `/` and a phone tab at `/play/`; play a Kart Race to the end. It must look and play as before (screenshot).
- [ ] **Step 6: Commit.** `Kart Race 3D: shares Kart Race's phone controller and TV screens`.

### Task 4: The 3D maths (`geom3d.js`)

**Files:**
- Create: `public/games/kart-race-3d/geom3d.js` (IIFE setting `globalThis.ArkKartGeom`; no three.js, no DOM)
- Test: `test/kart-race-3d-geom.test.js` (imports `../public/games/kart-race/track.js` and `../public/games/kart-race-3d/geom3d.js` for their side effects, and `buildTrack`, `buildArena`, `TRACKS`, `ARENAS`, `FIELD` from the server)

**Interfaces (all on `ArkKartGeom`):**
- `heightAt(x: number, y: number): number`: 0 for now.
- `ribbon(a: [x,y][], b: [x,y][]): { positions: Float32Array, indices: Uint32Array }`: a closed strip between two equal-length loops. Vertex `2i` is `a[i]` and `2i+1` is `b[i]` as `(x, heightAt, y)`; `indices.length === 6 * n`. Used for road, kerbs and both faces of walls.
- `wallSegments(road, edge, field): [x1, y1, x2, y2][]`: the inside faces of both barriers (`ArkKartTrack.edgeLines(road, edge, 0)`), joined as closed loops, plus the 4 field borders.
- `smoother({ delayMs = 50, snap = 2 } = {})` returns `{ push(t: number, poses: {x, y, angle}[]): void, at(t: number): {x, y, angle}[] | null }`:
  - It keeps the last 2 views and draws at `t - delayMs`, blending linearly between the views either side of that time (angle along the shorter way round).
  - Before the first view it returns `null`. Past the newest view it holds the newest. With one view it returns that view.
  - When a pose moved more than `snap` units since the previous view, that kart jumps to the new pose (no blend).
- `CAM = { back: 3.2, up: 1.6, ahead: 2.5, fov: 70, rate: 0.008, battle: { back: 4.5, up: 3.0, ahead: 1.5 } }`.
- `chase(pose: {x, y, angle}, cam = CAM): { eye: [x, y], eyeH: number, look: [x, y] }`: eye `back` behind the kart along its heading, at height `up`; look `ahead` in front.
- `follow(cur: number[], goal: number[], dtMs: number, rate = CAM.rate): number[]`: `cur + (goal - cur) * (1 - exp(-rate * dtMs))`, per component.
- `clampEye(kart: [x,y], eye: [x,y], segments, margin = 0.2): [x,y]`: if the line from kart to eye crosses a segment, return the point `margin` before the nearest crossing; else `eye`.

- [ ] **Step 1: Write the failing tests:**
  - `'heightAt is flat for now'`: `heightAt(5, 7) === 0`.
  - `'the road ribbon spans the road on every track and arena'`: for each track/arena, `ribbon(outline(line, -w/2), outline(line, w/2))`. Assert `positions.length === 2 * n * 3`, `indices.length === 6 * n`, every index `< 2n`, and the distance between vertex 0 and vertex 1 is about `width` (±0.01).
  - `'wall segments are the barrier inside faces plus the field border'`: for `buildTrack(0)`, the count equals `2 * n + 4`; every segment end is inside `[0, FIELD.w] x [0, FIELD.h]`.
  - `'smoother: blends halfway between two views, 50 ms behind'`: push at 0 `{x:0, y:0, angle:0}` and at 100 `{x:2, ...}`; `at(100)` gives x ≈ 1.
  - `'smoother: turns the short way across west'`: angle 3.1 then -3.1 (100 ms apart); `at(100)` has `|angle| > 3.1` (about ±π), never near 0.
  - `'smoother: a jump of more than 2 units snaps'`: x 0 then x 10; `at(100).x === 10`.
  - `'smoother: null before any view, the newest after it'`.
  - `'chase: the eye is behind the kart and the look point ahead of it'`: pose angle 0 at (10, 9) gives eye (6.8, 9), eyeH 1.6, look (12.5, 9).
  - `'follow: moves part of the way, never past the goal'`.
  - `'clampEye: an eye behind a wall comes back in front of it, on a shared barrier too'`:
    - a wall segment between kart and eye makes the result land on the kart's side, within `margin` + 0.01 of the wall;
    - on `buildTrack` for Hairpins (find it by name in `TRACKS`), for every 10th sample, `clampEye` of a kart there with its chase eye never returns a point across any wall segment from the kart.
- [ ] **Step 2: Run them and see them fail.** Run `node --test test/kart-race-3d-geom.test.js`. Expected: FAIL (`ArkKartGeom` undefined).
- [ ] **Step 3: Implement `geom3d.js`** to the interfaces above. Segment intersection is the usual 2D cross-product test.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race 3D: road, wall, smoothing and camera maths`.

### Task 5: A split-screen hook in `ArkMini.scene3d`

**Files:**
- Modify: `public/games/minis/mini.js` (`scene3d`)

**Interfaces:**
- Produces: `scene3d(el, { draw(renderer, scene, w, h) })`. When `opts.draw` is given, each frame calls it in place of `renderer.render(scene, camera)`, with the canvas size in CSS pixels. Without `opts.draw`, behaviour is unchanged. Also `opts.maxPixelRatio` (default 1.25), so Kart Race 3D can pass 1.

- [ ] **Step 1: Implement** the two options with a one-line comment each.
- [ ] **Step 2: Run the tests.** Run `npm test`. Expected: all pass (`mini-client.test.js` runs `mini.js` in a vm).
- [ ] **Step 3: Check by hand.** In the dev server, play one 3D minigame (Bowling) in Party Minigames: it draws as before.
- [ ] **Step 4: Commit.** `Minigames: the shared 3D scene can draw in split screen`.

### Task 6: The 3D stage: world, karts, things, two cameras

**Files:**
- Create: `public/games/kart-race-3d/kart3d.js`: `KR3D.create(el) -> Promise<{ update(view), dispose() }>`
- Create: `public/games/kart-race-3d/world3d.js`: `KRWorld.build(THREE, view) -> { group, segments, dispose() }`
- Create: `public/games/kart-race-3d/karts3d.js`: `KRKarts.make(THREE, racerId, slot) -> { obj, set(pose, k, now), dispose() }`
- Create: `public/games/kart-race-3d/things3d.js`: `KRThings.make(THREE) -> { group, update(view, now), dispose() }`
- Create: `public/games/kart-race-3d/style.css`
- Modify: `public/games/kart-race-3d/host.js` (real stage)

**Interfaces:**
- Consumes: `ArkKartTrack` (`build`, `outline`, `barriers`, `edgeLines`, `BARRIER`), `ArkKartGeom` (Task 4), `ArkKartRacers.racer(id)` (`shape`, `stripe`), `ArkMini.scene3d` with `draw` and `maxPixelRatio: 1` (Task 5), `ArkKartTV.make({ stage })` (Task 3).
- **The stage in `host.js`:**
  - `mount(el)` loads `/games/minis/mini.js`, `/games/kart-race/track.js`, `/games/kart-race/racers.js` and the four 3D files in order, then calls `KR3D.create(el)`.
  - `update(v)` forwards to it, or keeps the latest view until it's ready.
  - `unmount()` disposes it, and if `create` is still pending, disposes as soon as it resolves.
  - If loading fails, or WebGL is missing (`create` rejects), it puts `<div class="kr3d-none panel">3D isn't available on this screen. Try <strong>Kart Race</strong> instead.</div>` in `el`.
- **`kart3d.js`:**
  - Rebuilds the world when `view.track.index` changes, and keeps it otherwise.
  - Creates the 2 karts when `view.karts` first appears, and rebuilds one when its `racer` changes.
  - Pushes each view's poses into a `smoother`, and calls `smoother.at(performance.now())` every frame.
  - Each half keeps its own camera state, moved with `follow` toward `chase(pose, view.battle ? CAM.battle : CAM)`, with the eye passed through `clampEye(kart, eye, world.segments)`.
  - `draw` sets the scissor and viewport per half (P1 left) and each camera's aspect to `(w/2)/h`.
  - Background: a sky-blue clear colour. No fog, sky dome or shadows (PR 3).
  - Outside `race`/`countdown`, or with no karts, it draws the world from a high overview camera over the field centre.
- **`world3d.js`:**
  - The ground is a grass plane covering the field.
  - Road: `ribbon` of the road edges (`outline(line, ±trackWidth/2)`), dark grey.
  - Kerbs: thin red/white ribbons just outside each road edge, coloured by alternating vertex colours every 2 samples.
  - Tyre walls: inner and outer faces from `edgeLines(road, edge, 0)` and `edgeLines(road, edge, BARRIER)`, each raised as a 0.5-high wall (two ribbons plus a top ribbon), white with red stripes via vertex colours.
  - Boost pads: yellow flat quads at `view.track.boosts`.
  - Start line: a chequered quad at `view.track.start` (races only).
  - `segments` comes from `wallSegments`.
- **`karts3d.js`:**
  - The placeholder for each kart shape is the 2D `SHAPES` outline. Copy the six point lists into this file with a comment naming their source.
  - The body is the outline scaled so its x range spans 1.75, extruded 0.3 high, in the racer's `stripe` colour.
  - It also gets 4 dark wheels (cylinders, radius 0.18) and a driver: a sphere head (radius 0.22) above the middle, in the player's colour (`--p1` / `--p2`).
  - `set` places it at `(x, heightAt, y)`, turned to `-angle` about Y (field y is scene z), leaning up to 0.15 rad into the steer direction from the angle change.
  - While `k.spin` it adds a full turn every 600 ms.
  - While `k.shrunk` it scales to 0.7.
- **`things3d.js`:** simple stand-ins so nothing in play is invisible (nicer ones come in PR 2). Each kind is drawn as one `InstancedMesh`, resized as needed.

  | View field | Stand-in |
  | --- | --- |
  | `boxes` | rainbow cube, 0.5, spinning; gold when `double` |
  | `coins` | gold cylinder, radius 0.2, spinning on Y |
  | `bananas` | yellow capsule |
  | `webs` | white disc, radius 0.6 |
  | `oils` | dark disc, radius 0.7 |
  | `shots` | sphere, 0.25, coloured by `kind` |
  | `blasts` | an orange sphere growing with `age` to radius 2 by 500 ms, then gone |

- **`style.css`:**
  - `.kr-host.kr-3d .kr-arena` fills the space under the HUD.
  - The 3D canvas fills the arena, with a 4px `--p1` border on the left half and `--p2` on the right. Use two absolutely placed frame divs, not canvas borders.
  - Also styles `.kr3d-none`.

- [ ] **Step 1: Write the four modules and the stage** to the interfaces above, one file at a time. Each file opens with a 2–3 line comment saying what it draws.
- [ ] **Step 2: Run the tests.** Run `npm test`. Expected: all pass (no server change in this task).
- [ ] **Step 3: Check by hand in the browser.** Start the dev server with preview_start; on the TV pick Kart Race 3D; join two phones (two `/play/` tabs). Then:
  - Race on Speedway: both halves follow their kart, the road and walls line up with where karts bump, boxes and coins show, and the console has no errors.
  - Race on Hairpins: the camera never sees through the shared barrier.
  - A Battle round in each arena.
  - A best-of-3: the track changes and the karts snap to the grid.
  - Rematch.
  - Back to the lobby and in again: one canvas only (`document.querySelectorAll('canvas').length` in `javascript_tool`).

  Screenshot a race and a battle.
- [ ] **Step 4: Check the no-WebGL message.** In `javascript_tool`, before entering the game, make `HTMLCanvasElement.prototype.getContext` return null for `webgl2`/`webgl`, then enter Kart Race 3D. Expected: the message, and the HUD and overlays still work (setup screen usable).
- [ ] **Step 5: Commit.** `Kart Race 3D: split-screen 3D race with chase cameras and placeholder karts`.

### Task 7: Docs and release notes

**Files:**
- Modify: `README.md`:
  - A games-table row under Kart Race, in the same player-facing tone. It says it's Kart Race shown as a split-screen 3D race with a chase camera behind each kart, best on a PC or Steam Deck, with everything else as Kart Race and a link to its row.
  - Setup-table and controller-table rows "As Kart Race".
- Modify: `CHANGELOG.md`: a new `## 0.1.14` heading above `## 0.1.13` (v0.1.13 is the last release), with `- New game: **Kart Race 3D**. …` in the style of the Tower Defence Duel line.
- Regenerate: `docs/GAMES.md` if the README change affects it (`node tools/games-catalog.mjs`).

- [ ] **Step 1: Write the README rows and the CHANGELOG line.**
- [ ] **Step 2: Run the tests.** Run `npm test`. Expected: all pass (`changelog.test.js`, `catalog.test.js`).
- [ ] **Step 3: Review the branch.** Run the `two-player-sync-reviewer` agent on the branch and fix what it confirms.
- [ ] **Step 4: Commit.** `Kart Race 3D: README and What's new`.
- [ ] **Step 5: Push and open a ready PR.** Push the branch (`kart-race-3d`) and open a ready PR titled `Kart Race 3D: a new split-screen 3D kart race`, with the screenshots, test results, and a note that the Steam Deck frame rate is for the owner to check.
