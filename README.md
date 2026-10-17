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
and **🎨 Casual** (you play together, nobody really loses). Within each group
the games you played most recently come first (the last one is tagged
⏱ Last played), and **🎲 Random game** at the top picks one for you (never the
one you just played).

### ⚔️ Competitive

| Game | How it plays |
| --- | --- |
| **Reaction Duel** | The TV goes red… then GO! First tap wins. Tap early and your opponent gets the point. First to 3. |
| **Rock Paper Scissors** | Pick in secret on your phone; the TV reveals both. First to 3. |
| **Pong** | The classic, in real time. Drag on your phone's touch strip (or use the stick) to move your paddle. The ball speeds up every hit. First to 5. |
| **Light Cycles** | Tron-style. Your cycle leaves a wall behind it: make your rival crash into it. Tap a side of the phone pad or swipe to turn. Cycles speed up as the round goes on. First to 3. |
| **Snake Battle** | Two snakes, one arena. Eat the glowing food to grow; hit a wall, yourself or your rival and you lose the round. After 60 seconds the longer snake wins. Same controls as Light Cycles. First to 3. |
| **Tank Duel** | Top-down tank battle with cover. Drive with the joystick, fire shells that bounce once off walls (trick shots, and watch out for your own). 3 hits and you're out; after 90 s the healthier tank wins. First to 3. |
| **Sumo** | Two discs on a round clay ring: steer with a joystick (with momentum), and press **DASH** to ram (1.5 s cooldown; a dashing hit knocks harder). Leave the ring and you lose the round; after 15 s the ring starts shrinking, so every round ends. First to 3. |
| **Bomb Duel** | Bomberman-style, on a 15×11 arena of stone pillars and wooden crates. Walk with the D-pad on your phone (or a controller) and drop bombs with the big button: they go off after 2.5 s in a cross, smash the first crate each way and set off other bombs. Crates can hide power-ups: 💣 an extra bomb, 🔥 a longer blast, 👟 more speed. Caught in a blast, you lose the round (a trade is a draw); after 90 s the walls close in from the edges. Pick the round wins needed (2, 3 or 5) and how many crates before you start. |
| **Quiz Battle** | 10 trivia questions (science, geography, movies, music, sports, games and more). Answers stay secret until the reveal; a right answer scores 500 plus up to 500 for speed. Most points wins, and rematches don't repeat questions. |
| **Draw Duel** | A shape flashes up for 4 seconds, then vanishes: redraw it from memory on your phone. 125 shapes (basic shapes, pictures like a rocket or a cat, letters and numbers), never repeated until you've seen them all. Each drawing is scored 0–100% for how closely it matches (size and position don't matter); the TV shows both drawings live and overlays the real shape at the reveal. 5 rounds, most points wins. |
| **Battleship** | Hide your 5 ships on your phone (tap a ship, tap where it goes, tap it again to turn it, or shuffle), then take turns firing at the enemy grid. The TV shows both oceans with every hit and miss; ships stay hidden until sunk. 30 s per shot. Sink the whole fleet to win. |
| **Word Race** | Boggle for two: the same letter grid on both phones and the TV. Swipe across touching letters (sideways, up/down or diagonally) to spell words of 3+ letters, checked against a ~275k-word dictionary; longer words score more (3–4 letters 1, 5 → 2, 6 → 3, 7 → 5, 8+ → 11). When the time's up, words you **both** found cancel out, so hunt for the rare ones. Before the match, either player picks the grid (4×4, 5×5 or 6×6), the time per round (1, 1½, 2 or 3 min) and the length (one round, best of 3 or best of 5); the hub remembers your choice, and at the end you can rematch or change them. |
| **Mini Golf** | Both of you play the same hole at once (the balls roll through each other). Pull back anywhere on your phone and let go to putt: the further you pull, the harder the shot; the phone shows the hole too. 9 holes with walls, bumpers, sand, water (a stroke penalty, back where you shot from) and a windmill. 8 shots per hole, then you pick up and score 9; 90 s per hole. Pick 3, 6 or 9 holes before you start. Fewest strokes wins. |
| **Connect Four** | The classic: drop discs into a 7×6 grid and line up four (across, down or diagonally) before your rival. Tap a column on your phone, which shows the board too. 20 s per move (a random column if you run out); who starts swaps every round. First to 3 rounds. |

### 🎨 Casual

| Game | How it plays |
| --- | --- |
| **Sketch & Guess** | One of you picks a secret word (easy, medium or hard, from 260) and draws it on your phone with colours, undo and an eraser; the other watches it appear on the TV and their own phone and types guesses (near misses get a "so close!"). Letters are hinted as time runs out. Team up for stars: faster and harder words earn more. 6 rounds, taking turns to draw. |
| **Air Hockey** | The whole table is on your phone too, upright and turned so your goal is at the bottom: slide your mallet and smash the puck into their goal. Watch the phone or the TV. First to 7. |

**Every game opens on a setup screen** where either player picks the match
settings on their phone (or a controller: ↑↓ picks a row, ←→ changes it, A
starts). The numbers above are the defaults; you can change, for example:

| Game | Setting |
| --- | --- |
| Reaction Duel, Rock Paper Scissors | Points to win: 3, 5 or 7 |
| Pong | Points to win: 3, 5, 7 or 11 |
| Air Hockey | Goals to win: 5, 7 or 10 |
| Light Cycles, Snake Battle, Tank Duel, Sumo, Bomb Duel | Round wins needed: 2, 3 or 5 |
| Connect Four | One round, or first to 3 or 5 |
| Quiz Battle | 5, 10, 15 or 20 questions |
| Draw Duel | 3, 5, 7 or 10 rounds |
| Battleship | 15, 30 or 60 s per shot |
| Sketch & Guess | 4, 6, 8 or 10 rounds |
| Word Race | Grid size, time per round and match length |
| Mini Golf | 3, 6 or 9 holes |
| Bomb Duel | Also how many crates |

The room remembers your choice for next time. At the end of a match,
**Rematch** plays again with the same settings and **⚙ Change settings** (or
**Y** on a controller) goes back to the setup screen.

## Controllers

Each player can use a phone **or** a game controller. Mix and match: two
controllers, two phones, or one of each. Connect Xbox, PlayStation or most
other controllers (Bluetooth or USB) to the device showing the TV screen: the
PC on HDMI, the Raspberry Pi, or the Google TV box. Then:

| Where | Button | Does |
| --- | --- | --- |
| Lobby | **A** / **Start** | Join (takes a free seat as "Controller 1/2") |
| Lobby | **D-pad**, then **A** | Pick a game and start it (the first card, 🎲 Random, lets the hub choose) |
| Lobby | **Y** | Change your name: cycles through names on the leaderboard, so your wins count for you |
| Lobby | **B** | Leave your seat |
| Any game | **Back / Select** | Back to the lobby |
| Reaction Duel | any face button, bumper or trigger | Tap |
| Rock Paper Scissors | **X** ✊ · **Y** ✋ · **B** ✌️ (or D-pad ← ↑ →) | Pick (stays secret, the TV only shows 🔒) |
| Pong | **Left stick** or **D-pad ↑↓** | Move your paddle |
| Light Cycles | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Air Hockey | **Left stick** or **D-pad** | Move your mallet (in TV directions) |
| Snake Battle | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Tank Duel | **Left stick** or **D-pad** to drive, **A** / **RT** / **RB** / **X** to fire | Point where you want to go; the gun faces where you drive |
| Sumo | **Left stick** or **D-pad** to move, **A** / **B** / **RT** to dash | The dash goes where you're steering (or straight at your rival if you're not) |
| Bomb Duel | **D-pad** or **left stick** to walk (held), **A** / **B** / **X** / **RT** to drop a bomb | Setup: **↑↓** picks a row, **←→** changes it, **A** starts; at the end **A** rematches and **Y** changes the settings |
| Quiz Battle | **A** / **B** / **X** / **Y** to answer, or the **D-pad** as a diamond (↓ A, → B, ← X, ↑ Y) | Answer tiles on the TV are coloured like the buttons |
| Draw Duel | **Left stick** or **D-pad** moves a cursor, hold **A** / **RT** / **RB** to draw, **B** undo, **X** clear, **Y** / **START** done | Phones draw with a finger, which is easier; the controller is for brave players |
| Battleship | **D-pad** aims at the enemy grid on the TV, **A** fires | A controller player's fleet is placed at random, since the TV can't keep it secret |
| Word Race | Setup: **↑↓** picks a row, **←→** changes it, **A** starts. In the game: **D-pad** / **stick** moves a cursor, **A** adds the letter, **B** removes the last one, **Y** / **X** / **RT** submits the word. At the end, **A** rematches and **Y** changes the settings | Phones are easier (just swipe), and your trace shows on the TV for your rival to see |
| Mini Golf | **Left stick** aims (or **←→** turns the aim), hold **A** / **RT** to charge, let go to putt | The power meter swings up and down while you hold, so let go at the right moment. Setup: **←→** picks the holes, **A** starts; at the end **A** rematches and **Y** changes the holes |
| Connect Four | **D-pad** ← → (or the stick) moves your disc over the columns, **A** or **↓** drops it | |
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

There's background music too, composed live in the browser as it plays: a
laid-back tune in the lobby (and on game setup and results screens), and in
games one of three moods: **action** chiptune for the real-time games,
**thinking** for the quiz, word and board games, and **casual** for the
relaxed ones. Each mood keeps its chords, bass and beat, but the melody is
made up fresh every 8 bars, so it doesn't loop the same tune. The 🎵 button
turns music on and off separately from the sound effects (remembered on that
TV). A new game picks its mood with `music: 'action' | 'thinking' |
'casual'` (by default competitive games get action, casual games casual).

## Leaderboard and match history

Every finished match is saved (in `stats.json` in the data folder, so it
survives updates). The lobby on the TV and phones shows the record between the
two players seated, e.g. **🏆 Abe 14 – 9 Sam · last: Pong, Abe won 5–3**, plus
stars earned together in casual games. The 🏆 button on the TV (and the link in
the phone lobby) opens `/stats/`: players ranked by wins, rivalries, the best
player per game, and recent matches. Players are matched by name (ignoring
capitals), so use the same name each time. Settings (`/admin/`) can clear the
history.

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
- **Screens:** after an update the TV and phones reload by themselves, and the
  TV keeps its room code, so phones reconnect without scanning again. (A game in
  progress does end, so update between games.)

If Windows blocks the script, run `Set-ExecutionPolicy -Scope Process Bypass` first.

To update automatically, schedule it:

- **Linux (cron):** `*/10 * * * * /path/to/Ark-2P-Hub/update.sh >> /var/log/ark-update.log 2>&1`
- **Windows (Task Scheduler):** run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\path\to\Ark-2P-Hub\update.ps1` on a timer.

### Raspberry Pi 4/5 as a plug-in console

The Pi runs the server *and* shows the TV screen full-screen from boot, pairs
Bluetooth controllers and updates itself from GitHub (never mid-game; the TV
keeps its room code and phones reconnect by themselves). On Raspberry Pi OS
(64-bit, with desktop), as your normal user:

```bash
curl -fsSL https://raw.githubusercontent.com/areyesromo/Ark-2P-Hub/main/deploy/pi/install.sh | bash
sudo reboot
/opt/ark/pair-controller.sh   # once per Bluetooth controller
```

Full guide: [docs/raspberry-pi.md](docs/raspberry-pi.md).

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
deploy/pi/                Raspberry Pi installer, compose, kiosk, updater, controller pairing
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

**More content**

- More quiz packs, drawing shapes and Sketch & Guess words
- More Mini Golf holes
