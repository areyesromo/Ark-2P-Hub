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
