# Party Board: 3D board environments (art brief)

Requirements for building one **environment model per map**: the whole board world (terrain,
plateaus, stairs, bridges, water or lava, props, the backdrop) as one `.glb`. The game keeps
drawing everything that moves or that the rules need (see "What the game draws").

**Target: the desktop app (Windows, Linux / Steam Deck).** The 3D board is the Steam / desktop
experience; the Raspberry Pi plays the 2D board. So build for a **Steam Deck as the minimum** and a
normal gaming PC as typical: detail, real materials and live lighting are welcome (see "Budgets").

## What's in this folder

| File | What it is |
| --- | --- |
| `blueprint-<map>.png` | Top-down plan of each map in world units (1 grid square = 1 unit): every space (numbered, coloured by type), the paths, the forks, the warps, the star spots, the keep-out zones (red haze) and the current ground edge. A starting point: spaces may move (see "Anchors"). |
| `layout.json` | The same data as numbers: every space's `x` / `z`, type, links, forks and star spots, per map. |
| `now-<map>-overview.jpg` | The board today from the overview camera (the end screen / bonus reveal). |
| `now-<map>-follow.jpg` | The board today from the gameplay camera (it follows the player whose turn it is). |

Regenerate the plans after a map change: `node tools/board-layout.mjs && python3 tools/board_blueprint.py`.

## The maps

Spaces can move anywhere (any height, on plateaus, stairs or bridges); **the links can't**: each
space must keep the same number, the same neighbours, the same forks, warps and star spots.

| id | Name | Spaces | Forks (space → choices) | Warp spaces | Star spots | Brief |
| --- | --- | --- | --- | --- | --- | --- |
| `island` | 🏝️ Party Island (easy) | 28, one loop | none | none | 2, 7, 12, 19, 25 | Tropical party island: turquoise shallows, palms, tiki huts, a pier, karst islands and a boat in the backdrop. Bright and welcoming. |
| `lagoons` | 🌊 Twin Lagoons (easy) | 24 | 7 → 8 / 14 | none | 2, 9, 12, 19 | Two clear lagoons with reefs, boardwalks, a rope bridge (a good spot for the fork's risky branch), flamingos, a waterfall in the backdrop. |
| `pipes` | 🔧 Pipe Works (medium) | 30 | 4 → 5 / 23, 14 → 15 / 28 | 9, 19 | 2, 7, 14, 20 | Steampunk factory (matches the tiles and miniatures): catwalks, an iron arch bridge, furnaces, gears and gauges, a clock tower and chimneys in the backdrop. |
| `haunted` | 👻 Haunted Maze (hard) | 32 | 5 → 6 / 23, 12 → 13 / 26, 18 → 19 / 30 | 11, 21 | 9, 15, 20, 27 | Spooky but readable: chasms with stone and plank bridges, graves, iron fences, glowing pumpkins, ghosts, a mansion on a hill and a big moon. |
| `volcano` | 🌋 Volcano Peak (expert) | 34 | 2 → 3 / 24, 9 → 10 / 27, 14 → 15 / 30, 19 → 20 / 32 | 7, 17, 26 | 6, 15, 22, 31 | Basalt plateaus over lava rivers, glowing lava-crack paths, stairs and arch bridges, crystals, a huge erupting volcano behind. |

A warp sends the player to a random space (it flies there), so warps need no pipes or lines.

## Coordinates and scale

- **glTF, Y up, 1 unit = 1 unit** (the game doesn't rescale environments). Origin = the board centre.
- **+X** is right and **+Z** is toward the camera (down on the 2D board).
- **A tile is 1.3 across** (not 1 unit) and about 0.2 tall. A character miniature is about
  1.9 tall (2.3 with its name tag; 1.6× that on the victory pedestal). The star floats about 3 above
  its tile, the die tumbles 3.4 … 6.4 above the roller, and a warp flight arcs up to about 8.
- Today's spaces span about **x −9.7 … +9.7, z −5.5 … +5.5**; keep the board roughly that size so
  the cameras frame it. Ground or skirt should cover at least **x −17 … +17, z −15 … +12**; the
  backdrop (a volcano, mansion, clock tower, cliffs) goes beyond **z −10**.

## Anchors and named nodes

| Node name | What the game does with it |
| --- | --- |
| `space_00` … `space_NN` | **Required.** An empty node at each tile's centre, on the walking surface, at any height (two digits: `space_07`). The tile and the figures go there; hops arc between anchors (up stairs, across bridges). |
| `path_…` | Your own paths between spaces (glowing lava cracks, planks, grated catwalks). If any exist, the game stops drawing its own links. |
| `pedestal` | Optional: where the winner stands at the end (the top of your podium). Without it, the game builds its own pedestal at (0, 0, −8). |
| `lava…` / `water…` | A slow texture scroll and a gentle bob. |
| `spin_…` | Spins slowly around its own Y axis (gears, windmills, fans). |
| `bob_…` | Floats up and down (ghosts, boats, turtles, lanterns). |
| `sway_…` | Sways a little (palm tops, flags, ropes). |
| `glow_…` | Its emissive colour pulses (lanterns, pumpkins, furnaces, lava cracks, windows). |

Keep each animated part its own node with its pivot at its own centre. (The game reads these when
environment support lands; until then the names do no harm.)

## Where you can build

- **Keep out:** nothing within **1.0 of a space anchor** or **0.6 of a path's centre line**
  (flat decals are fine there).
- **Between paths:** props up to about **1.5 above the nearby walking surface**, so they never
  hide a tile from the gameplay camera, which looks down at about 45° from about 8 up and 8.5
  behind the current player. Tall cliffs right in front of a lower path can hide its tiles.
- **Front edge** (z > 7.5): keep it low. **Sides** (|x| > 11): medium. **Backdrop** (z < −10): go big.

## Cameras (what will be seen)

- **Gameplay:** follows the current player from about (0, 8, 8.5) relative to them, 42° field of
  view, 16:9 (16:10 on the Steam Deck's own screen). Every part of the board is seen up close.
- **Overview:** from (0, 17, 13) looking at the centre: the whole board and the backdrop.
- **Star, warp and victory moments:** swings to the star, follows a warp flight, then frames the
  pedestal beside the recap card.

## Budgets (desktop app: Steam Deck minimum)

- **Triangles:** up to about **400,000 per environment** (the tiles, characters and props add
  roughly 100k). Reuse meshes (rocks, pillars, crystals, crates, trees) as instances where you can.
- **Materials:** PBR (base colour, normal, roughness / metallic, emissive), up to about 40.
  Real metal is fine now (the desktop game uses reflections).
- **Textures:** up to **2048 px** (4096 for one hero texture, e.g. the ground), PNG or JPEG.
  Aim for **≤ 60 MB per file**.
- **Lighting:** the desktop game lights the scene live (a sun with real shadows, sky light, glow on
  emissive parts, fog). So: no lights or cameras in the file; give glowing things an **emissive**
  colour (lava, furnaces, pumpkins, windows, lanterns); baked ambient occlusion is still welcome for
  depth.
- **Normals:** export them (smooth where things are round).
- **No Draco / KTX2 / WebP inside the file** for now (we can add the decoders later if files get big).
- **Characters and props:** your full-detail originals are fine on desktop (no need to cut them
  down to 11k triangles); keep a copy of each source file.

## Files and delivery

- One file per map: `env-<map>.glb` (`env-island.glb`, `env-lagoons.glb`, `env-pipes.glb`,
  `env-haunted.glb`, `env-volcano.glb`).
- Big desktop assets will ship **inside the desktop app**, not in the Pi's Docker image (the Pi plays
  2D and never downloads them). Until the app exists, they go in `public/games/party-board/models/`.
- Check each file against its map: every `space_NN` present, the numbers matching the table above,
  nothing in the keep-out zones.

## What the game draws (don't model these into the environment)

The space tiles (tile model + face art: they change during play), the warp flights, the player
figures (the engineer and mechanic miniatures), the star, the die and number plate, the coin pops,
the name tags and, unless you add `path_` nodes, the paths between spaces. The 2D board is separate
and doesn't use any of this.
