# Ark 2P Hub

Jackbox-style 1v1 party games: the TV shows the game, each player's phone (or a gamepad) is the
controller. Node 20+ ES modules, Express + Socket.IO on the server, plain browser JS on the client
(no build step, no framework, no bundler). Three.js 0.184 for the 3D bits. Runs in one Docker
container, built for amd64 and arm64 (Raspberry Pi), so keep things light on the TV side.

## Commands

- `npm run dev`: server with `--watch` on http://localhost:3000 (TV at `/`, phones at `/play/`, admin at `/admin/`)
- `npm test`: every `test/*.test.js` (node:test, no extra runner)
- `node --test test/kart-race*.test.js`: one game's tests
- `node tools/games-catalog.mjs`: regenerate `docs/GAMES.md` (`test/catalog.test.js` fails until you do)

## Layout

- `server/games/<id>.js`: one game. Exports `{ id, name, tagline, category?, music?, needsPhone?, phoneOnly?, create(ctx) }`;
  the instance has `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`. The contract is
  documented at the top of `server/games/index.js`.
- `server/games/index.js`: the `GAMES` registry. Setup screens are added here with `withSetup(game, spec)`
  (see `server/games/options.js`); the game reads its choices with `settingOf(ctx, key, fallback)`.
- `server/games/minis/`, `server/games/board/`: Party Minigames / Micro Mayhem minis and Party Board maps.
- `public/games/<id>/host.js` (TV) and `player.js` (phone): IIFEs that call `Ark.register('host' | 'player', '<id>', {...})`,
  plus an optional `style.css` and shared helpers (`board.js`), loaded with `Ark.loadCss` / `Ark.loadScript`.
- `public/shared/`: `common.js` (the `Ark` helpers), steering / move pads, tilt and motion.
- `test/<id>.test.js`: game tests use `fakeCtx()` from `test/helpers.js` (manual clock: `ctx.advance(ms)`), and
  pass a fixed rng into the game class where randomness matters.

## Conventions

- Server state is the truth; views are plain objects. Never send one player's hidden info in the other's
  `playerView` (dice under the cup, ships, secret picks) or in `hostView` before the reveal.
- Timers only through `ctx.setTimeout` / `ctx.clearTimeout` (they are cleared when the game ends). Keep one
  `this.timer` and clear it on every phase change; rematch (`{ type: 'rematch' }` when `phase === 'over'`) calls `start()`.
- Validate every `onInput` field (type, phase, whose turn, integer ranges) and ignore bad input silently.
- Comments are short, plain-English, and explain the rules or the why; match the density of the file you're in.
- Every phone control should work with a gamepad on the TV too (`padHint`, cursors for local players).
  Motion/tilt needs the https page, so always offer a button or swipe fallback.

## Design tokens

The palette, radii and type sizes live as CSS custom properties at the top of `public/shared/common.css`.
In UI styles, use them instead of literal values:

- Surfaces and text: `--bg`, `--bg-2`, `--panel`, `--line`, `--text`, `--muted`, `--btn`.
- Players: `--p1`, `--p2`, and on phones `--me` (that phone's own colour, set in `public/play/play.css`).
- Meaning: `--good`, `--bad` (`--bad-strong`, `--bad-soft`), `--warn`. Dark text on a bright fill: `--on-bright`, `--on-good`, `--on-warn`.
- Radii: `--r-sm` 8px, `--r-md` 12px, `--radius` 18px, `--r-pill`. Type: `--fs-sm` … `--fs-2xl`.

Keep literal colours for game objects whose colour is the thing itself (a red wire, a Simon pad, a traffic
light, a gold coin), so a palette change doesn't repaint the game. Phones get the shared `.rematch` button
style from `play.css`: give your Rematch button `class="primary rematch"` and only add a margin if it needs one.

## When you change a game

1. Server module + its test (`npm test` must pass).
2. TV and phone renderers under `public/games/<id>/`.
3. The game's row in the **README.md** games table (keep the player-facing tone and detail level).
4. New game or minigame: `node tools/games-catalog.mjs`, and add helper files that don't start with the id to `EXTRA` in that tool.
5. A line for players in `CHANGELOG.md`, under the next desktop release's `## x.y.z` heading (add the heading if it
   isn't there; one version above the last release on GitHub). It's the app's What's new card and the release notes.

Commit messages: `Game Name: what changed, in plain words` (for example `Kart Race: smaller Star glow for the bigger karts`).
