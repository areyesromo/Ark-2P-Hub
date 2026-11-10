# Kart Race 3D: Rex's skeleton and smooth driving (design)

Date: 2026-11-09. Status: approved design, awaiting spec review.

## Goal

Rex looks like he's really driving. His hands stay on a steering wheel that turns, his body reacts to
the drive, he's never frozen, and his reactions (including throwing and dropping items) flow in and
out smoothly. The rig and the motion code are reusable for every racer that gets a model later.

## What the owner asked for

- "Does Rex have a skeleton so it can look animated?" No: today he's four rigid pieces (torso, head,
  two arms) turned at the neck and shoulders. Then: "let's plan it out so the driving can look smooth."
- **The owner chose all of these:**
  - **Hands stay on the wheel:** his elbows and wrists bend so his hands follow the steering wheel.
  - **His body reacts to the drive:** he leans into bends, rocks back on a boost and jolts on hits, and his head follows the turn.
  - **He's always a bit alive:** breathing, small head movements, and a tail that sways and trails.
  - **Smooth reactions:** the spin-out, the finish and items, blended in and out.
  - **Items look thrown or dropped:** a forward toss, or a drop behind him.
- **The owner chose approach A:** the rig is built in Blender, and all the motion is computed in the
  game code (no keyframed animation clips).

**Assumptions** (agreed in the design review):

- Rex only for now. The pipeline and the code are written so another racer needs only its own
  numbers.
- The phones don't change. The server change is one field in the view.

## 1. The model step (`tools/kart-models/`)

**Rex as one skinned mesh:**

- **No more pieces:** the build stops cutting Rex into four. His remeshed and decimated mesh stays whole (8,000 triangles at most), with the same UVs and texture pass as today (`paint.py`, the R-003 texture).
- **The skeleton:** 22 bones, built by script from joint positions measured once per racer and kept in `<racer>.json` under `joints`, in the game frame, relative to his origin (the seat point):

  | Part | Bones |
  | --- | --- |
  | Middle | `hips` (the root, at the origin), `spine`, `chest`, `neck`, `head` |
  | Each arm (`_l`, `_r`) | `shoulder`, `upper_arm`, `forearm`, `hand` |
  | Each leg (`_l`, `_r`) | `thigh`, `shin`, `foot` |
  | Tail | `tail_1`, `tail_2`, `tail_3` |

  Each bone runs from its joint to the next joint in its chain. Leaf bones (`head`, `hand`, `foot`, `tail_3`) point along their parent.
- **Skin weights:** Blender's automatic weights (parent with automatic weights), with at most 4 bones per vertex, and normalised.
- **Export:** a GLB with the skin (`export_skins`, no animations), named `rex.glb` as now.
- **Checks:**
  - renders of the seated pose;
  - five test poses (steering hard left and right, both arms up, the right arm thrown forward, the left hand behind the shoulder), from six views, to `asset-references/v5/textures/rex/check/rig-*.png`;
  - a pose is acceptable when no part of the mesh tears or folds inside out at the shoulders, elbows, neck or tail root.

**The steering wheel becomes its own part:**

- **Cutting it out:** the faces within the wheel's ring are cut out of the kart body into `steer`, using the wheel's centre, radius and the column's axis (`rex.json` `kart.steer`), and the hole is filled.
- **Its pivot:** its origin is on the column, and its local up runs along the column's axis.
- **The grips:** two markers, `grip_l` and `grip_r`, are children of `steer` on the rim at 10 and 2 o'clock.
- **Budget:** the kart's total budget stays at 10,000 triangles.

## 2. The server (`server/games/kart-race.js`, `kart-items.js`)

- **Recording a use:** when an item is used, the kart records `usedKind` and `usedAt`.
- **The view:** each kart gains `used`, the kind it used, for `USED_MS = 600` after it was used, and `null` otherwise. Gold Turbo boosts count as `'goldturbo'`.
- **Hidden information:** none. The item is visible on the track anyway, and the field is only a name of an item that was just used.
- **Unchanged:** the phones, the 2D game and the race rules.

## 3. The motion (`public/games/kart-race-3d/body3d.js`, applied in `karts3d.js`)

`body3d.js` is pure maths: poses as plain numbers, with no Three.js objects. `karts3d.js` applies a
pose to the clone's bones every frame. The existing `rig3d.js` keeps the wheels' roll and steering,
and the turn rate.

**The layers, each frame:**

1. **The steering wheel:** `steer` turns about the column by **2.5 × the front wheels' steering angle** (clamped to ±60°). The grips go round with it.
2. **The arms (two-bone IK):**
   - each arm's shoulder → elbow → hand chain is solved so the hand reaches its grip;
   - the elbows bend outward and down (a pole target to the side of, and below, each shoulder);
   - a grip out of reach leaves the arm straight, pointing at it;
   - each arm has an IK weight from 0 to 1 that reactions lower.
3. **The body:**
   - **Bends:** `spine` and `chest` roll into a bend (as the kart leans, up to about 10° more).
   - **Boost and braking:** they pitch back up to 8° while boosting and forward up to 6° while braking or slowing hard.
   - **Hits:** a hit (the start of a spin, a bump into another kart, a shrink) gives a short jolt impulse to the chest and head.
4. **The head:**
   - turns into the bend (as today's `headGoal`, up to 30°);
   - bobs with speed and the road height (as today's `bob`);
   - makes a slow idle drift (±3°, 0.1–0.3 Hz).
5. **Alive:**
   - **breathing:** the chest pitches ±1.5° at 0.25 Hz;
   - **the tail:** the three tail bones follow a spring-damper on the kart's turn rate and speed. They trail opposite the bend, swing back, and bounce on a jolt. Each bone gets less of the motion than the one before it, so the tip moves most.
6. **Reactions:**
   - **Blending:** each reaction is a pose (target rotations for the bones it uses) with a weight that blends in over **0.2 s** and back out over **0.25 s**.
   - **The arm on the wheel:** while a one-arm reaction plays, that arm's IK weight goes to 0 and the other hand stays on its grip.

   | Reaction | When | Pose | Arms off the wheel | How long |
   | --- | --- | --- | --- | --- |
   | `spin` | `k.spin` | both arms up, the head shakes | both | while spinning |
   | `win` | finished first | left-fist pump (repeats), chest up | left | while the finish shows |
   | `sad` | finished, not first | slumped: chest forward 15°, head down 20° | none | while the finish shows |
   | `throw` | `used` is Bouncer, Seeker or Bomb | right arm overhand forward (wind-up, then release) | right | 0.5 s |
   | `drop` | `used` is Banana, Web or Oil | left hand reaches back over the shoulder, then opens | left | 0.5 s |
   | `use` | `used` is Turbo, Gold Turbo, Shield, Star, Coin Bag, Magnet or Hover | a quick right fist up | right | 0.4 s |
   | `point` | `used` is Thunder, Freeze or Swap | right arm points ahead | right | 0.5 s |

   - **Priority:** `spin` > `win` / `sad` > the item reactions. A higher one takes over by blending, never by snapping.
7. **Smoothing:** every bone's rotation eases to its goal through a critically damped spring (about 0.12 s to settle, 0.25 s for the tail). It works from the frame's time step, so it looks the same at any frame rate.

**Kept:**

- the kart's wheels (roll and steer);
- the lean, spin-out, shrink, player ring and tags;
- the placeholder for racers without a model, and its swap when a model loads.

**Cloning:** each kart clones the model with `SkeletonUtils.clone` (from `/vendor/three-addons/utils/SkeletonUtils.js`), so every Rex has its own bones, while the geometry and texture stay shared.

## Performance

Rex is one skinned mesh of 22 bones. Even with eight Rexes in a Cup, the extra work is small next to
the frame on a Steam Deck: the skinning runs on the graphics card, and each kart does a few dozen
spring updates and two IK solves. Draw calls stay at one for Rex and six for the kart (`steer` is
the new one).

## Testing

- **`body3d.js`, in a vm:**
  - the two-bone IK reaches a reachable grip within 0.01, and points straight at an unreachable one;
  - the springs settle at their goal, and look the same at 30 and 60 fps;
  - the choice of reaction and its priority;
  - the reaction weights blend in and out over the times above;
  - the tail trails the opposite way to the bend;
  - a one-arm reaction keeps the other arm's IK weight at 1.
- **Models:**
  - `rex.glb` has a skin with the 22 named bones and no more than 8,000 triangles;
  - `rex-kart.glb` has `steer`, `grip_l` and `grip_r` (the grips as children of `steer`) and no more than 10,000 triangles;
  - the 1024 texture is kept.
- **Server:** `used` names the kind for 600 ms after a use, then is `null`. Computer racers get it too.
- **Scene** (real Three.js, fake model with a skin):
  - after a turn, each hand bone's world position is within 0.02 of its grip;
  - a `throw` lifts the right hand off its grip and the left stays on;
  - disposing a kart frees only what that kart made.
- **Live check:** a race with Rex driven by the bots, with screenshots of steering, a throw, a drop and the finish. No console errors.

## Not in this work

- Keyframed animation clips.
- Rigs for the other racers (the same tools, and their own `joints`, later).
- Sounds.
- Facial animation, and fingers that grip one by one.
