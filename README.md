# Ark 2P Hub

Jackbox-style **1v1 party games** for your living room. The TV shows the game,
and each player's **phone is the controller**. Nothing to install: phones
scan a QR code and play in the browser. Self-hosted in a single Docker
container on your home network.

<p>
  <img src="docs/screenshots/tv-lobby.png" alt="TV lobby with QR code, both players and the game picker" width="62%">
  <img src="docs/screenshots/phone-reaction.png" alt="Phone controller in Reaction Duel showing TAP!" width="17%">
  <img src="docs/screenshots/phone-rps.png" alt="Phone controller in Rock Paper Scissors" width="17%">
</p>

## Games

| Game | How it plays |
| --- | --- |
| **Reaction Duel** | The TV goes red… then GO! First tap wins. Tap early and your opponent gets the point. First to 3. |
| **Rock Paper Scissors** | Pick in secret on your phone; the TV reveals both. First to 3. |

## Quick start

### Docker (any machine on your network)

```bash
docker compose up -d --build
```

Then open `http://<server-ip>:3000/host/` in the TV's browser (a PC on HDMI,
a Google TV browser, or a Raspberry Pi; see below). Phones scan the QR code.

If the TV page is opened as `http://localhost:…` (for example on the server
itself), set `PUBLIC_URL` in `docker-compose.yml` to the address phones should
use, so the QR code points somewhere reachable.

### Raspberry Pi 4 as an all-in-one console

The Pi runs the server *and* shows the TV screen in kiosk mode, and updates
itself from GitHub. Full guide: [docs/raspberry-pi.md](docs/raspberry-pi.md).

### Local development

```bash
npm install
npm run dev        # restarts on file changes
npm test
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
  resumes its room after a refresh too.
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
deploy/pi/                Raspberry Pi compose, kiosk and auto-update files
```

## Adding a game

1. **Logic:** create `server/games/<id>.js` exporting
   `{ id, name, tagline, create(ctx) }`. The instance implements
   `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`.
   Use `ctx.setTimeout` (cleared automatically when the game ends) and call
   `ctx.update()` whenever state changes. Register it in
   `server/games/index.js`.
2. **TV:** `public/games/<id>/host.js` calls
   `Ark.register('host', '<id>', { mount(el), update(view) })`.
3. **Phone:** `public/games/<id>/player.js` calls
   `Ark.register('player', '<id>', { mount(el, api), update(view) })`
   and sends inputs with `api.send({...})`.
4. Add a test in `test/` using the `fakeCtx()` helper (manual clock, no waiting).

`reaction-duel` is the best template for real-time games and
`rock-paper-scissors` for turn-based / hidden-information games.

## Notes

- Reaction times are measured on the server, so they include Wi-Fi latency
  (usually a few ms on a LAN). It's the same for both players.
- Phone screen wake-lock and vibration work where the browser allows it;
  iOS needs HTTPS for wake-lock, so put a reverse proxy (e.g. Caddy) in front
  if you want that.

## Roadmap ideas

- Bluetooth/USB gamepad support on the TV (Gamepad API) as an alternative to phones
- Real-time games: Pong, Tron light-cycles, air hockey (touch joystick)
- Quiz / trivia battle, drawing duels
- Sounds, match history and a persistent leaderboard
