# Kart Race 3D: Rex's skeleton and smooth driving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rex becomes one skinned mesh with a 22-bone skeleton. His hands stay on a turning steering wheel, his body, head and tail move with the drive, and reactions (spin, win, sad, throw, drop, use, point) blend in and out. All of the motion is computed in game code.

**Architecture:**
- **The build:** the Blender build (`tools/kart-models/`) makes Rex skinned (joints from `rex.json`, automatic weights) and cuts the kart's steering wheel out as `steer`, with grip markers.
- **The server:** puts each kart's last item use in the view as `used`.
- **The motion:** `body3d.js`, pure maths with no Three.js, computes a pose each frame:
  - joint targets for the arm IK;
  - turns about axes in the model's frame for the body, head, tail and reactions;
  - springs for smoothing.
- **Applying it:** `karts3d.js` applies the pose to the bones of a `SkeletonUtils.clone` of the model.

**Tech Stack:** Blender 5.2 bpy, Three.js 0.184 (`SkinnedMesh`, `SkeletonUtils`), plain browser IIFEs, node:test.

**Spec:** `docs/superpowers/specs/2026-11-09-kart-race-3d-rex-skeleton-design.md`

## Global Constraints

- **Bone names (22):**
  - `hips`, `spine`, `chest`, `neck`, `head`;
  - `shoulder_l`, `upper_arm_l`, `forearm_l`, `hand_l`, and the same with `_r`;
  - `thigh_l`, `shin_l`, `foot_l`, and the same with `_r`;
  - `tail_1`, `tail_2`, `tail_3`.

  `hips` is the root, at Rex's origin (the seat point).
- **Kart parts:** `steer` (its origin on the column, local +Y along the column axis), with `grip_l` and `grip_r` as children of `steer` on the rim at 10 and 2 o'clock.
- **Budgets:** Rex ≤ 8,000 triangles, the kart ≤ 10,000, one 1024 texture each (the R-003 textures, with the wheel area as now).
- **Skin weights:** at most 4 bones per vertex, normalised. No animations exported.
- **Server:** `used` is the item kind for `USED_MS = 600` after a use, otherwise `null`. A Gold Turbo press counts as `'goldturbo'`.
- **The steering wheel:** it turns `2.5 ×` the front wheels' angle, clamped to ±60° (±1.0472 rad).
- **Body motion:**
  - lean up to +10° (0.1745 rad) more than the kart's lean;
  - boost pitch back up to 8° (0.1396 rad);
  - braking pitch forward up to 6° (0.1047 rad);
  - head into the bend up to 30°;
  - idle head drift ±3° at 0.1–0.3 Hz;
  - breathing ±1.5° at 0.25 Hz.
- **Reactions:** blend in over 0.2 s and out over 0.25 s. Their poses, lengths and priority (spin > win/sad > item) are as in the spec's table.
- **Springs:** critically damped, settling in about 0.12 s (the tail 0.25 s), stepped by the frame's time step.
- **Commits:** messages look like `Kart Race 3D: …`.

## Review Focus

1. **An item used during a spin-out:** the spin pose wins, and the item reaction doesn't snap in afterwards if the spin outlasts it. *Task 2:* the priority test, with a `used` that expires during the spin.
2. **A very low frame rate** (a dropped frame of 200 ms): the springs mustn't overshoot or explode. *Task 2:* a spring stepped with dt 200 stays between its start and goal.
3. **A grip the arm can't reach** (the wheel turned to ±60° on a short arm): the arm points at it without NaNs. *Task 2:* the unreachable IK test checks every number is finite.
4. **Two Rexes on the track** (a player and a computer racer): each has its own bones, so one's spin doesn't move the other. *Task 4:* two karts' hand bones differ after one spins.
5. **A model that hasn't loaded, or fails:** the placeholder still shows and moves as today. *Task 4:* the existing placeholder tests keep passing.

---

### Task 1: The server says what each kart just used

**Files:**
- Modify: `server/games/kart-items.js`, `useItem` (line 126): after `game.events.used++` (both places), set `k.usedKind` (the kind, or `'goldturbo'` for a Gold Turbo press) and `k.usedAt = now`.
- Modify: `server/games/kart-race.js`:
  - the kart fields (line 470): `usedKind: null, usedAt: -Infinity`;
  - the kart view: `used: now - k.usedAt < USED_MS ? k.usedKind : null`;
  - export `const USED_MS = 600`.
- Test: `test/kart-race-3d-look.test.js` (append: it already has a 3D race helper)

- [ ] **Step 1: Write the failing tests:**
  - `a kart says what it just used, for a moment`: give kart 0 `items = ['banana']`, then `onInput(0, { type: 'item' })`. `hostView().karts[0].used === 'banana'`. After `ctx.advance(USED_MS + 20)`, `used === null`.
  - `a Gold Turbo press counts as goldturbo`: set `k.goldUntil = ctx.now() + 5000`, then use an item. `used === 'goldturbo'`.
  - `computer racers' uses show too`: in an 8-kart Cup, give kart 3 a `'bomb'` and call `useItem(game, 3, ctx.now())` (import from `kart-items.js`). `karts[3].used === 'bomb'`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-look.test.js`. Expected: FAIL (`used` is undefined).
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-look.test.js test/kart-race.test.js test/kart-race-3d.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: each kart says which item it just used"`

### Task 2: The motion maths (`body3d.js`)

**Files:**
- Create: `public/games/kart-race-3d/body3d.js` (an IIFE setting `globalThis.KRBody`, like `rig3d.js`)
- Test: `test/kart-race-3d-body.test.js`

**Interfaces:**
- **Produces `KRBody`:**
  - `spring(state, goal, dtMs, settleMs)`
    - `state` is `{ x, v }`, and the function returns a new `{ x, v }`;
    - critically damped, with `ω = 4.6 / (settleMs / 1000)`;
    - it uses the exact closed-form step for a critically damped spring, so it's stable at any dt.
  - `ik2(shoulder, elbowRest, hand, target, pole) -> { elbow, hand }`
    - all points are `[x, y, z]` in model space;
    - the upper and lower lengths come from the rest positions;
    - the solved `hand` reaches `target` when `|target − shoulder| ≤ upper + lower`;
    - otherwise the arm points straight at `target`;
    - the elbow bends towards `pole`;
    - all numbers stay finite.
  - `reaction(k, place, finishing) -> { name, arms } | null`
    - `finishing` is true while the view's phase is `finish` or the kart has finished;
    - `name` is one of `spin`, `win`, `sad`, `throw`, `drop`, `use` or `point`;
    - `arms` is `'both'`, `'left'`, `'right'` or `'none'`;
    - priority: spin, then win or sad (finished: place 1 is win, otherwise sad), then items by `k.used`;
    - the item groups:
      - **throw:** bouncer, seeker, bomb;
      - **drop:** banana, web, oil;
      - **use:** turbo, goldturbo, shield, star, coinbag, magnet, hover;
      - **point:** thunder, freeze, swap.
  - `blend(state, active, dtMs) -> state`: `state` is `{ weight }`, and the weight moves towards 1 over 200 ms while `active`, or towards 0 over 250 ms when not, linearly and clamped to 0..1.
  - `pose(input) -> Pose`
    - **input:** `{ steer, rate, speed, boosting, braking, dh, jolt, now, reaction, weights }`;
    - **Pose:** `{ wheel, ikWeight: { l, r }, turns: { [bone]: [[axis, angle], ...] } }`, where each `axis` is `'x'` (forward), `'y'` (up) or `'z'` (right) in the model's frame;
    - `wheel = clamp(2.5 × steer, ±1.0472)`;
    - the turns hold the body, head, breathing and reaction targets, with the spec's limits;
    - a one-arm reaction's arm gets `ikWeight = 1 − weight`, and the other arm stays at 1.
  - `tail(state, rate, speed, jolt, dtMs) -> state`: three springs (the tail's settle time is 250 ms). The goal of bone i is `−rate × 0.25 × (i + 1) / 3`, clamped to ±0.6, plus a downward bounce on `jolt`. It returns the three yaw angles as `state.yaw[0..2]`.

- [ ] **Step 1: Write the failing tests:**
  - `spring settles at its goal, the same at 30 and 60 fps`: from `{ x: 0, v: 0 }` to goal 1 with settle 120, 1 s at dt 16.7 and 1 s at dt 33.3 both end within 0.001 of 1, and the two results are within 0.01 of each other.
  - `a dropped frame doesn't overshoot`: one step of dt 200 from 0 to 1 gives an `x` between 0 and 1.
  - `ik2 reaches a reachable grip`: shoulder `[0, 0, 0]`, elbow rest `[0.15, 0, 0]`, hand `[0.3, 0, 0]`, target `[0.2, -0.1, 0.05]`. The hand is within 0.01 of the target, and both bone lengths are kept within 0.001.
  - `ik2 points straight at a grip out of reach, all numbers finite`: target `[1, 0, 0]` gives the hand at `[0.3, 0, 0]` (within 0.001), with every number finite.
  - `reaction priority`:
    - `{ spin: true, used: 'bomb' }` gives `spin` (both arms);
    - finished in place 1 gives `win` (left arm);
    - finished in place 2 gives `sad` (no arms);
    - `{ used: 'banana' }` gives `drop` (left);
    - `{ used: 'seeker' }` gives `throw` (right);
    - `{ used: 'shield' }` gives `use` (right);
    - `{ used: 'swap' }` gives `point` (right);
    - `{}` gives `null`.
  - `blend: in over 0.2 s, out over 0.25 s`:
    - from 0, active, after 100 ms the weight is 0.5 (±0.01), and after 200 ms it's 1;
    - from 1, inactive, after 125 ms it's 0.5 (±0.01).
  - `pose: the wheel turns 2.5x the steer, capped at 60 degrees`: `wheel` is 0.25 for steer 0.1, and 1.0472 for steer 1.
  - `pose: a one-arm reaction lets go with that hand only`: for `throw` at weight 1, `ikWeight` is `{ l: 1, r: 0 }`.
  - `tail trails opposite the bend`: after 60 steps of 16 ms at rate +2 (turning right), all three yaws are below 0, and `|yaw[2]| > |yaw[0]|`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-body.test.js`. Expected: FAIL (ENOENT).
- [ ] **Step 3: Implement `body3d.js`** with the interface above, and a header comment in the house style.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-body.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: the maths for Rex's smooth driving"`

### Task 3: The rig and the steering wheel in the model build

**Files:**
- Modify: `tools/kart-models/driver.py` (`build`):
  - don't split Rex: keep `torso` whole, renamed `rex`;
  - after decimating to 8,000, add an armature from `cfg['joints']`, parent the mesh with automatic weights, and limit and normalise the weights to 4 per vertex (`bpy.ops.object.vertex_group_limit_total(limit=4)`, then `vertex_group_normalize_all`).
- Modify: `tools/kart-models/kart.py`: cut `steer` out of the body (the faces whose centre lies within `steer.radius × 1.1` of the column axis line and within ±`steer.depth` of the wheel's plane), fill both holes, set its origin and rotation as in Global Constraints, and add the two grip empties as its children.
- Modify: `tools/kart-models/common.py`: export with `export_skins=True` and `export_animations=False`.
- Modify: `tools/kart-models/build.py`: the posed check renders bend the armature's bones (not piece objects), writing `check/rig-*.png`. The five poses: steering hard left, steering hard right, both arms up, the right arm thrown forward, and the left hand behind the shoulder.
- Modify: `tools/kart-models/rex.json`:
  - drop `pieces`;
  - add `joints`;
  - add `kart.steer: { "centre": [0.17, 0.6, 0], "radius": 0.19, "depth": 0.06 }` (the column axis already exists).
- Modify: `public/games/kart-race-3d/models/rex.glb` and `rex-kart.glb` (rebuilt with `--texture asset-references/v5/textures/rex/r003`)
- Test: `test/kart-race-3d-models.test.js`. Replace the four-pieces tests with skin tests.

**Starting joints:** in the game frame, relative to the seat, measured from the R-002 mesh at height 0.88. Check them in the renders and adjust.
- **Middle:** hips `[0, 0, 0]`, spine `[0.02, 0.12, 0]`, chest `[0.05, 0.24, 0]`, neck `[0.06, 0.38, 0]`, head `[0.07, 0.46, 0]`, head top `[0.08, 0.66, 0]`.
- **Arms:** shoulder `[0.08, 0.32, ∓0.12]`, upper arm `[0.09, 0.32, ∓0.2]`, elbow `[0.23, 0.29, ∓0.21]`, hand `[0.36, 0.28, ∓0.19]`, hand tip `[0.42, 0.28, ∓0.19]`.
- **Legs:** thigh `[0.02, 0.02, ∓0.1]`, knee `[0.33, 0.11, ∓0.11]`, ankle `[0.27, -0.14, ∓0.11]`, toe `[0.37, -0.17, ∓0.11]`.
- **Tail:** base `[-0.13, 0.08, 0.04]`, then `[-0.2, 0.05, 0.1]`, `[-0.24, 0.07, 0.17]`, and the tip `[-0.25, 0.12, 0.22]`.

The left side is −z.

- [ ] **Step 1: Write the failing model tests**, using `test/helpers-glb.js`:
  - `rex.glb is one skinned mesh with its 22 bones`: `json.skins.length === 1`, and the skin's joints' node names deep-equal the 22 names (in any order). Exactly one mesh has `JOINTS_0` and `WEIGHTS_0`. `triangles(json) <= 8000`.
  - `every vertex's weights add up to 1`: read `WEIGHTS_0` with `floats()`; every row sums to 1 (±0.01).
  - `the left arm's bones are on the left`: `upper_arm_l`'s world x and z (from the node translations down the chain) have z < 0, and `upper_arm_r`'s have z > 0.
  - `rex-kart.glb's steering wheel turns on the column, with grips`: there's a `steer` node, `grip_l` and `grip_r` are its children, and `grip_l` is at local z < 0. `triangles(json) <= 10000`.
  - **Kept:** the texture test (1024, one image per model) and the wheel tests.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-models.test.js`. Expected: FAIL (no skin).
- [ ] **Step 3: Implement the build changes and rebuild.**
  - Check the GPU rule first: no game running.
  - Run `"$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- rex --texture asset-references/v5/textures/rex/r003 --check`.
  - Read the `rig-*` and `seated_*` renders. Adjust the joints and repeat until no pose tears or folds at the shoulders, elbows, neck or tail root.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-models.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Rex gets a skeleton, and his kart a turning steering wheel"`

### Task 4: Rex drives with his skeleton

**Files:**
- Modify: `public/games/kart-race-3d/models3d.js`:
  - `KRModels.cloner` (default: `import('/vendor/three-addons/utils/SkeletonUtils.js')`, then `.clone`; replaceable for tests) is loaded with the GLTF loader;
  - `get()` resolves `{ kart, driver, wheelRadius, clone }`.
- Modify: `public/games/kart-race-3d/karts3d.js`, `rig()` and `set()`:
  - **The parts:** `rig()` finds the `steer` node, the grips, and the 22 bones of the driver clone (made with `model.clone(driver)`). It records each bone's rest local quaternion, and the rest world positions of the shoulders, elbows and hands in the model's frame.
  - **Each frame**, `set()` builds `KRBody.pose(...)` from what it already computes (rate, steer, speed, `k.boosting`, braking when the speed drops by more than 4 units/s², `dh`, a jolt when `k.spin` starts, the reaction and its blend weight) and applies it:
    1. `steer.rotation.y` (about its local column axis) becomes `-wheel`;
    2. every bone is reset to its rest, and then gets its `turns`. Each turn is applied in its parent's space: `q = axisAngle(inverse(parentRestWorldQ) · modelAxis, angle) · q`;
    3. each arm is solved with `KRBody.ik2` from its shoulder to its grip's position in the model's frame (with the pole out to the side and 0.2 below the shoulder). Its upper arm and forearm are aimed with `setFromUnitVectors` in parent space, blended by the arm's `ikWeight`;
    4. the tail bones get `tail()`'s yaws about the model's up axis.
  - **Removed:** the old piece-based code (`armL`, `armR`, `head`, and `moves`).
- Modify: `public/games/kart-race-3d/host.js` `SCRIPTS`: add `'/games/kart-race-3d/body3d.js'` before `karts3d.js`.
- Modify: `public/games/kart-race-3d/rig3d.js`: remove `moves` and `ARM_PER_STEER`, which are no longer used. Update `test/kart-race-3d-rig.test.js` to match.
- Test: `test/kart-race-3d-karts.test.js`. Its fake loader builds a `SkinnedMesh` with a `Skeleton` of the 22 bones (a chain from the starting joints above), plus a kart with `steer`, `grip_l` and `grip_r`. Pass `KRModels.cloner = SkeletonUtils.clone` from `three/examples/jsm/utils/SkeletonUtils.js`.

- [ ] **Step 1: Update and write the failing tests:**
  - **Replace** the arm and head piece tests with:
    - `the hands stay on the wheel through a turn`: after driving 30 frames turning right, each hand bone's world position is within 0.02 of its grip's world position, and `steer.rotation.y < 0`.
    - `a throw lets go with the right hand only`: drive with `used: 'bomb'` for 15 frames. The right hand is more than 0.05 from `grip_r`, and the left is within 0.02 of `grip_l`.
    - `spinning out puts both hands up`: with `k.spin`, after 20 frames both hand bones are higher (world y) than the head bone's rest height minus 0.05.
    - `two Rexes move on their own`: two karts, and only one spins. Their right-hand bones' world positions (relative to their own kart) differ by more than 0.05.
  - **Kept:** the placeholder, failed-load, dispose-before-load, shared-model (now: disposing doesn't free the shared skinned geometry) and ring tests.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-karts.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** the changes listed under Files.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-karts.test.js test/kart-race-3d-rig.test.js test/kart-race-3d-body.test.js test/kart-race-3d-client.test.js test/kart-race-3d-scene.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.** `git commit -m "Kart Race 3D: Rex drives with his skeleton: hands on the wheel, body, tail and reactions"`

### Task 5: Docs, full suite and a live check

**Files:**
- Modify: `README.md`, the Kart Race 3D row. The Rex sentence becomes: "**Rex** races as a full 3D kart and driver with a skeleton: his hands stay on a turning steering wheel, he leans into bends, rocks back on a boost, breathes and swishes his tail, tosses items forward or drops them behind, throws his arms up when he spins out, and celebrates (or slumps) at the finish".
- Modify: `CHANGELOG.md`: add a `## 0.1.39` heading above `## 0.1.38`, with `- 🦖 Kart Race 3D: Rex drives for real now: his hands stay on a turning steering wheel, his body leans and rocks with the drive, his tail swishes, and he tosses items forward or drops them behind.`
- Modify: `docs/GAMES.md` (regenerated)

- [ ] **Step 1: Update the docs, regenerate the catalog, and run `npm test`.** Expected: everything passes.
- [ ] **Step 2: Live check.**
  - Run `preview_start ark-dev` with a 1280 × 720 viewport.
  - Race with the scratchpad bots, Rex for P1 (`RACERS=rex,dash`, track 2).
  - Take screenshots, zoomed on P1's kart: steering into a bend, a moment after an item use, and the finish.
  - Read `read_console_messages` after a reload. Expected: no new errors.
- [ ] **Step 3: Commit.** `git commit -m "Kart Race 3D: README and What's new for Rex's skeleton"`
