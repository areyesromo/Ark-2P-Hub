# Ark 2P Hub

Jackbox-style 1v1 party games: the TV shows the game, each player's phone (or a gamepad) is the
controller. Node 20+ ES modules, Express + Socket.IO on the server, plain browser JS on the client
(no build step, no framework, no bundler). Three.js 0.184 for the 3D bits. Runs in one Docker
container, built for amd64 and arm64. The TV side targets a Steam Deck as the minimum (the desktop app):
don't lower visual quality for a Raspberry Pi (pixel ratio, shadows, lights, textures).

## Commands

- `npm run dev`: server with `--watch` on http://localhost:3000 (TV at `/`, phones at `/play/`, admin at `/admin/`)
- `npm test`: every `test/*.test.js` (node:test, no extra runner). Needs `npm ci` first (`ELECTRON_SKIP_BINARY_DOWNLOAD=1` skips Electron)
- `npm run test:fast`: everything but the slow computer-vs-computer files (`bots-games*`, `kart-race-cpu`), for quick checks
- Computer-player tests: the harness is `test/helpers-bots.js`; a slow game goes in `HEAVY` there (its own `bots-games-*.test.js`) so it runs in parallel
- `node --test test/kart-race*.test.js`: one game's tests
- `node tools/games-catalog.mjs`: regenerate `docs/GAMES.md` (`test/catalog.test.js` fails until you do)

## Layout

- `server/games/<id>.js`: one game. Exports `{ id, name, tagline, category?, music?, needsPhone?, phoneOnly?, create(ctx) }`;
  the instance has `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`. The contract is
  documented at the top of `server/games/index.js`.
- `server/games/index.js`: the `GAMES` registry. Setup screens are added here with `withSetup(game, spec)`
  (see `server/games/options.js`); the game reads its choices with `settingOf(ctx, key, fallback)`.
- Lobby folders: `FOLDERS` in `server/games/index.js` puts a game in 🎲 Board Games or 🃏 Cards & Casino (new board,
  card and casino games go there).
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
   This goes for any change players notice (hub, desktop app), not only games.

Commit messages: `Game Name: what changed, in plain words` (for example `Kart Race: smaller Star glow for the bigger karts`).

## 3D work and the ideas list

The cloud session builds games and their base (rules, server, phones, computer player, tests, a TV scene
of simple shapes). The owner's local session makes 3D models, scenery and animation (Kart Race 3D, and
any 3D that needs models or scenery). Write a brief for it in `docs/3D-HANDOFF.md`, and don't change the
rules for art. New minigame ideas live in `docs/MINIGAME-IDEAS.md` (the working backlog, unlike the bucket list).
When asked what to build next, pick from that list; only suggest brand-new ideas once it's empty.

## Bucket list

`docs/BUCKET-LIST.md` holds ideas the owner has parked for later (paid services, big maybes). Read it back only
when asked for it ("what's on the bucket list?"). Never include its items when suggesting what to build next or
answering "what else can we do"; add to it when the owner parks an idea.
