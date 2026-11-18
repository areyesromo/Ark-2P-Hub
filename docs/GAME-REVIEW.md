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
4. ~~🎨 **Asteroid Duel.**~~ Done in 0.1.54. The ships are tiny arrows and the rocks are plain grey. Bigger ships, a
   thrust flame and some shading on the rocks would help.
5. 🎨 **Phone boards that are too small:** (0.1.53: Mancala, Crazy Eights, Dice Party and Dots &
   Boxes done. Anagram Duel's tiles and Brick Duel's court already fill the phone's width; they
   looked small only beside the empty space under them.) Mancala, Dots & Boxes, Crazy Eights' hand, Dice Party's
   dice, Anagram Duel's tiles and Brick Duel's court. Each leaves half the phone empty. Let the
   board fill the width.
6. ~~🎨 **Empty TV space:**~~ Done in 0.1.54. Fake Out, Micro Mayhem, Sketch Guess (while a word is being picked),
   Tower Stack and Rally Tennis (a small court in a big screen). Each of these screens could hold
   bigger content or a status panel.
7. ~~🎮 **No buzz (vibration)** in Pong and Marble Maze.~~ Done in 0.1.53. (Micro Mayhem already
   buzzed through the shared minigame frame.)
8. ~~🎨 **Small TV text:**~~ Done in 0.1.55 (Dice Party has a new two-column scorecard). the Dice Party scorecard and the Mini Golf and Ten-Pin scorecards are
   hard to read from the couch.
9. ~~📶 **Ten-Pin.**~~ Done in 0.1.55: the roll goes packed, only the pins that moved in each step (about 19 KB to 3 KB). Each throw's pin physics goes out as one 27 KB view. That is harmless on a home
   network, but it is the largest single message any game sends.
10. ~~📶 Socket.IO compression (`perMessageDeflate`).~~ On in 0.1.55 (messages over 1 KB).
    The views are repetitive JSON and shrink by about 3× each (more with the shared context). On a home network it isn't needed.

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
| Brick Duel | ✅ | The walls go only when a brick breaks, to the TV and the phone (0.1.55): about half the traffic. |
| Kitchen Rush | 30 | 1.3 KB | 1.2 KB | 73 |
| Marble Maze | 30 | 1.1 KB | 1.0 KB | 64 |
| Dungeon Duo | 16 | 2.0 KB | 1.9 KB | 59 |
| Mini Golf | ✅ | A bigger scorecard on the TV (0.1.55). |
| Bomb Duel | 30 | 0.9 KB | 0.8 KB | 48 |
| Asteroid Duel | 30 | 1.2 KB | 0.4 KB | 46 |
| Air Hockey | ✅ | Air holes, a puck trail and a goal flash (0.1.55). |
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
| Air Hockey | ✅ | Air holes, a puck trail and a goal flash (0.1.55). |
| Anagram Duel | 🎨 | The phone's tiles are small with a lot of empty space below. Make them bigger. |
| Asteroid Duel | ✅ | Glowing ships, flame, shaded rocks (0.1.54). Kept to the hit size: the ships are drawn only a touch bigger. |
| Battleship | ✅ | |
| Block Battle | ✅ | Grid, shaded blocks and coloured landing outline added in 0.1.53. |
| Bomb Duel | ✅ | |
| Bomb Squad | ✅ | |
| Brick Duel | ✅ | The walls go only when a brick breaks, to the TV and the phone (0.1.55): about half the traffic. |
| Checkers | ✅ | |
| Connect Four | ✅ | |
| Crazy Eights | ✅ | Bigger cards in the phone's hand (0.1.53). |
| Dice Party | ✅ | A two-column scorecard on the TV, bigger dice on the phone (0.1.53, 0.1.55). |
| Dots & Boxes | ✅ | The phone board sits in the middle of the screen (0.1.53). |
| Draw Duel | ✅ | |
| Dungeon Duo | 🎨 | Dim stand-in 3D. The art is waiting on the local session's models. |
| Fake Out | ✅ | Notepads for each player while writing (0.1.54). |
| Kart Race | ✅📶 | Looks good. Heavy phone view (see the top list). |
| Kart Race 3D | ✅📶 | Stand-in shapes until the art lands. Heaviest view of all (see the top list). |
| Kitchen Rush | ✅📶 | |
| Liar's Dice | ✅ | |
| Mancala | ✅ | The phone board stands up and fills the screen (0.1.53). |
| Marble Maze | ✅ | Buzzes on a fall and at the goal (0.1.53). |
| Memory Match | ✅ | |
| Micro Mayhem | ✅ | The minis' pieces grow with the TV (0.1.54). |
| Mind Meld | ✅ | The dial reads well on the TV and the phone. |
| Mini Golf | ✅ | A bigger scorecard on the TV (0.1.55). |
| Party Board | ✅ | The side panels are mostly empty early in the game (items and stars fill them later). The phone's Roll button has empty space under it. |
| Party Minigames | ✅ | The intro card reads well. The phone shows a blurred copy of the TV behind the card, which is fine. |
| Pong | ✅ | Neat neon look. Buzzes on a return and a point (0.1.53). |
| Quiz | ✅ | |
| Rally Tennis | ✅ | Banner off the net, a little more court (0.1.54). The court stays upright: turning it sideways would swap which way ◀ ▶ aim. |
| Reaction Duel | ✅ | Bold and clear. |
| Rock Paper Scissors | ✅ | |
| Sketch Guess | ✅ | Face-down word cards and the rounds so far while the drawer picks (0.1.54). |
| Snake | ✅ | The crash burst reads well. |
| Sumo | ✅ | The ring could use some texture. |
| Tanks | ✅ | Clean. The walls are plain blocks. |
| Ten-Pin | ✅ | A bigger scorecard, and the roll goes packed (0.1.55). |
| Tower Duel | ✅ | The phone's tile grid is dense for a finger, but it works. |
| Tower Stack | ✅ | Dusk sky, plinth and star-height rings (0.1.54). |
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

## The computer, game by game (0.1.56)

Every game with a computer was played against it at Easy, Normal and Hard: headless (a player who
does nothing, many seeds: `test/bots-idle.test.js` keeps the worst cases), then on the real TV page
(standing still at Easy, playing at Normal and Hard), watching its moves frame by frame.

| Game | What was wrong | Fix |
|---|---|---|
| Pong | After a misjudged ball, it kept that misjudgement for the next serve too: a paddle left in the middle won 5:0 | Its read of the ball resets between points |
| Air Hockey | Shot straight at a mallet left in the goal; Easy chased fast rebounds into its own goal; a puck left on your side sat there for good | Aims at the open side; Easy stays in front of its goal; a slow puck drifts over after 7 s |
| Bomb Duel | Froze on its own bomb when its escape didn't fit its reaction time; walked into a blast past a late turn; crushed by the closing walls | Plans the way out for a slow start, takes the least bad way when none is safe, presses turns before the junction (and the game takes a turn a moment late), heads inward before the walls |
| Tank Duel | Steered for you but fired at its own aim: never fired at a tank standing still | Steers for its aim when you stand still |
| Snake (Easy) | Turned from a wall at the last cell, too late for its slow tap | Turns a cell early |
| Light Cycles (Easy) | Rode head-on into your cycle (draws) | Sees your cycle coming |
| Mini Golf | In the room, it stood still for good once every ball had stopped (still planning, and nothing woke it) | Keeps the room looking while it plans; the room looks again every second anyway |
| Mancala, Memory Match, Connect Four, Dots & Boxes (Easy) | Too easy: lost to random moves, didn't block an obvious four, gave boxes away | A little more careful, still well below Normal |

Fine as they were: Snake (Normal, Hard), Tron (Normal, Hard), Volley Blobs (Easy gives away a point
now and then), Brick Duel, Asteroid Duel, Rally Tennis, Sumo, Block Battle, Tower Duel, Word Hunt,
Word Race, Anagram Duel, Checkers, Battleship, Rock Paper Scissors, Dice Party, Crazy Eights,
Liar's Dice, Ten-Pin, Party Board, Party Minigames, Micro Mayhem, Kitchen Rush.

## Smoothness on the TV

Every 2D game holds 60 frames a second, under half a millisecond of script a frame. The 3D games
can't be measured in the cloud (no graphics card): tap the version at the bottom right during a game
on the Steam Deck to see its frame rate.
