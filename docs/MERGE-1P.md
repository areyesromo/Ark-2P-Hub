# Plan: Ark 1P Hub inside Ark 2P Hub (one app for everything)

**Goal.** One app, one address, one port, one desktop app, one Docker image:

- `http://<hub>:<port>/2p/…` Ark 2P Hub (1v1 games, with a CPU opponent for most of them)
- `http://<hub>:<port>/1p/…` Ark 1P Hub (solo games: beat your best)
- `http://<hub>:<port>/` goes to `/2p/` by default
- A **1P ↔ 2P** switch on the TV and the phone, so you change mode without typing an address

## The approach: two hubs side by side in one server

Copying every 2P change into 1P (or every 1P change into 2P) would cost a lot. So we don't merge
the two **engines**. Each hub keeps its own code, rooms, Socket.IO, scores and pages, unchanged
inside. They only share the server process, the port, the desktop app and the Docker image.

- 2P's repo becomes the home of both. 1P moves in as a folder, `1p/`, laid out exactly as it
  is now (`1p/server`, `1p/public`, `1p/test`, `1p/tools`, `1p/CLAUDE.md`), so its files still
  find each other and its 324 tests still run as they are.
- `git subtree add --prefix=1p` brings 1P in **with its history**, so `git log 1p/` still tells
  its story.
- 1P's dependencies (express, socket.io, qrcode) are already 2P's, so `package.json` barely changes.
- Bringing things together (one admin page, shared avatars, shared helpers) comes later, piece by
  piece, and only where it pays off. Both hubs work the whole time.

Why not one engine? A real merge (one room type with 1 or 2 seats, one scoreboard, one renderer
API) would mean rewriting one hub's 40-odd games against the other's contract. That's weeks of
work for little the player would see. Side by side gets the "one app" result now.

## Where things go

| | Today | After |
| --- | --- | --- |
| TV screen | 2P `/`, 1P `/host/` (port 3001 in the desktop app) | `/2p/` and `/1p/host/` |
| Phones | 2P `/play/`, 1P `/play/` and `/phone` | `/2p/play/`, `/1p/play/`, `/1p/phone` |
| Pages | 2P `/stats/`, `/trophies/`, `/admin/`; 1P `/stats/`, `/achievements/`, `/collection/`, `/calendar/`, `/me/`, `/admin/` | the same under `/2p/` and `/1p/` |
| Socket.IO | `/socket.io` on each | `/2p/socket.io` and `/1p/socket.io` (two servers on one port) |
| Data | 2P `data/`, 1P its own `data/` | 2P stays in `data/` (no move for existing installs), 1P in `data/1p/` |
| Desktop app | two apps, ports 3000 and 3001 | 2P's app only, port 3000; opens `/2p/` (or the last mode used) |
| Docker | two images and containers | one (2P's), one port |

**Old addresses keep working.** `/play/`, `/host/`, `/stats/` and the rest redirect to their `/2p/`
place, so phones that saved a link and QR codes already printed or bookmarked still work.

## Things to watch

1. **Saved data in the browser gets shared.** 1P on port 3001 was a separate site to the browser.
   On one port, both hubs read the same saved data, and they use the same names: `ark.player`,
   `ark.host`, `ark.sound`, `ark.music`, and the `ark_player` cookie. Unchanged, a phone's 1P seat
   would overwrite its 2P seat. Fix: 1P's names get their own prefix (`ark1p.player` …), and its
   cookie is limited to `/1p/`. On first load, 1P's page moves an old `ark.phone` seat to the new
   name, so nobody gets logged out.
2. **Hard-coded addresses.** 1P's pages hold about 230 addresses that start with `/` (`'/games/…'`,
   `'/shared/…'`, `fetch('/api/…')`, links); 2P's hold about 380. A one-time script rewrites them to
   `/1p/…` and `/2p/…`, and a new test opens every page of both hubs and fails on any missing
   file. Addresses the server builds also get the prefix: the join link and QR code, the
   "switch to the secure page" link, and 1P's `/phone`.
3. **Two Socket.IO servers on one http server.** Each gets its own `path`, and each hub's pages
   connect with `io({ path: '/1p/socket.io' })` (or `/2p/`). The https-on-the-same-port wrapper
   (`dualProtocol`, which both hubs have) is set up once, around the shared server.
4. **Both hubs' `createApp()`** currently make their own http server and listen. They change to
   take a shared server and a base path (`createApp({ server, base: '/1p' })`), and to return an
   Express app that's mounted with `app.use('/1p', hub1p)`. Mounted that way, Express strips the
   `/1p`, so 1P's own routes (`/api/me`, `/phone` …) don't change.
5. **Settings both hubs need.** The join address (and the rest of 2P's Settings) should be set once.
   1P reads them from 2P's settings file (a small shim), and 1P's `/admin/` page redirects to 2P's.
6. **2P's online play and tunnel.** Decide whether `/1p/` is reachable through the tunnel too.
   Suggested: no at first. 1P is a living-room thing, and phone-only mode works on the home Wi-Fi.
7. **Lint and CI.** 2P runs eslint over the repo. `1p/` starts excluded, then gets fixed. `npm test`
   runs `test/*.test.js` and `1p/test/*.test.js`. 2P's `tools/test-fast.mjs` and the games catalog
   (`docs/GAMES.md`) learn about `1p/` too.
8. **The desktop app's name.** It stays "Ark 2P Hub" for now: renaming an Electron app moves its
   saved data and breaks auto-update unless it's migrated. A rename to "Ark Hub" can be its own
   step later.
9. **Games that exist in both.** Hangman, Snake, Anagram Rush / Anagram Duel, Mastermind / Code
   Breaker, Word Guess / Five Letters, Colour Trap / Colour Clash, Word Search / Word Hunt, and
   Asteroids, Breaker and Blocks against their duels. They all stay: 1P is "beat your best", 2P is
   "beat the other player or the CPU". The two `hangman` and `snake` folders don't clash, because
   each hub keeps its own `games/`.

## The steps

Each step is one PR that leaves both hubs working, with its line in `CHANGELOG.md`. After the merge, the
desktop build is started as 2P's `CLAUDE.md` says.

1. **Bring 1P in** (the big one, mostly done by scripts):
   - `git subtree add --prefix=1p` from the 1P repo.
   - 1P's `createApp` takes a shared server and the `/1p` base. A new `server/index.js` starts one
     server, mounts 2P at its current paths and 1P at `/1p/`.
   - The address-rewrite script runs over `1p/public`. Socket.IO for 1P moves to `/1p/socket.io`.
   - 1P's saved-data names get their prefix (see "Things to watch", 1).
   - 1P's data lives in `data/1p/`.
   - Tests: 1P's run alongside 2P's, plus the "every page loads" test.
   - `CLAUDE.md` gets a short `1p/` section, and `1p/CLAUDE.md` (1P's rules) comes along.
   - Result: 1P works at `/1p/` in the 2P app. 2P is untouched at `/`.
2. **Move 2P to `/2p/`:** the same script over `public/`, 2P's Socket.IO moves to `/2p/socket.io`,
   `/` redirects to `/2p/`, and the old addresses redirect. The desktop app and the Pi kiosk open
   `/2p/`.
3. **The 1P ↔ 2P switch:**
   - A button in both TV lobbies and both phone lobbies.
   - When the TV switches, a phone in its room gets "The TV switched to 1P, tap to follow". The tap
     takes it to the new room with its name filled in, using the new room code that the old room
     passes on, so there's nothing to scan.
   - The desktop app remembers the last mode.
4. **One of each setting:** one Settings page (2P's: join address, network, theme and layout), and
   1P's settings read from it.
5. **Retire the 1P app:**
   - 2P's desktop app imports the 1P app's scores, achievements and avatars into `data/1p/` on first
     start, if it finds the 1P app's data folder.
   - A last 1P release tells its users that 1P now lives inside Ark 2P Hub, and where.
   - The 1P desktop and Docker releases stop, and the 1P repo is archived (read-only).
   - Docker users get a one-line step to copy the old 1P volume into `data/1p/`.
6. **Tidy up later, when it's worth it:**
   - shared avatars and colours, so one profile serves both modes
   - one copy of the shared helpers (sounds, music, controllers, setup screens)
   - one "My stats" page across both modes
   - 1P's pages pick up 2P's themes and layouts (`/theme.css`)
   - lint on `1p/`
   - optionally renaming the app to "Ark Hub"

## Rough size

| Step | Size | Why |
| --- | --- | --- |
| 1 Bring 1P in | Large, mostly scripted | the server wiring, the address rewrite, saved-data names, tests, a full browser check of 1P |
| 2 2P to `/2p/` | Medium, mostly scripted | the same rewrite over 2P, redirects, desktop and Pi kiosk addresses, a browser check of 2P |
| 3 Switch | Small to medium | buttons, plus passing the room on to the phone |
| 4 Settings | Small | |
| 5 Retire 1P | Medium | the desktop data import is the careful part |
| 6 Tidy-ups | Optional, piece by piece | |

Steps 1 and 2 are the risky ones (every page's addresses change). They're done by scripts and
checked by the "every page loads" test plus a browser run through every page, not by hand.

## Decisions needed

1. **2P under `/2p/` (step 2) or 2P staying at `/`?** Suggested: do step 2, as you asked. The
   redirects keep old links working. The alternative (1P at `/1p/`, 2P staying at `/`) skips
   step 2 and its risk.
2. **The app's name:** keep "Ark 2P Hub" for now (suggested), or rename to "Ark Hub" now (needs a
   data move in the desktop app).
3. **1P over the internet** (2P's online play and tunnel): no at first (suggested), or yes.
4. **Until the merge is done:** pause new 1P features, and build them in `1p/` afterwards.
   Suggested: yes, so nothing gets built twice. The next-games list (`docs/minigames-1p.md` in the
   1P repo) then joins `docs/MINIGAME-IDEAS.md`, marked 1P.
