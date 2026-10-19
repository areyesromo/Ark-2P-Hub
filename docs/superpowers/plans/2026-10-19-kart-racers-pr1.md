# Kart Race PR 1: Racers and Tyres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each player picks one of 12 racers and one of 5 tyres before a race. The combined
stats change how their kart drives and how it looks on the TV.

**Architecture:**
- A shared plain-script module `public/games/kart-race/racers.js` holds the roster, the tyres and
  the stats→physics mapping. It sets `globalThis.ArkKartRacers`, in the same pattern as
  `track.js`.
- The server keeps `picks` per slot and gives each kart a `car` (its physics numbers) at race
  start.
- The phone and TV load the module to draw cards, stat bars and kart shapes.

**Tech Stack:** Node (ES modules, `node:test`), browser JS (ES5-style IIFEs, no build step),
canvas 2D, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-10-19-kart-racers-design.md` (Part 1 only).

## Global Constraints

- Emoji up to Emoji 12 only. Roster emoji: 🔥 ⚡ 🌀 🪨 ⚖️ 🦊; tyres: ⚫ 🏁 🔩 🔘 🚜.
- No emoji drawn on the canvas (kiosk browsers may lack a colour emoji font); emoji in HTML only.
- All-3s stats with Standard tyres must give exactly today's `KART` values (8.5 / 9 / 2.8 / 1.2 /
  3.2, boost 12.5).
- Every racer type's stats total 12. Combined stats (racer + tyre) range 0–6.
- Browser files follow the existing style: `(function () { ... })()`, `var`-free `const`/`let`,
  `function` expressions, comments in plain English.
- No model names in commits or PRs. Commit trailer lines as in the session instructions.

## Review Focus

1. **A pick arrives mid-race or from the wrong phase.** It must be ignored (only `setup` and
   `over` accept picks). Test in Task 2.
2. **A stale or unknown id comes from a phone's localStorage** (e.g. a racer renamed later). The
   server ignores it, and the phone falls back to the default instead of showing nothing. Tests in
   Task 1 (`racer('nope')` gives the default) and Task 2 (input ignored).
3. **Both players pick the same racer.** This is allowed: karts stay told apart by P1/P2 colour.
   Test in Task 2.
4. **A controller on the new Racer/Tyres rows presses ←→ before `racers.js` has loaded.** No
   crash, no input sent. Guarded in Task 4.
5. **A rematch or "best of 3" next race.** Picks persist and each new race rebuilds `k.car` from
   them. Test in Task 2.

---

### Task 1: Shared roster module

**Files:**
- Create: `public/games/kart-race/racers.js`
- Create: `test/kart-racers.test.js`

**Interfaces:**
- Produces, on `globalThis.ArkKartRacers`:
  - `RACERS`: array of 12 `{ id, name, type, gender: 'm'|'f', emoji, stats: { speed, accel, handling, weight }, shape, stripe }`
    - types: `speed`, `accel`, `handling`, `heavy`, `allround`, `tricky`
    - shapes: `long`, `stubby`, `wings`, `boxy`, `classic`, `pointed`
  - `TYPES`: `{ [type]: { label, emoji } }`
    - labels: "Speed", "Acceleration", "Handling", "Heavy", "All-round", "Tricky"
  - `TYRES`: array of 5 `{ id, name, emoji, mod: { speed?, accel?, handling?, weight? }, grassHalf?: true, wheel: { len, wide } }`
  - `DEFAULT_RACERS = ['dash', 'daisy']`, `DEFAULT_TYRE = 'standard'`
  - `racer(id)`: the racer, or Dash for an unknown id
  - `tyre(id)`: the tyre, or Standard for an unknown id
  - `stats(racerId, tyreId)`: `{ speed, accel, handling, weight }` (racer + tyre mod)
  - `physics(racerId, tyreId)`: `{ maxSpeed, boostSpeed, accel, turnRate, grip, weight, grassSpeed }`

**Roster** (copy exactly from the spec):

| type | m | f | Spd | Acc | Hnd | Wgt | shape | stripe |
|---|---|---|---|---|---|---|---|---|
| speed | rex Rex | roxy Roxy | 5 | 2 | 2 | 3 | long | `#ef4444` |
| accel | zip Zip | zara Zara | 2 | 5 | 3 | 2 | stubby | `#facc15` |
| handling | swift Swift | sky Sky | 3 | 3 | 5 | 1 | wings | `#38bdf8` |
| heavy | boulder Boulder | bella Bella | 4 | 1 | 2 | 5 | boxy | `#a8a29e` |
| allround | dash Dash | daisy Daisy | 3 | 3 | 3 | 3 | classic | `#4ade80` |
| tricky | rascal Rascal | ruby Ruby | 2 | 4 | 5 | 1 | pointed | `#fb923c` |

**Tyres:**
- `standard` ⚫: no mod; wheel `{ len: 0.24, wide: 0.14 }`
- `slicks` 🏁: speed +1, handling −1; wheel `{ 0.26, 0.09 }`
- `grippy` 🔩: handling +1, speed −1; wheel `{ 0.26, 0.19 }`
- `rollers` 🔘: accel +1, speed −1; wheel `{ 0.17, 0.12 }`
- `monster` 🚜: weight +1, accel −1, `grassHalf: true`; wheel `{ 0.34, 0.22 }`

**Physics** (linear per step from 3; s, a, h, w are combined stats):
- `maxSpeed = 8.5 + (s-3)*0.45`
- `boostSpeed = maxSpeed + 4`
- `accel = 9 + (a-3)*1.25`
- `turnRate = 2.8 + (h-3)*0.15`
- `grip = 1.2 - (h-3)*0.1`
- `weight = 1 + (w-3)*0.25`
- `grassSpeed = 3.2 + (w-3)*0.15`; with `grassHalf`, `grassSpeed = maxSpeed - (maxSpeed - grassSpeed)/2`

- [ ] **Step 1: Write the failing tests** in `test/kart-racers.test.js`. Import
  `'../public/games/kart-race/racers.js'` for its side effect; use `const R = globalThis.ArkKartRacers`.
  - `roster: 12 racers, unique ids, every type has an m and an f with equal stats totalling 12`
  - `tyres: five, standard first; unknown ids fall back to the defaults`:
    - `R.racer('nope').id === 'dash'`
    - `R.tyre('nope').id === 'standard'`
  - `physics: all-3s on Standard is today's kart`: `deepEqual(R.physics('dash','standard'), { maxSpeed: 8.5, boostSpeed: 12.5, accel: 9, turnRate: 2.8, grip: 1.2, weight: 1, grassSpeed: 3.2 })`
    (compare each key with a tolerance of 1e-9).
  - `stats: tyres shift stats`:
    - `R.stats('rex','slicks')` deepEquals `{ speed: 6, accel: 2, handling: 1, weight: 3 }`
    - `R.physics('rex','slicks').maxSpeed > R.physics('rex','standard').maxSpeed`
  - `monster tyres halve the grass slowdown`: with `p = R.physics('dash','monster')`,
    `p.maxSpeed - p.grassSpeed` is about `(8.5 - 3.35) / 2`.
- [ ] **Step 2: Run** `node --test test/kart-racers.test.js`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `racers.js` as specified above. Header comment: what it is, and that
  the server, the screens and a future 3D module share it.
- [ ] **Step 4: Run** `node --test test/kart-racers.test.js`. Expected: all pass.
- [ ] **Step 5: Commit** `Kart Race: shared racer and tyre roster`.

### Task 2: Server: picks, per-kart physics, view

**Files:**
- Modify: `server/games/kart-race.js`. Touch points:
  - imports (top);
  - `start()`/`begin()` (~149-175): picks kept on the game, not reset;
  - `newRace()` (~176): adds `k.racer`, `k.tyre`, `k.car`;
  - `drive()` (~275-310);
  - `bump()` (~447);
  - `onInput()` (~533);
  - `common()` (~559).
- Test: `test/kart-race.test.js`

**Interfaces:**
- Consumes: `ArkKartRacers.physics`, `racer`, `tyre`, `DEFAULT_RACERS`, `DEFAULT_TYRE` (Task 1).
- Produces:
  - `game.picks: [{ racer, tyre }, { racer, tyre }]`;
  - each kart gets `racer`, `tyre` and `car` (the `physics()` result);
  - inputs `{ type: 'racer', id }` and `{ type: 'tyre', id }`;
  - view: `common().picks` (the same shape), and each kart in the view gains `racer` and `tyre`.

**Design notes:**
- `picks` is created once in the constructor, so it survives `start()` (back to setup), `begin()`
  (a rematch) and `newRace()`.
- `drive()` reads `k.car.maxSpeed`, `k.car.boostSpeed`, `k.car.accel`, `k.car.turnRate`,
  `k.car.grip` and `k.car.grassSpeed` in place of the `KART` fields.
- The mini-boost `KART.maxSpeed + 1.5` becomes `k.car.maxSpeed + 1.5`.
- Turbo and boost pads set `Math.max(k.speed, k.car.boostSpeed)`.
- `bump()` splits `(min - d)` so that `a` moves `b.car.weight/(wa+wb)` of it and `b` moves
  `a.car.weight/(wa+wb)`.
- View constants `maxSpeed`/`boostSpeed` stay (base values). The TV gauge scales to
  `boostSpeed + 2` (Task 4), so even Speed 6 plus boost fits on the dial.

- [ ] **Step 1: Write the failing tests** (in `test/kart-race.test.js`):
  - `racer and tyre picks: own slot, setup/over only, bad ids ignored, kept across rematch`:
    - Fresh game: `game.picks` deepEquals `[{racer:'dash',tyre:'standard'},{racer:'daisy',tyre:'standard'}]`.
    - In setup, slot 1 sends racer `rex`, then tyre `slicks`, then racer `nope`: the picks become
      `picks[1] = {racer:'rex', tyre:'slicks'}` and `picks[0]` is unchanged.
    - Slot 0 picks `rex` too; both are `rex`.
    - Go, then race: `game.karts[1].car.maxSpeed` is about 9.85 (Rex on Slicks: speed 6).
    - A racer input mid-race changes nothing.
    - Play to `over` (set the result directly or use an existing helper), send rematch: picks
      unchanged, and `karts[1].car` is rebuilt.
  - `racers drive differently` (use the `racing()` helper with picks set before `go`; put each
    kart on the road with `onRoad()` per measurement):
    - Rex: hold gas for 3 s on a straight; top speed is about 9.4 within 0.05.
    - Zip: gas from 0 for 0.5 s gives a higher speed than Rex does in 0.5 s.
    - Swift and Boulder: speed 4, full lock for 0.3 s; Swift's angle change is greater.
  - `heavier karts win bumps`:
    - Bella (slot 0) and Ruby (slot 1) overlap on the road 0.3 apart (as in the existing bump test).
    - After one tick, Ruby moved further than Bella. Measure each kart's displacement from its
      start.

- [ ] **Step 2: Run** `node --test test/kart-race.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the touch points listed above.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. If the existing grass test's speed
  assertion uses `KART.grassSpeed`, it still holds, because the default racers are all-3s.
- [ ] **Step 5: Commit** `Kart Race: racer and tyre picks drive the kart`.

### Task 3: Phone: racer grid, tyres and stat bars

**Files:**
- Modify: `public/games/kart-race/player.js`
- Modify: `public/games/kart-race/style.css`

**Interfaces:**
- Consumes:
  - `ArkKartRacers` (load with `Ark.loadScript('/games/kart-race/racers.js')`, then render once loaded);
  - `view.picks`, `view.you`, `view.phase`;
  - sends `{ type: 'racer', id }` and `{ type: 'tyre', id }`.
- Produces: nothing used by other tasks.

**Design notes:**
- **Layout:** a `.kr-picks` box between the settings and the controller prefs, shown in
  `setup` and `over` only:
  - title "Your racer";
  - a grid of 12 `button.kr-racer[data-racer]` (emoji over name, m/f pairs adjacent, 4 columns
    on a portrait phone);
  - title "Tyres";
  - a row of 5 `button.kr-tyre[data-tyre]` (emoji + name);
  - `.kr-stats`: four rows "Speed / Acceleration / Handling / Weight", each a bar of 6 cells.
- **Stat bars:**
  - Cells up to the racer's own stat are filled in the player colour.
  - A tyre's +1 adds a green cell; a tyre's −1 turns the last racer cell red (outlined, unfilled).
- **Remembering picks:**
  - Store the picks in localStorage keys `ark.kart.racer` and `ark.kart.tyre` (try/catch, like
    the existing `store`).
  - On the first setup view after mounting, if the stored ids differ from `view.picks[you]` and
    `ArkKartRacers.racer(id).id === id`, send them once.
- **Re-rendering:** add `v.picks` to the render key (`textKey`), so a pick from the controller or
  the server re-renders.

- [ ] **Step 1: Implement** the markup, the click delegation on `.kr-picks` and the stat bars.
- [ ] **Step 2: Syntax check.** Run `node --check public/games/kart-race/player.js`. Expected: no
  output.
- [ ] **Step 3: Commit** `Kart Race: pick your racer and tyres on the phone`.
  (This is browser-verified in Task 5.)

### Task 4: TV: picks panel, HUD, controller rows, kart shapes

**Files:**
- Modify: `public/games/kart-race/host.js`
- Modify: `public/games/kart-race/style.css`

**Interfaces:**
- Consumes: `ArkKartRacers`, `view.picks`, `view.karts[i].racer`, `view.karts[i].tyre`.
- Sends: `{ type: 'racer', id }` and `{ type: 'tyre', id }` from controllers.
- Produces: nothing used by other tasks.

**Design notes:**
- **Loading:** load `racers.js` next to `track.js`. Until it has loaded, the picks panel and kart
  shapes fall back: draw the classic body and standard wheels, and show no panel.
- **Setup panel** (`.kr-picks-tv`), beside the track preview: for each player, their name in
  their colour, the racer's emoji, name and type label, the tyre's emoji and name, and four stat
  bars (the same rules as the phone).
- **Controller rows:**
  - `PAD_ROWS = ROWS.concat([{ key: 'racer' }, { key: 'tyre' }])`, used for ↑↓ navigation.
  - In `pad()` during setup, when `pads[slot].row` is 4 or 5:
    - ←→ cycles that player's racer through `RACERS` order, or their tyre through `TYRES`
      order, wrapping round, and sends the input;
    - ↑↓, A and START are handled as today, by calling `Ark.setup.pad` with `PAD_ROWS`.
  - On rows 0–3, call `Ark.setup.pad(btn, v, PAD_ROWS, pads[slot])`. LEFT/RIGHT only reach it on
    rows 0–3, so `setupChoices` never sees 'racer' or 'tyre'.
  - When the focus is on row 4 or 5, outline that player's block in the picks panel
    (`.focus.p1`/`.p2`) instead of a settings row. `Ark.setup.focus` uses `rows[row].key`, so
    only pass `ROWS` focus for rows below 4.
  - If `ArkKartRacers` hasn't loaded, ←→ on rows 4/5 returns null.
- **Race HUD:** under each name, the racer's emoji, name and tyre emoji.
- **Gauge scale:** use `v.boostSpeed + 2` so Speed 6 plus boost isn't pinned.
- **Kart drawing** (`drawKart`):
  - The body path depends on the racer's `shape`, in the same coordinate frame as today
    (nose at +x):
    - `classic` is today's path;
    - `long`: nose at 0.75, body 0.26 wide;
    - `stubby`: nose at 0.42, body 0.32 wide;
    - `wings`: add side wings to y ±0.42 at x −0.1…0.2;
    - `boxy`: a rectangle from −0.5 to 0.45, ±0.33;
    - `pointed`: a triangle-ish nose at 0.6 with a body ±0.22.
  - Then a stripe along the centre line in the racer's `stripe` colour (width 0.1, from −0.45 to
    the nose minus 0.1).
  - Wheel rectangles use the tyre's `wheel.len` × `wheel.wide`.
  - Keep the player-colour fill, the white outline and the helmet.

- [ ] **Step 1: Implement** the above.
- [ ] **Step 2: Syntax check.** Run `node --check public/games/kart-race/host.js`. Expected: no
  output.
- [ ] **Step 3: Commit** `Kart Race: racer picks on the TV, controller rows and kart shapes`.

### Task 5: Docs, browser e2e, review, PR

**Files:**
- Modify: `README.md`: the Kart Race game row, controller row and settings row mention racers
  and tyres.
- Modify: `server/games/kart-race.js`: the tagline (mention 12 racers and tyres).
- Regenerate: `docs/GAMES.md` with `node tools/games-catalog.mjs`.
- Scratchpad e2e: copy `kart4-e2e.cjs` to `kart5-e2e.cjs`.

- [ ] **Step 1: Update** the README rows and the tagline; run `node tools/games-catalog.mjs`;
  run `npm test`. Expected: all pass.
- [ ] **Step 2: Browser e2e** (`kart5-e2e.cjs`):
  - The phone taps the `roxy` card and the `grippy` tyre.
  - The controller goes ↓ ×4 to the Racer row, then → twice: from `daisy` the racer becomes
    `rascal`, then `ruby` (RACERS order: rex, roxy, zip, zara, swift, sky, boulder, bella, dash,
    daisy, rascal, ruby).
  - Assert both picks in the TV's `window.__view.picks`, and that the TV panel shows "Roxy" and
    the picked racer.
  - Screenshot the TV setup and the phone setup.
  - Race a lap with the controller autopilot.
  - Expected: `errors: []`, and the screenshots show the kart shapes and stripes.
- [ ] **Step 3: Review.** A fresh reviewer subagent (opus) reviews the branch diff. Fix the
  Important findings; run `npm test` and the e2e again.
- [ ] **Step 4: Ship.** Commit, push, open the PR, subscribe, then a 50-minute `send_later`. On
  green `test` and `image`, merge with `merge_method: "merge"` and the head SHA. Then delete the
  check-in, unsubscribe and sync the branch. Tell the owner to run `.\update.ps1`.
