# Kart Race 3D: Rex's moving 3D model (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rex races in Kart Race 3D as a real textured 3D kart and driver. The wheels spin and steer, the arms follow the wheel, the head looks into bends, and Rex reacts to spin-outs and wins. Every other racer keeps the placeholder.

**Architecture:** A repeatable Blender script (`tools/kart-models/`) turns the R-002 Hunyuan meshes into two committed GLBs with named, pivoted parts and a first-pass texture. On the TV, `models3d.js` loads each racer's GLBs once per page. `karts3d.js` starts every kart as today's placeholder and swaps in a clone of the model when it arrives. The movement maths lives in the pure `rig3d.js`, so it can be tested in a vm.

**Tech Stack:** Blender 5.2.3 (Steam copy) with Python and bpy, Three.js 0.184 (GLTFLoader from `/vendor/three-addons/`), plain browser IIFEs, and node:test.

**Spec:** `docs/superpowers/specs/2026-11-09-kart-race-3d-rex-model-design.md`

## Global Constraints

- **The contract:** `KRKarts.make` keeps returning `{ obj, racer, marker, set(pose, k, now), dispose() }`. It may gain optional trailing arguments.
- **No server or phone changes.** Movement comes only from the pose and the view the TV already has.
- **The kart model:** 1.75 game units nose to tail (±2%), facing +X, wheels on the ground (y = 0), centred on the kart's middle.
- **Kart parts:** `body`, `wheel_fl`, `wheel_fr`, `wheel_rl` and `wheel_rr`, with origins at the hubs, plus empties `seat` and `column`. Left is scene −Z (the kart faces +X with +Y up).
- **Rex's parts:** `torso`, `head` (pivot at the neck), and `arm_l` and `arm_r` (pivots at the shoulders). His file's origin is the point that goes on the kart's `seat`.
- **Budgets:**
  - kart ≤ 10,000 triangles;
  - Rex ≤ 8,000 triangles;
  - one 1024 × 1024 texture per model, embedded.
- **Caps:** steering up to 25° (0.4363 rad), and the head up to 30° (0.5236 rad).
- **Outputs:**
  - the game models: `public/games/kart-race-3d/models/rex-kart.glb` and `rex.glb` (committed);
  - the guides and check renders: `asset-references/v5/textures/rex/` (git-ignored).
- **GPU:** local Blender runs are allowed only when no game process is running (check with `Get-Process` first). No ComfyUI jobs are needed.
- **Visual quality:** keep the Steam Deck minimum. Don't lower quality for a Pi.
- **Commits:** messages look like `Kart Race 3D: …`.

## Sign conventions (used by Tasks 1, 5 and 6)

- **Field to scene:** the field's (x, y) is the scene's (x, z). A pose's `angle` increasing means the kart turns towards scene +Z, its right. So a **positive turn rate means turning right**.
- **Angle signs:** `rig3d.js` returns angles with the turn rate's sign. `karts3d.js` applies them as `rotation.y = -value` (a positive `rotation.y` turns +X towards −Z, the left).
- **Rolling forward** is a negative `rotation.z` on a wheel (the axle is local Z). With three's default Euler order 'XYZ', a front wheel's `rotation.z` (roll) is applied before its `rotation.y` (steer), which is what's wanted.

## Review Focus

1. **Teleports:** a kart that jumps far between frames (respawn, a new race, a Swap item) must not flash its wheels round. Pinned in Task 1 (`roll` returns 0 past `TELEPORT`).
2. **Model arrives after the kart's gone:** a kart disposed before its model loads must not swap, and must not add anything to a removed object. Pinned in Task 6.
3. **Shared GLB data:** disposing one Rex kart must not free the geometry or texture that the other Rex karts (the Cup can have one player and CPU clones) still draw. Pinned in Task 6.
4. **Steering direction:** turning right must turn the front wheels, arms and head to the right, not mirrored. Pinned in Task 6 (`wheel_fl.rotation.y < 0` when turning right).
5. **A failed load:** a missing or broken GLB keeps the placeholder and logs once per racer, not every frame. Pinned in Task 5.

---

### Task 1: The movement maths (`rig3d.js`)

**Files:**
- Create: `public/games/kart-race-3d/rig3d.js`
- Test: `test/kart-race-3d-rig.test.js`

**Interfaces:**
- Produces `window.KRRig`, an IIFE assigning `globalThis.KRRig` (like `geom3d.js`). Field poses are `{ x, y, angle }`, in field units and radians.
  - `STEER_MAX = 25 * Math.PI / 180` and `HEAD_MAX = 30 * Math.PI / 180`.
  - `TELEPORT = 3`: field units moved in one frame, past which a move counts as a jump.
  - `turnRate(prev, pose, dtMs) -> number`: radians a second, signed. The angle difference is wrapped to (−π, π]. Returns 0 when `prev` is null or `dtMs <= 0`.
  - `roll(prev, pose, radius) -> number`: the wheel's roll in radians since `prev`. That's (dx·cos(angle) + dy·sin(angle)) ÷ radius, so it's negative when reversing. Returns 0 when `prev` is null or the move is longer than `TELEPORT`.
  - `steerGoal(rate) -> number`: clamp(rate × 0.25, ±STEER_MAX).
  - `headGoal(rate) -> number`: clamp(rate × 0.3, ±HEAD_MAX).
  - `ease(cur, goal) -> number`: `cur + (goal - cur) * 0.2`, the same smoothing as today's lean.
  - `bob(speed, dh, now) -> number`: the head's y offset in model units. That's 0.02 × min(1, |speed| ÷ 8.5) × sin(now ÷ 60), minus clamp(dh × 0.4, ±0.05), where `dh` is the road height change since the last frame. 8.5 is the server's `KART.maxSpeed`.
  - `reaction(k, place) -> 'spin' | 'win' | null`: `'spin'` when `k.spin`, otherwise `'win'` when `k.finished && place === 1`, otherwise `null`. A null or undefined `k` gives `null`.
  - `moves(reaction, steer, head, now) -> { column, armL, armR, headYaw }`. All are radians in the turn-rate sign convention, except the arms, which are a shoulder `rotation.z` (positive raises the hand).
    - **No reaction:** `column = steer`, `armL = armR = 0`, `headYaw = head`.
    - **`'spin'`:** `column = 0`, `armL = armR = 2.2` (arms up), `headYaw = 0.35 * sin(now / 70)` (head shaking).
    - **`'win'`:** `column = 0`, `armL = 1.6 + 0.6 * |sin(now / 180)|` (fist pump), `armR = 0`, `headYaw = 0`.

- [ ] **Step 1: Write the failing tests** in `test/kart-race-3d-rig.test.js`. Load the file with `vm.runInContext` into a context `{ globalThis-as-window }`, as `kart-race-3d-geom.test.js` loads `geom3d.js`. The tests:
  - `roll: forward along the heading is distance / radius`: `roll({x:0,y:0,angle:0}, {x:0.5,y:0,angle:0}, 0.25) === 2`.
  - `roll: reversing rolls backwards`: `roll({x:1,y:0,angle:0}, {x:0.5,y:0,angle:0}, 0.25) === -2`.
  - `roll: stopped or first frame is 0`: the same pose twice gives `0`, and `roll(null, p, 0.25)` gives `0`.
  - `roll: a jump past TELEPORT is 0`: `roll({x:0,y:0,angle:0}, {x:5,y:0,angle:0}, 0.25) === 0`.
  - `turnRate wraps across ±π`: from angle 3.1 to −3.1 over 1000 ms gives ≈ +0.0832 (`Math.abs(r - (2*Math.PI - 6.2)) < 1e-9`).
  - `steerGoal caps at 25°`: `steerGoal(100) === STEER_MAX`, `steerGoal(-100) === -STEER_MAX`, and `steerGoal(0.4) ≈ 0.1`.
  - `headGoal caps at 30°`: `headGoal(100) === HEAD_MAX`.
  - `reaction`:
    - `({spin:true, finished:true}, 1) === 'spin'`;
    - `({finished:true}, 1) === 'win'`;
    - `({finished:true}, 2) === null`;
    - `({}, 1) === null`;
    - `(null, 1) === null`.
  - `moves`:
    - `moves(null, 0.2, 0.3, 0)` deep-equals `{column:0.2, armL:0, armR:0, headYaw:0.3}`;
    - `moves('spin', 0.2, 0.3, 0).armL === 2.2` and `.column === 0`;
    - `moves('win', 0.2, 0.3, 0).armR === 0` and `.armL >= 1.6`.
  - `bob is 0 when stopped on flat road`: `bob(0, 0, 123) === 0`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-rig.test.js`. Expected: FAIL (ENOENT for `rig3d.js`).
- [ ] **Step 3: Implement `rig3d.js`** with the interface above. Give it a header comment in the house style (what it is and the sign convention).
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-rig.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.**
  ```bash
  git add public/games/kart-race-3d/rig3d.js test/kart-race-3d-rig.test.js
  git commit -m "Kart Race 3D: the maths for spinning wheels, steering and Rex's moves"
  ```

### Task 2: The GLB reader and the kart model

**Files:**
- Create: `test/helpers-glb.js`
- Create: `test/kart-race-3d-models.test.js`
- Create: `tools/kart-models/build.py`, `tools/kart-models/kart.py` and `tools/kart-models/rex.json`
- Create: `public/games/kart-race-3d/models/rex-kart.glb`

**Interfaces:**
- Produces `test/helpers-glb.js` (ES module):
  - `readGlb(path) -> { json, bin }`, the two chunks.
  - `nodeNames(json) -> string[]`.
  - `triangles(json) -> number`, summed over every mesh primitive (index count ÷ 3, or POSITION count ÷ 3 without indices).
  - `bounds(json) -> { min:[x,y,z], max:[x,y,z] }`, from each mesh node's POSITION accessor `min`/`max` plus that node's `translation`. Only top-level nodes are used, and the build makes no rotation or scale on mesh nodes.
  - `imageSize(json, bin, i) -> { width, height, mime }`, read from the PNG IHDR or the JPEG SOF0/SOF2 marker.
- Produces the Blender command:
  ```
  "$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- <racer> [--only kart|rex] [--texture <dir>]
  ```
  - `$BLENDER` defaults to `A:/SteamLibrary/steamapps/common/Blender/blender.exe`.
  - `build.py` puts its own folder on `sys.path` and reads `tools/kart-models/<racer>.json`.
- Produces the `rex.json` schema. All positions are in the **game frame** (x forward, y up, z right, in game units after placement); the script converts them to Blender's frame as (x, −z, y).
  ```json
  {
    "kart": { "src": "asset-references/v4/models/rex/r002_kart_raw.glb", "forward": "+z|-z|+x|-x", "length": 1.75,
              "wheels": { "fl": {"hub":[x,y,z], "radius":r, "width":w}, "fr": {...}, "rl": {...}, "rr": {...} },
              "seat": [x,y,z], "column": {"at":[x,y,z], "axis":[x,y,z]},
              "budget": { "body": 8400, "wheel": 400 } },
    "rex":  { "src": "...r002_rex_raw.glb", "forward": "...", "height": h,
              "pieces": { "head": {"pivot":[x,y,z], "keep":[[px,py,pz,nx,ny,nz], ...]}, "arm_l": {...}, "arm_r": {...} },
              "budget": { "torso": 4800, "head": 1600, "arm": 800 } },
    "views": { "kart": "asset-references/v4/parts/rex/kart", "rex": "asset-references/v4/parts/rex/rex",
               "alignment": "asset-references/v4/parts/rex/alignment.json" },
    "atlas": { "kart": { "<object>:<side>": [u0,v0,u1,v1], ... }, "rex": { ... } }
  }
  ```
  A face belongs to a piece when its centre is on the normal's side of every plane in `keep`. Rex's coordinates are relative to his origin (the seat point).

- [ ] **Step 1: Write the failing kart tests** in `test/kart-race-3d-models.test.js`, using `helpers-glb.js`:
  - `rex-kart.glb has its parts`: `nodeNames` includes `body`, `wheel_fl`, `wheel_fr`, `wheel_rl`, `wheel_rr`, `seat` and `column`.
  - `rex-kart.glb is within budget`: `triangles(json) <= 10000`.
  - `rex-kart.glb is 1.75 long, on the ground`:
    - `Math.abs((max[0]-min[0]) - 1.75) <= 0.035`;
    - `Math.abs(min[1]) <= 0.02`;
    - `Math.abs(max[0] + min[0]) <= 0.05`.
  - `the front-left wheel is front and left`: the `wheel_fl` node's translation has `x > 0` and `z < 0`, and `wheel_rr`'s has `x < 0` and `z > 0`.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-models.test.js`. Expected: FAIL (ENOENT for `rex-kart.glb`).
- [ ] **Step 3: Measure Rex's kart.**
  - Check the GPU rule first: no game process should be running.
  - Import `r002_kart_raw.glb` in Blender and render its four orthographic sides. The scratchpad `render.py` is a starting point; render to `asset-references/v5/textures/rex/check/raw-kart-*.png`.
  - Compare with `asset-references/v4/parts/rex/kart/{left,front}.png` to find which raw axis is the nose. The raw long axis is ±Z, from −0.987 to 0.989.
  - Fill in the `kart` block of `rex.json` with:
    - `forward`;
    - the four hubs, radius and width;
    - `seat` (the hollow of the cockpit, at cushion height);
    - `column` (from the steering wheel's centre down the column).
- [ ] **Step 4: Write `build.py` and `kart.py` for the kart.** The steps run in this order, each a function in `kart.py`:
  1. `place(obj, cfg)`:
     - rotate so `forward` points to game +X;
     - scale to `length`;
     - centre x and z;
     - put the lowest point at y = 0.
  2. `decimate(obj, faces)`: use a COLLAPSE Decimate modifier down to about 60,000 faces before cutting (the raw mesh has 1.2M), and apply it.
  3. `cut_wheels(obj, wheels)`:
     - for each wheel, select the faces whose centre lies inside the cylinder (hub, radius × 1.05, width × 1.1, with the axle along game Z);
     - separate them as `wheel_<id>`;
     - `fill_holes` on both the wheel and the body;
     - set the wheel's origin to its hub.
  4. Decimate each part to its `budget`.
  5. Shade smooth.
  6. `markers(cfg)`: add empties `seat` and `column` at their places. The `column` empty's local +Y (game frame) points along `column.axis`.
  7. Export only the kart objects to `public/games/kart-race-3d/models/rex-kart.glb`:
     - `export_format='GLB'`, `export_yup=True` and `export_apply=True`;
     - every part a top-level node;
     - names exactly as above;
     - rotation and scale applied, so only translations remain.
  - `--only kart` stops after this export.
- [ ] **Step 5: Run the build, then the tests.**
  - Build: `"$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- rex --only kart`.
  - Test: `node --test test/kart-race-3d-models.test.js`. Expected: the four kart tests pass.
  - Render the six check views to `asset-references/v5/textures/rex/check/kart-*.png` and read them. The wheels should be whole discs, there should be no holes in the body, and the nose should be at +X.
- [ ] **Step 6: Commit.**
  ```bash
  git add test/helpers-glb.js test/kart-race-3d-models.test.js tools/kart-models public/games/kart-race-3d/models/rex-kart.glb
  git commit -m "Kart Race 3D: Rex's kart as a 3D model with separate wheels"
  ```

### Task 3: Rex in pieces, seated

**Files:**
- Create: `tools/kart-models/driver.py`
- Modify: `tools/kart-models/build.py` and `rex.json`
- Create: `public/games/kart-race-3d/models/rex.glb`
- Test: `test/kart-race-3d-models.test.js`

**Interfaces:**
- **Consumes:** Task 2's `place`, `decimate`, `markers` and `rex.json`, plus the kart's `seat` and `column`.
- **Produces `rex.glb`:**
  - top-level nodes `torso`, `head`, `arm_l` and `arm_r`, each with its origin at its pivot;
  - the file's origin is the seat point.

- [ ] **Step 1: Write the failing Rex tests:**
  - `rex.glb has its parts`: the node names include `torso`, `head`, `arm_l` and `arm_r`.
  - `rex.glb is within budget`: `triangles(json) <= 8000`.
  - `the head pivot is above the shoulders`: `head` translation y > `arm_l` translation y − 0.05. `arm_l` z < 0 and `arm_r` z > 0.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-models.test.js`. Expected: the three Rex tests FAIL (ENOENT); the kart tests pass.
- [ ] **Step 3: Measure Rex.**
  - Render the raw Rex's sides as in Task 2 Step 3.
  - Set `rex.forward` and `rex.height` so that, sitting at `seat`, his hands meet the steering wheel.
  - Set the `pieces` planes: the neck plane under the collar, and the shoulder planes inside the sleeves. Each arm also gets a plane above the waist, so the legs stay with the torso.
  - Set the pivots: the neck's centre and each shoulder joint's centre.
- [ ] **Step 4: Write `driver.py`:**
  - `place` (as the kart, but scale to `height` and put the origin at the seat point);
  - `decimate` to 60,000;
  - `split(obj, pieces)`: for each piece, separate the faces kept by its planes, `fill_holes` on both sides, and set the origin to the pivot. What remains is `torso`;
  - decimate each piece to its budget;
  - shade smooth;
  - export `rex.glb` the same way as the kart.

  `build.py` runs both by default, and `--only rex` runs only Rex.
- [ ] **Step 5: Run the build, then the tests.**
  - Build: `"$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- rex --only rex`.
  - Test: `node --test test/kart-race-3d-models.test.js`. Expected: all pass.
  - Render Rex seated in the kart (Rex's origin at `seat`) from the six views to `check/seated-*.png` and read them:
    - his hands are on the wheel;
    - his legs are inside the bodywork;
    - there are no gaps at the neck or shoulders;
    - his tail is clear of the rear wheels.
  - Also render a pose check, `check/posed-*.png`, with the head turned 30° and both arms turned 25° round the column axis. The joins should stay hidden.
- [ ] **Step 6: Commit.**
  ```bash
  git add tools/kart-models public/games/kart-race-3d/models/rex.glb test/kart-race-3d-models.test.js
  git commit -m "Kart Race 3D: Rex as a 3D driver with a moving head and arms"
  ```

### Task 4: UVs, the first-pass textures and the guides

**Files:**
- Create: `tools/kart-models/paint.py`
- Modify: `tools/kart-models/build.py` and `rex.json` (the `atlas` block)
- Modify: both GLBs (rebuilt)
- Test: `test/kart-race-3d-models.test.js`

**Interfaces:**
- **Consumes:** the objects from Tasks 2 and 3 (before export), and the `views` and `atlas` blocks of `rex.json`.
- **Produces:**
  - each GLB embeds one 1024 × 1024 JPEG (quality 90) in one material (Principled BSDF, roughness 0.8, metallic 0);
  - `asset-references/v5/textures/rex/{kart,rex}-texture.png` (the first pass) and `{kart,rex}-guide.png`;
  - `build.py --texture <dir>` uses `<dir>/kart.png` and `<dir>/rex.png` in place of the first pass (that's PR B), and keeps the same UVs.

- [ ] **Step 1: Write the failing test:**
  - `each model has one 1024 texture`: for both files, `json.images.length === 1`, and `imageSize` gives `1024 × 1024`.
  - Also check that each file is under 1.5 MB (`fs.statSync(...).size < 1.5e6`).
- [ ] **Step 2: Run the test.** Run `node --test test/kart-race-3d-models.test.js`. Expected: FAIL (no images).
- [ ] **Step 3: Write `paint.py`:**
  - `unwrap(objects, atlas)`:
    - group each object's faces by their dominant normal axis: front, back, left, right, top, bottom;
    - project each group orthographically along its axis;
    - fit the projection into that group's `atlas` rect, keeping its aspect ratio and a 4-pixel margin.

    So each side becomes one island that looks like the model seen from that side. Each wheel and Rex's head and arms get their own rects.
  - `first_pass(objects, views, alignment) -> image`:
    - each texel takes its colour from the reference view of its side;
    - the model's projected bounds map onto that view's subject box (`subjectX`, `subjectY`, `subjectWidth`, `subjectHeight` in `alignment.json`);
    - top and bottom islands sample the left or right view, by which side of the centre line the face is on (the "nearest painted colour");
    - pixels left empty inside a rect take the nearest filled pixel of the same rect.

    Use numpy (bundled with Blender) on `image.pixels`.
  - `guide(image, atlas) -> png`: render, with an orthographic camera, a plane showing the texture with the UV outlines drawn over it (`bpy.ops.uv.export_layout`, composited), and a text object at each rect's centre labelled `<object> <side>`.
  - **Fill in `atlas`:**
    - kart: body left and right 0.5 × 0.3 each, front, back and top sharing the rest, and four small wheel rects;
    - Rex: torso sides large, head and arms smaller.

    Record the exact rects in `rex.json`.
- [ ] **Step 4: Rebuild, test and check.**
  - Build: `"$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- rex`.
  - Test: `node --test test/kart-race-3d-models.test.js`. Expected: all pass.
  - Render the textured six views to `check/textured-*.png` and read them against `asset-references/v4/parts/rex/*/sheet.png`:
    - the flames, the REX lettering and Rex's markings land on the right faces;
    - the left and right sides aren't swapped;
    - no island bleeds into another.
- [ ] **Step 5: Commit.**
  ```bash
  git add tools/kart-models public/games/kart-race-3d/models test/kart-race-3d-models.test.js
  git commit -m "Kart Race 3D: first-pass colours for Rex's 3D kart and driver"
  ```

### Task 5: Loading models once per page (`models3d.js`)

**Files:**
- Create: `public/games/kart-race-3d/models3d.js`
- Test: `test/kart-race-3d-karts.test.js` (the loading part)

**Interfaces:**
- **Produces `window.KRModels`:**
  - `MODELS = { rex: { kart: 'rex-kart.glb', driver: 'rex.glb' } }`, files under `/games/kart-race-3d/models/`.
  - `has(racerId) -> boolean`.
  - `get(THREE, racerId) -> Promise<{ kart: Object3D, driver: Object3D, wheelRadius: number }> | null`:
    - `null` for a racer without a model;
    - otherwise the same promise every call (one load per racer per page);
    - `wheelRadius` is half the height of `wheel_fl`'s bounding box;
    - the resolved objects are originals: callers `clone(true)` them, which shares geometry and materials.
  - `loader: (url) => Promise<gltf>`:
    - replaceable, for tests;
    - the default is `import('/vendor/three-addons/loaders/GLTFLoader.js')`, then `new GLTFLoader().loadAsync(url)`, the same as `party-board/board3d.js`.
  - **A failed load:** the promise rejects, and `console.error('Kart Race 3D: no model for', racerId, err)` is logged once. The rejected promise stays cached, so there's no retry storm within the page.

- [ ] **Step 1: Write the failing tests** in `test/kart-race-3d-karts.test.js`:
  - **Setup:** `import * as THREE from 'three'`. Create a vm context with `window` = the context, `console` = a stub that records `error` calls, and `performance`. Load `public/games/kart-race/racers.js`, `kart-race-3d/geom3d.js`, `rig3d.js` and `models3d.js` in that order.
  - **The fake loader** resolves `{ scene }`, built from three Groups or Meshes named like the GLBs:
    - `wheel_*` as `Mesh(new THREE.CylinderGeometry(0.2,0.2,0.1))`;
    - `body`, `seat`, `column`, `torso`, `head`, `arm_l` and `arm_r`.
  - The tests:
    - `get returns null for a racer without a model`: `KRModels.get(THREE, 'not-rex') === null`.
    - `get loads each file once`: calling `get` twice for `rex` returns the same promise, and the loader was called exactly 2 times (kart and driver).
    - `wheelRadius comes from the wheel`: the resolved `wheelRadius ≈ 0.2`.
    - `a failed load rejects and logs once`: the loader rejects; two `get` calls give one rejection, and `console.error` was called once.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-karts.test.js`. Expected: FAIL (ENOENT for `models3d.js`).
- [ ] **Step 3: Implement `models3d.js`** with the interface above.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-karts.test.js`. Expected: pass.
- [ ] **Step 5: Commit.**
  ```bash
  git add public/games/kart-race-3d/models3d.js test/kart-race-3d-karts.test.js
  git commit -m "Kart Race 3D: load racers' 3D models once per TV page"
  ```

### Task 6: The model in the race (`karts3d.js`, `kart3d.js`, `host.js`)

**Files:**
- Modify: `public/games/kart-race-3d/karts3d.js` (`make` and its returned object)
- Modify: `public/games/kart-race-3d/kart3d.js` (line 85: pass the place; line 121: pass `player`)
- Modify: `public/games/kart-race-3d/host.js` (`SCRIPTS`: add `rig3d.js` and `models3d.js` before `karts3d.js`)
- Test: `test/kart-race-3d-karts.test.js` (the race part)

**Interfaces:**
- **Consumes:**
  - `KRRig` (Task 1): `turnRate`, `roll`, `steerGoal`, `headGoal`, `ease`, `bob`, `reaction` and `pose`.
  - `KRModels.get` (Task 5).
- **Produces:**
  - `KRKarts.make(THREE, racerId, color, label, player)`. The 5th argument, `player` (a boolean), adds the colour ring.
  - `set(pose, k, now, place)`. The 4th argument, `place`, is that kart's 1-based place from `view.positions` (it can be undefined).
  - `kart3d.js` calls `karts[i].set(pose, view.karts[i], now, view.positions && view.positions[i])` and `make(..., label, player)`.
- **The swap**, when `KRModels.get` resolves and the kart hasn't been disposed:
  - remove and dispose the placeholder's own meshes;
  - add `kart.clone(true)` and `driver.clone(true)` to `body`, with the driver at the kart clone's `seat` position;
  - build `armsPivot`, a Group at `column`'s position and quaternion, and `attach()` both arm clones to it;
  - move the marker to the driver's bounding-box top + 0.45;
  - for a player, add the ring: `RingGeometry(0.95, 1.05, 48)`, flat at y = 0.02, `MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })`, in `obj` (not `body`, so it doesn't lean or spin). Under the kart is under its tag.
- **Each `set()` with a model:**
  - every wheel's `rotation.z -= roll`;
  - `steer = ease(steer, steerGoal(rate))`, and the front wheels' `rotation.y = -steer`;
  - `headTurn = ease(headTurn, headGoal(rate))`;
  - `p = moves(reaction(k, place), steer, headTurn, now)`;
  - `armsPivot` is set to its base quaternion turned by `-p.column` round its local Y;
  - `arm_l.rotation.z` and `arm_r.rotation.z` are offset from their base by `p.armL` and `p.armR`;
  - `head.rotation.y = -p.headYaw`, and `head.position.y` = its base plus `bob(speed, dh, now)`, with the speed from the pose distance ÷ dt.
  - Lean, spin and shrink stay as today.
- **`dispose()`:**
  - frees the placeholder (if still there), the ring's geometry and material, and the marker;
  - never the clones' geometry or materials (they're shared);
  - sets a `gone` flag so a later swap does nothing.

- [ ] **Step 1: Write the failing tests**, in the same file and with the same context. Also stub `document.createElement` for the tag canvas, as `kart-race-3d-loading.test.js` does. A `ready()` helper awaits the fake load and a microtask.
  - `a kart shows the placeholder until the model loads`: right after `make`, `obj.getObjectByName('wheel_fl')` is undefined; after `ready()`, it's defined and the placeholder's meshes are gone from `obj`.
  - `a failed load keeps the placeholder`: with the loader rejecting, after `ready()` there's no `wheel_fl`, and `obj` still has its placeholder meshes.
  - `a kart disposed before its model loads never swaps`: dispose, then `ready()`; `obj` has no `wheel_fl`.
  - `turning right steers the front wheels right and the rear not at all`: after 20 `set()` calls 16 ms apart, with the angle increasing by 0.02 each and x moving forward by 0.1, `wheel_fl.rotation.y < 0`, `wheel_rr.rotation.y === 0`, and `wheel_rr.rotation.z < 0`.
  - `the head looks into the bend and the arms turn with the wheel`: same run, `head.rotation.y < 0`, and the `armsPivot` quaternion differs from its base.
  - `spinning out puts the arms up`: one `set` with `k = { spin: true }`; `arm_l.rotation.z` is greater than its base by `2.2 ± 1e-9`.
  - `winning pumps the left fist`: with `k = { finished: true }` and place `1`, `arm_l.rotation.z - base >= 1.6`, and `arm_r` stays at its base.
  - `disposing a kart keeps the shared model`: wrap the fake model's geometries' `dispose` in a spy; make two Rex karts, dispose one; the spy wasn't called.
  - `a player's kart gets a ring in its colour; a computer's doesn't`: `make(THREE,'rex','#ff0000',null,true)` has a `Mesh` with `RingGeometry` whose material colour is `0xff0000`; with `player` false there's none.
- [ ] **Step 2: Run the tests.** Run `node --test test/kart-race-3d-karts.test.js`. Expected: the race tests FAIL; the Task 5 tests still pass.
- [ ] **Step 3: Implement** the changes to `karts3d.js`, `kart3d.js` and `host.js` described above. Update the `karts3d.js` header comment: Rex has a model; the others have the placeholder.
- [ ] **Step 4: Run the tests again.** Run `node --test test/kart-race-3d-karts.test.js test/kart-race-3d-client.test.js test/kart-race-3d-loading.test.js`. Expected: all pass.
- [ ] **Step 5: Commit.**
  ```bash
  git add public/games/kart-race-3d test/kart-race-3d-karts.test.js
  git commit -m "Kart Race 3D: Rex drives his 3D kart, with spinning wheels, steering and reactions"
  ```

### Task 7: Docs, catalog, full suite and a live race

**Files:**
- Modify: `README.md` (the Kart Race 3D row, line 71)
- Modify: `CHANGELOG.md` (under `## 0.1.37`)
- Modify: `docs/GAMES.md` (regenerated) and, if needed, `EXTRA` in `tools/games-catalog.mjs`

- [ ] **Step 1: Update the README row.** Replace "For now the karts are simple 3D stand-ins in each racer's colours: proper 3D racers come later." with: "**Rex** races as a full 3D kart and driver: his wheels spin and steer, he turns the wheel and looks into bends, throws his arms up when he spins out and pumps his fist when he wins; the other racers are simple 3D stand-ins in their colours for now, with their own models to come. A player's kart has a ring in their colour under it."
- [ ] **Step 2: Add the What's new line** under `## 0.1.37`: `- 🦖 Kart Race 3D: Rex now races as a real 3D kart and driver. His wheels spin and steer, he turns the wheel, looks into bends, throws his arms up when he spins out and pumps his fist when he wins.`
- [ ] **Step 3: Regenerate the catalog and run everything.**
  - Run `node tools/games-catalog.mjs`, then `npm test`. Expected: everything passes, including `test/catalog.test.js`.
  - If the catalog test names the new files as missing, add them to `EXTRA` and rerun.
- [ ] **Step 4: Race it live.**
  - Run `preview_start ark-dev`. Set up a 1v1 Kart Race 3D race with Rex as P1, then a Cup in which Rex is a computer racer (for example, both players on other racers).
  - Check with screenshots, using `javascript_tool` to read poses if needed:
    - the model appears;
    - the wheels roll;
    - the front wheels and arms turn into bends;
    - the head looks into bends;
    - the P1 ring shows;
    - a spin-out (take a hit) raises the arms;
    - the win fist pump shows.
  - `read_console_messages` with `onlyErrors`. Expected: none.
- [ ] **Step 5: Commit.**
  ```bash
  git add README.md CHANGELOG.md docs/GAMES.md tools/games-catalog.mjs
  git commit -m "Kart Race 3D: README and What's new for Rex's 3D model"
  ```
