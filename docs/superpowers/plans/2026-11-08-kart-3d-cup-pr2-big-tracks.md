# Kart Race 3D Cup, PR 2: big tracks. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kart Race 3D races on five big tracks (a road 7 wide, fields about 4× bigger, laps of 40-60 seconds): four of today's layouts remade at the new scale plus Sunset Canyon Rally. The 2D Kart Race keeps its six small tracks exactly as they are.

**Architecture:** A track's size becomes data: each track carries its own road width, wall verge, field, ? box rows, coin count and shortcut threshold, and the road's sample count follows its length. The engine reads those instead of module constants. The game's track list and setup options become per game (`this.tracks`, `this.options`), and `KartRace3D` returns the new list from `server/games/kart-tracks-3d.js`. The screens already draw from the view's `field`, `trackWidth` and track points; only a few fixed sizes in the 3D client need scaling.

**Tech Stack:** Node 20 ES modules, `node:test`, plain browser JS, three.js.

**Spec:** `docs/superpowers/specs/2026-11-08-kart-race-3d-grand-prix-design.md` (build stage 2, "Big tracks").

## Global Constraints

- The 2D Kart Race is unchanged. Its six tracks, field (32 × 18), road (3.4), box rows, coins and 240 samples stay as they are. Every existing kart test passes **unedited**.
- Big tracks: road width **7**, field **128 × 72**, laps of **40-60 s** for the Normal computer driver. Kart speed and handling stay unchanged.
- Kart Race 3D's five tracks, in setup order:
  1. **Sunset Canyon Rally**
  2. **Speedway Oval**
  3. **Grand Prix Circuit**
  4. **Serpent Pass**
  5. **Zigzag Ridge**

  They have new names, so lap records start fresh. They are separate from the 2D tracks' records.
- Road sample spacing stays about today's (≈ 0.3 units), so every "samples apart" constant (`OTHER` in `barriers`, `NEAR_SPAN`, the Seeker's same-stretch check) keeps meaning the same distance.
- Battle arenas are unchanged (the 32 × 18 field), in 2D and 3D.
- Tracks stay flat (`heightAt` = 0).
- Players notice this change, so it gets a README row update and a line in `CHANGELOG.md` under `## 0.1.37` (v0.1.36 is the latest release).
- Comments are short and plain-English. Commit messages use `Kart Race 3D: …` or `Kart Race: …`.

## Review Focus

1. **Saved settings from before:** a room that saved `track: 6` (Zigzag, the 6th 2D track) opens Kart Race 3D, which has only 5. Expected: the setting falls back to Mixed, with no crash. Pinned in Task 3.
2. **A 4-race cup in 3D 1v1:** it needs 5 different tracks (4 races plus sudden death). With exactly 5 this must still work, with no repeats and no crash. Pinned in Task 3.
3. **Shortcuts on big tracks:** a kart cutting across the infield must still be caught. The "a lap jump this big is a shortcut" fraction can't stay 0.05 of a lap, which is 20 units on a long track. Pinned in Task 2.
4. **A kart pushed off the field's edge** on a big track must be held in by the big field, not the old 32 × 18 one. Pinned in Task 2.
5. **Switching games in one TV session** (2D, then 3D, then 2D) must rebuild the right road each time. The client builds the road from the points, so it must agree with the server on the sample count. Pinned in Task 1, which checks the client-side `Road.build` and the server get the same `line.length`.

---

### Task 1: Road samples follow the track's length

**Files:**
- Modify: `public/games/kart-race/track.js` (`build`, new `samplesFor`)
- Modify: `server/games/kart-race.js` (every `SAMPLES` used as "this track's sample count")
- Test: `test/kart-tracks-3d.test.js` (new)

**Interfaces:**
- Produces:
  - `ArkKartTrack.samplesFor(points): number`:
    - `SAMPLES` (240) when the control polygon's perimeter is at most 120 units, which covers every 2D track and arena;
    - otherwise `Math.round(perimeter / 0.3)`.
  - `ArkKartTrack.build(points)` uses `centreLine(points, samplesFor(points))`. The server and the screens call the same function, so they always agree.
  - In `kart-race.js`, a kart's `seg` uses `this.track.line.length` instead of `SAMPLES`, in `newRace` (kart `seg`) and the shortcut reset in `lapCheck`. The exported `SAMPLES` stays as it is for existing imports.

- [ ] **Step 1: Write the failing tests**
  - `'2D tracks and arenas keep 240 samples'`: for every `TRACKS` and `ARENAS` entry, `buildTrack(i).line.length === 240` and `buildArena(i).line.length === 240`.
  - `'a big loop gets more samples, about 0.3 apart'`: a square of points `[[10,10],[118,10],[118,62],[10,62]]` gives `samplesFor(...) === Math.round(320 / 0.3)`. `Road.build(points).length / line.length` is between 0.25 and 0.35.
- [ ] **Step 2: Run them.** Run `node --test test/kart-tracks-3d.test.js`. Expected: the first test PASSES, which confirms the baseline; the second FAILS (`samplesFor` is not a function).
- [ ] **Step 3: Implement** `samplesFor` and `build` in `track.js` (add it to the `ArkKartTrack` exports), and replace the per-track uses of `SAMPLES` in `kart-race.js`.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass, with no existing kart test edited.
- [ ] **Step 5: Commit.** `Kart Race: a road's sample count follows its length`.

### Task 2: A track's size is its own

**Files:**
- Modify: `server/games/kart-race.js` (`buildTrack`, `coinSpots`, the `field` getter and the field-edge walls, `newRace` box rows, `lapCheck` shortcut threshold, `common()`)
- Test: `test/kart-tracks-3d.test.js`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `buildTrack(index, list = TRACKS)`. A track definition may set these optional fields:
    - `width` (default `TRACK_WIDTH`)
    - `out` (default `WALL.out`)
    - `field` (default `FIELD`)
    - `rows` (default `ITEMS.rows`, as fractions of the lap)
    - `boxOffsets` (default `ITEMS.offsets`)
    - `coins` (default `COINS.perLap`)

    The built track carries `width`, `out`, `field`, `rows`, `boxOffsets` and `cutJump`.
  - `cutJump`: `CUT_JUMP` (0.05) for a track whose `length <= 120`, else `3.5 / length` (the same 3.5 units as a 70-unit 2D lap).
  - `coinSpots(def, rows, perLap)`: the same rule as today, with the track's rows and coin count. With the defaults it gives today's spots exactly.
  - `get field()`: `this.track ? this.track.field : FIELD`. The field-edge walls use `this.field` and the view sends `field: this.field`.
  - `newRace` places box rows at `this.track.rows` × `this.track.boxOffsets` (the middle offset, 0, is the double box, as today). `lapCheck` uses `this.track.cutJump`.

- [ ] **Step 1: Write the failing tests** (with a test definition `BIG = { name: 'Test Loop', points: [[10,10],[118,10],[118,62],[10,62]], width: 7, field: { w: 128, h: 72 }, rows: [0.2, 0.45, 0.7, 0.95], boxOffsets: [-2.4, -1.2, 0, 1.2, 2.4], coins: 96, boosts: [] }`, built with `buildTrack(0, [BIG])`):
  - `'a big track keeps its own width, field, rows and coins'`:
    - `width === 7` and `field.w === 128`;
    - `rows` has length 4;
    - `coins.length` is between 80 and 96, and every coin spot lies on the road (`locate(...).d <= 3.5`);
    - `cutJump` is about `3.5 / track.length` (±1e-9).
  - `'2D tracks: same coins, rows and shortcut threshold as before'`: for every 2D track:
    - `coins` deep-equals `coinSpots(TRACKS[i])`, computed with the defaults;
    - `cutJump === CUT_JUMP`;
    - `rows` deep-equals `ITEMS.rows`.
  - `'a kart at the big field's edge is held by the big field'`: run a `KartRace` subclass whose `tracks` getter returns `[BIG]` (Task 3 adds the getter, so write this test in Task 3; see there).
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-tracks-3d.test.js`. Expected: FAIL (the width is 3.4; there is no `cutJump`).
- [ ] **Step 3: Implement** the per-track fields and their use in the engine.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race: each track has its own width, field, item rows and coins`.

### Task 3: Each game has its own track list and options

**Files:**
- Modify: `server/games/kart-race.js` (`get tracks()`, `get options()`, and every `TRACKS` / `OPTIONS` read inside the class)
- Test: `test/kart-tracks-3d.test.js`

**Interfaces:**
- Consumes: Task 2's `buildTrack(index, list)`.
- Produces:
  - `get tracks(): TrackDef[]`: `TRACKS` in the base class.
  - `get options()`: `OPTIONS` in the base class. A game with a different track count returns `{ ...OPTIONS, track: [0, …, tracks.length] }`.
  - The class reads `this.tracks` and `this.options` instead of `TRACKS` and `OPTIONS` in these places:
    - `loadSettings`
    - `applySetting`
    - `pickTrack`
    - `cupTracks`
    - `newRace` (`buildTrack(i, this.tracks)`)
    - the view (`options`, `trackNames`, `trackPoints`, `next.track`)
  - Arenas are numbered after this game's tracks (`index: this.tracks.length + i`).

- [ ] **Step 1: Write the failing tests** (a test class `class Big extends KartRace { get tracks() { return [BIG, { ...BIG, name: 'Test Loop 2' }]; } get options() { return { ...OPTIONS, track: [0, 1, 2] }; } }`)
  - `'a game races on its own track list'`: a `Big` race with `track: 1` gives `game.track.name === 'Test Loop'`, `view.trackNames` deep-equals `['Test Loop', 'Test Loop 2']`, and `view.field.w === 128`.
  - `'a saved track the game doesn't have falls back to Mixed'`: `fakeCtx()` with `ctx.saved = { settings: { track: 6 } }`; `new Big(ctx).settings.track === 0`.
  - `"a kart at the big field's edge is held by the big field"`: in a `Big` race, put kart 0 at `x = 120` heading +x at full speed; after 2 s of ticks, `x <= 128` and `x > 32`, so the old 32-unit edge didn't catch it.
  - `'Kart Race keeps its six tracks'`: `new KartRace(fakeCtx()).tracks === TRACKS` and the view's `trackNames` has length 6.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-tracks-3d.test.js`. Expected: FAIL (`tracks` is ignored).
- [ ] **Step 3: Implement** the two getters and switch the class's reads over.
- [ ] **Step 4: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race: each game has its own track list and setup options`.

### Task 4: The five big tracks, in Kart Race 3D

**Files:**
- Create: `server/games/kart-tracks-3d.js` (`export const TRACKS_3D`)
- Modify: `server/games/kart-race-3d.js` (`get tracks()`, `get options()`)
- Modify: `tools/games-catalog.mjs` (`EXTRA['kart-race-3d']` gains `server/games/kart-tracks-3d.js`)
- Test: `test/kart-tracks-3d.test.js`

**Interfaces:**
- Consumes: Tasks 2-3.
- Produces:
  - `TRACKS_3D`: five definitions in the order of the Global Constraints. Each has `width: 7`, `field: { w: 128, h: 72 }`, `boosts`, `rows` (? box rows about every 60 units of lap, as fractions), `boxOffsets: [-2.4, -1.2, 0, 1.2, 2.4]`, and `coins` (about one per 3.5 units of lap).
  - `KartRace3D` returns `TRACKS_3D` and the matching `options`.
- **Starting layouts:** today's points × 4 suit the new 128 × 72 field. Each then needs reworking so its bends still challenge a 7-wide road at speed, by adding bends to long straights and tightening wide sweeps toward the minimum radius. The tests below are the definition of done, so tune the points until they pass.
  - **Speedway Oval:** from Speedway × 4, with one chicane on a straight.
  - **Grand Prix Circuit:** from Grand Prix × 4.
  - **Serpent Pass:** from Serpent × 4, with more and tighter wiggles on the top run.
  - **Zigzag Ridge:** from Zigzag × 4.
  - **Sunset Canyon Rally:** laid out from the top-down concept (`asset-references/tracks/sunset-canyon/v0.1/whole-track-top-view-v1.png`, 1672 × 941 px, × 0.0766 to field units). The start is on the bottom straight, heading west. Then:
    - the Festival Paddock corner at the bottom left;
    - up the left side to the **Arch Sweep** at the top left;
    - the S-bends along the top past the dam;
    - down the right side through the **Mining Cut**;
    - back along the bottom straight.

    Starting points, in field units: `[[36,61.3],[17.6,59.8],[13.4,46],[15.3,30.6],[23,23.7],[33,23],[42.9,25.3],[53.6,24.5],[62.8,16.9],[72.8,10],[88,8.4],[101.9,10.7],[107.2,21.4],[103.4,32.2],[99.6,39.8],[107.2,44.4],[110.3,53.6],[107.2,60.5],[84.3,61.3],[61.3,61.3]]`.

    Its definition also sets `features: { arches: [p1, p2] }`, the lap fractions of the Arch Sweep and the Mining Cut, for PR 4's scenery.

- [ ] **Step 1: Write the failing tests**, one block that runs for each `TRACKS_3D` entry:
  - `'<name>: a clean loop on its field'`:
    - every centre-line point lies at least `width / 2 + out + 1` inside the field;
    - the loop never crosses itself (no two segments more than 20 samples apart intersect);
    - `Road.tightest(line).r >= Road.MIN_RADIUS`.
  - `'<name>: boxes, coins and boost pads on the road'`: every box spot, coin spot and boost spot is within `width / 2` of the centre (via `pointAt` then `locate`).
  - `'<name>: an 8-kart grid fits on the road at the start'`: for `n = 8`, every grid spot (PR 1's rule: two a row from 0.012 of the lap on, `GRID.rowGap` apart) is on the road, and no two are closer than 1.4.
  - `'<name>: a Normal driver laps in 40-60 s'`:
    - build a `KartRace3D` 1v1 race with `track` set to this one, rng `() => 0.5`, and `laps: 3`;
    - each tick, feed both karts `kartRaceBot(game.botView(slot), 'normal', () => 0.5)` inputs straight away, ignoring `botDelayMs`;
    - advance in 17 ms steps until kart 0's `bestLap` is set, or 120 s have passed;
    - `bestLap` must be between 40000 and 60000.
  - `'Kart Race 3D lists the five big tracks; Kart Race keeps its six'`: `new KartRace3D(fakeCtx()).hostView().trackNames` deep-equals the five names in order, and 2D's are unchanged.
  - `'a 4-race cup in 3D uses five different tracks'`: a 3D cup (`races: 4`) run through four races (using `winRace` from `kart-race.test.js`'s pattern) and a sudden death never repeats a track.
- [ ] **Step 2: Run and see them fail.** Run `node --test test/kart-tracks-3d.test.js`. Expected: FAIL (`kart-tracks-3d.js` is missing).
- [ ] **Step 3: Write `kart-tracks-3d.js`** (a short header comment, and one line per track on what it's like) and the `KartRace3D` getters. Then tune each track's points, rows and coins until every test passes. Keep the tuning in the points, never in the tests' limits.
- [ ] **Step 4: Run the tests and regenerate the catalog.** Run `npm test` and `node tools/games-catalog.mjs`. Expected: all pass.
- [ ] **Step 5: Commit.** `Kart Race 3D: five big tracks, Sunset Canyon Rally and four remade`.

### Task 5: The 3D view at the new size

**Files:**
- Modify: `public/games/kart-race-3d/things3d.js` (instance capacities)
- Modify: `public/games/kart-race-3d/kart3d.js` (`OVERVIEW` from the field)
- Modify: `public/games/kart-race-3d/ui.js` (map dot size from the field)
- Modify: `README.md` (the Kart Race 3D row), `CHANGELOG.md` (`## 0.1.37`)

**Interfaces:**
- Consumes: the view's `field`, `trackWidth`, `track.points`, `boxes` and `coins`, as today.
- Produces:
  - **things3d capacities:** boxes 80, doubles 30, coins 200, bananas 40, webs 10, oils 10, shots 20, blasts 10.
  - **Overview camera:** height `field.w * 0.19`, set back `field.h * 0.83`. That gives today's 24 / 15 on 32 × 18, so 2D-sized arenas look the same.
  - **Course map:** dot radius `field.w / 23`, label font `field.w / 16`. On 32 × 18 these come to 1.4 and 2, as today.

- [ ] **Step 1: Make the three client changes.**
- [ ] **Step 2: Run the tests.** Run `npm test`. Expected: all pass (`test/kart-race-3d-ui.test.js` covers the map).
- [ ] **Step 3: Check in the browser** (the dev server and the two scripted phones in the session scratchpad, `bots.mjs`), on each of the five tracks in a 1v1 race:
  - the road, walls and kerbs line up with where karts bump;
  - the course map fits;
  - every ? box row and coin run shows;
  - the overview camera between races shows the whole track;
  - the console is clean.

  Screenshot Sunset Canyon and one remade track. Also run a Battle, which should look exactly as before.
- [ ] **Step 4: Update the README and changelog.** In the README, the Kart Race 3D row now names its five big tracks, with "a lap takes about a minute", and says Battle keeps its arenas. In `CHANGELOG.md` under `## 0.1.37`, add a line such as `- 🏎️ Kart Race 3D races on five big new tracks, built for 3D: Sunset Canyon Rally, Speedway Oval, Grand Prix Circuit, Serpent Pass and Zigzag Ridge. Laps take about a minute.` Then run `node --test test/changelog.test.js`.
- [ ] **Step 5: Commit.** `Kart Race 3D: the view, map and stand-ins at the big tracks' size`.

### Task 6: Review and ship

- [ ] **Step 1: Confirm the existing tests are untouched.** Run `git diff --stat main -- test/kart-race.test.js test/kart-race-battle.test.js test/kart-race-field.test.js test/kart-racers.test.js`. Expected: no output.
- [ ] **Step 2: Review.** Get a fresh whole-branch review and the `two-player-sync-reviewer`, and fix the confirmed Critical and Important findings test-first.
- [ ] **Step 3: Push, PR and merge.** Push `kart-3d-big-tracks`, open a ready PR `Kart Race 3D: five big tracks (8-kart Cup, part 2)`, wait for CI to pass, merge, and pull `main`.
