# 3D handoff

Two Claude sessions share the 3D work:

- **The cloud session** (GitHub, no GPU, no Blender) builds the game: rules, server, phone controls,
  computer player, tests, and a TV scene made of simple shapes so it's playable and shippable on day
  one. It writes a brief here for anything that needs real art.
- **The local session** (on the owner's computer, with 3D tools) makes the models, scenery and
  animation from those briefs: Kart Race 3D, and any 3D that needs models or scenery.

The game logic never waits for the art, and the art never changes the rules.

## How a brief works

Each brief says what to make, where it goes, and how the game finds it. The local session can
change anything in the TV renderer (`public/games/<id>/host.js` or `public/games/minis/<id>.js`)
but not the server module, the views or the phone controls; if the art needs something from the
server (a new view field, an event to animate), note it under the brief and the cloud session adds it.

Conventions the game code already follows (Party Board does it this way, see `public/games/party-board/board3d.js`):

- Models are `.glb`, in `public/games/<id>/models/`, loaded with three.js's GLTFLoader (three 0.184,
  served from `/vendor/three-addons/`).
- Parts the code moves or recolours are **named meshes or empties** (for example `face`, `wheel_fl`,
  `start_line`). Write the names in the brief.
- Metres, +Y up, the model's front facing +Z, origin at its base. Keep the stand-in shapes as a
  fallback when a model fails to load.
- Glowing parts get `material.userData.glow = true` so HD graphics (`public/shared/hd3d.js`) blooms them.
- Steam Deck is the minimum target: keep the triangle count sensible, but don't lower the look for a Raspberry Pi.
- Player colours come from the game (P1 and P2), so leave a part to tint (a named material or mesh).

## Briefs

### Kart Race 3D (`kart-race-3d`)

Owned by the local session. Racer kart models (one per racer in `public/games/kart-race/racers.js`),
tracks built for 3D (hills, jumps, banked turns, bridges, tunnels) with the road, walls, start line,
boost pads and item rows marked as named meshes or empties. See `docs/DREAMS.md`. The server needs
height on the track for jumps and hills: ask here and the cloud session adds it.

#### Borrowing from open-source kart games (motion, effects, camera)

Rather than build every bit of motion from scratch, port tuned code from MIT-licensed kart games.
Checked 2026-11-18: each has an MIT `LICENSE` file.

| Take from | What | How |
|---|---|---|
| [ryancampbell/kart-royale](https://github.com/ryancampbell/kart-royale) (three.js, TypeScript) | `src/kart/Driver.ts`: the driver rig (steer, lean, pitch, duck under boost, look to the apex, jolt on a hit, all smoothed). `src/kart/Suspension.ts`, `Tyre.ts`: bounce, squash on landings, wheel spin and steer. `src/fx/Particles.ts`, `Trails.ts`, `Decals.ts`: sparks, dust, smoke, skid marks. `src/game/Camera.ts`: a chase camera that reacts to speed, drifts and hits. | **Port the code.** Strip the TypeScript types to plain JS (no build step here), and swap its kart for ours. `Particles.ts` uses the `simplex-noise` package (MIT): vendor it under `public/vendor/` or write a small noise function. |
| [eviltwo/UniKart](https://github.com/eviltwo/UniKart) (Unity, C#) | `KartModelController.cs` (~280 lines): body tilt, wheel spin and steer, hop, drift slide. `Kart.cs` (~400 lines): the rolling-sphere driving that handles slopes and jumps. | **Translate.** The model controller is plain maths and ports nearly line for line. The rolling-sphere driving is for the server (see below). |
| [JustInvoke/PowerslideKartPhysics](https://github.com/JustInvoke/PowerslideKartPhysics) (Unity, C#) | Drift-boost tiers, tyre marks (`TireMarkMaker.cs`), bump response (`KartBump.cs`), a turning steering wheel, kart sounds. | **Read for ideas, write fresh.** It's large and built on Unity's physics. |
| Lunakepio/Mario-Kart-3.js | Drift sparks, flames and glow. | **Look only.** React (doesn't fit), no `LICENSE` file (only a README badge), and Nintendo's models and names. |

Where it goes in our code (everything on the TV side):

- The driver rig: `rig3d.js` and `body3d.js` (they already pose Rex's hands and head; extend them with
  kart-royale's lean, pitch, duck, apex look and jolt). Keep the maths free of three.js so it stays
  testable, the way those files are now.
- Wheels, suspension, tilt and hop: `karts3d.js`, with the maths in `rig3d.js`.
- Sparks, dust, skid marks, boost flames: a new `fx3d.js`, loaded with the other scripts in `host.js`.
  Glowing parts get `material.userData.glow = true` for HD graphics.
- The camera: `geom3d.js` (the chase camera's maths) and `kart3d.js`.

What the animation can read: the view the TV already gets (each kart's position, angle, speed,
steering, drift and boost state, spin-outs, items). If a motion needs something the view doesn't
carry (a hop's start, a landing, how hard a hit was), note it under this brief and the cloud
session adds it to the server's view.

Order, one PR each, biggest win first:

1. The driver rig, for every racer (Rex first, then the placeholder racers).
2. Wheels, suspension, body tilt and the drift slide.
3. Drift sparks in tiers, skid marks, dust on grass, boost flames.
4. The camera.
5. Later, with the cloud session: hills and jumps. The driving runs on the server
   (`server/games/kart-race.js`), so UniKart's rolling-sphere idea is ported there, test-first,
   along with track height (`kart-tracks-3d.js`). The local session builds the tracks' shapes; the
   cloud session makes the server drive on them.

Rules for borrowed code:

- Keep the original's MIT copyright line at the top of each file that takes code from it, plus a
  line saying what changed ("ported to plain JS for Ark 2P Hub").
- List each source in `THIRD-PARTY-NOTICES.md` at the repo root (project, link, licence, our files
  that use it), with the full MIT text once per project.
- Ideas (tiers, how marks are drawn) need no credit; copied or translated code does.
- No assets from these projects (models, textures, sounds) unless their licence covers them too;
  never anything from Mario-Kart-3.js.
- Keep the Steam Deck smooth: particles pooled, skid marks in one mesh that recycles, no new
  per-frame allocations.

### Kart Race racers: a picture of each from the waist up (`kart-race`, `kart-race-3d`)

The setup's first screen is a racer select, like a kart game's: each player's pick is shown big on
their side. Today that's the round coin portrait. A picture of each racer from the waist (or chest)
up would make it feel like a proper select screen:

- One per racer, `public/games/kart-race/art/full/<racer id>.webp` (ids in `art/README.md`):
  transparent background, the racer facing slightly towards the middle, about 512 px tall, in
  the coins' style and colours. A pose with some character (a wave, arms crossed, a thumbs-up).
- Add the racer's id to `FULL` in `public/games/kart-race/racers.js`; the select screen shows the
  picture instead of the coin straight away (`.krs-big.full`, up to 15rem tall). Nothing else changes.
- Later, the same racers in 3D on the select screen (turning on a stand) would be the next step.

### Already playable with stand-in shapes

Each of these works today. Art would lift them; none of it changes play.

| Game | What it shows now | What art would add |
|---|---|---|
| Bowling (`ten-pin`) | Box lane, cylinder pins, a sphere ball | A real lane and gutters, pin and ball models, a bowler who steps and swings, an alley around it |
| Tower Stack (`tower-stack`) | Boxes on a box | A crane that swings the block, a city skyline that falls away as it rises |
| Curling (minis) | A flat sheet, cylinder stones | Stone models with handles, sweepers who brush in front of the stone, an arena |
| Archery (minis) | A ringed disc, line arrows | A bow and archer, a field with flags blowing the wind's way |
| Bumper Cars, Ice Sumo, Glass Bridge, Paint Grab, Penalty (minis) | Simple shapes | Car and player models, a goalkeeper who dives, scenery for each arena |
| Dungeon Duo | Box walls, shape heroes | Hero, slime and Warden models with walk and swing animations; tile sets per floor (Ice Caves, Armory) |
| Marble Maze | Box walls, a sphere | A wooden board, a glass marble, gates and conveyors with moving parts |

### New ideas

The 3D art ideas in `docs/MINIGAME-IDEAS.md` get a brief here once their base is built.
