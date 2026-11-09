# Kart Race 3D: Sunset Canyon's look (part 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sunset Canyon Rally gets its own look in Kart Race 3D. Red rock cliffs ring the field, there are mesas and boulders in the infield, two rock arches cross the road (the Arch Sweep and the Mining Cut), a dam stands in the distance, and the festival paddock sits by the start. The ground is sand and the barriers are orange and white.

**Architecture:**
- **Server:** the track's data says it has canyon scenery and where its arches are, and the race view passes that on (`view.track.scenery`).
- **Layout:** a new client file, `canyon3d.js`, works out a deterministic layout from the road: what goes where, kept clear of the road. This is pure and testable.
- **Pieces:** the same file builds each piece from a small table of factories (`PIECES`), so a later ComfyUI model can replace a factory without touching the layout. Every rock is one shared slab geometry drawn as a single `InstancedMesh`, so the canyon costs a handful of draw calls.
- **World:** `world3d.js` switches the ground and barrier colours and adds the canyon when the view asks for it.

**Tech Stack:** Three.js 0.184 (`InstancedMesh`, basic geometries), plain browser IIFEs, node:test with real Three.js for the scene graph.

**Spec:** `docs/superpowers/specs/2026-11-08-kart-race-3d-grand-prix-design.md`, build order item 4, and "The first five" under Big tracks. The look follows the concept art in `asset-references/tracks/sunset-canyon/v0.1/` (`hero.png`, `whole-track-top-view-v1.png`).

## Global Constraints

- **Scenery only:** the road, the barriers, the collision and the minimap are unchanged. `heightAt` stays 0, and nothing in the scenery touches the drivable corridor (half the road width plus `wallOut`).
- **Only Sunset Canyon Rally** gets the canyon. The other four big tracks, the 2D game and the battle arenas look exactly as before.
- **Ready to swap for ComfyUI models later:** the layout (positions and sizes) is separate from the geometry (the `PIECES` factories).
- **Steam Deck minimum:** don't lower visual quality. The canyon adds at most **40 draw calls** and **80,000 triangles**, and it is drawn twice a frame (split screen).
- **The chase camera:** it sits 1.6 above the road (3.0 in battles), so an arch's underside is at least **7** above the road.
- **Field:** Sunset Canyon is 128 × 72, the road is 7 wide, and `wallOut` is 1.25. Its arches are at lap fractions **0.396** (Arch Sweep) and **0.85** (Mining Cut), from `features.arches` in `server/games/kart-tracks-3d.js`.
- **Commits:** messages look like `Kart Race 3D: …`.

## Decisions this plan makes (the spec only names the pieces)

- **Palette:**
  - sand ground `0xd9a066`;
  - rock bands `[0xc2410c, 0xea580c, 0xb45309, 0x9a3412, 0xd97706]`;
  - barrier stripes orange `#f97316` and white `#f8fafc` (as in `hero.png`);
  - dam concrete `0xd6d3d1`, water `0x22b8cf`;
  - tents teal `0x14b8a6` and yellow `0xfacc15`.
- **Determinism:** a seeded random generator (mulberry32, seed `20261108`), so every TV draws the same canyon.
- **"In the distance":** the dam stands beyond the field's north edge (y < 0), behind the cliffs, and is tall enough to show over them.

## Review Focus

1. **The overview camera between races** (high over the field, looking north): the scenery must not hide the track. Cliffs stay outside the field, and the dam stands beyond them. *Task 2:* the cliffs-outside-the-field test.
2. **An arch over a road that runs close to another stretch:** its legs must not land on the other stretch. *Task 2:* leg clearance is measured against the whole centre line, not just the near point.
3. **A rematch, or a switch to another track and back:** the world is rebuilt, and the old canyon's geometry and materials must be freed. *Task 3:* dispose frees every geometry and material once.
4. **Other tracks unchanged:** a view without `scenery` builds no canyon, with grass ground and red and white walls. *Task 4.*
5. **Battle arenas:** an arena view has no `scenery`, so no arches over a battle camera at 3.0. *Task 1:* the arena view test.

---

### Task 1: Scenery in the track data and the race view

**Files:**
- Modify: `server/games/kart-tracks-3d.js` (Sunset Canyon's entry gets `scenery: 'canyon'`)
- Modify: `server/games/kart-race.js` (`buildTrack` at line 216, which keeps `scenery`, and the view's `track` object at line 1243)
- Test: `test/kart-tracks-3d.test.js`

**Interfaces:**
- **Produces:** `view.track.scenery`, which is `{ kind: 'canyon', arches: [0.396, 0.85] }` for Sunset Canyon Rally and `null` for every other track and arena. `buildTrack` copies `def.scenery` (or `null`) and `def.features` into the built track. The view builds `scenery` as `track.scenery ? { kind: track.scenery, arches: (track.features && track.features.arches) || [] } : null`.

- [ ] **Step 1: Write the failing tests** in `test/kart-tracks-3d.test.js`. Use `KartRace3D` from `server/games/kart-race-3d.js` and the file's existing `racingOn` pattern (start a race on a chosen track):
  - `Sunset Canyon's view carries its canyon scenery`: racing on track 0, `hostView().track.scenery` deep-equals `{ kind: 'canyon', arches: [0.396, 0.85] }`.
  - `other big tracks have no scenery`: racing on track 1, `scenery === null`.
  - `the 2D game's tracks have no scenery`: a `KartRace` race on track 0 gives `scenery === null`.
  - `a battle arena has no scenery`: a 3D battle (mode battle) gives `hostView().track.scenery === null`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-tracks-3d.test.js`. Expected: the four new tests FAIL (`scenery` is undefined).
- [ ] **Step 3: Implement** the changes in the Interfaces block. Arenas go through `buildArena`, which never sets `scenery`, so make sure the view gives `null` there and not undefined.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-tracks-3d.test.js test/kart-race-3d.test.js test/kart-race.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Sunset Canyon's view says where its scenery goes"`

### Task 2: The canyon's layout (`canyon3d.js`, pure part)

**Files:**
- Create: `public/games/kart-race-3d/canyon3d.js`
- Test: `test/kart-race-3d-canyon.test.js`

**Interfaces:**
- **Consumes:** `window.ArkKartTrack` (`build`, `pointAt`), and a view with `track.points`, `track.scenery`, `trackWidth`, `wallOut` and `field`.
- **Produces `window.KRCanyon.layout(view) -> Layout`:**
  - `rocks: [{ x, y, r, h, kind: 'cliff' | 'mesa' | 'boulder' }]`, in field units, where `r` is the base radius and `h` the height.
  - `arches: [{ x, y, angle, inner, clear, legR }]`: centred on the road, with `angle` the direction of travel.
    - `inner = 2 * (half + wallOut) + 2`, the gap between the legs.
    - `clear = 7`, the underside's height.
    - `legR = 2.5`.
    - The leg centres sit at `±(inner / 2 + legR)` across the road.
  - `dam: { x, y, w, h }`.
  - `paddock: [{ kind: 'tent' | 'canopy' | 'flag', x, y, angle }]`.
  - Positions use field (x, y). The scene's (x, z) is the field's (x, y).
- **Rules:**
  - **Cliffs:** on a rectangle 6 outside the field's edges, every 7 units, with r 5 to 8 and h 9 to 16. Every cliff's disc lies wholly outside the field.
  - **Mesa:** one big mesa at the point inside the loop farthest from the centre line. Its r is that distance minus (half + wallOut + 3), capped at 14, with h 8.
  - **Boulders:** up to 36, from seeded candidates on a 4-unit grid inside the field. Each has r 1 to 3 and h 1 to 4, and keeps at least (half + wallOut + 3 + r) from the whole centre line and 3 from every paddock piece.
  - **Arches:** one per `scenery.arches` fraction, at `pointAt(road, f)`. Each leg centre keeps at least (half + wallOut + 0.5 + legR) from the whole centre line. If a leg would break that, it moves outward until it doesn't (at most 6 extra), and `inner` grows to match.
  - **Dam:** `{ x: field.w / 2, y: -30, w: 56, h: 22 }`.
  - **Paddock:** along the lap between fractions 0.06 and 0.16, on the side of the road outside the loop. That side is the offset whose point is not inside the centre-line polygon. Pieces sit at offsets of 9 to 11 from the centre line, in this order: tent, canopy, tent, tent, then flags every 0.012 at offset 6.5.
  - **No canyon:** `layout` returns `null` when `view.track.scenery` is missing.
  - **Randomness:** everything random comes from mulberry32 seeded `20261108`.

- [ ] **Step 1: Write the failing tests** in `test/kart-race-3d-canyon.test.js`.
  - **Setup:** import `../public/games/kart-race/track.js` (it sets `globalThis.ArkKartTrack`), load `canyon3d.js` with `vm.runInContext` into a context whose `window` is itself and which has `ArkKartTrack`, and build the view from `buildTrack(0, TRACKS_3D)` (in `server/games/kart-race.js`) as `{ track: { points, scenery: { kind: 'canyon', arches: [0.396, 0.85] } }, trackWidth: 7, wallOut: 1.25, field: { w: 128, h: 72 } }`. A helper `dist(road, x, y)` returns the smallest distance to any point of `road.line`.
  - The tests:
    - `no canyon without scenery`: `layout({ ...view, track: { points } }) === null`.
    - `the same canyon every time`: two `layout(view)` calls deep-equal each other.
    - `cliffs stand outside the field`: for every cliff, `x + r < 0 || x - r > 128 || y + r < 0 || y - r > 72`, and there are more than 30 cliffs.
    - `rocks in the field keep off the road`: every mesa and boulder has `dist >= 3.5 + 1.25 + 3 + r - 1e-6`, and there is exactly one mesa.
    - `two arches straddle the road, legs clear of every stretch`:
      - `arches.length === 2`;
      - each arch centre is within 0.5 of the centre line;
      - each leg centre (`x ∓ sin(angle) * (inner / 2 + legR)`, `y ± cos(angle) * (inner / 2 + legR)`) has `dist >= 3.5 + 1.25 + 0.5 + legR - 1e-6`;
      - `clear >= 7`.
    - `the dam is in the distance`: `dam.y < -20`, and `dam.x` is between 0 and 128.
    - `the paddock is by the start, off the road, outside the loop`:
      - at least 4 pieces, including at least one `tent` and one `canopy`;
      - every piece has `dist >= 3.5 + 1.25 + 1`;
      - no piece is inside the centre-line polygon;
      - every piece is within 40 of the start point `pointAt(road, 0)`.
    - `boulders keep clear of the paddock`: every boulder is at least `3 + r` from every paddock piece.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: FAIL (ENOENT for `canyon3d.js`).
- [ ] **Step 3: Implement `KRCanyon.layout(view)`** with the rules above. Give the file a header comment in the house style: what it is, the layout/pieces split, and that a ComfyUI model can replace a `PIECES` entry later. Use a ray-casting point-in-polygon test against `road.line`.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: where Sunset Canyon's rocks, arches, dam and paddock go"`

### Task 3: Building the canyon (`canyon3d.js`, pieces)

**Files:**
- Modify: `public/games/kart-race-3d/canyon3d.js`
- Test: `test/kart-race-3d-canyon.test.js`

**Interfaces:**
- **Consumes:** `layout(view)` from Task 2.
- **Produces:**
  - **`KRCanyon.PIECES`**, factories each returning a `THREE.Object3D` at the origin, facing +x:
    - `arch(THREE, a)`: two legs (stacked slabs) and a half `TorusGeometry` over the top whose underside is at `a.clear`;
    - `dam(THREE, d)`: the wall (a box `d.w` × `d.h` × 4), two buttress towers, the water behind it (a flat plane), and two waterfall planes down its face;
    - `tent(THREE)`: a cylinder with a cone roof, about 3 across and 3 tall;
    - `canopy(THREE)`: four posts and a flat roof, 5 × 3;
    - `flag(THREE)`: a 4-tall pole with a pennant.
    - Each takes its colours from the palette.
  - **`KRCanyon.build(THREE, view) -> { group, dispose() } | null`:**
    - `null` without scenery;
    - `group.name === 'canyon'`;
    - every rock (cliffs, the mesa and boulders, plus the arch legs) is one `InstancedMesh`;
    - `dispose()` frees every geometry and material it made, once each.
- **Rocks:** each rock is a stack of slabs drawn from one shared slab, `CylinderGeometry(1, 1, 1, 9)` with its base at y = 0.
  - The number of slabs is `max(1, round(h / 2.5))`, each slab about `0.9` the radius of the one below.
  - Each slab gets a random turn about y, and its colour from the rock bands in turn.
  - The material is `MeshLambertMaterial({ flatShading: true })`, with `setColorAt` giving each slab its colour.

- [ ] **Step 1: Write the failing tests**, in the same file. Load `three` into the context as in `test/kart-race-3d-karts.test.js`, passing real THREE.
  - `build gives nothing without scenery`: `build(THREE, plainView) === null`.
  - `the canyon is one group with every rock in one instanced mesh`: `group.name === 'canyon'`; exactly one `InstancedMesh`, whose `count` equals the total number of slabs; the group has at least one each of a dam, two arches, tents and a canopy. Find these by `userData.piece` (`'dam'`, `'arch'`, `'tent'`, `'canopy'`, `'flag'`), set by each factory.
  - `the canyon stays within its draw-call and triangle budget`:
    - draw calls are the meshes in the group (an `InstancedMesh` counts once): at most 40;
    - triangles are each mesh's index count ÷ 3, times `count` for the `InstancedMesh`: at most 80,000.
  - `pieces stand where the layout says`: the arch objects' positions match `layout(view).arches` x/y as scene x/z (±1e-6), and `rotation.y === -angle`.
  - `dispose frees each geometry and material once`: spy on `dispose` of every geometry and material in the group (traverse before calling). After `dispose()`, each spy was called exactly once.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: the new tests FAIL (`build` isn't a function).
- [ ] **Step 3: Implement `PIECES` and `build`** as above. Place pieces at scene `(x, 0, y)` with `rotation.y = -angle`. Share the materials of the same colour within the build.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: build Sunset Canyon's rocks, arches, dam and paddock"`

### Task 4: The canyon in the world

**Files:**
- Modify: `public/games/kart-race-3d/world3d.js` (`COLORS`, `stripes()`, `build()`)
- Modify: `public/games/kart-race-3d/host.js` (`SCRIPTS`: add `'/games/kart-race-3d/canyon3d.js'` before `world3d.js`)
- Test: `test/kart-race-3d-canyon.test.js`

**Interfaces:**
- **Consumes:** `KRCanyon.build(THREE, view)` from Task 3.
- **Produces:** `KRWorld.build(THREE, v)`, unchanged in its signature.
  - When `v.track.scenery && v.track.scenery.kind === 'canyon'`:
    - the ground is sand `0xd9a066`;
    - the barrier and kerb stripes are orange `#f97316` and white `#f8fafc`;
    - the canyon group is added as a child of the world group.
  - Otherwise, everything is as before (grass `0x3f8f3a`, red `#ef4444` and white stripes).
  - The world's `dispose()` also calls the canyon's `dispose()`. Don't free the canyon's pieces twice through the world's own traverse: build the canyon in its own group and leave it out of that traverse.

- [ ] **Step 1: Write the failing tests:**
  - **Setup:** load `geom3d.js`, `world3d.js` and `canyon3d.js` into the same context, with a `document.createElement` canvas stub whose `getContext` returns an object with `fillRect`, `beginPath`, `moveTo`, `lineTo` and `stroke`, and writable `fillStyle`, `strokeStyle` and `lineWidth`. Record every `fillStyle` set, to check the stripe colours.
  - `Sunset Canyon's world has the canyon, sand and orange barriers`: `world.group.getObjectByName('canyon')` exists; the ground mesh (the first child) has colour `0xd9a066`; `'#f97316'` was among the fill styles used.
  - `other tracks' worlds are unchanged`: with no `scenery` there is no `canyon` child, the ground is `0x3f8f3a`, and `'#ef4444'` was used.
  - `disposing the world frees the canyon once`: spy on the canyon's pieces as in Task 3. After `world.dispose()`, each spy was called exactly once.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes to `world3d.js` and `host.js`. `stripes(THREE, a, b)` takes its two colours.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-canyon.test.js test/kart-race-3d-client.test.js test/kart-race-3d-loading.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Sunset Canyon races through its canyon"`

### Task 5: Docs, catalog, full suite and a live race

**Files:**
- Modify: `README.md` (the Kart Race 3D row, line 71)
- Modify: `CHANGELOG.md` (under `## 0.1.37`)
- Modify: `docs/GAMES.md` (regenerated)

- [ ] **Step 1: Update the README row.** Change "**Sunset Canyon Rally** (laid out after a desert canyon rally route)" to "**Sunset Canyon Rally** (a desert canyon rally: red rock cliffs, two rock arches over the road, a dam in the distance and the festival paddock at the start)".
- [ ] **Step 2: Add the What's new line** under `## 0.1.37`: `- 🏜️ Kart Race 3D: Sunset Canyon Rally now races through its canyon: red rock cliffs and mesas, two rock arches over the road, a dam in the distance and the festival paddock by the start.`
- [ ] **Step 3: Regenerate the catalog and run everything.** Run `node tools/games-catalog.mjs`, then `npm test`. Expected: everything passes.
- [ ] **Step 4: Race it live.**
  - Run `preview_start ark-dev` and set a 1280 × 720 viewport.
  - Start a 1v1 race on Sunset Canyon Rally with the scratchpad bots (`PORT=<port> node bots.mjs <code> kart-race-3d '{"track":0}' 60`).
  - Take screenshots on the start straight (the paddock), at an arch, and of the overview between races.
  - Check through the arches that the chase camera stays clear.
  - Read `renderer.info.render.calls` through `javascript_tool` if it's reachable; otherwise compare the frame time before and after.
  - Run `read_console_messages` with `onlyErrors`. Expected: none.
  - Also race on Speedway Oval, which should look as before.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: README and What's new for Sunset Canyon's look"`
