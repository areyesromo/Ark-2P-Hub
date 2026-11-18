# Game review (November 2026)

A pass over all 45 games: how each one looks on the TV and on the phone, how it handles, and how
much it sends over the network. The screenshots were taken mid-game on a 1280×720 TV and a
360×800 phone. The network numbers come from 60 s of computer-vs-computer play through the real
room.

Legend: ✅ fine as it is · 🎨 could look better · 🎮 handling · 📶 network.

## Top of the list

These are the changes that would be felt most, in rough order.

1. ~~📶 **Kart Race (2D and 3D) phone view.**~~ Done in 0.1.53 (about 1.5 KB per update). Each phone gets every kart, the event log and the
   setup options 30 times a second (2.4 KB per update). The phone only needs its own kart, its
   item and its place. Trimming it cuts the phone's traffic by about 4× and its JSON work too
   (helps older phones).
2. ~~📶 **Kart Race 3D TV view.**~~ Done in 0.1.53 for every game: the room leaves out a TV view's
   big fields while they are unchanged (`Room#hostPacket`), so Kart Race 3D's TV gets about 2.6 KB. The item boxes (3.1 KB) and coins (2.2 KB) go out on every update,
   but they only change when someone picks one up. Send them once, then only when one changes.
   That takes the TV from 8.4 KB to about 3 KB per update.
3. ~~🎨 **Block Battle.**~~ Done in 0.1.53: shaded blocks, a grid and a coloured landing outline.
   (It already had the landing outline and the next piece; the first screenshot was taken during
   the countdown.)
4. 🎨 **Asteroid Duel.** The ships are tiny arrows and the rocks are plain grey. Bigger ships, a
   thrust flame and some shading on the rocks would help.
5. 🎨 **Phone boards that are too small:** Mancala, Dots & Boxes, Crazy Eights' hand, Dice Party's
   dice, Anagram Duel's tiles and Brick Duel's court. Each leaves half the phone empty. Let the
   board fill the width.
6. 🎨 **Empty TV space:** Fake Out, Micro Mayhem, Sketch Guess (while a word is being picked),
   Tower Stack and Rally Tennis (a small court in a big screen). Each of these screens could hold
   bigger content or a status panel.
7. ~~🎮 **No buzz (vibration)** in Pong and Marble Maze.~~ Done in 0.1.53. (Micro Mayhem already
   buzzed through the shared minigame frame.)
8. 🎨 **Small TV text:** the Dice Party scorecard and the Mini Golf and Ten-Pin scorecards are
   hard to read from the couch.
9. 📶 **Ten-Pin.** Each throw's pin physics goes out as one 27 KB view. That is harmless on a home
   network, but it is the largest single message any game sends.
10. 📶 *(optional, for tunnel or online play)* Turn on Socket.IO compression (`perMessageDeflate`).
    The views are repetitive JSON and shrink by about 5–10×. On a home network it isn't needed.

## Network

On a home network none of this is a problem. Wi-Fi carries megabytes a second, and the busiest
game uses about 0.3 MB/s. It starts to matter over the tunnel, or on an old phone parsing 30
views a second. The room sends the whole view on every `ctx.update()`, with no diffing or
compression.

Busiest games (TV plus one phone):

| Game | Updates/s | TV view | Phone view | KB/s |
|---|---|---|---|---|
| Kart Race 3D | 30 | 8.4 KB | 2.4 KB | 319 |
| Kart Race | 30 | 3.7 KB | 2.4 KB | 177 |
| Brick Duel | 30 | 1.7 KB | 1.2 KB | 84 |
| Kitchen Rush | 30 | 1.3 KB | 1.2 KB | 73 |
| Marble Maze | 30 | 1.1 KB | 1.0 KB | 64 |
| Dungeon Duo | 16 | 2.0 KB | 1.9 KB | 59 |
| Mini Golf | 30 | 1.0 KB | 0.9 KB | 57 |
| Bomb Duel | 30 | 0.9 KB | 0.8 KB | 48 |
| Asteroid Duel | 30 | 1.2 KB | 0.4 KB | 46 |
| Air Hockey | 30 | 0.8 KB | 0.7 KB | 45 |
| Sumo | 30 | 0.8 KB | 0.7 KB | 44 |
| Tanks, Tower Duel, Pong, Rally Tennis, Volley Blobs | 10–30 | | | 29–36 |
| Party Minigames | 5 | 2.2 KB | 2.2 KB | 23 |

Every turn-based game sends 6 KB/s or less.

The real-time TV renderers already smooth between updates (they extrapolate or ease on
`performance.now()`), so motion doesn't stutter at 30 updates a second. Snake, Tron and Block
Battle move on a grid on purpose.

Ideas, from cheapest to most work:

- **Lean phone views in the real-time games** (Kart Race above all; also Brick Duel, Kitchen Rush,
  Marble Maze and Mini Golf, whose phones mostly show a copy of the TV). A phone that only shows a
  pad needs only the score and its own state.
- **Send fields that rarely change only when they change** (3D item boxes and coins, track and
  maze layouts, Tower Duel's road).
- **Compression for online play**, as above.
- **Skip a view identical to the last one sent** to the same screen (cheap: compare the JSON).

## Each game

| Game | Looks | Notes |
|---|---|---|
| Air Hockey | ✅ | Clean but plain. 🎨 A rink texture, a glow on the puck and a goal flash would liven it up. |
| Anagram Duel | 🎨 | The phone's tiles are small with a lot of empty space below. Make them bigger. |
| Asteroid Duel | 🎨 | Tiny ships and grey rocks (see the top list). |
| Battleship | ✅ | |
| Block Battle | ✅ | Grid, shaded blocks and coloured landing outline added in 0.1.53. |
| Bomb Duel | ✅ | |
| Bomb Squad | ✅ | |
| Brick Duel | 🎨📶 | The phone's court is small. Its phone view is a full copy of the TV's. |
| Checkers | ✅ | |
| Connect Four | ✅ | |
| Crazy Eights | 🎨 | The cards in the phone's hand are small. Fan them bigger across the width. |
| Dice Party | 🎨 | The TV scorecard text is small, and the dice on the phone are tiny. |
| Dots & Boxes | 🎨 | Fine on the TV. The phone board is small. |
| Draw Duel | ✅ | |
| Dungeon Duo | 🎨 | Dim stand-in 3D. The art is waiting on the local session's models. |
| Fake Out | 🎨 | A large empty area on the TV. |
| Kart Race | ✅📶 | Looks good. Heavy phone view (see the top list). |
| Kart Race 3D | ✅📶 | Stand-in shapes until the art lands. Heaviest view of all (see the top list). |
| Kitchen Rush | ✅📶 | |
| Liar's Dice | ✅ | |
| Mancala | 🎨 | The phone board is small. |
| Marble Maze | ✅ | Buzzes on a fall and at the goal (0.1.53). |
| Memory Match | ✅ | |
| Micro Mayhem | 🎨 | Big empty panels and small emoji targets. |
| Mind Meld | ✅ | The dial reads well on the TV and the phone. |
| Mini Golf | ✅ | The TV scorecard is small. The course could fill more of the TV. |
| Party Board | ✅ | The side panels are mostly empty early in the game (items and stars fill them later). The phone's Roll button has empty space under it. |
| Party Minigames | ✅ | The intro card reads well. The phone shows a blurred copy of the TV behind the card, which is fine. |
| Pong | ✅ | Neat neon look. Buzzes on a return and a point (0.1.53). |
| Quiz | ✅ | |
| Rally Tennis | 🎨 | The court is small in the middle of the TV, and the serve text overlaps the net. Make the court bigger and move the text off it. |
| Reaction Duel | ✅ | Bold and clear. |
| Rock Paper Scissors | ✅ | |
| Sketch Guess | 🎨 | The TV is blank while the drawer picks a word. Show the three difficulty cards face down, or a timer. |
| Snake | ✅ | The crash burst reads well. |
| Sumo | ✅ | The ring could use some texture. |
| Tanks | ✅ | Clean. The walls are plain blocks. |
| Ten-Pin | ✅📶 | The TV scorecard is small. There is one large view per throw. |
| Tower Duel | ✅ | The phone's tile grid is dense for a finger, but it works. |
| Tower Stack | 🎨 | A lot of empty grey stage around the block. Add a backdrop or a height marker. |
| Trivia Quest | ✅ | |
| Tron | ✅ | Plain arena. A faint grid would show speed. |
| Volley Blobs | ✅ | Charming. |
| Word Hunt | ✅ | The phone grid is tight but readable. |
| Word Race | ✅ | |

## Handling notes that apply to every game

- Every real-time game has a gamepad hint (`padHint`). The games without one are the phone-only
  games, which is expected.
- Phone pads use the shared joystick and D-pad and tilt with a button fallback, so they match from
  game to game.
- The only handling gaps found are the missing buzzes above. Input lag wasn't measured here: it
  needs real phones on the home network.
