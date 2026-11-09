# Kart Race 3D: Rex's 3D model, with moving wheels and a moving driver

Status: approved design (2026-11-09), awaiting spec review.

## Goal

Rex's placeholder kart in Kart Race 3D becomes a real 3D model: his kart and Rex himself, in
colour. The wheels spin and the front pair steer, and Rex moves as he drives. Rex is the first
racer to get a model; the same steps are reused for the other racers later.

## What the owner asked for

- The kart's wheels spin with speed, and the front wheels turn with steering.
- Rex's **arms turn with the steering**, his **head looks into bends**, and he **reacts to
  events** (arms up when spun out, a fist pump when he wins the race).
- **Colour painted by ChatGPT** as a texture.

Assumptions (not stated by the owner, agreed in the design review):

- The model is used everywhere Rex races: 1v1, the 8-kart Cup, and as a computer racer.
- No server change: every movement comes from data the TV already has.
- It runs smoothly on the Steam Deck (the TV's minimum) with eight karts on the track.

## Inputs

- `asset-references/v4/models/rex/r002_kart_raw.glb`, `r002_rex_raw.glb`: Hunyuan3D 2 multi-view
  meshes (about 1.2M triangles each, shape only, one piece each), from ChatGPT's R-002 views.
- `asset-references/v4/parts/rex/kart/*.png`, `rex/*.png`: those views (front, left, back, right,
  three-quarter), used for the first-pass texture.
- Blender (the Steam copy, `A:/SteamLibrary/steamapps/common/Blender/blender.exe`, or
  `BLENDER_PATH`), run in the background.

## 1. The model step: `tools/kart-models/`

A Blender Python script, run as
`blender -b --factory-startup --python tools/kart-models/build.py -- <racer> [--texture <dir>]`,
turns a racer's raw meshes into the game's models. It's repeatable for every racer, and a small
per-racer settings file holds the numbers that differ (wheel positions, cut planes, seat offset).

**The kart (`<racer>-kart.glb`):**

- **Placement:** scaled to 1.75 game units nose to tail, facing +X, wheels on the ground (y = 0),
  centred on the kart's middle.
- **The wheels:**
  - Each of the four wheels is found from the per-racer hub positions, checked against the side
    views.
  - Each is cut out with a cylinder and closed.
  - The holes left in the body are filled.
  - Each wheel is its own node, with its origin at its hub: `wheel_fl`, `wheel_fr`, `wheel_rl`,
    `wheel_rr`. The rest is `body`.
- **The seat:** an empty node, `seat`, marks where the driver sits. A `column` node marks the
  steering column, where Rex's arms turn.
- **Budget:** about 10,000 triangles in all, after decimation.

**Rex (`<racer>.glb`):**

- **The pieces:** split into four rigid pieces with cut planes at the neck and shoulders, so the
  jacket sleeves and collar hide the joins:
  - `torso` (with the legs and tail);
  - `head`, pivot at the neck;
  - `arm_l` and `arm_r`, pivots at the shoulders.
- **Seating:** scaled and placed so that, put at the kart's `seat` node, his hands meet the steering
  wheel and his legs sit inside the bodywork.
- **Budget:** about 8,000 triangles.

**Textures:**

- Each model gets one 1024 × 1024 texture.
- **UV layout:** unwrapped by projection from the views. The left side, right side, top, front and
  back each become one large island that looks like the model seen from that side, plus islands
  for the wheels, head and arms.
- **First-pass texture:** made by projecting ChatGPT's R-002 views onto the model. Places no view
  sees get the nearest painted colour.
- **The guide for ChatGPT:** for each model, a PNG of the layout's outlines and labels over the
  first-pass texture.

**Outputs:**

- The game models go in `public/games/kart-race-3d/models/`: `rex-kart.glb` and `rex.glb`, textures
  embedded. These are committed.
- The guides and check renders go in `asset-references/v5/textures/rex/`, which is git-ignored.

## 2. In the game: `public/games/kart-race-3d/karts3d.js`

`KRKarts.make(THREE, racerId, color, label)` keeps its contract:
`{ obj, racer, marker, set(pose, k, now), dispose() }`.

- **A racer without a model** gets the placeholder, as today.
- **A racer with a model** gets the kart and Rex, seated at `seat`.
- **Loading:**
  - Models load once per TV page, in the background, through
    `/vendor/three-addons/loaders/GLTFLoader.js` (as Party Board does).
  - A kart made before its model arrives shows the placeholder, then swaps to the model when it's
    ready.
  - A failed load keeps the placeholder and logs an error.
  - The same model is shared between karts: each kart clones it, and the clones share the
    geometry and the texture.

**Movement**, all from the pose and the kart's view:

- **Wheel spin:** the distance moved since the last frame, divided by the wheel radius. The wheels
  stop when the kart stops and run backwards when it reverses (its movement against its heading).
- **Steering:** the turn rate (the same measure as today's lean), smoothed, up to 25°. The front
  wheels turn by it.
- **Arms:** both arms turn round the steering column by the steering angle, so his hands stay on
  the wheel.
- **Head:**
  - It turns into the bend, up to 30°, from the same turn rate.
  - It bobs a little with speed, and when the road height changes (humps on the big tracks).
- **Reactions:**
  - `k.spin`: arms up and the head shaking, for as long as the spin lasts.
  - `k.finished` with position 1: a fist pump with the left arm, repeating while the finish shows.
- **Kept from today:** the lean into bends, the spin-out turn, the shrink when hit by a mushroom,
  and the P1/P2 tags.
- **The player's colour:** since the model has Rex's own colours, a player's kart gets a thin
  ring in the player's colour under its tag, so P1 and P2 still match their phones.
- `dispose()` frees only what that kart made: its clones' materials, if any, and the tag. It
  doesn't free the shared geometry or texture.

The movement maths lives in small pure functions (spin, steer, head angle, which reaction), so it
can be tested without WebGL.

**Performance:** eight karts with models come to about 150,000 triangles, with two 1024 textures
shared by every Rex. That's well inside the Steam Deck's budget. Visual quality isn't lowered for
smaller devices.

## 3. ChatGPT's texture (request R-003)

1. **The first pass (Claude):** Claude runs the model step and gives ChatGPT the guides and the
   first-pass textures.
2. **R-003 (ChatGPT):** repaint each texture over its guide in the house style.
   - **Keep:** every island's outline and position exactly, and paint slightly past the edges so
     no seams show.
   - **Preserve:** the flames, the REX lettering and Rex's markings, as in the references.
   - **Deliver:** the two 1024 PNG textures, plus notes on anything it couldn't see.
   - **GPU:** cloud image generation only; no local GPU work.
3. **The check (Claude):**
   - The script applies the textures and renders six views.
   - Claude compares them with the reference sheets.
   - Seams or misplaced paint send R-003 back with the problem views marked.

## Order of work

- **PR A, the moving 3D Rex:**
  - the Blender script and Rex's settings;
  - the two models with the first-pass textures;
  - the game code (loading, wheels, Rex's movement, the colour ring);
  - tests, the README row and a What's new line.

  Players can race the moving 3D Rex when this merges.
- **R-003** runs alongside PR A.
- **PR B:** ChatGPT's textures, once accepted, replace the first-pass ones.

## Tests

- **The movement maths, in a vm:**
  - wheel spin from distance, including stopped and reversing;
  - steering from turn rate, capped at 25°;
  - the head's angle, capped at 30°;
  - the reaction: spin-out, first place over the line, or none.
- **The models:**
  - each file in `models/` has its named parts (`body`, four wheels, `seat` and `column` on the kart;
    `torso`, `head`, `arm_l` and `arm_r` on Rex);
  - each stays under its triangle budget and has a 1024 texture;
  - the kart is 1.75 long (±2%).
- **Loading:** a kart made before the model loads shows the placeholder, then swaps to the model.
  A failed load keeps the placeholder.
- **In the browser:** a live race on the TV with Rex as a player and as a computer racer, 1v1
  and in the Cup. Check the wheels, steering, head, arms, the spin-out and win reactions, and
  that there are no console errors.

## Not in this work

- The other racers: the same script is reused for each later.
- A skeleton, skinning or animation clips.
- New sounds.
- Changes to the server or to the phones.
