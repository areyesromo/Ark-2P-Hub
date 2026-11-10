# Kart Race 3D: look back and glance sideways Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Kart Race 3D, a player can hold Look back for a rear view and glance up to 90° left or right, from a phone or a controller. Each player's camera half swings round their kart and eases back when they let go.

**Architecture:**
- **Input:** the existing `drive` message gains `look` (−1..1) and `back` (true or false), sent by the 3D phone and by the controller's right stick.
- **Server:** checks them, keeps them on the kart, and puts them in the view.
- **TV:** each half's chase camera turns by `back ? π : look × π/2`, eased the short way round in about 150 ms.

**Tech Stack:** plain browser IIFEs, Node server ES modules, node:test with vm.

**Spec:** `docs/superpowers/specs/2026-11-09-kart-race-3d-look-around-design.md`

## Global Constraints

- **Only the 3D game:** the 2D Kart Race's phone, TV, pad hint and `drive` messages are unchanged. The 2D phone sends no `look` or `back`.
- **Camera only:** steering, items and the race don't change.
- **Server checks:** `look` must be a finite number, clamped to −1..1, otherwise 0. `back` becomes a Boolean. Both reset when a race starts. Computer racers always show `look: 0` and `back: false`.
- **View rounding:** `look` goes in the view to one decimal.
- **Controller:**
  - the right stick is axes 2 and 3;
  - the stick clicks are the buttons `LS` (10) and `RS` (11);
  - `back` is the right stick pulled down past 0.6, or `RS` held;
  - `look` is the right stick's x, past the existing `DEADZONE`, rounded to one decimal.
- **Camera:** the yaw goal is `back ? Math.PI : look * Math.PI / 2`. The swing takes about 150 ms, the shorter way round.
- **Commits:** messages look like `Kart Race 3D: …`.

## Review Focus

1. **A player who stops touching the phone mid-glance:** lifting the finger (or `pointercancel`, or lost capture) must send `look: 0`. *Task 4:* a cancelled strip touch sends 0.
2. **A controller whose right stick rests slightly off centre:** the dead zone keeps the camera still. *Task 3:* `stick2` at x 0.1 gives `look: 0`.
3. **Looking back while a race ends:** the next race starts looking forward. *Task 1:* the reset test.
4. **The swing at exactly ±π:** going from 0.9π to −0.9π must take the short way (0.2π), not spin 1.8π. *Task 2:* the wrap test.
5. **Only your own half turns:** P1 looking back leaves P2's camera alone. *Task 5:* the per-half test.

---

### Task 1: The server keeps `look` and `back`

**Files:**
- Modify: `server/games/kart-race.js`:
  - the kart fields at line 470 (add `look: 0, lookBack: false`);
  - `onDrive` at line 1167;
  - the kart view at line 1250 (add `look: Math.round(k.look * 10) / 10, back: k.lookBack`).
- Test: `test/kart-race-3d-look.test.js` (new)

**Interfaces:**
- **Produces:** `view.karts[i].look` (a number from −1 to 1, one decimal) and `view.karts[i].back` (a Boolean).

- [ ] **Step 1: Write the failing tests.** Start a 3D race with `KartRace3D` and `fakeCtx`, as `racingOn` does in `test/kart-tracks-3d.test.js`.
  - `look and back reach the view`: `onInput(0, { type: 'drive', steer: 0, gas: true, look: 0.46, back: true })`, then `hostView().karts[0]` has `look === 0.5` and `back === true`.
  - `bad look values are clamped or dropped`:
    - `look: 5` gives 1;
    - `look: -3` gives −1;
    - `look: 'x'` gives 0;
    - `look: NaN` gives 0;
    - `back: 'yes'` gives `true` (Boolean).
  - `look resets when the next race starts`: send `back: true, look: 1`, then call `game.newRace()` (the engine's own start of a race, `kart-race.js:402`). Then `hostView().karts[0].back === false` and `look === 0`.
  - `computer racers never look`: in an 8-kart Cup (`field: 1`), `karts[2].look === 0` and `karts[2].back === false`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-look.test.js`. Expected: FAIL (`look` is undefined).
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-look.test.js test/kart-race.test.js test/kart-race-3d.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: the server keeps where each player is looking"`

### Task 2: The camera maths (`geom3d.js`)

**Files:**
- Modify: `public/games/kart-race-3d/geom3d.js` (`chase` at line 114, plus new functions)
- Test: `test/kart-race-3d-geom.test.js`

**Interfaces:**
- **Produces:**
  - `ArkKartGeom.chase(pose, cam, yaw)`. `yaw` is optional and defaults to 0. It uses the direction `pose.angle + yaw` for both `eye` (`back` behind) and `look` (`ahead` along).
  - `ArkKartGeom.lookYaw(k) -> number`: `k && k.back ? Math.PI : (k && k.look || 0) * Math.PI / 2`.
  - `ArkKartGeom.swing(cur, goal, dtMs) -> number`: eases from `cur` towards `goal` the shorter way round. Each frame it moves `1 - Math.exp(-dtMs / 50)` of the wrapped difference (about 95% in 150 ms). When it's within 0.001 it returns `goal` exactly. The result is not wrapped.

- [ ] **Step 1: Write the failing tests:**
  - `chase with no yaw is the same camera`: `chase(p, CAM)` deep-equals `chase(p, CAM, 0)`.
  - `looking back puts the eye ahead of the kart, looking back at it`: for `p = { x: 10, y: 10, angle: 0 }`, `chase(p, CAM, Math.PI)` has `eye[0] > 10` and `look[0] < 10`.
  - `a glance to the right puts the eye on the kart's left`: with `yaw = Math.PI / 2` (a positive angle is to the right, field +y), `eye[1] < 10` and `look[1] > 10`.
  - `lookYaw`:
    - `{ back: true, look: 1 }` gives π;
    - `{ look: -1 }` gives −π/2;
    - `null` gives 0.
  - `swing takes the short way round`: `swing(0.9 * Math.PI, -0.9 * Math.PI, 16)` is greater than `0.9 * Math.PI`, going forward across π.
  - `swing settles at the goal`: 20 steps of 16 ms from 0 to `Math.PI` end within 0.001 of π.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-geom.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** `chase(pose, cam, yaw)`, `lookYaw` and `swing`, and export them on `ArkKartGeom`.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-geom.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: camera maths for looking back and glancing"`

### Task 3: The controller's right stick

**Files:**
- Modify: `public/host/gamepads.js`:
  - `BUTTONS` adds `10: 'LS'` and `11: 'RS'`;
  - a `sticks2` map from axes 2 and 3;
  - `ArkPads.stick2(index)`.
- Modify: `public/host/host.js` at line 731 (pass `stick2: ArkPads.stick2(Number(idx))` into `padPoll`'s pad object).
- Modify: `public/games/kart-race/host.js`:
  - `padPoll(pad, v)` gains a third flag through `make(opts)`: when `opts.look`, the input also carries `look` and `back`;
  - `padHint` for `opts.look` appends ` · R-stick: look (pull down or click: look back)`.
- Modify: `public/games/kart-race-3d/host.js` at line 86 (pass `look: true` to `ArkKartTV.make`).
- Test: `test/kart-race-3d-look.test.js`

**Interfaces:**
- **Produces:**
  - `ArkPads.stick2(index) -> { x, y }`, from −1 to 1 with down as +y, and `{ x: 0, y: 0 }` for an unknown pad.
  - The pad object passed to `padPoll` gains `stick2`.

- [ ] **Step 1: Write the failing tests:**
  - `the pad reader reports the right stick and its click`:
    - load `public/host/gamepads.js` in a vm with `navigator.getGamepads` returning one pad (`index 0`, `connected`, `axes [0, 0, 0.7, 0.8]`, buttons with `[11].pressed = true`) and a `requestAnimationFrame` that runs the callback once;
    - then `ArkPads.stick2(0)` deep-equals `{ x: 0.7, y: 0.8 }`;
    - `ArkPads.held(0)` includes `'RS'`.
  - `the 3D pad maps the right stick to look and back`:
    - with `ArkKartTV.make({ look: true }).padPoll({ held: [], stick: { x: 0, y: 0 }, stick2: { x: 0.5, y: 0 } }, { phase: 'race' })`, `look` is 0.5 and `back` is false;
    - `stick2 { x: 0, y: 0.7 }` gives `back: true`;
    - `held ['RS']` gives `back: true`;
    - `stick2 { x: 0.1, y: 0 }` gives `look: 0`.
  - `the 2D pad sends no look`: `ArkKartTV.make({}).padPoll(...)` has neither key.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-look.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-look.test.js test/kart-race-3d-client.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: look round with a controller's right stick"`

### Task 4: The phone's Look back button and look strip

**Files:**
- Modify: `public/games/kart-race/player.js`:
  - the markup at line 549: in 3D, a `.kr-look` row before `.kr-bottom` with `<div class="kr-lookstrip">◀ look ▶</div><button class="kr-btn lookback">👀 LOOK BACK</button>`;
  - `held.back`, the hold button for `.lookback`, and a `lookX` set by the strip;
  - `send()`: in 3D only, add `look` and `back` to the message and to the change key.
- Modify: `public/games/kart-race-3d/style.css` (where the `kr3d-phone` rules live): `.kr3d-phone .kr-look` is a row with the strip taking the remaining width, a minimum height of 44px, and the house tokens (`--panel`, `--line`, `--r-md`).
- Test: `test/kart-race-3d-phone.test.js`

**Interfaces:**
- **Consumes:** the `drive` fields from Task 1.
- **The strip:** a pointer on `.kr-lookstrip` sets `look = clamp((x - left) / width * 2 - 1)`, rounded to one decimal. It uses the existing `local()` helper, so the rotated landscape layout works. `pointerup`, `pointercancel` and `lostpointercapture` set `look` back to 0.

- [ ] **Step 1: Write the failing tests**, in the file's harness:
  - `the 3D phone's Look back button sends back while held`: `.lookback` `pointerdown` makes the last sent `back` true, and `pointerup` makes it false.
  - `the look strip sends where the finger is, and 0 when it lifts`:
    - stub `strip.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40 })`;
    - `pointerdown` at `clientX: 150, clientY: 20` sends `look: 0.5`;
    - `pointermove` to `clientX: 0` sends `look: -1`;
    - `pointercancel` sends `look: 0`.
  - `the 2D phone sends no look`: a `factory.make({})` phone's drive messages have no `look` or `back` keys, and it has no `.kr-look` row in its markup (`root.innerHTML` doesn't match `/kr-look/`).
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-phone.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-phone.test.js test/kart-race.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Look back and a look strip on the phone"`

### Task 5: The TV camera turns, and the HUD says so

**Files:**
- Modify: `public/games/kart-race-3d/kart3d.js`:
  - `aim(poses, dt)` keeps a `yaw = [0, 0]` per half;
  - each frame, `yaw[i] = G.swing(yaw[i], G.lookYaw(view.karts[i]), dt)`, and it uses `G.chase(pose, cam, yaw[i])`;
  - a new race (where `follow` resets) also resets `yaw`.
- Modify: `public/games/kart-race-3d/ui.js` (`alertFor`: after the shortcut line, `if (k.back) return '👀 Looking back';`).
- Test: `test/kart-race-3d-scene.test.js`, `test/kart-race-3d-ui.test.js`

**Interfaces:**
- **Consumes:** `G.chase(pose, cam, yaw)`, `G.lookYaw(k)` and `G.swing(cur, goal, dtMs)` from Task 2, and `view.karts[i].back` and `look` from Task 1.

- [ ] **Step 1: Write the failing tests:**
  - **Scene harness:** in `test/kart-race-3d-scene.test.js`, have the fake `scene3d` keep `opts.draw`, and add `cameras()`. It calls `draw({ setScissorTest() {}, setViewport() {}, setScissor() {}, render: (s, cam) => out.push(cam) }, scene, 1600, 900)` and returns the two cameras.
  - `looking back turns only that half's camera round`:
    - a race view with kart 0 at (20, 20) angle 0 with `back: true`, and kart 1 at (20, 30) angle 0 with `back: false`;
    - after `update`, call `frame()` 30 times with `performance.now` advancing 16 ms each time;
    - camera 0's `position.x > 20`, so it's ahead of kart 0;
    - camera 1's `position.x < 20`, so it's still behind kart 1.
  - **UI**, in `test/kart-race-3d-ui.test.js:52`'s style: `the HUD says when you're looking back`. A race view with `karts[0].back = true` sets the first driver node's `.kr3d-alert` text to `'👀 Looking back'`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-scene.test.js test/kart-race-3d-ui.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run the same command. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: each half's camera turns when its player looks"`

### Task 6: Docs, full suite and a live check

**Files:**
- Modify: `README.md` (the Kart Race 3D row: after "Phone controls label items…", add "Hold **Look back** (phone button, or pull the controller's right stick down) to see who's behind you, or glance left and right with the phone's look strip or the right stick.")
- Modify: `CHANGELOG.md` (under `## 0.1.38`): `- 👀 Kart Race 3D: look behind you and glance left or right while you drive: hold Look back on the phone, or use a controller's right stick.`
- Modify: `docs/GAMES.md` (run `node tools/games-catalog.mjs`)

- [ ] **Step 1: Update the README and the What's new line, regenerate the catalog, and run `npm test`.** Expected: everything passes.
- [ ] **Step 2: Live check.**
  - Run `preview_start ark-dev` with a 1280 × 720 viewport.
  - Race with the scratchpad bots; add a `LOOK` env var to `bots.mjs` that sends `back: true` for P1 between seconds 8 and 12 and `look: 1` between 14 and 16.
  - Take screenshots while P1 looks back (P1's half shows the road behind and P2's view is unchanged) and while P1 glances.
  - Check `read_console_messages` for errors after a reload. Expected: none new.
- [ ] **Step 3: Commit.** `git commit -m "Kart Race 3D: README and What's new for looking around"`
