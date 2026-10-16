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

The lobby groups games into **⚔️ Competitive** (head to head, one of you wins)
and **🎨 Casual** (you play together, nobody really loses).

### ⚔️ Competitive

| Game | How it plays |
| --- | --- |
| **Reaction Duel** | The TV goes red… then GO! First tap wins. Tap early and your opponent gets the point. First to 3. |
| **Rock Paper Scissors** | Pick in secret on your phone; the TV reveals both. First to 3. |
| **Pong** | The classic, in real time. Drag on your phone's touch strip (or use the stick) to move your paddle. The ball speeds up every hit. First to 5. |
| **Light Cycles** | Tron-style. Your cycle leaves a wall behind it: make your rival crash into it. Tap a side of the phone pad or swipe to turn. Cycles speed up as the round goes on. First to 3. |
| **Snake Battle** | Two snakes, one arena. Eat the glowing food to grow; hit a wall, yourself or your rival and you lose the round. After 60 seconds the longer snake wins. Same controls as Light Cycles. First to 3. |
| **Tank Duel** | Top-down tank battle with cover. Drive with the joystick, fire shells that bounce once off walls (trick shots, and watch out for your own). 3 hits and you're out; after 90 s the healthier tank wins. First to 3. |
| **Quiz Battle** | 10 trivia questions (science, geography, movies, music, sports, games and more). Answers stay secret until the reveal; a right answer scores 500 plus up to 500 for speed. Most points wins, and rematches don't repeat questions. |
| **Draw Duel** | A shape flashes up for 4 seconds, then vanishes: redraw it from memory on your phone. 125 shapes (basic shapes, pictures like a rocket or a cat, letters and numbers), never repeated until you've seen them all. Each drawing is scored 0–100% for how closely it matches (size and position don't matter); the TV shows both drawings live and overlays the real shape at the reveal. 5 rounds, most points wins. |
| **Battleship** | Hide your 5 ships on your phone (tap a ship, tap where it goes, tap it again to turn it, or shuffle), then take turns firing at the enemy grid. The TV shows both oceans with every hit and miss; ships stay hidden until sunk. 30 s per shot. Sink the whole fleet to win. |

### 🎨 Casual

| Game | How it plays |
| --- | --- |
| **Sketch & Guess** | One of you picks a secret word (easy, medium or hard, from 260) and draws it on your phone with colours, undo and an eraser; the other watches it appear on the TV and their own phone and types guesses (near misses get a "so close!"). Letters are hinted as time runs out. Team up for stars: faster and harder words earn more. 6 rounds, taking turns to draw. |
| **Air Hockey** | The whole table is on your phone too, upright and turned so your goal is at the bottom: slide your mallet and smash the puck into their goal. Watch the phone or the TV. First to 7. |

## Controllers

Each player can use a phone **or** a game controller. Mix and match: two
controllers, two phones, or one of each. Connect Xbox, PlayStation or most
other controllers (Bluetooth or USB) to the device showing the TV screen: the
PC on HDMI, the Raspberry Pi, or the Google TV box. Then:

| Where | Button | Does |
| --- | --- | --- |
| Lobby | **A** / **Start** | Join (takes a free seat as "Controller 1/2") |
| Lobby | **D-pad**, then **A** | Pick a game and start it |
| Lobby | **B** | Leave your seat |
| Any game | **Back / Select** | Back to the lobby |
| Reaction Duel | any face button, bumper or trigger | Tap |
| Rock Paper Scissors | **X** ✊ · **Y** ✋ · **B** ✌️ (or D-pad ← ↑ →) | Pick (stays secret, the TV only shows 🔒) |
| Pong | **Left stick** or **D-pad ↑↓** | Move your paddle |
| Light Cycles | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Air Hockey | **Left stick** or **D-pad** | Move your mallet (in TV directions) |
| Snake Battle | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Tank Duel | **Left stick** or **D-pad** to drive, **A** / **RT** / **RB** / **X** to fire | Point where you want to go; the gun faces where you drive |
| Quiz Battle | **A** / **B** / **X** / **Y** to answer, or the **D-pad** as a diamond (↓ A, → B, ← X, ↑ Y) | Answer tiles on the TV are coloured like the buttons |
| Draw Duel | **Left stick** or **D-pad** moves a cursor, hold **A** / **RT** / **RB** to draw, **B** undo, **X** clear, **Y** / **START** done | Phones draw with a finger, which is easier; the controller is for brave players |
| Battleship | **D-pad** aims at the enemy grid on the TV, **A** fires | A controller player's fleet is placed at random, since the TV can't keep it secret |
| Sketch & Guess | **A** / **B** / **X** / **Y** picks one of four words shown on the TV | Controller players always guess (the word has to stay secret from the guesser); wrong picks pause you for a moment |
| Game over | **A** / **Start** | Rematch |

Buttons use Xbox names. On a PlayStation controller A = ✕, B = ○, X = □, Y = △.
Browsers only notice a controller after one of its buttons is pressed, so
press A once if the TV says no controller is connected. Controllers rumble on
input where the browser supports it.

## Sound

The TV plays sound effects for every game: countdown beeps, GO, points,
bounces, crashes, explosions, splashes, right and wrong answers, and a fanfare
at the end. They're generated in the browser (no audio files). Browsers only
allow sound after someone interacts with the page, so the first time the TV
shows **🔈 Tap for sound** in the top bar: click it, or press OK on a TV remote
or any key. The 🔊 button mutes and unmutes (remembered on that TV). The
Raspberry Pi kiosk is allowed to play sound straight away.

## Quick start

### Docker (any machine on your network)

```bash
docker compose up -d --build
```

Then open `http://<server-ip>:3000/host/` in the TV's browser (a PC on HDMI,
a Google TV browser, or a Raspberry Pi; see below). Phones scan the QR code.

#### Fixing the QR code address

Inside Docker, the server only knows its own internal IP. If the TV page is
opened as `http://localhost:…` (for example on the server itself), the QR code
can point somewhere phones can't reach, and the TV shows a ⚠ warning. To fix it:

1. On a phone or PC, open `http://<server-ip>:3000/admin/` (or press ⚙ on the TV screen).
2. The first visit asks you to create an admin password.
3. Press **Use this page's address**, or type the address, then **Save**. The QR
   code on the TV updates right away.

The setting is stored in the `ark-data` Docker volume, so it survives updates.
You can also set `ADMIN_PASSWORD` and/or `PUBLIC_URL` in `docker-compose.yml`;
`PUBLIC_URL` overrides the saved address.

### Update and redeploy from GitHub

Clone the repo once on the Docker machine, then run the update script from the
repo folder whenever you want the latest version:

```bash
git clone https://github.com/areyesromo/Ark-2P-Hub.git && cd Ark-2P-Hub

./update.sh                  # Linux / macOS / Pi
./update.sh --branch main    # switch to (and follow) another branch
./update.sh --force          # recreate the container even if nothing changed
```

```powershell
.\update.ps1                 # Windows (Docker Desktop), PowerShell 5.1 or 7
.\update.ps1 -Branch main
.\update.ps1 -Force
```

It runs `git pull`, builds the image, redeploys with Docker Compose, then
checks `http://localhost:3000/version` and prints the version and commit that
are running. Details:

- **Failed build:** the running container is left as it is.
- **Pinned version:** if you've checked out a tag or commit to roll back, it
  won't pull.
- **Local changes:** they're kept, and the build is tagged `+dirty`.
- **Common git errors:** it explains them, including folders owned by another
  user ("dubious ownership") and ZIP downloads that aren't a git clone.

If Windows blocks the script, run `Set-ExecutionPolicy -Scope Process Bypass` first.

To update automatically, schedule it:

- **Linux (cron):** `*/10 * * * * /path/to/Ark-2P-Hub/update.sh >> /var/log/ark-update.log 2>&1`
- **Windows (Task Scheduler):** run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\path\to\Ark-2P-Hub\update.ps1` on a timer.

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
update.sh / update.ps1     pull from GitHub, rebuild and redeploy
```

## Adding a game

1. **Logic:** create `server/games/<id>.js` exporting
   `{ id, name, tagline, category, create(ctx) }` (`category` is
   `'competitive'`, the default, or `'casual'`). The instance implements
   `start()`, `onInput(slot, input)`, `hostView()`, `playerView(slot)`.
   Use `ctx.setTimeout` (cleared automatically when the game ends) and call
   `ctx.update()` whenever state changes. `ctx.players[slot].local` is true
   for controller players, who have no private screen (see `battleship`).
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

`pong` is the template for real-time games (server physics loop, canvas on the
TV, touch strip on the phone), `reaction-duel` for timing games and
`rock-paper-scissors` for turn-based / hidden-information games.

## Notes

- Reaction times are measured on the server, so they include Wi-Fi latency
  (usually a few ms on a LAN). It's the same for both players.
- Phone screen wake-lock and vibration work where the browser allows it;
  iOS needs HTTPS for wake-lock, so put a reverse proxy (e.g. Caddy) in front
  if you want that.

## Roadmap ideas

**The hub**

- Background music for the lobby and games
- Persistent leaderboard: head-to-head record, wins per game, recent matches
- Lobby polish: last-played first, a "random game" button
- Raspberry Pi kiosk mode: boot straight into the TV screen, auto-update, Bluetooth controllers

**More games**

- Connect Four: quick turn-based classic
- Sumo / Bumper Arena: shove each other off a shrinking platform
- Typing or Word Race: race to type, or find words in a shared letter grid
- Mini Golf: aim and drag on your phone, watch the ball roll on the TV
- Bomberman-style duel: maze, bombs and power-ups
- More quiz packs, drawing shapes and Sketch & Guess words
