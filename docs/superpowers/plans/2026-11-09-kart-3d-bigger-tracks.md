# Kart Race 3D: bigger tracks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kart Race 3D's five tracks get a 12-wide road on a 288 × 162 field, with each layout scaled up so a lap takes 45–60 seconds at top speed. Items, grid, computer lanes, laps, records, cameras and Sunset Canyon's scenery all scale to match.

**Architecture:**
- **Track data:** the 3D track list (`kart-tracks-3d.js`) carries each track's `size`, plus its new shared constants (width, field, grid, box offsets, lanes, record name).
- **`buildTrack`:** derives the box rows and the coin count from the scaled lap.
- **Engine:** reads its lanes and record name from the built track.
- **TV:** sizes its cameras' far distance by the field, and the canyon scales by `field.w / 128`.

**Tech Stack:** Node ES modules on the server, plain browser IIFEs, node:test.

**Spec:** `docs/superpowers/specs/2026-11-09-kart-race-3d-bigger-tracks-design.md`

## Global Constraints

- **3D tracks:**
  - `width: 12`, `field: { w: 288, h: 162 }`;
  - `boxOffsets: [-4, -2, 0, 2, 4]`, `grid: { rowGap: 5, side: 2.5 }`;
  - `lanes: [-4.1, 0, 4.1]`, `recordName: '<name> (wide)'`.
- **Sizes:**
  - Sunset Canyon Rally 2.25, Speedway Oval 2.25, Grand Prix Circuit 2.25;
  - Serpent Pass 2.15, Zigzag Ridge 2.4.

  Measured: these give laps of 52.4, 53.5, 47.8, 58.0 and about 48.6 seconds at 8.5 units a second.
- **Scaling about the middle:** each point is placed with
  `[144 + (x - 64) * size, 81 + (y - 36) * size]`, where `x, y` are today's points (after `around(…)`).
  So every track stays centred on the new field.
  - *(The spec says "about the field's corner". With sizes other than 2.25 that would shift the track off centre. Scaling about the middle is the same at 2.25 and keeps the others centred.)*
- **Lap length:** every lap is 45–60 s at top speed, so `road.length / 8.5` falls in [45, 60].
- **? box rows:** one about every 60 units. A 3D track sets `rowEvery: 60`, and `buildTrack` gives `n = Math.round(road.length / 60)` rows at fractions `(i + 0.5) / n`.
- **Coins:** today's count × size, rounded.
- **Boost pads:** today's pads, plus one at the middle of the track's longest straight.
- **The 2D game unchanged:** `TRACKS`, `OPTIONS.laps [5, 3, 8]`, `CPU.lanes [-2.4, 0, 2.4]`, the record names, `GRID` and `ITEMS`.
- **Kart Race 3D laps:** `[3, 5, 8]`.
- **Cameras:** the far distance is `Math.max(200, 2.5 * field.w)`.
- **Room for items on the TV:** coins 400 and boxes 120.
- **Canyon:** it scales by `s = field.w / 128`, with up to 80 boulders. The budget stays ≤ 40 draw calls and ≤ 80,000 triangles, and the arch is still ≥ 7 clear over the middle of the road.
- **Commits:** messages look like `Kart Race 3D: …`.

## Review Focus

1. **A saved 3D laps setting from before** (stored as 5) must still load as 5, not change silently. *Task 2:* the saved-laps test.
2. **A 2D race after a 3D one in the same room:** the 2D tracks keep `lanes` and their record name. *Task 2:* the 2D lanes and record test.
3. **The Mixed track setting (0)** picks among the five big tracks and still works at the new size. *Task 1:* the existing 4-race cup test keeps passing (five different tracks).
4. **The overview between races on the biggest field:** the far corner of the field and the dam are inside the camera's far distance. *Task 3:* the far-distance test against the field's diagonal.
5. **Boulders and arch legs on the much wider road near a hairpin:** the canyon layout tests run on the new field. *Task 4.*

---

### Task 1: Bigger 3D track data

**Files:**
- Modify: `server/games/kart-tracks-3d.js`:
  - `BIG` becomes the new constants;
  - each track gets `size`, scaled `points`, `coins`, and `boosts` (plus the new pad);
  - replace `rows` with `rowEvery: 60`;
  - `recordName`.
- Modify: `server/games/kart-race.js`, `buildTrack` (line 207): `rows = def.rows || (def.rowEvery ? spread(road.length / def.rowEvery) : ITEMS.rows)`, plus `lanes: def.lanes || CPU.lanes` and `recordName: def.recordName || def.name` in the built track.
- Test: `test/kart-tracks-3d.test.js` (update the per-track tests at lines 135–197).

**Interfaces:**
- **Produces:** the built track gains `lanes` (a number array) and `recordName` (a string). Its `rows` are fractions of the lap, as before.
- **The new pad's place:** use a short node script with `Road.build` and `pointAt` to find the middle of the longest stretch where the heading changes by less than 0.05 rad over ±5 units. Write that fraction into the track's `boosts` as `[fraction, 0]`.

- [ ] **Step 1: Update the per-track tests:**
  - `a big track (road 12, field 288 x 162)`: `t.width === 12` and `t.field` deep-equals `{ w: 288, h: 162 }`.
  - `a lap of 45-60 s at top speed`: `t.length / 8.5` is in [45, 60].
  - `rows of boxes about every 60 units`: `t.rows.length === Math.round(t.length / 60)`, and each gap between consecutive rows, times `t.length`, is in [50, 70].
  - `one more boost pad than before, the new one on a straight`:
    - `t.boosts.length === 3`;
    - at the last pad's fraction, the heading at `p − 5/len` and `p + 5/len` differs by less than 0.05 rad.
  - **The grid test:** use `t.grid` (not `GRID`), check spots are at least 2 apart, and keep "on the road".
  - **The Normal-driver test:** rename it `a Normal driver completes a lap without getting stuck`. Loop up to 300,000 ms, and assert `bestLap !== null && bestLap <= 180000`.
  - **Kept:** the clean-loop, tightest-bend and on-the-road tests stay as they are; they read `t.width` and `t.field`.
  - **Add** `the 3D tracks race in wide lanes, under their own record name`: `t.lanes` deep-equals `[-4.1, 0, 4.1]` and `t.recordName === def.name + ' (wide)'`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-tracks-3d.test.js`. Expected: the updated tests FAIL (width is 7).
- [ ] **Step 3: Implement** the data and the `buildTrack` changes. Keep `around()` for today's shapes, then apply the scaling in Global Constraints with a `scaled(points, size)` helper. Update the file's header comment to say road 12 on 288 × 162, laps of 45–60 s.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-tracks-3d.test.js test/kart-race.test.js`. Expected: all pass.
  - If a track fails the 45–60 s or the tightest-bend test, adjust only that track's `size` within 2.1–2.5, and record a ruling.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: the big tracks get a 12-wide road and laps of about a minute"`

### Task 2: Lanes, laps and records in the engine

**Files:**
- Modify: `server/games/kart-race.js`:
  - lines 453 and 608: `CPU.lanes` becomes `this.track.lanes`;
  - line 414: `lapRecord(this.track.recordName)`;
  - line 1084: `track: this.track.recordName`;
  - the `seriesRecords` keys at lines 415 and 1060–1064 become `this.track.recordName`.
- Modify: `server/games/kart-race-3d.js` line 12: `OPTIONS_3D` gets `laps: [3, 5, 8]`.
- Test: `test/kart-tracks-3d.test.js`

**Interfaces:**
- **Consumes:** `track.lanes` and `track.recordName` from Task 1.

- [ ] **Step 1: Write the failing tests:**
  - `computer racers hold the wide lanes on a big track`: in an 8-kart Cup, every computer kart's `driver.home` is in `[-4.1, 4.1]`.
  - `the 2D game keeps its lanes and record names`: `buildTrack(0)` has `lanes` deep-equal to `[-2.4, 0, 2.4]` and `recordName === TRACKS[0].name`.
  - `a 3D lap record is looked up and saved under its wide name`:
    - give `fakeCtx()` a `lapRecord` spy that records its argument;
    - after a race starts on track setting 2 (Speedway Oval), the spy was called with `'Speedway Oval (wide)'`;
    - the game's laps entry (whatever `kart-race.js:1084` builds) has `track: 'Speedway Oval (wide)'`.
  - `Kart Race 3D races 3 laps by default; Kart Race keeps 5`: a fresh `KartRace3D` has `settings.laps === 3`, and a fresh `KartRace` has 5.
  - `a saved 5-lap setting still loads as 5`: with `ctx.saved = { settings: { laps: 5 } }`, `new KartRace3D(ctx).settings.laps === 5`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-tracks-3d.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-tracks-3d.test.js test/kart-race.test.js test/kart-race-3d.test.js test/kart-race-cup8.test.js test/kart-race-cpu.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: wide lanes, 3 laps by default and fresh records for the big tracks"`

### Task 3: The TV's cameras and item room

**Files:**
- Modify: `public/games/kart-race-3d/kart3d.js`: `setWorld` sets `far = Math.max(200, 2.5 * f.w)` on `gl.camera` and both `cams`, then calls `updateProjectionMatrix()`.
- Modify: `public/games/kart-race-3d/things3d.js`: `boxes` 120, `coins` 400.
- Test: `test/kart-race-3d-scene.test.js`

- [ ] **Step 1: Write the failing test:**
  - `the cameras see the whole big field`: update the view's `field` to `{ w: 288, h: 162 }`, then call `update`.
  - Both chase cameras (from `cameras()`) have `far === 720`.
  - The overview camera (the fake `scene3d`'s `camera`; expose it from the harness) also has `far === 720`.
  - Its distance to the field's far corner `(288, 0, 0)` is less than 720.
- [ ] **Step 2: Run the test.** Run `node --test test/kart-race-3d-scene.test.js`. Expected: FAIL (far is 200).
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-scene.test.js test/kart-race-3d-client.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: the cameras see across the big fields"`

### Task 4: Sunset Canyon at the new size

**Files:**
- Modify: `public/games/kart-race-3d/canyon3d.js`. In `layout(view)`, take `s = view.field.w / 128` and scale:
  - `CLIFF.step`, `r` and `h`;
  - `BOULDERS.grid`, `r` and `h`, with `max: 80`;
  - `MESA.maxR` and `h`;
  - `DAM.y`, `w` and `h`;
  - in `build`, `SLAB_H`.

  The paddock offsets become `keep + extra`, with extras `[5, 5.5, 4.5, 5]` for tent, canopy, tent and tent, and the flags at `keep + 1.75`. `ROCK_GAP`, `ARCH` and the paddock's distances along the road stay as they are.
- Test: `test/kart-race-3d-canyon.test.js`. `HALF` becomes `6`, and the view uses `trackWidth: 12`, `field: { w: 288, h: 162 }`.

- [ ] **Step 1: Update the canyon tests** to the new view:
  - `the dam is in the distance` becomes `dam.y < -45`;
  - `boulders: up to 80, more than 36`: the boulder count is in (36, 80].
  - The other tests stay as they are, against the new view.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-canyon.test.js`. Expected: FAIL. Some may fail because rocks sit too close on the wider road, and the boulder and dam tests fail.
- [ ] **Step 3: Implement** the scaling.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-canyon.test.js test/kart-tracks-3d.test.js`. Expected: all pass, including the budget (≤ 40 draw calls, ≤ 80,000 triangles).
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Sunset Canyon's scenery grows with its track"`

### Task 5: Docs, full suite and a live check

**Files:**
- Modify: `README.md`, the Kart Race 3D row:
  - "a road twice as wide and laps of about a minute" becomes "a road three times as wide as Kart Race's (room for the whole pack) and laps of about a minute";
  - the Laps mention for 3D: races default to 3 laps.
- Modify: `README.md`, the setup table row for Kart Race 3D, if it lists laps.
- Modify: `CHANGELOG.md` (under `## 0.1.38`): `- 🏁 Kart Race 3D's tracks are much bigger: a road wide enough for the whole pack and laps of about a minute (3D races now default to 3 laps). Lap records start fresh on the bigger tracks.`
- Modify: `docs/GAMES.md` (regenerated)

- [ ] **Step 1: Update the docs, regenerate the catalog, and run `npm test`.** Expected: everything passes.
- [ ] **Step 2: Live check.**
  - Run `preview_start ark-dev` with a 1280 × 720 viewport.
  - With the scratchpad bots, race 1v1 on Sunset Canyon Rally (track 1) and Speedway Oval (track 2).
  - Take screenshots of the wider road with both karts, and of the overview between races.
  - Note a bot's first lap time from the view.
  - Run `read_console_messages` with `onlyErrors` after a reload. Expected: none new.
- [ ] **Step 3: Commit.** `git commit -m "Kart Race 3D: README and What's new for the bigger tracks"`
