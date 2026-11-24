# Ark 2P Hub

Jackbox-style 1v1 party games: the TV shows the game, each player's phone (or a gamepad) is the
controller. Node 20+ ES modules, Express + Socket.IO on the server, plain browser JS on the client
(no build step, no framework, no bundler). Three.js 0.184 for the 3D bits. Runs in one Docker
container, built for amd64 and arm64. The TV side targets a Steam Deck as the minimum (the desktop app):
don't lower visual quality for a Raspberry Pi (pixel ratio, shadows, lights, textures).

## Commands

- `npm run dev`: server with `--watch` on http://localhost:3000 (TV at `/`, phones at `/play/`, Settings at `/admin/`, no password: home network only, and from Player 1's phone menu)
- `npm test`: every `test/*.test.js` (node:test, no extra runner). Needs `npm ci` first (`ELECTRON_SKIP_BINARY_DOWNLOAD=1` skips Electron)
- `npm run lint`: ESLint (`eslint.config.js`: real mistakes only, not style); CI runs it. A new shared browser global (`window.ArkSomething`) goes in its `ARK` list
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
  card and casino games go there, and in `RESUMES` too: they survive a restart).
- Resuming after a restart (`RESUMES`, `server/saves.js`): the room saves the game's own fields, so its state must be plain
  data, and a timer's callback is a method *name* stored in state (`runPhase(phase, ms, 'afterShot')`), not a function.
  A game with a clock gives `resumed(downMs)` to push its deadline back and arm its timer again. `test/resume.test.js`
  checks every game in `RESUMES`.
- `server/games/minis/`, `server/games/board/`: Party Minigames / Micro Mayhem minis and Party Board maps.
- `public/games/<id>/host.js` (TV) and `player.js` (phone): IIFEs that call `Ark.register('host' | 'player', '<id>', {...})`,
  plus an optional `style.css` and shared helpers (`board.js`), loaded with `Ark.loadCss` / `Ark.loadScript`.
- `public/shared/`: `common.js` (the `Ark` helpers), steering / move pads, tilt and motion.
- `test/<id>.test.js`: game tests use `fakeCtx()` from `test/helpers.js` (manual clock: `ctx.advance(ms)`), and
  pass a fixed rng into the game class where randomness matters.

## Solo games (the lobby's 1 player mode)

The lobby switches between 👥 2 players (the 1v1 games) and 👤 1 player (`room.mode`, `lobby:mode`).
The solo games came from Ark 1P Hub (now retired: `docs/MERGE-1P.md`) and live in `server/solo/`:
`server/solo/games/` (one player, so `onInput(input)` and `playerView()`; their contract is at the top
of `server/solo/games/index.js`, the `SOLO_GAMES` list), with 1P's own `options.js` (choices that
unlock), `looks.js`, `stats.js` (runs and bests, in `solo-stats.json`) and `achievements.js`.
`soloGame()` (`server/solo/adapter.js`) runs one on this hub's room: whoever picks it plays it
(`ctx.soloSlot`), the other seat watches. The room records each run and adds `best` and, at the
end, `record` to the views; the TV and phone draw the end screen (`Ark.soloOverHtml`), with the
game's own line from its renderer's `overHtml(view)`. A solo game with a 2P twin has "1P" after
its name and id for now (`trivia-1p`) until the pair is merged into **a game for both modes**: the 2P
game's module also exports a solo def under the same id (`soloSnake` in `snake.js`, listed in `SOLO_GAMES`),
`server/games/index.js` hangs it on the 2P game as `soloDef`, and the room picks the one for its mode
(`gameFor(id, mode)`, `soloGameOf(id)`; `room.gameDef` is the running one). `listGames()` has an entry for
each mode (same id, `solo` tells them apart), blurbs.js and the game guide take `'solo:<id>'`, its 1 player
preview picture is `preview-solo.jpg`, and one set of renderers draws both (`view.solo`; a mode whose screens differ a lot can hand over to its own file,
like `rush.js` in Anagram Duel and Reaction Duel, and Memory Match's `pairs.js`). Tests: `test/solo-*.test.js`, with 1P's `fakeCtx` in
`test/helpers-solo.js`. The TV's keyboard is a controller (`ArkPads.KEYBOARD`); a renderer's
`typing(key, view)` takes letters and digits. The solo daily challenge (`server/solo/daily.js`, the
`daily` game id in 1 player mode) deals the day's game through `ctx.challenge`. The solo pages are in
`public/solo/` (`/api/solo/*`), and the solo achievements show on the Trophies page.
Phone only (`/phone`, `phone:create`): a phone opens a room of its own with no TV (`room.noTv`), 1 player
mode for good, with the solo games marked `phone` (`true`, or `'split'`: the phone also gets the TV's view as
`tv` and draws the TV renderer above its controls; `play.js` `NO_TV`). A new solo game says which it is.

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

Themes (picked in Settings, served as `/theme.css`) live in `public/shared/themes/<name>.css`: they override
these tokens and restyle the hub's own screens (lobby, seats, game list, phone header, leaderboard, trophies) and
the frame around a match (`body.in-game`, `body.match-over[data-winner]`, `#winner-tag`, the shared `.scoreboard`
and `.rematch`), so a game that sticks to the tokens and shared pieces follows the theme for free. A game's own
finish line ("You win! 🏆", "X wins the match!") carries `class="ark-result"` (plus `won` / `lost` / `draw` where
it knows) so the themes can dress it: give a new game's finish the same. Their fonts are bundled in `public/shared/fonts/` (no internet needed).
Layouts (`public/shared/layouts/<name>.css`, picked apart from the theme and served after it in `/theme.css`) move the
lobby's parts about using only the tokens (and `--font-title`, which each theme sets), so any theme works with any layout;
their selectors start at `#lobby` / `#phone-games` to win over a theme's classic-layout rules. The list of looks and their
preview pictures is `public/shared/look-minis.js` (Settings and the TV's picker).

Keep literal colours for game objects whose colour is the thing itself (a red wire, a Simon pad, a traffic
light, a gold coin), so a palette change doesn't repaint the game. Phones get the shared `.rematch` button
style from `play.css`: give your Rematch button `class="primary rematch"` and only add a margin if it needs one.

## When you change a game

1. Server module + its test (`npm test` must pass).
2. TV and phone renderers under `public/games/<id>/`.
3. The game's row in the **README.md** games table (keep the player-facing tone and detail level). It is also what the
   setup screen's preview tells you (with its rows in the README's settings and controller tables): run
   `node tools/games-catalog.mjs` after changing them (it writes `public/shared/game-guide.json`).
4. New game or minigame: `node tools/games-catalog.mjs`, add helper files that don't start with the id to `EXTRA` in that tool,
   and a short lobby-card line (under 50 letters) in `server/games/blurbs.js` (the tagline is the preview's first box).
   Its setup screen's preview picture: `node tools/game-previews.mjs <id>` (needs Playwright; writes `public/games/<id>/preview.jpg`).
5. A line for players in `CHANGELOG.md`, under the next desktop release's `## x.y.z` heading (add the heading if it
   isn't there; one version above the last release on GitHub). It's the app's What's new card and the release notes.
   This goes for any change players notice (hub, desktop app), not only games.

Commit messages: `Game Name: what changed, in plain words` (for example `Kart Race: smaller Star glow for the bigger karts`).

Releases: once a PR with player-facing changes is merged (CI green), start the desktop build straight away, without asking:
the `desktop.yml` workflow on `main` with the version of the newest `## x.y.z` heading in `CHANGELOG.md` (if it isn't released
yet). It builds the AppImage and Windows installer and publishes the GitHub Release; the app's Update banner then offers it.

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
