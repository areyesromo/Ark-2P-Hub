---
name: new-game
description: Add a new 1v1 game to Ark 2P Hub end to end (server module, registry, TV and phone renderers, test, README row, games catalog). Use with the game's name and a sentence on how it plays.
argument-hint: "<Game Name>: how it plays"
disable-model-invocation: true
---

# Add a game to the hub

The request: $ARGUMENTS

Read `CLAUDE.md` and the "Adding a game" section of `README.md` first; they are the contract. This skill is
the checklist so nothing gets missed.

## 0. Make sure it's new, and pick a template

- Check `docs/GAMES.md`: if the game (or something very close) already exists, stop and say so. If it is in
  the ideas list at the bottom, you will move it out of the ideas in step 6 (`test/catalog.test.js` fails
  when an idea has the name of a built game).
- Choose an `id` (kebab-case; its own prefix: `party-board` isn't `party`'s) and a category:
  `competitive` (default), `board` or `casual`.
- Copy the shape of the closest existing game rather than inventing one:
  - turn-based on a grid: `connect-four` (smallest full example: clock, rounds, rematch)
  - hidden information: `rock-paper-scissors`, `battleship`
  - real-time physics: `pong` (server loop, canvas on the TV, touch strip on the phone)
  - timing / reaction: `reaction-duel`
  - its own setup screen: `word-race`, `mini-golf`; otherwise use `withSetup` in the registry
- If it's really a 20-40 s minigame, it belongs in `server/games/minis/` instead (see the README); say so
  and ask before going on.

Agree the rules with the user in a few lines (win condition, rounds, timers, what each phone shows)
before writing code if the request leaves any of that open.

## 1. Server: `server/games/<id>.js`

- Header comment: the rules in plain English, as in `connect-four.js`.
- Export the game class and its pure helpers/constants (tests import them), then the default
  `{ id, name, tagline, category?, music?, needsPhone?, phoneOnly?, create: (ctx) => new Game(ctx) }`.
- Take `rng = Math.random` in the constructor so tests can fix it.
- Settings via `settingOf(ctx, 'key', DEFAULT)` when you register with `withSetup`.
- One `this.timer`, only `ctx.setTimeout` / `ctx.clearTimeout`, cleared on every phase change.
- `phase` drives everything (`'play'`, `'roundEnd'`, `'over'`, ...); `{ type: 'rematch' }` in `'over'` calls `start()`.
- Validate every input field; ignore anything out of turn or out of range.
- `hostView()` / `playerView(slot)`: plain objects. Nothing secret leaks to the other player or the TV early.
- Call `ctx.update()` after every state change.

## 2. Registry: `server/games/index.js`

Import it and add it to `GAMES`, wrapped in `withSetup(game, spec)` if players pick options
(first value of each list is the default). Place it near games of the same category.

## 3. Test: `test/<id>.test.js`

`node:test` + `assert/strict` + `fakeCtx()` from `./helpers.js`. Cover at least: a normal win, turn/input
validation, a timer running out (`ctx.advance(ms)`), the round/match end and rematch, and that hidden
info stays hidden in the other player's view. Run `node --test test/<id>.test.js` until it passes.

## 4. TV: `public/games/<id>/host.js` (+ `style.css`)

IIFE, `Ark.register('host', '<id>', { padHint, pad(btn, view, slot), sounds?(prev, view), mount(el), update(view), unmount() })`.
Big and readable from the sofa; uses `Ark.scoreboardHtml` and the `p1-text` / `p2-text` colours. Controller
players (`players[slot].local`) play from the TV, so `pad` must map buttons to the same inputs a phone sends.

## 5. Phone: `public/games/<id>/player.js`

IIFE, `Ark.register('player', '<id>', { mount(el, api), update(view), unmount() })`, inputs with
`api.send({...})`, light `api.vibrate` feedback. Thumb-sized targets; works in portrait. The end-of-match
button is `<button class="primary rematch">Rematch</button>` (styled once in `play.css`).

For both screens, style with the tokens in `public/shared/common.css` (see "Design tokens" in `CLAUDE.md`), not
literal colours or radii, except for game objects whose colour is the point (a red wire, a gold coin).

## 6. Docs

- Add the game's row to the right table in `README.md` (same voice: how it plays, controls, how you win).
- `node tools/games-catalog.mjs` to regenerate `docs/GAMES.md`; if the game uses helper files that don't
  start with its id, add them to `EXTRA` in `tools/games-catalog.mjs` first. Remove it from the ideas list if it was there.

## 7. Check

- `npm test` (whole suite, including the catalog test) passes.
- Start the server (`npm run dev`) and open the TV at `http://localhost:3000/` and two phones at `/play/`
  (separate browser tabs work) to play one match: start, a round, the end screen, rematch, back to the lobby.
  Say plainly if you couldn't do this step.
- Commit as `Game Name: new game, <one line on how it plays>` only when the user asks.
