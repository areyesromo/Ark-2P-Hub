# Plan: one app — 1P's games inside Ark 2P Hub, on 2P's engine

**Goal.** One app that behaves exactly like Ark 2P Hub, with a **1 player / 2 players** switch in
the lobby. The switch only changes the game list:

- **2 players** (as today): the 1v1 games, against each other or the CPU.
- **1 player**: the solo games (1P's 39: beat your own best, no CPU). The 2P-only games are hidden.

There's one address, one set of players (names, avatars, trophies), and one lobby, room,
Settings page, theme, desktop app and Docker image. When 2P changes (the lobby, themes, rooms,
controllers, the desktop app, online play), the solo games change with it, because they run on the
same engine. No `/1p/` or `/2p/` addresses: the mode is a lobby choice, not a separate site.

## The idea: move the games, keep 2P's engine

1P's **games** move into 2P. 1P's **hub** (its rooms, sockets, lobby, pages and desktop app) is
retired. What 1P's hub did that 2P doesn't (scores and bests, achievements, the daily challenge,
unlockable looks) is added to 2P once, as the solo mode's features.

To keep this cheap, the 39 solo games are **not rewritten**. A small adapter, `solo(game)` on the
server, lets a 1P game module run on 2P's room. 1P's TV and phone screens run in 2P almost
unchanged, because they already use the same `Ark.register` / `loadCss` / `loadScript` / setup
screen API as 2P's, and the same design tokens (so 2P's themes dress them for free).

### Server: the adapter (`server/games/solo.js`)

| 1P game expects | 2P room gives | The adapter |
| --- | --- | --- |
| `onInput(input)` | `onInput(slot, input)` | passes the playing seat's input on, ignores the other seat |
| `playerView()` | `playerView(slot)` | the game's view for the playing seat, "watching" for the other |
| `ctx.player` | `ctx.players[slot]` | the playing seat's player |
| `ctx.settings`, `settingOf`, `withSetup` | the same (both hubs have them) | nothing |
| `ctx.best(variant)`, `ctx.achievements()`, `ctx.daily`, `ctx.saved`, `ctx.rng` | (new) | given by the room's new solo services (below) |
| `score: { better, unit }`, phase `'over'` with `score` | (new) | the room records a **run** (below) |

### Server: what 2P's room learns (once, for every solo game)

- **Mode.** `mode: 'solo' | 'duo'` on the room, switched from the TV or a phone. In solo mode one seated
  player is enough to start (2P's room now waits for two), and the lobby lists the solo games.
- **Runs and bests.** When a solo game ends, the room records a run (name, game, variant, score) and
  works out the best and the hub's top 10, like 1P's room does. Bests show on the lobby cards, in
  the game, and on the end screen ("🎉 New best!"). This is 1P's `stats.js` run store, moved in
  next to 2P's match store, in the same data folder.
- **Achievements.** 1P's 131 achievements become 2P **trophies**: one Trophies page, with a Solo
  section.
- **The daily challenge, unlockable looks, Collection, Calendar, My stats.** These are 1P's pages
  and features, moved in and dressed in 2P's themes.

### TV and phone

- 1P's `public/games/<id>/` folders move into 2P's `public/games/`.
- 1P helpers that 2P's `Ark` lacks are added to 2P's `common.js`: `formatScore`, `clock`,
  `bestLine`, `recordHtml`, `unlockedHtml`, the daily card, and the solo groups (🕹️ Arcade, 🧩 Puzzle,
  🧠 Brain).
- 2P's TV learns two renderer hooks that 1P's games use:
  - `overHtml(view)`, the game's line on the end screen
  - `typing(key, view)`, typing on the TV's keyboard
- **The keyboard as a controller** (arrows/WASD, Enter, Space…) comes to 2P's TV too, so a laptop or the
  Steam Deck's keyboard plays every game, 1v1 ones included.
- The end screen shows the solo result (score, best, top 10, unlocks) in solo mode, and the match
  result in duo mode.
- **The 1 player / 2 players switch** sits at the top of the TV lobby and the phone lobby (and works
  with a controller). Its choice is kept with the room.

### Users

Both hubs already know players **by name** (ignoring capitals), so the same name is the same
person: one player list, one set of avatars and trophies for both modes.

There's **no data import**. We're still testing, and the players' data lives in each app's data
folder, not in the repo, so the merged app starts fresh.

## Things to decide or watch

1. **Solo games with a 2P twin.** 14 of the solo games are the same game at heart as a 2P one. For
   now each gets "1P" after its name and `-1p` after its id. Only Snake and Hangman actually clash
   by id, but the suffix on all of them marks the pairs to merge later (see 7), and keeps them apart
   in searches and records:

   | Solo game (1P) | Becomes | Its 2P twin |
   | --- | --- | --- |
   | Snake | Snake 1P (`snake-1p`) | Snake Battle (`snake`) |
   | Hangman | Hangman 1P (`hangman-1p`) | Hangman Duel (`hangman`) |
   | Word Guess | Word Guess 1P (`word-guess-1p`) | Five Letters |
   | Anagram Rush | Anagram Rush 1P (`anagram-1p`) | Anagram Duel |
   | Word Search | Word Search 1P (`wordsearch-1p`) | Word Hunt |
   | Mastermind | Mastermind 1P (`mastermind-1p`) | Code Breaker |
   | Trivia | Trivia 1P (`trivia-1p`) | Quiz Battle |
   | Memory Pairs | Memory Pairs 1P (`memory-1p`) | Memory Match |
   | Reaction Rush | Reaction Rush 1P (`reaction-1p`) | Reaction Duel |
   | Brick Breaker | Brick Breaker 1P (`breaker-1p`) | Brick Breaker Duel |
   | Asteroids | Asteroids 1P (`asteroids-1p`) | Asteroid Duel |
   | Blocks | Blocks 1P (`blocks-1p`) | Falling Blocks Battle |
   | Stack | Stack 1P (`stack-1p`) | Tower Stack (co-op) |
   | Minesweeper | Minesweeper 1P (`minesweeper-1p`) | Mine Duel (same field, a different goal) |

   Cousins, not twins (kept as they are): Quick Maths and Make 24 (both arithmetic, different
   games), and Colour Trap and Colour Clash (the names are alike, but Colour Clash is a card game).
   The other 23 solo games have nothing like them in 2P.
2. **Two players seated in solo mode.** Suggested: whoever picks the game plays it, and the other
   watches (their phone shows "watching"). A later extra: a **take turns** option, where both play
   the same game one after the other and compare scores.
3. **The CPU in solo mode.** None, as you asked. (A 2P game against the CPU is still one tap away
   in 2-player mode.)
4. **2P's online play and tunnel** in solo mode: off at first.
5. **1P's phone-only mode** (`/phone`, every game on the phone alone) moves in as a later step,
   reusing 2P's "📱 No TV needed" idea, for the solo games first.
6. **Tests.** 1P's 324 tests move in with the games, as `test/solo-*.test.js`, plus a `test/helpers-solo.js`
   for 1P's `fakeCtx` (the two hubs' helpers differ). Their import paths are rewritten by script. 2P's
   checks cover solo games too: the catalog, the README, lint, the "every game has a renderer" test.
7. **Later: games that work in both modes.** Where a solo game and a 2P game are the same game at
   heart (the 14 pairs in the table in 1, starting with Snake 1P and Snake Battle), they can become one
   game on 2P's engine that is played alone in 1-player mode (no CPU, scored like the solo games)
   and 1v1 in 2-player mode. The same logic can then give more 2P games a solo version. Each is its
   own PR after the merge (see step 6), so the merge itself stays a move, not a rewrite.
8. **2P's per-game rules** (blurbs, the games catalog and preview pictures, CHANGELOG lines) apply to
   the solo games as well. The catalog tool and README get a Solo section.

## The steps

Progress: **steps 1 to 3 done** (the engine on 2P, all 39 solo games, then their achievements, daily challenge and pages).

Each step is one PR to 2P that leaves the app working, with its `CHANGELOG.md` line. After each
merge, the desktop build is started as 2P's `CLAUDE.md` says.

1. **The engine, proved on three games** (the big one):
   - the solo mode on the room, the adapter, runs and bests, and the end screen
   - the helpers and hooks on the TV and phone, and the keyboard as a controller
   - the 1 player / 2 players switch
   - Dog Park, Reaction Rush and Snake moved over as the pilots, with their tests
   - Ends with: switch to 1 player, play Dog Park on 2P's lobby and theme, a best recorded.
2. **The other 36 games**, mostly by script: the files moved, ids renamed where they clash, tests'
   paths rewritten, the catalog, README, blurbs and preview pictures.
3. **Trophies and the rest:**
   - achievements as trophies, the daily challenge, and looks (with the Collection page)
   - the Calendar and My stats pages, in 2P's themes
4. **Phone-only for the solo games**, on 2P's terms.
5. **Retire 1P:** a last 1P release that says where it went, then archive the 1P repo. The next-games list (`docs/minigames-1p.md`) joins
   `docs/MINIGAME-IDEAS.md`, marked Solo.
6. **Then, one PR at a time: games for both modes.** Merge each solo/2P pair into one game
   (Snake 1P into Snake Battle first), and give chosen 2P games a solo version the same way.

## Rough size

| Step | Size | Why |
| --- | --- | --- |
| 1 Engine + 3 pilots | Large | the room's solo mode, the adapter, the run store, TV and phone hooks, keyboard, switch |
| 2 36 games | Medium, mostly scripted | moving files and renaming; each game checked in a browser |
| 3 Trophies, daily, looks, pages | Medium | 1P's code moved in, and fitted to 2P's pages and themes |
| 4 Phone-only | Medium | |
| 5 Retire 1P | Small | |
| 6 Games for both modes | Small to medium each | one pair or one 2P game per PR |

Step 1 is where the risk is: it touches 2P's room and lobby, which every 2P game uses. It's checked
by 2P's own tests and a browser run of 2P games as well as the new solo ones. After step 1, the
rest is mostly moving files.
