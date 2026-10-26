# Kart Race 3D: design

Date: 2026-10-25. Status: draft for review.

## Goal

A new game, **Kart Race 3D** (`kart-race-3d`), with its own tile in the hub: the Kart Race the players
already know (same racers, tyres, tracks, items, Race and Battle modes, phones and gamepads as
controllers), shown on the TV as a split-screen 3D race with a chase camera behind each kart.

The 2D **Kart Race** stays as it is, as its own game.

Success looks like:

- Both players can play every Kart Race mode (one race, best of 3, cup, Battle) in 3D, at a steady 60 fps on
  the Steam Deck (the low end; the 3D game is not meant for the Raspberry Pi).
- What you see is what you hit: the 3D road, walls and karts line up with the server's physics exactly.
- Racers get proper 3D models made with ComfyUI and Blender, one at a time, with no waiting on them to play.
- Later, crazy tracks with bumps, twists and turns can be added to the 3D game without rewriting its view.

## Decisions

| Question | Decision |
| --- | --- |
| Engine | three.js in the hub (the desktop app's TV is already a browser window). Not Unity. |
| Relation to 2D Kart Race | A separate game and tile; the server subclasses the 2D engine (`KartRace`), so physics, items, modes and racers stay shared. |
| Camera | Split-screen chase cameras: P1 left, P2 right. |
| Track height | Flat for now (the server's physics stays 2D). The view reads height from one `heightAt(x, y)` hook (0 for now) so bumpy tracks can come later. |
| World | Hybrid: road, kerbs, walls, grass, pads and boxes are built in code from the shared track data; scenery, props and racers are GLB models from ComfyUI + Blender. |
| Racers at launch | Code-built placeholder karts (one per kart shape, in the racer's colour); models replace them racer by racer. |

## Architecture

### Server: `server/games/kart-race-3d.js`

- `class KartRace3D extends KartRace`. It changes nothing in the rules for now; it exists so the 3D game
  has its own id, setup memory, records and stats, and a place to override parts (track height, new tracks)
  later.
- Default export `{ id: 'kart-race-3d', name: 'Kart Race 3D', tagline, create }`; the tagline says it is
  best on a PC or Steam Deck. Registered in `server/games/index.js` next to Kart Race.
- Its records (lap records, best starts, cup wins) are kept apart from the 2D game's. The plan checks how
  `server/stats.js` keys them (lap records are by track name today) and keys the 3D ones by game.
- Any small change to `kart-race.js` needed to allow the subclass (for example the game id it reports in
  stats) is made there, with the 2D game's behaviour unchanged and its tests passing untouched.

### Phone: `public/games/kart-race-3d/player.js`

The phone controller is the 2D game's one. `public/games/kart-race/player.js` is changed to register its
renderer under both ids (`kart-race` and `kart-race-3d`), or the 3D folder's `player.js` loads it and
registers it again, whichever fits how `Ark.register` and the phone's script loading work. No change for
players.

### TV: `public/games/kart-race-3d/`

- `host.js`: registers the 3D game's TV. Draws the 3D scene filling the screen, with the HTML HUD on top
  (gauges, items, positions, lap times, start lights, overlays, scoreboard), laid out per half.
- The setup, ready, HUD and scoreboard HTML that the 2D TV builds today move into a shared file
  (`public/games/kart-race/screens.js`) used by both TVs. The 2D game looks and behaves the same.
- The 3D code, each file with one job:
  - `kart3d.js`: the scene, the two cameras, the draw loop, smoothing between server views.
    `KR3D.create(el) -> Promise<{ update(view), dispose() }>`, as Party Board's `board3d.js`.
  - `world3d.js`: road, kerbs, tyre walls, grass, boost pads, start line and scenery placement.
  - `karts3d.js`: one racer + kart per player (GLB or placeholder) and its motion and effects: lean in
    bends, drift sparks, spin-outs, shield, star, shrink, freeze, hover, Battle balloons.
  - `things3d.js`: ? boxes, coins, bananas, webs, oil slicks, shots (bouncer, seeker, bomb) and blasts.
  - `geom3d.js`: the maths, with no three.js in it, attached to `globalThis` like `track.js` so the server's
    test runner can check it: road strip, wall placement, prop placement, smoothing, camera clamping.
- `style.css`: split-screen frame and the HUD halves, using the hub's design tokens.

## Rendering

- **Split-screen.** One WebGL renderer draws the scene twice a frame, into the left and right halves
  (scissor + viewport), each half framed by a thin `--p1` / `--p2` border. `ArkMini.scene3d` draws through
  one camera today; it gets an optional custom-draw hook, and its current users are unchanged.
- **Chase camera.** Behind and a little above the kart, following on a spring, looking slightly ahead into
  bends, widening its field of view a little on a boost. It does not spin with a spin-out, and is pulled in
  front of any tyre wall between it and the kart. In Battle it sits higher and further back.
- **Smoothing.** Views arrive about 30 times a second; the screen draws at 60. Karts are drawn about 50 ms
  behind the newest view, blended between the two around that time. A jump bigger than a kart could drive
  in one view (a new race, a new track) snaps instead of blending.
- **Coordinates.** Field point (x, y) on the 32 x 18 field is (x, heightAt(x, y), y) in the scene, 1 unit =
  1 metre (a kart is 1.75 long). Models are scaled to the kart's hit capsule.
- **Budget (Steam Deck).** 60 fps; pixel ratio capped at 1; one sun shadow around the karts, switched off if
  frames run long; scenery merged into few draw calls, repeated props instanced; about 15k triangles and a
  1024 px texture per racer; no post-processing. `?fps` in the TV's address shows a frame counter.
- **Look.** Bright, cartoon colours like the 2D art: red and white kerbs, striped tyre walls (as the 2D
  barrier pattern), a sky gradient and distance fog.

## Model pipeline

Per racer, starting from its 2D portrait so the 3D cast matches the art players know:

1. ComfyUI, Qwen image edit: `art/portraits/<id>.webp` -> the character sitting in their kart (shape and
   colour from `racers.js`), three-quarter view, plain background.
2. Qwen image edit: front, side and back views of it; BiRefNet removes the backgrounds.
3. Hunyuan3D-2 multi-view for the shape, or Pixal3D / TRELLIS 2 for a textured model in one go (~16 min).
4. `tools/kart-model.py`, run with `blender -b -P`: join the parts, drop vertex colours and loose bits,
   decimate to about 15k triangles, downscale the texture to 1024 px, face +X, origin at the kart's middle
   on the ground, scale to the 1.75 kart length, export `public/games/kart-race-3d/models/<id>.glb`.
   It prints triangles, texture size and file size against the budget.

Racer and kart are one rigid model: the code leans it, bounces it, wobbles it and spins it. The wheels do not
turn.

Props (? box, banana, bomb, seeker, bouncer) and scenery (trees, tyre stacks, grandstand, start gantry) are
made the same way from z_image pictures. Each has a code-built stand-in.

In the repo: the ComfyUI workflows as JSON under `tools/comfy/`, and `public/games/kart-race-3d/models/README.md`
with the prompts, steps, budgets and which models are done. The 3D code keeps a list of the models that exist;
anything not on it uses its stand-in, and a model that fails to load does too.

## Errors

- No WebGL, or the 3D code fails to load: the TV says "3D isn't available on this screen" with a hint to
  play Kart Race instead. Players can still leave or change game as usual.
- WebGL context lost during a race: the same message.
- A model fails to load: its stand-in stays.
- The scene is disposed on the end screen and when leaving the game (frees the GL context, as Party Board
  does). A rematch on the same track keeps it; a new track rebuilds the world.

## Testing

- `test/kart-race-3d.test.js` (with `fakeCtx()`): the game is registered, reports its own id, plays a race and a
  Battle round to the end like Kart Race, and its records are kept apart from the 2D game's.
- `geom3d.js` tests: the road strip matches the server's road edges, walls sit where `ArkKartTrack.barriers()`
  puts them, props never land on the road, smoothing blends and snaps correctly, the camera stays in front of
  the walls.
- The 2D game's tests pass unchanged after the shared-screens and subclass changes.
- Visual check: the dev server, a race and a Battle played in the built-in browser, with screenshots.
- Frame rate on the Steam Deck: checked by the owner with `?fps`.

## Build order

One PR each:

1. **New tile, playable 3D.** Server subclass and registration, shared screens, phone registration, the
   split-screen chase cameras, flat road + walls + grass from the track data, placeholder karts, smoothing,
   the no-WebGL message.
2. **Items and effects.** Boxes, coins, bananas, webs, oil, shots, blasts, kart status effects; Battle arenas
   and balloons.
3. **Scenery and polish.** Prop placement, sky and fog, start gantry, shadow, `?fps`.
4. **Model pipeline.** `tools/kart-model.py`, the ComfyUI workflows, Rex as the first racer through it; the other
   11 follow one by one. Independent of 1-3.

Each PR also does the CLAUDE.md checklist: README row, `CHANGELOG.md` line, `node tools/games-catalog.mjs`
(and `EXTRA` in that tool for helper files that don't start with the game id).

## Later (not in this project)

- Tracks with height: bumps, banking, jumps and twists, which need height in the 3D game's physics.
- New 3D-only tracks.
- Animated wheels or rigged drivers.
