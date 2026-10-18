# Party Board: 3D board environments (art brief)

Requirements for building one **environment model per map**: the ground, the scenery and the
backdrop around the board, with real assets (trees, rocks, buildings, water) instead of today's
simple shapes. The game keeps drawing everything that moves or that the rules need (see
"What the game draws"); the environment is everything else.

## What's in this folder

| File | What it is |
| --- | --- |
| `blueprint-<map>.png` | Top-down plan of each map in world units (1 grid square = 1 unit): every space (numbered, coloured by type), the paths, the forks, the warps, the star spots, the **keep-out zones** (red haze) and the current ground edge. Build to this. |
| `layout.json` | The same data as numbers: every space's `x` / `z`, type, links, warps, forks and star spots, per map. Import it into Blender (or your script) to place markers. |
| `now-<map>-overview.jpg` | The board today from the overview camera (the end screen / bonus reveal). |
| `now-<map>-follow.jpg` | The board today from the gameplay camera (it follows the player whose turn it is). |

Regenerate the plans after a map change: `node tools/board-layout.mjs && python3 tools/board_blueprint.py`.

## The maps

| id | Name | Spaces | Forks | Warps | Today's look | Brief (make it eye-popping) |
| --- | --- | --- | --- | --- | --- | --- |
| `island` | 🏝️ Party Island (easy) | 28, one loop | 0 | none | sand oval in the sea, a lawn, 3 palms | Tropical party island: turquoise shallows and foam around the beach, lush palms and flowers, a tiki hut or two, a pier, beach balls and a boat in the water, a volcano-free sky. Bright and welcoming. |
| `lagoons` | 🌊 Twin Lagoons (easy) | 24 | 1 | none | sand, 3 ponds, palms, rocks | Two clear lagoons with reefs you can see into, wooden boardwalks, rope bridges, flamingos, a waterfall into a lagoon in the backdrop. |
| `pipes` | 🔧 Pipe Works (medium) | 30 | 2 | 9→17, 19→1 | riveted metal floor, green pipes, crates | Steampunk factory yard (matches the tiles): brass pipes and valves, gauges, cogs turning, steam vents, a clock tower and chimneys in the backdrop. |
| `haunted` | 👻 Haunted Maze (hard) | 32 | 3 | 11→3, 21→12 | dark ground, fog, dead trees, tombstones, lanterns, ghosts | Spooky but readable: twisted trees, graves, iron fences, a crooked mansion on a hill in the backdrop, a big moon, jack-o'-lanterns as light sources. |
| `volcano` | 🌋 Volcano Peak (expert) | 34 | 4 | 7→1, 17→2, 26→0 | basalt slab on a lava sea, a cone with smoke behind | Basalt plateau over glowing lava rivers, cracked rock, crystals, a huge erupting volcano filling the backdrop. |

All five maps fit in **x −9.7 … +9.7, z −5.5 … +5.5** (the spaces); paths run between them.

## Coordinates and scale

- **glTF, Y up, 1 unit = 1 unit** (the game does not rescale environments). Origin = the board centre.
- **+X** is right and **+Z** is toward the camera (down on the 2D board), as on the blueprints.
- **The ground's top surface is y = 0** wherever the board is: tiles sit on it, paths lie on it
  (y 0 … 0.12). Keep the play area flat (bumps under 0.05) inside the board's footprint plus a
  1-unit margin.
- Sizes for reference: a tile is **1.3 across** and about 0.2 tall; a figure is about **1.9 tall**
  (2.3 with its name tag); the star floats at about y 3.2; the die tumbles at y 3.4 … 6.4 above the
  roller; warp arcs rise to about 2.5 … 4 between their two spaces.

## Where you can build

- **Keep out** (red haze on the blueprints): nothing within **1.0 of a space centre** or **0.6 of
  a path's centre line**. Flat ground decals (sand ripples, cracks, grass) are fine there.
- **Inside the board** (between paths): props up to about **1.5 tall**, so they never hide a
  space from the gameplay camera, which looks down at about 45°.
- **Foreground** (z > 7.5): low only (under 1.5); the camera looks over this edge.
- **Sides** (|x| > 11): medium props, up to about 4.
- **Backdrop** (z < −10): go big: mountains, a volcano, a castle, a skyline, cliffs. This is
  what fills the top of the screen.
- **Ground extent:** cover at least **x −17 … +17, z −15 … +12**, so no edge shows. Beyond that,
  fade into water, lava, fog or a skirt. The game sets a background colour per map (today: island
  `#0b2a4a`, lagoons `#0c4a6e`, pipes `#111827`, haunted `#0f0a1a` with fog 26 … 55, volcano
  `#1c0a05` with fog 22 … 50), and those can change to suit your art.

## Cameras (what will be seen)

- **Gameplay:** follows the current player from about (0, 8, 8.5) above and behind them, 42° field
  of view, 16:9. Close-ups of every part of the board, so props near paths are seen up close.
- **Overview:** from (0, 17, 13) looking at the centre: the whole board and the backdrop.
- **Star and warp moments:** short swings to (0, 7, 7.5) above the star, or higher during a warp
  flight.

## Budgets (the hub runs on a Raspberry Pi)

The tiles and figures already use about 60k triangles, so each environment gets:

- **≤ 50,000 triangles** in total (the backdrop can be low-poly: it's far away).
- **≤ 12 materials** (each material is a draw call after the game merges parts by material).
  Share materials across props; use a texture atlas.
- **Textures:** one ground texture up to 1024 px, prop atlases up to 512 px, JPEG for anything
  without transparency. **≤ 2.5 MB per file** after slimming.
- **No lights, cameras or shadows** in the file: the game lights the scene (a sky/ground hemisphere
  light and a sun from (4, 10, 6)) and shadows are off for speed. **Bake ambient occlusion and
  soft shadows into the textures**: it's the cheapest way to make it pop.
- **Normals:** export them (smooth where things are round); the earlier models had none and render
  faceted.
- **Metals:** keep `metallic` at 0.5 or below. Full metal renders dark here, because the game
  doesn't use reflection maps (they cost a third of the frame rate).
- **No glTF extensions** (no Draco, KTX2, WebP in the file) unless we add the decoders first.

## Animation (optional)

Name nodes so the game can animate them cheaply (to be wired up when the environments are added):

| Node name starts with | The game will |
| --- | --- |
| `water` / `lava` | a gentle bob and a slow texture scroll (one big plane each) |
| `spin_` | spins slowly around its own Y axis (cogs, windmills, fans) |
| `bob_` | floats up and down (ghosts, boats, lanterns) |
| `sway_` | sways a little (palm tops, flags) |
| `glow_` | pulses its emissive colour (lanterns, lava cracks, windows) |

Keep each animated part a separate node with its pivot at its own centre.

## Files and delivery

- One file per map: `public/games/party-board/models/env-<map>.glb` (`env-island.glb`,
  `env-lagoons.glb`, `env-pipes.glb`, `env-haunted.glb`, `env-volcano.glb`).
- Slim it before adding: `python3 tools/slim_glb.py env-pipes.glb public/games/party-board/models/env-pipes.glb --tex 1024`.
- Check it against the plan: load `layout.json` markers in Blender, or crop the 70 px title bar
  off `blueprint-<map>.png` and lay it on a plane at y = 0, 36 × 30 units, centred at x 0, z −2
  (it spans x −18 … 18, z −17 … 13), then make sure nothing pokes into the red haze.
- Loading `env-<map>.glb` isn't in the game yet: it gets added with the first environment. Until a
  map has one, it keeps today's scenery (and Tile art "light" / "classic" keep it too, for slower TVs).

## What the game draws (don't model these into the environment)

The spaces (tile models + face art), the paths between spaces (planks / pipes / stone, per map),
the warp arcs, the player figures, the star, the die and number plate, the coin pops, and the
name tags. The 2D board is separate and doesn't use these models.
