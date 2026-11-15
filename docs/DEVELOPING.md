# Developing Ark 2P Hub

For whoever works on the hub's code (the [README](../README.md) is for players and whoever sets it up).
The working rules for changing a game are in [CLAUDE.md](../CLAUDE.md).

## Local development

```bash
npm ci             # ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci skips the desktop app's Electron
npm run dev        # restarts on file changes
npm test           # every test (about a minute and a half on four cores)
npm run test:fast  # all but the slow computer-vs-computer games, for quick checks
npm run lint       # ESLint: undefined names, unused variables and the like (CI runs it too)
```

Open <http://localhost:3000/host/> in one window and
<http://localhost:3000/play/> in two others (or on your phone via your
computer's LAN IP).

## How it works

```
TV browser  /host  ◄──┐
                      ├── Socket.IO ──►  Node server (rooms + game logic)
Phone P1    /play  ◄──┤
Phone P2    /play  ◄──┘
```

- **The server is the source of truth.** Phones only send inputs
  (`{ type: 'tap' }`); the server runs the game and pushes a *view* to each
  screen. The TV gets the full picture, and each phone gets only what that player
  should see (e.g. Rock Paper Scissors picks stay secret).
- **Reconnects are built in.** Phones keep a seat token, so a locked screen,
  a refresh or a Wi-Fi blip drops you straight back into your seat. The TV
  resumes its room after a refresh too. A phone that lost its token (another
  browser, cleared storage) gets its seat back by joining under the same name
  while that seat shows *Reconnecting…*; while the player is still there, the
  name is taken.
- **Removing a player:** tap ✕ on their seat on the TV, then **Remove?** to
  confirm (their phone goes back to the join screen). With a controller,
  **Back** in the lobby frees the seats of phones that have left.
- **Room codes** are 4 letters; rooms are cleaned up after 30 idle minutes.

```
server/
  app.js, index.js        HTTP + Socket.IO setup
  sockets.js              the socket protocol (join, start game, input…)
  rooms.js                rooms, seats, running a game
  games/                  one file per game (pure logic, unit-tested)
public/
  host/                   TV page
  play/                   phone controller page
  games/<id>/host.js      how a game looks on the TV
  games/<id>/player.js    how a game looks/behaves on the phone
deploy/pi/                Raspberry Pi installer, compose, kiosk, updater, controller pairing
update.sh / update.ps1     pull from GitHub, rebuild and redeploy
```

## Adding a game

First check [`docs/GAMES.md`](GAMES.md): every game and minigame we have (what it is and its
files) and the ideas not built yet, so a new one doesn't repeat an old one. After adding one, run
`node tools/games-catalog.mjs` to update it (a test fails until you do).

1. **Logic:** create `server/games/<id>.js` exporting
   `{ id, name, tagline, category, create(ctx) }` (`category` is
   `'competitive'`, the default, `'board'` or `'casual'`). The instance implements
   `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`.
   Use `ctx.setTimeout` (cleared automatically when the game ends) and call
   `ctx.update()` whenever state changes. `ctx.players[slot].local` is true
   for controller players, who have no private screen (see `battleship`).
   `ctx.saved` is an object the room keeps between launches of your game.
   For match settings picked on a setup screen, declare
   `OPTIONS = { key: [default, ...choices] }` and use
   `server/games/options.js` on the server and `Ark.setup` on the TV and
   phones (see `word-race` and `mini-golf`): the room remembers the choice.
   Simpler: register your game wrapped in `withSetup(game, spec)` (see
   `server/games/index.js`) and read the choice with
   `settingOf(ctx, key, default)`: the hub draws the setup screen for you.
   Register it in `server/games/index.js`.
2. **TV:** `public/games/<id>/host.js` calls
   `Ark.register('host', '<id>', { mount(el), update(view) })`.
   For controller players, also give it a `padHint` string and a
   `pad(button, view, slot)` function that turns a button name (`A`, `B`, `X`,
   `Y`, `LB`, `RB`, `LT`, `RT`, `START`, `UP`/`DOWN`/`LEFT`/`RIGHT`) into the same
   input a phone would send, or `null`. Real-time games can add
   `padPoll({ held, stick }, view, slot)`, called every frame, for analog
   input (see `pong`). An optional `sounds(prev, view)` returns sound effect
   names to play when the view changes (see `public/host/sound.js` for the list).
3. **Phone:** `public/games/<id>/player.js` calls
   `Ark.register('player', '<id>', { mount(el, api), update(view) })`
   and sends inputs with `api.send({...})`.
4. Add a test in `test/` using the `fakeCtx()` helper (manual clock, no waiting).

**Adding a minigame** to Micro Mayhem or Party Minigames is smaller: write
`server/games/minis/<id>.js` (`{ id, kind: 'micro' | 'party', name, order, howTo,
durationMs, create(api) }`, see `server/games/minis/runner.js`) and its renderer
`public/games/minis/<id>.js` (`ArkMini.register(id, { host, phone, pad })`, see
`public/games/minis/mini.js`), then list it in `server/games/minis/index.js`.

`pong` is the template for real-time games (server physics loop, canvas on the
TV, touch strip on the phone), `reaction-duel` for timing games and
`rock-paper-scissors` for turn-based / hidden-information games.

## 3D art for Party Board

The tile faces live in `public/games/party-board/tiles/` (256 px WebP, one per
space type plus `star`), the 3D models in `public/games/party-board/models/`: `tile.glb` (one body
for every space; the face is swapped per type), `die.glb`, `star.glb` and `coin.glb`. For a new
tile model, export a `.glb` lying flat with its face up and a mesh named `face` (UV-mapped). Slim
any model before adding it with `tools/slim_glb.py` (drop unseen parts with `--drop`, shrink
textures with `--tex`; see the top of the script). Models load when the board starts; until then,
or if one is missing, the plain shapes stay.

Building 3D board environments (trees, buildings, backdrops) for each map: see the art brief,
blueprints and renders in [`docs/party-board-art/`](party-board-art/README.md).

## Roadmap ideas

**The plan: 2D on the Pi, 3D on the desktop**

The hub keeps running on a Raspberry Pi (Docker + the browser) with the **2D** Party Board: light,
no 3D engine needed. The **3D** board is the desktop experience, built for a Steam Deck as the
minimum and a gaming PC as typical:

1. ✅ **Desktop app**: Electron wraps the hub (the server inside the app, the TV screen
   full-screen, phones still join with the QR code); a Windows installer and a Linux AppImage for
   the Steam Deck, updating itself from GitHub releases.
2. **High graphics** in the app: ✅ the HD look (glow on what glows, reflections, sharper shadows,
   per TV); still to come: fog and mist, full-resolution textures, the full-detail characters; plus each map's environment
   model (`env-<map>.glb`, with `space_NN` anchors, `path_` / `pedestal` nodes and animated parts;
   see [`docs/party-board-art/`](party-board-art/README.md)).

**Done lately**: 🤖 a computer opponent (Easy, Normal, Hard) in every game that can have one, and a
teammate in the co-op games; 🏆 trophies and practice records; 🌍 online play through a quick
tunnel, with a remote screen; more co-op content (Dungeon Duo's Ice Caves and Armory, Marble Maze's
moving parts, Kitchen Rush's Food Truck); 🎳 Bowling, ten-pin in 3D; 🏗️ Tower Stack, co-op stacking; ✨ HD graphics; the computer's levels pulled further apart (Penalty Shootout, Bumper Cars, Crazy Eights, Dungeon Duo's Warden); four new minigames (Curling, Drum Beat, Musical Chairs, Archery).

**Next up: more to play together**

- **More minigames**, and more co-op games in the spirit of Tower Stack.
- **HD 3D models and textures** for the 3D board and minigames (part of the desktop plan above):
  richer scenery and the full-detail characters, with shadows turned back on
  (`scene3d(el, { shadows: true })`).

**More content**

- Even more quiz questions, shapes, words and holes: they're plain lists in
  `server/games/quiz-questions.js`, `shape-library.js`, `sketch-words.js` and
  `mini-golf.js` (COURSE), so adding your own is easy
