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

The lobby groups games into **⚔️ Competitive** (head to head, one of you wins),
**🎲 Dice & Board** (classic table games, head to head) and **🎨 Casual** (you play together, nobody really loses). Within each group
the games you played most recently come first (the last one is tagged
⏱ Last played), and **🎲 Random game** at the top picks one for you (never the
one you just played). The board and card games sit in two folders,
**🎲 Board Games** and **🃏 Cards & Casino**, so the list stays short: open one to pick a game
inside, and **◀ All games** (or **B** on a controller) to go back.
Once both seats are taken, the TV's lobby stacks the two players (with your
head to head and the tournament) in a narrow column on the left and gives the
rest of the screen to the games; the QR code comes back when a seat is free.
Two labels on a game tell you how it plays: **📱 No TV needed** (the phones show
everything, the board, the question, the reveal and the result, so nobody has to watch
the TV once you've joined: most board, card, word and quiz games, with the time left in the phone's header;
Dice Party with its Handheld screen) and **🤸 Motion** (you can tilt or move your phone to play; buttons
or a joystick always work too).
**👥 2 players / 👤 1 player.** The switch at the top of the lobby (on the TV, in its top bar, or on
your phone) picks which games it lists: the 1v1 games above, or the **solo games** further down,
where one of you plays and chases your own best (no computer). One person is enough to start a
solo game; with two of you seated, whoever picks it plays and the other's phone watches. Each solo
run is scored (the best to beat shows on the lobby card, in the game and on the end screen, with
**🎉 New best!**), and solo games have achievements of their own.

No one to play with? Games labelled **🤖 Vs computer** can be played against the computer:
Battleship (Classic and Ultimate), Connect Four, Chess, Checkers, Reversi, Backgammon, Ludo, Dominoes, Five in a Row, Nine Men's Morris, Mine Duel, Blackjack, Gin Rummy, Colour Clash, Dots and Boxes, Mancala, Rock Paper
Scissors, Memory Match, Dice Party, Pong, Air Hockey, Snake Battle,
Light Cycles, Tank Duel, Word Hunt, Volley Blobs, Brick Breaker Duel, Rally Tennis, Sumo, Asteroid
Duel, Mini Golf, Falling Blocks Battle, Bomb Duel, Kart Race (and 3D, races and balloon battles),
Tower Defence Duel, Crazy Eights, Liar's Dice, Anagram Duel, Word Race, Five Letters, Code Breaker, Hangman Duel, Make 24, Party Board, Party
Minigames, Micro Mayhem (every minigame), and as your teammate in Kitchen Rush, Dungeon Duo and
Marble Maze. Reaction Duel, Quiz Battle, Trivia Quest and Tower Stack are for two people: a
computer there was either unbeatable or no fun. In Kart Race it readies up on the menus once you have. The phone-only games
need just your phone against it (it isn't a controller). With a seat free,
tap **Easy**, **Normal** or **Hard** under it on the TV (or on your phone's lobby, or press **LT**
on a controller). While it's seated, the games it can't play are greyed out (**🧑 Needs a
person**: the drawing and bluffing games). Easy makes mistakes and forgets, Normal plays sensibly, and
Hard looks further ahead (board games), remembers every card (Memory Match), reads your habits
(Rock Paper Scissors) and knows more answers. In the action games it answers what it sees no
faster than a person: it plays what it made of the moment a reaction time later, a slow player's
on Easy (about a third of a second), the average on Normal, a quick one's on Hard (about a fifth),
with a person's spread. What it sees coming (a tennis swing, a jump, its own planned turn) it
times, with a person's error. Its aim wobbles and it misjudges now and then, so it can always be
beaten. It plays from what its own phone would show, so it never
peeks at your fleet, your cards or your pick. Games (and tournaments)
against it don't count in the leaderboard; tap ✕ on its seat to send it away, or just join: whoever
scans in from the lobby takes its seat.

### ⚔️ Competitive

| Game | How it plays |
| --- | --- |
| **Reaction Duel** | The TV goes red… then GO! First tap wins. Tap early and your opponent gets the point. First to 3. On your own? **Reaction Rush** in the 1 player lobby: five rounds, your average time is your score. |
| **Rock Paper Scissors** | Pick in secret on your phone; the TV reveals both. First to 3. |
| **Pong** | The classic, in real time. The whole court is on your phone too, turned so your paddle is at the bottom: drag left and right anywhere on it (or use the stick) to move your paddle. The ball speeds up every hit. First to 5. |
| **Volley Blobs** | Beach volleyball for two bouncy blobs. Hold ◀ ▶ on your phone (or the stick) to slide and tap JUMP; where the ball hits your dome sets where it goes, so jump into it to smash. Up to 3 touches a side, and the one who lost the point serves. First to 7. |
| **Brick Breaker Duel** | A race to break your own wall, side by side on the TV. Your wall, balls and paddle are on your phone too: drag left and right on it (or use the stick) to move your paddle; a missed ball puts back the last brick you broke (or, if you pick it, just costs a moment). Power bricks shrink your rival's paddle, give you an extra ball or add a row to their wall. First to clear their wall wins; after 2 minutes, most bricks broken (level: next brick wins). |
| **Asteroid Duel** | Two ships in a field of drifting rocks, and the edges wrap round. Point the joystick (or the stick) where you want to face and push further to thrust; hold FIRE to shoot. Big rocks split when shot, and flying into one hurts. Three lives a round, a short shield after each hit; last ship flying takes the round. First to 3 rounds. |
| **Rally Tennis** | Tennis seen from above: your player runs to the ball by themselves, you time the swing. Tap SWING (or A) as the ball reaches you: spot on is a faster, deeper shot, a touch early pulls it left and late pushes it right, and holding ◀ ▶ aims too. Aim wide with a mistimed swing and it lands out. One swing per ball: too early or too late and it's gone. Tennis scoring (15, 30, 40, deuce); first to 4 games. |
| **Falling Blocks Battle** | A well each, side by side, and the same pieces in the same order for both. Slide ◀ ▶ (hold to keep going), rotate, hold ▼ to speed it down or DROP it at once. Clear 2 or more lines together and junk rows rise into your rival's well (2 lines send 1, 3 send 2, 4 send 4); your clears cancel junk coming at you first. Fill your well and you lose the round. First to 2 rounds. |
| **Light Cycles** | Tron-style. Your cycle leaves a wall behind it: make your rival crash into it. Tap a side of the phone pad or swipe to turn; the arena is on your phone too, above the pad. Cycles speed up as the round goes on. First to 3. |
| **Snake Battle** | Two snakes, one arena. Eat the glowing food to grow; hit a wall, yourself or your rival and you lose the round. After 60 seconds the longer snake wins. Same controls as Light Cycles, with the arena on your phone too. First to 3. On your own? It's **Snake** in the 1 player lobby: the same arena, one snake. |
| **Tank Duel** | Top-down tank battle with cover. Drive with the joystick (or pick ✛ D-pad or 📱 Tilt on your phone), fire shells that bounce once off walls (trick shots, and watch out for your own). 3 hits and you're out; after 90 s the healthier tank wins. First to 3. |
| **Tower Defence Duel** | Your own side of the TV each: a winding road down to your 🏰 base (20 lives by default), and the free tiles beside it for towers. Creeps walk the road; each one that gets through costs a life (a brute two), and when your lives are gone you lose. **Build** towers to stop them: 🏹 **Arrow** (cheap and quick), 💣 **Cannon** (slow, hits a whole group), ❄️ **Frost** (slows them down); each upgrades twice, or sell it back for part of the cost. **Send** creeps down your rival's road with your gold: 🏃 Runner (fast), 🐗 Brute (tough) or 🐜 Swarm (five small ones); every one you send also raises your income. Kills pay a bounty, and every 30 s both roads get the same house wave, a little stronger each time, so the game always ends. On the phone, your half of the map with the creeps walking it (and a small map of your rival's road): tap a tile to build or a tower to upgrade or sell, and the send buttons along the bottom. Both roads are the same. |
| **Sumo** | Two discs on a round clay ring: steer with a joystick, ✛ D-pad or 📱 Tilt, picked on your phone (with momentum), and press **DASH** to ram (1.5 s cooldown; a dashing hit knocks harder). Leave the ring and you lose the round; after 15 s the ring starts shrinking, so every round ends. First to 3. |
| **Bomb Duel** | Bomberman-style, on a 15×11 arena of stone pillars and wooden crates. Walk with the D-pad on your phone (or a controller) and drop bombs with the big button: they go off after 2.5 s in a cross, smash the first crate each way and set off other bombs. Crates can hide power-ups: 💣 an extra bomb, 🔥 a longer blast, 👟 more speed. Caught in a blast, you lose the round (a trade is a draw); after 90 s the walls close in from the edges. A turn pressed a moment after a junction still takes, so a phone's slight delay doesn't carry you past it. Pick the round wins needed (2, 3 or 5) and how many crates before you start. |
| **Kart Race** | Top-down racing on the TV. The setup goes in three steps, like a kart game's menus: **choose your racer** (both of you on the same screen, your pick big on your side, all twelve along the bottom; Confirm), then **choose your tyres** (Confirm), then the **track and settings** (Ready); Back goes a step back. Each player picks a **racer** on their phone or controller: 12 of them (6 types, each in a male and a female version), each with their own kart and Speed / Acceleration / Handling / Weight stats, and **tyres** (Standard, Slicks, Grippy, Rollers, Monster) that shift those stats; the stat bars show what you get. Hold **GAS** to drive and let go to coast; hold **BRAKE** to slow down, and keep holding it once stopped to **reverse** (handy for backing off a wall). Hold **DRIFT** through a bend to turn tighter: drift long enough (the sparks turn orange) and let go for a mini-boost. Each kart has a speedometer on the TV (and a speed bar on its phone) plus lap times. Tyre walls line every road (and run between stretches of road that pass close together): a glancing hit slides you along, a head-on hit bounces you back. Grab the 🟡 **coins** dotted round the road (one at a time, alternating sides, so you weave to collect a run): each one you hold (up to 15) makes you a little faster; spinning out on a banana drops 3 and a head-on crash drops 1. Pick the track on the setup screen (a preview map shows it). Steering on the phone: 🔘 **Buttons** (hold ◀ ▶), 🕹️ **Joystick** (steer as far as you push; push up for gas, pull down to brake), 👆 **Slide** (put a finger down anywhere and slide) or 📱 **Tilt** (turn the phone like a wheel; tap to re-centre. Phones only let a web page use the motion sensor on a secure https page: on plain http the phone switches to the joystick and offers **🔒 Switch to the secure page**, see [Secure page (https)](#secure-page-https)). Pick a layout too: 🔄 Auto (follows how you hold the phone), ↔ Landscape (sideways even with rotation locked) or ↕ Portrait. Grass slows you right down, yellow boost pads shoot you forward, and you can bump your rival. Rainbow ? boxes give you an item (the gold **2** box in the middle of each row gives two); you hold up to 3 and the ITEM button uses the oldest first: 🍌 banana (drop it behind you: whoever hits it spins out), ⚡ turbo, 🛡️ shield (blocks one hit), 🌟 gold turbo (5 s of boosts on every press), ⭐ star (faster, untouchable, ram your rival to spin them), 💰 coin bag (+5 coins), 🧲 magnet (pulls in coins and boxes, slipstream behind your rival), 🎈 hover (float over grass and bananas), 🌩️ thunder (your rival shrinks: slower and lighter), 🧊 freeze (your rival's tyres ice up), 🔄 swap (trade items with your rival), 🕸️ web (drop it: whoever hits it is slowed right down), 🛢️ oil slick (drop it: whoever crosses it can't steer or brake for a moment), 🥏 bouncer (fires straight ahead and bounces off the walls: it spins out anyone it hits, you too), 🎯 seeker (chases your rival round the road; a banana or web stops it) or 💣 bomb (lobbed ahead, goes off after 1.5 s and spins out anyone close). The leader mostly gets defensive items; the kart behind gets the catch-up ones. Six tracks (Speedway, Kidney, Serpent, Grand Prix, Hairpins, Zigzag). Both players press **Ready** (or **A**), then five red **start lights** come on one by one and go out together: press GAS before they go out and it's a **jump start** (stalled for 1 s). First across the line after the last lap wins. Play one race, a best of 3, or a 🏆 **cup**: four races on four different tracks with a leaderboard between them; the most wins takes the cup (2–2 goes to a sudden-death race). Or pick 🎈 **Battle** instead of Race: no laps, just the two of you in a wide arena round an island (**Donut**, **Peanut** or **Plaza**, or a different one each round), starting on opposite sides with three balloons each. Every time you spin out (a banana, a bouncer, a seeker, a bomb, a star's ram) you lose a balloon; a shield takes the hit instead. Lose your last balloon and the round is theirs; after 2 minutes, whoever has more balloons left wins it (level: a draw round, played again). The ? boxes are always on, and both of you get the same items (no coin bag, gold turbo, magnet, thunder, swap or hover). Rematches wait for both of you too. |
| **Kart Race 3D** | **Kart Race** in 3D: the TV splits in two, with a camera behind each kart (yours on your side), so you race down the road instead of watching from above. The same racers, tyres, items, cups and 🎈 battles, played on your phone or a controller exactly like Kart Race (see its row above), but on **five big tracks built for 3D**, with a road wide enough for the whole pack (three times as wide as Kart Race's) and laps of about a minute: **Sunset Canyon Rally** (a desert canyon rally: red rock cliffs, two rock arches over the road, a dam in the distance and the festival paddock at the start), **Speedway Oval**, **Grand Prix Circuit**, **Serpent Pass** and **Zigzag Ridge**. Battles keep Kart Race's arenas. Best on a PC or Steam Deck; on a screen that can't draw 3D it says so, and Kart Race is the one to play. **Rex** races as a full 3D kart and driver with a skeleton: his wheels spin and steer, his hands stay on a turning steering wheel, he leans into bends, rocks back on a boost, breathes and swishes his tail, tosses items forward or drops them behind, throws his arms up when he spins out, and celebrates (or slumps) at the finish; the other racers are simple 3D stand-ins in their colours for now, with their own models to come. When a player races Rex, a ring in their colour under the kart marks it as theirs. Its lap records are its own (marked **3D** on the stats page). A dedicated **3D garage** shows race settings, the circuit and both players' rides and readiness. Each driving view has its own position/lap panel, item queue and drift-charge meter; a shared course map marks P1/P2 and the start line. Phone controls label items and tell you when to release a charged drift for a boost. Hold **Look back** (the phone's button, or pull a controller's right stick down) to see who's behind you, or glance left and right with the phone's look strip or the right stick. Loading feedback includes retry (controller **X**), and the podium shows race times and the next race. Or pick **🏁 8-kart Cup** on the setup screen: the two of you and **six computer racers** (the racers neither of you picked, each in their own kart, driving Easy, Normal or Hard), five races, one on each big track. Every place scores, 10-8-6-5-4-3-2-1, computers included; race 1 starts with the computers in front, after that the grid goes by points with the leader at the back. Each half shows your place out of eight and the running order, the course map shows everyone, a floating **P1** / **P2** tag helps you find each other in the pack, and between races the TV and phones show the cup table. After five races, whichever of you has more points wins the cup (level: the better place in the last race). |
| **Quiz Battle** | 10 trivia questions from a bank of 250 (science, geography, history, movies, music, sports, games, food, nature and tech; play them mixed or pick one topic). Answers stay secret until the reveal; a right answer scores 500 plus up to 500 for speed. Most points wins, and rematches don't repeat questions. On your own? **Trivia** in the 1 player lobby: twelve questions against the clock. |
| **Fake Out** | A bluffing quiz for two phones. Each round the TV shows a strange-but-true fact with a blank ("In 1386 a French court put a ___ on trial for murder"), and you each secretly type a **fake answer** that sounds true; stuck? Your phone has one ready-made fake of its own. Then the TV (and your phone) lists four answers, shuffled: the truth, both your fakes and one more from the bank, and you each pick the one you think is real (your own fake isn't on your phone). Find the truth for **1000**; fool your rival with your fake for **500**; the last round counts double. The reveal goes answer by answer: whose fake it was and who fell for it, the truth last. 69 facts, and rematches don't repeat them. Write the real answer by accident and you're told, but finding it won't score that round. Needs two phones (you write your fake in secret). |
| **Draw Duel** | A shape flashes up for 4 seconds, then vanishes: redraw it from memory on your phone. 150 shapes (basic shapes, pictures like a rocket or a cat, letters and numbers), never repeated until you've seen them all. Each drawing is scored 0–100% for how closely it matches (size and position don't matter); the TV shows both drawings live and overlays the real shape at the reveal, and your phone shows your rival's drawing then too. 5 rounds, most points wins. |
| **Battleship** | Hide your 5 ships on your phone (tap a ship, tap where it goes, tap it again to turn it, or shuffle), then take turns firing at the enemy grid. The TV shows both oceans with every hit and miss; ships stay hidden until sunk. 30 s per shot. Sink the whole fleet to win. **⚡ Ultimate** (pick it in setup): each of you picks a commander, and each brings their own fleet, some of it angled (L, T and Z shapes and a 2 × 2 block, turning four ways): ⚓ Admiral Vega (the all-rounder), 🦈 Captain Mako (submarines that sonar can't see), 🧊 Commodore Frost (a fortress, with a shield), 🛰️ Engineer Nova (the scout), 🔥 Raider Ash (big guns), 🌪️ Admiral Tempest (a cross and a U) and 🦑 Captain Kraken (a hidden cross-shaped Leviathan). Every ship carries a skill you pay for with ⚡ energy (1 a turn and 1 for every hit): ✈️ Air Strike (3 in a line), 💥 Barrage (a plus of 5), 📡 Sonar (how many ship cells in a 3 × 3), 🌊 Torpedo (down a row to the first ship), 🎯 Double Shot and 🛡️ Shield (a secret 2 × 2 that stops the next hit on each ship cell under it). Lose a ship and its skill goes with it. Your commander's ⭐ special charges as you land hits: Lock-on (a line of 5), Wolf Pack (three torpedoes), Deep Freeze (they miss a turn), Full Scan (see the ships in a 5 × 5), Broadside (a 3 × 3), Typhoon (every other cell of a 4 × 4) or Deep Strike (a whole column). Every move plays out on the TV: explosions along the line, a torpedo's wake, a sonar sweep, a ship going down. 🤖 You can play it against the computer, Classic or Ultimate. Six seas: Open Sea, the Archipelago (islands), the Reef (rocks, and shallows only small ships fit), the Frozen Strait (ice that stops torpedoes), the Fog Bank (what a shot into the fog did shows only on your next turn, and torpedoes lose their way in it) and the Volcano (lava; after 8 turns it erupts once and hits every ship cell next to it, and if that sinks both fleets it's a draw). |
| **Word Race** | Boggle for two: the same letter grid on both phones and the TV. Swipe across touching letters (sideways, up/down or diagonally) to spell words of 3+ letters, checked against a ~275k-word dictionary; longer words score more (3–4 letters 1, 5 → 2, 6 → 3, 7 → 5, 8+ → 11). When the time's up, words you **both** found cancel out, so hunt for the rare ones (your phone lists your words and theirs at the end of each round). Before the match, either player picks the grid (4×4, 5×5 or 6×6), the time per round (1, 1½, 2 or 3 min) and the length (one round, best of 3 or best of 5); the hub remembers your choice, and at the end you can rematch or change them. **Race** mode: the first to the target points (20, 35 or 50) takes the round, words you both found count for both, and the round's time is only a cap (then more points wins). 🤖 Against the computer: it finds everyday words first, and fewer as they run out (more on Hard, which knows more words). |
| **Anagram Duel** | Both phones get the same five mixed-up letters: tap them in order to make a word that uses all five, and it goes off by itself once the last letter's in (⌫ takes one back). The first real word wins the round, and any real word counts, not only the one they came from. A wrong word locks you out for a second and a half, so tapping at random doesn't pay. Nobody in 30 seconds: no point, and the TV shows the word. The TV shows the letters and how far along each of you is (how many letters, not which). First to 5 rounds (or 3, or 7). 🤖 Against the computer: it takes a person's time to see each word (some come quicker than others), about 15 s on Easy, 9 on Normal, 5 on Hard. On your own? **Anagram Rush** in the 1 player lobby: as many words as you can in a minute. |
| **Five Letters** | Wordle for two phones: you both hunt the same hidden five-letter word, six guesses each, typed on your phone's keyboard. Every guess comes back coloured: 🟩 the right letter in the right spot, 🟨 in the word but somewhere else, ⬛ not in it (the keyboard keeps track). The TV and your rival see your colours but never your letters, until the round ends and the word is shown. Fewer guesses takes the round; the same number, whoever got there first. Only real words count (a made-up one shakes and costs nothing). 3 minutes a word. First to 3 rounds. On your own? It's in the 1 player lobby too, with a word of the day. 🤖 Against the computer (one phone is enough): it only sees its own colours, and takes a while over each guess like a person. |
| **Code Breaker** | Bulls and cows for two phones. Each of you sets a secret code of four different digits, then take turns guessing the other's. Every guess comes back with **bulls** (a right digit in the right place, gold) and **cows** (a right digit in the wrong place, silver). Crack it first to take the round; you both get the same number of goes, so if the second player cracks it on the same turn, it's level. Ten goes each at most. The TV shows both vaults and every guess, never the codes. |
| **Hangman Duel** | Each of you sets a secret word for the other on your phone (any real word of 4 to 10 letters; a made-up one comes back), or let the hub pick them. Then race, both at once: tap letters to guess theirs. A right letter shows everywhere it's in the word; a wrong one draws a bit more of your hangman, and seven wrong and you're out. Reveal the whole word first to take the round; time up (2½ minutes), the one who found more letters takes it. On your own? **Hangman** in the 1 player lobby is a run of the hub's words. |
| **Make 24** | Four numbers on a card, the same for you both. On your phone, tap a number, then + − × or ÷, then another: the two become one (fractions too). Keep joining till one number's left: make it 24 and you take the round, first to do it. Undo or start over any time. The TV shows the card and how far each of you has got. Every puzzle can be done; if nobody does it in 90 s (or you both give up), a way to do it is shown. First to 5. 🤖 Against the computer (one phone is enough): it needs longer for the harder ones, and Easy sometimes doesn't see it. |
| **Word Hunt** | One word search on the TV and both phones, with the list of words to find. Drag from a word's first letter to its last (or tap both): the first to mark a word gets it, in their colour, and it's crossed off for both. Find more than half the words and the grid is yours; after 3 minutes, whoever has more takes it. 8 × 8 hides 7 words across and down, 10 × 10 hides 9 with diagonals too, and 12 × 12 hides 11 any way, even backwards; the words nobody found are outlined at the end. Works with controllers too (a cursor each on the TV). First to 2 grids (or 1, or 3). **Race** mode (two phones): the same grid, but your own copy each on your phone. You can both find every word, your finds stay on your phone (the TV and your rival only see how many you have), and the first to find them all takes the grid; when time's up, more words takes it. On your own? **Word Search** in the 1 player lobby: find them all against the clock. |
| **Mini Golf** | Both of you play the same hole at once (the balls roll through each other). Pull back anywhere on your phone and let go to putt: the further you pull, the harder the shot; the phone shows the hole too. 15 holes with walls, bumpers, sand, water (a stroke penalty, back where you shot from), a moat and a windmill. 8 shots per hole, then you pick up and score 9; 90 s per hole. Pick 3, 6, 9, 12 or 15 holes before you start. Fewest strokes wins. |
| **Bowling** | Ten-pin bowling in 3D: ten frames on one lane, taking turns a frame at a time, with the score card along the top of the TV. On your phone, drag the ball to where you stand, then swipe it up the lane: the swipe's angle aims, its speed is the power, and a curve in it puts spin on the ball, which hooks once it's off the oil near the pins. With motion (the https page) you can swing the phone instead. Real pin action: the pins knock each other over, so the pocket (just beside the head pin) strikes most and a straight hit on the head pin leaves splits. Strikes and spares score as in a real game, with bonus balls in the 10th frame; the higher total wins. Pick 10 frames or a quick 5, and bumpers for no gutter balls. 🤖 Vs the computer: it curves into the pocket and goes after what's left for the spare; Easy throws wide and now and then into the gutter, Hard rarely misses its line. |
| **Connect Four** | The classic: drop discs into a 7×6 grid and line up four (across, down or diagonally) before your rival. Tap a column on your phone, which shows the board too. 20 s per move (a random column if you run out); who starts swaps every round. First to 3 rounds. |
| **Memory Match** | A grid of face-down picture cards on the TV and your phone. Take turns flipping two: a pair is yours and you go again, otherwise they turn back over (remember them!) and it's your rival's go. Most pairs wins. **Race** mode (two phones): the same cards on each phone, and you both flip at once on your own board (a mismatch stays up until your next flip); the first to clear every pair wins, and the TV shows only how many pairs each of you has. On your own? **Memory Pairs** in the 1 player lobby: clear the board in as few tries as you can. |
| **Micro Mayhem** | WarioWare-style: tiny games of 3-4 seconds, both of you at once. A big order flashes up (TAP IT! STOP IT! SHAKE IT! ODD ONE OUT! COUNT 'EM! SWIPE IT! DON'T TOUCH! QUICK MATH! PICK THE COLOUR! BIGGER NUMBER! LIGHTS OUT! SNAP! PUMP IT! CATCH IT! DODGE BALL!) and you have a moment to do it on your phone or controller. Miss one and you lose a ❤️; every 5 games the speed goes up. Last one with lives wins (both out at once: sudden death). 🤖 Against the computer: it reacts and times its taps like a person, and now and then slips (a tap on DON'T TOUCH!). |
| **Party Minigames** | Mario Party-style showdowns of 20-75 seconds: **Balloon Pump** (mash to pop yours first), **Hot Potato** (pass the bomb back before the secret fuse runs out), **Quick Draw** (fire on BANG!, too early loses), **Memory Path** (repeat the glowing path as it grows), **Sweet Spot** (stop your spinning number high, three times), **Coin Grab** (run around grabbing coins, dodge the 💣), **Tug of War** (pull on the beat), **Whack-a-Mole** (whack the moles in your colour, not theirs), **Fishing** (hook on the bite, reel without snapping the line), **Simon Says** (press the colour only when Simon says so), **Hurdle Dash** (a race over the same hurdles: jump each one just in time; clip one and you stumble), **Laser Dodge** (jump the low beams, duck under the high ones; three lives, the beams come faster) and **Pop the Most** (steer a crosshair and pop the balloons in your colour; gold is +3, spiky −2), **Safe Cracker** (turn the dial until it clicks, the phone buzzes and the lock light flickers, then TRY; three numbers open your safe), **Reflex Grid** (tap the lit squares before they fade; a dark one costs a point) and **Mirror Me** (remember the shape, then join the dots on your phone to draw it; three rounds, each a line longer; phones only, so nobody draws in plain sight on the TV), **Cannon Lob** (aim, hold FIRE to charge and lob it over the wall to knock your rival's tower down; watch the wind flag), **Stack Attack** (slide your tray to catch the falling crates; catch them off-centre and the stack leans until it topples), **Drum Beat** (tap the lane as each note hits the line: perfect, good or miss, with a bonus for a long streak) and **Musical Chairs** (circle the chair; when the music stops, sit first; sit while it's playing, or when it only dips, and you trip), plus nine in **3D** on the TV: **Tower Stack** (drop the swinging block; the overhang is cut off), **Bowling Bash** (swipe up the lane: the angle aims, the speed is your power; phones only), **Penalty Shootout** (pick a corner or a dive, in secret), **Glass Bridge** (left or right, row by row: one panel of each pair breaks), **Ice Rink Sumo** (slide on the ice and bump your rival off), **Bumper Cars** (ram your rival in the side or from behind for a point and spin them out; head-on doesn't count) **Paint Grab** (drive over the floor to paint it your colour, grab the paint buckets for a big splash; most tiles wins), **Archery** (aim, hold DRAW to steady the bow, let go to shoot; allow for the wind; three arrows each, or tilt the phone to aim) and **Curling** (swipe your stone down the ice, curve the swipe for curl, then tap SWEEP to carry it further; nearest the button wins), **Treasure Dig** (dig your patch of sand: each hole says 🔥 hot, ♨️ warm, 🌤️ cool or ❄️ cold for how close your chest is; first to dig up three chests), **Bubble Pop** (one grid of bubbles: tap a clump of two or more of your colour; gold counts double, and popping their clump costs you a point), **Bridge Builder** (take turns putting crates on a bridge balanced on a post: tip it and you lose; when it's full the cart rolls over and the heavier side loses) and **Pancake Flip** (flip when the meter's golden, catch it flat as it spins; crooked catches wobble the stack over; tallest stack wins), **Hot Air Race** (hold BURN to rise, let go to sink; the wind blows at different speeds at different heights and changes as you go: ride the fastest to the flag) and **Cup Stack** (build a pyramid of cups and take it back down, three times over, tapping LEFT or RIGHT as the strip shows; the wrong hand fumbles; first to finish wins). Two more you play by moving the phone: **Sword Duel** (when the arrow shows, slash your phone that way; too soon gives the point away) and **Pour It** (hold the phone up like a bottle and tip it sideways to pour, stand it up to stop: closest to the line without spilling). Fishing works with motion too (jerk to hook, wind the phone to reel), and Android phones buzz on a catch, a snap or a spill (iPhones can't vibrate from a web page, so a buzz only ever confirms what you did or a result, never warns you first; ⋯ → 📳 Test vibration checks a phone). Motion needs the secure (https) page; every motion game also has a button or swipe. A *Next up* card explains each one; tap Ready. Win a minigame for a ⭐, first to 3 wins. 🤖 Against the computer: it plays every minigame, with a person's reactions, timing and memory (Easy loses track of a long path), and only sees what your screen would. |
| **Party Board** | Mario Party-style: take turns rolling (tap to stop the die) and hopping around one of seven maps: 🏝️ Party Island and 🌊 Twin Lagoons (easy), 🔧 Pipe Works and 🌉 Sky Bridges (medium: a drawbridge across the middle is down for two rounds, then up for two, and while it's up you go the long way round), 👻 Haunted Maze and 🛒 Market Square (hard: two shops, and the shop prices, half to double, and the star price, 15 to 35, change every round) and 🌋 Volcano Peak (expert: stars cost 30, the shop 50% more). Bigger maps have 🔀 forks (pick your path; the phone previews what's ahead) and 🌀 warp spaces that fling you to a random space (anywhere but the start or another warp). **💀 Harsh mode** scatters ⚡ thunder (lose half your coins), 💀 skulls (lose a star) and 🌪️ tornadoes (blown anywhere). 🔵 +3 🪙, 🔴 −3, ❓ events (coin shower, swap places, steal, lucky, the star moves), 🎰 a slot machine, 🛒 the shop (🍄 +3 roll, 🎲 double dice, 🌀 warp, 🦹 coin thief, 👻 star thief; hold 3). Pass the ⭐ with 20 🪙 (more on the harder maps) to buy it. A party minigame after every round pays +10 🪙. Bonus stars at the end for the most minigames won and the most coins earned; most ⭐ wins. 🏁 The end screen recaps the match (in 3D the winner spins on a pedestal under confetti): stars, coins, minigames won, coins earned, spent and lost, stars bought and stolen, warps and bonus stars. 🤖 Against the computer: it heads for the star, saves for it, shops and uses its items, and plays the minigames. |

### 🎲 Dice & Board

| Game | How it plays |
| --- | --- |
| **Liar's Dice** | Your dice are hidden under a cup on your phone (the TV shows only how many each of you has). Take turns bidding how many of a face there are across *both* players' dice ("three 5s"): raise the count, or keep it and bid a higher face. Or call **Liar!**: the cups lift on the TV and both phones, and if there are fewer than bid, the bidder loses a die; otherwise the caller does. Ones are wild (they count as every face). Lose all your dice and you lose. Needs two phones (or one against the computer). Before the first match the TV plays a short example round (📖 How to play, a setting); during the game your phone explains each bid in plain words and shows the chance it's true. 🤖 Against the computer (one phone is enough): it only knows its own dice and plays the odds; Hard reads your bids and bluffs now and then. |
| **Dice Party** | Yahtzee-style: roll five dice up to three times, tapping the ones to hold between rolls, then score them in one of 13 boxes (ones to sixes, three and four of a kind, full house, small and large straight, five of a kind, chance). 63+ in the top boxes earns a 35 bonus. The TV shows the dice and both scorecards side by side (the numbers on the left, the combos on the right as 3× and 4× of a kind, FH full house, SM and LG straights, 5× five of a kind and CH chance), with what each open box would score. Highest total wins. 📱 **No TV needed**: pick the **Handheld** screen and each phone shows the whole scorecard (yours and theirs, the bonus and the totals) with the dice and Roll in a tray at the bottom; tap a box in your column, then tap it again to score. |
| **Crazy Eights** | The card game, for two phones: your hand is secret on your phone (the cards you can play light up), the TV shows the pile, the suit to follow and how many cards each of you holds. On your turn play a card that matches the top card's **suit or rank**, or an **8** at any time and call the new suit. Can't (or won't) play? Draw one: play it if it fits, or pass. With **action cards** on, a **2** makes the other player draw two (unless they answer with a 2 of their own: they stack), a **Jack** gives you another turn and the **Queen of ♠** makes them draw five. 30 s a turn (out of time: you draw and pass). First to empty their hand wins the hand and scores what's left in the other's: 8s 50, picture cards 10, aces 1, the rest face value. When the draw pile runs out, the played cards are shuffled back in. If there's nothing left to draw and neither of you can play, the hand goes to whoever holds fewer points. 🤖 Against the computer (one phone is enough): it only knows its own hand; it keeps its 8s for when it needs them, and Hard saves its 2s for your last cards. |
| **Checkers** | Classic draughts on the TV. Men step diagonally forward; jump to capture, and jumps are a must (a piece that can keep jumping must). Reach the far row to crown a ♛ king that moves both ways. Take every piece or leave your rival with no move; 40 moves without a capture is a draw. Tap a piece on your phone (the board turns so yours are at the bottom), then a ◯. 30 s per move. |
| **Dots and Boxes** | Take turns joining two neighbouring dots. Close the fourth side of a box to claim it and go again, so don't hand your rival a chain of boxes. When every line is drawn, the most boxes wins. Tap a line on your phone. 20 s per move. |
| **Mancala** | Kalah with 6 bowls a side. Pick a bowl of yours and sow its stones one by one counter-clockwise into the next bowls and your store (never your rival's). End in your store and go again; end in an empty bowl of yours with stones opposite and capture them all. When one side runs out, the stones left on the other side go to their owner's store, and the fullest store wins. Tap a bowl on your phone (your side is always at the bottom). 30 s per move. |
| **Reversi** | Othello rules on an 8×8 felt board, dark (Player 1) against light. Place a disc so it traps a straight line of your rival's discs between it and one of yours (across, down or diagonally), and they all flip to your colour. You must flip at least one; with no move you pass. When neither of you can move, most discs wins. The squares you can play glow on your phone; the TV keeps the count. 30 s per move (a random legal move if you run out); who starts swaps every game. 🤖 Against the computer: Easy goes for good squares, Hard looks four moves ahead and plays the ending out perfectly. |
| **Backgammon** | The classic race for two: 15 checkers each, round the board and off it. Roll two dice on your phone and move that many points (doubles: four moves). You can't land on two or more of theirs; land on a lone one and it's hit to the bar, and must come back in before its owner moves anything else. Once all yours are home, bear them off. You must use both dice if you can. Tap a checker, then where it goes (the places light up); **Undo** takes the turn back. A gammon (they've borne none off) scores double, a backgammon triple. The **doubling cube**: before you roll, double the stakes; they take it (and own the cube) or drop and lose. First to 3 points. 45 s a turn. 🤖 Against the computer: it plays out every way to use its roll; Hard counts the shots at its lone checkers and builds walls. |
| **Chess** | The full game: castling, en passant, promotion (pick the piece), checkmate to win; stalemate, threefold repetition, fifty moves and too little to mate are draws. A chess clock each (10 minutes; out of time loses) and a Resign button. Tap a piece on your phone (your side at the bottom) and the squares it can go to show; the TV shows the board, both clocks, the pieces taken and the moves. Colours swap each game. 🤖 Against the computer: Easy looks a move ahead (and slips now and then), Normal two, Hard three or four, following every capture through. |
| **Ludo** | For two: your yard top left, theirs bottom right. Roll a **6** to bring a pawn out (a 6 rolls again), move by the roll, and land on a lone pawn of theirs to send it back to their yard (not on a ★ or a start square). After a lap, your pawns head up your home path and need the exact roll. First to bring all four home. Tap Roll on your phone, then the pawn to move (the TV numbers them). 🤖 Against the computer: Hard keeps out of reach of your pawns. |
| **Five in a Row** | Gomoku on a big 15×15 grid: take turns placing a stone, and the first to line up **five** of yours across, down or diagonally wins. Turn on **captures** (Pente's rule) and placing a stone either side of exactly two of theirs takes that pair off; five pairs taken also wins. Tap a point on your phone to aim, tap again (or **Place**) to put your stone down. Who starts swaps every game. 30 s a move (run out and a stone goes down for you). |
| **Nine Men's Morris** | Nine pieces each on a board of three squares joined at the sides. Take turns placing your pieces, then slide them along a line to the next empty point. Three of yours in a line is a **mill**: take one of theirs off (not one in a mill, unless they all are). Down to three, your pieces **fly** to any empty point. Leave them with two, or with no move, and you win; fifty moves without a mill is a draw. Who starts swaps every game. 30 s a move. |
| **Dominoes** | The draw game with a double-six set, for two phones: seven tiles each, secret. Match a number at either end of the line; can't, and you draw from the boneyard (pass when it's empty). Play your last tile to score the pips left in their hand; if neither of you can go, the lower count wins the hand. First to 100. 🤖 Against the computer (one phone is enough): Hard remembers what you couldn't match. |
| **Mine Duel** | One minefield (12×12, 25 mines) and here you *want* the mines. Take turns digging a square: a mine is yours, with your flag on it, and you go again. A safe square shows how many mines touch it (an empty one opens up around it) and it's your rival's turn, so a careless dig hands them clues. First to 13 mines wins. Tap a square on your phone. 25 s a turn (a random square if you run out). 🤖 Against the computer: it reads the numbers like a person; Hard works out mines from two numbers together. On your own? **Minesweeper** in the 1 player lobby: the classic, clear the field without a bang. |
| **Blackjack** | Beat the dealer for play chips (never money). You both start with 1,000 and bet each hand from your phone (25 to 500, or all in), then play the same dealer: hit, stand, double down on your first two cards or split a pair. **You both get the same cards** (the same next card if you hit), so your choices and your bets decide it, not luck; while you play, your rival's extra cards stay face down. The dealer hits to 17 and stands on every 17; blackjack pays 3 to 2. Most chips after 8 hands wins (out of chips ends it early). 🤖 Against the computer: it plays by the book and bets to the match. |
| **Gin Rummy** | The card game, for two phones: ten cards each, secret on your phone, grouped for you into **melds** (three or four of a rank, or three or more in a row in a suit) with the rest, your deadwood, counted. Take the top of the deck or the discard pile, then throw one away. With 10 or less left over you can **knock**: both hands go down (on the TV too), your rival lays off what fits on your melds, and you score the difference. **Gin** (nothing left over) scores 25 more; if your rival ends up with as little as you, it's an **undercut** and they score. First to 100. 🤖 Against the computer (one phone is enough): it only sees its own hand; Hard keeps the cards with the most ways to become a meld and won't throw you what you're collecting. |
| **Colour Clash** | Our own Uno-style card game, for two phones: match the top card's **colour** or what's on it, or play a **Wild** any time and pick the colour. Can't? Draw one, and play it if it fits. **Skip** and **Reverse** give you another turn (there are only two of you), **Draw Two** and **Wild Draw Four** make the other draw and lose their turn. Down to one card? Tap **CLASH!** before you play your second-to-last card, or the other can catch you (two cards). Every colour has a shape too (▲ ■ ● ★), so they're told apart without the colours. Out of cards: you score what's left in their hand (numbers face value, symbols 20, wilds 50). First to 200. 🤖 Against the computer (one phone is enough): it only knows its own hand; Hard saves its Draw Fours for when you're nearly out. |

### 🎨 Casual

| Game | How it plays |
| --- | --- |
| **Sketch & Guess** | One of you picks a secret word (easy, medium or hard, from 400) and draws it on your phone with colours, undo and an eraser; the other watches it appear on the TV and their own phone and types guesses (near misses get a "so close!"). Letters are hinted as time runs out. Team up for stars: faster and harder words earn more. 6 rounds, taking turns to draw. |
| **Bomb Squad** | A co-op bomb-defusal game for two phones. One of you has the bomb on your phone, the other has the defusal manual on theirs, and neither may look at the other's screen. The defuser describes, the expert finds the rules and says what to do. Seven kinds of module: **wires** to cut, a **button** to tap or hold, **symbols** to press in order, **password** letter wheels, **Simon** (press the colours the manual's table gives for each flash; it changes with strikes), a **maze** with invisible walls (the green markers say which maze it is) and **switches** set by their lights. **Every bomb comes with a freshly dealt rulebook** (the edition code is on both phones), so there's no learning the manual by heart. Three strikes or the timer running out and it goes 💥. The TV shows the countdown, strikes and which modules are done. You swap roles every bomb and collect stars (more for time to spare). Easy, Normal, Hard or Expert (2 to 6 modules), 1, 3 or 5 bombs. |
| **Marble Maze** | Co-op in 3D: a marble on a wooden maze board that you tilt together. One of you tilts it left and right, the other forwards and back (or pick *Shared* and both steer everything). Roll it to the green goal without dropping it down a hole (down one, it's back to the start). Phones use the 🕹️ joystick, ✛ D-pad or 📱 tilt pad; controllers use the stick. Stars for each maze: three within par time. Eight mazes, from *First roll* to *The gauntlet*, plus three with moving parts: *Sliding door* (an orange block slides along a groove: cross while it's away, or it squashes you), *Conveyor belts* (they push the marble the way their arrows point) and *Button and gate* (roll over the red button to open the red gate). 🤖 With the computer as your teammate: it tilts its half (or, in Shared, lends a hand), steering round the holes, waiting for the sliding block and heading for the button first; Easy lets the marble run a bit fast. |
| **Tower Stack** | Co-op stacking in 3D: build one tower together, a block at a time. Each new block slides back and forth over the top; tap **DROP** on your phone (or **A**) and whatever hangs over the edge is cut off and falls, so the tower (and every block after it) gets narrower. Drop it dead on and it snaps into place whole; three of those in a row and the blocks start growing back. You take turns: player 1 drops the blocks sliding left-right, player 2 the ones sliding front-back. Missing the tower costs one of your shared lives (3, or 5 on Easy) and you try that floor again. It speeds up as it grows. Stars for height (15, 35 and 60 floors; 10, 25 and 40 on Easy). 🤖 With the computer as your teammate: it times its drops as the block crosses the middle; Hard is nearly always dead on, Easy cuts it often. |
| **Trivia Quest** | Co-op quiz: the two of you against three monsters in a row, a 🦠 Goo Blob, a 🗿 Stone Golem and the 🐉 Dragon, each with a health bar, while you share a row of ❤️ hearts. Every turn is a question from the Quiz Battle bank (mixed or one topic); you both answer secretly on your phones (talk it over first: that's the point) and it's revealed when you've both answered (there's no timer unless you pick **Timed** in setup: then 15 s a question, 12 s against the Dragon, and the faster a right answer comes the harder it hits). A right answer hits the monster, and both right is a ⚡ **team strike** for half as much again; every wrong or missing answer costs a heart. Beat a monster for up to ⭐⭐⭐ (3 with no hearts lost against it, 2 with one, 1 otherwise), so a perfect quest is 9 ⭐; run out of hearts and the quest ends with the stars you have. Each of you has one 💡 **50/50** per quest: it takes two wrong answers off your own phone. Rematches don't repeat the last quest's questions. |
| **Kitchen Rush** | Co-op cooking, seen from above on the TV: two chefs (in your colours) serve the orders before they run out. Walk with your phone's pad (joystick, D-pad or tilt) or a controller's stick; **ACTION** picks up, puts down and serves whatever you're facing, and you hold **CHOP** at a chopping board. Tomatoes and lettuce need chopping, meat cooks on a stove (and **burns** if you leave it), buns are ready as they are: put them on a plate and hand it in at the hatch. Order tickets come in along the top (🍔 burger, 🍔🥬 lettuce burger, 🍔🥬🍅 the works, 🥗 salad, and in the Food Truck 🧀 cheeseburger and the deluxe with everything), each with its own timer: a dish served earns coins plus a tip for speed, an order that runs out costs some. Four kitchens: the open **Diner**, **Split** (buns, meat and stoves on one side, the vegetables, plates and hatch on the other: pass things over the counter), **Rush Hour** (split, with orders coming faster) and the **Food Truck** (a narrow kitchen with a cheese crate, and two serving hatches that take turns: only the open one takes dishes). Stars at the end of the shift by the coins earned, with targets set by how many orders the shift brings (shown on the TV). 🤖 With the computer as your teammate: it takes whatever job helps most (meat off before it burns, chopping, plating up, serving, fetching what the orders still need), counts what you're carrying so it doesn't double up, and in the Split kitchen passes things over the middle. |
| **Dungeon Duo** | Co-op dungeon crawl in 3D: a 🛡️ **Fighter** and a ✨ **Healer** fight their way down five floors together (or three, for a short quest). Walk with your phone's pad (joystick, D-pad or tilt) or a controller's stick. **ATTACK** swings the Fighter's sword at whatever is in front, or fires one of the Healer's bolts. **SPECIAL** is the Fighter's shield (hold it: hits from the front are blocked and enemies shoved back, but you walk slower) or the Healer's healing circle (a heart a second for anyone standing in it, then a wait before the next). Enemies hurt on touch: slimes, bats and skeletons that throw bones from a distance. At no hearts you're down, and your partner revives you by standing beside you; both down and it's back to the start of the floor, which costs a continue. **The Cellar**: find the key, open the door, take the stairs together. **The Crypt**: spikes that go up and down, a gate that only stays open while one of you stands on a plate, and skeletons. **The Ice Caves**: a frozen lake you slide on, and big slimes that split in two when you beat them. **The Armory**: arrow traps that fire across the hall on a beat (the shield stops them), and an iron door that opens once you're both standing on its two levers at the same time. **The Warden's Hall**: the Stone Warden. Get out of its red ring before it slams, step out of its lane when it charges (a wall, or a raised shield, stuns it for a moment), and watch out for the help it calls at half health. Beat it to win. Stars for finishing, few retries and a good time. 🤖 With the computer as your teammate (the Fighter or the Healer, whichever you aren't): it fights, heals you, comes to revive you, dodges the Warden, holds the plate for you at a gate, takes the other lever, steers against the slide on ice, fetches the key and waits for you on the stairs. |
| **Mind Meld** | Co-op guessing on a scale, Wavelength-style. The TV shows a scale like *Cold ↔ Hot*; the clue-giver's phone shows a secret target on it, and they type a clue ("tea"). The other turns the dial (drag it on the phone, or the stick on a controller) and locks in: dead on is ⭐⭐⭐, close is ⭐⭐ or ⭐. 60 scales; you swap who gives the clue every round (a controller player always guesses). |
| **Air Hockey** | The whole table is on your phone too, upright and turned so your goal is at the bottom: slide your mallet and smash the puck into their goal. Watch the phone or the TV. A slow puck left on one side for 7 seconds drifts over to the other. First to 7. |

### 👤 Solo (1 player)

The 1 player games (switch the lobby to **👤 1 player**): one of you plays and chases your own best.
They came from Ark 1P Hub. Games with a 1v1 twin here have **1P** after their name for now (Brick Breaker 1P
and Brick Breaker Duel, Stack 1P and Tower Stack…): each pair is becoming one game, one pair at a time.
These already are, the 2 player game played on your own: **Snake**, **Five Letters**, **Hangman**, **Anagram Rush**,
**Memory Pairs**, **Reaction Rush**, **Trivia**, **Word Search** and **Minesweeper**.

- **📅 Daily challenge** (the card after 🎲 Random in the 1 player lobby): one game a day, the same deal
  for everyone (the same board, pieces or questions), one go each. Each day's runs have their own
  high-score table, and a new challenge comes at midnight (UTC).
- **Achievements**: every solo game has a few to unlock (eat 25 in Snake, clear a level of Sokoban
  without a restart…), plus some for the hub as a whole. They're on your **🏆 Trophies** page, under
  👤 Solo achievements, and each game's card in the lobby shows how many you have.
- **Unlockable looks and levels**: some looks (snakes, card backs, dogs…) and levels (Dog Park,
  Sokoban, Helicopter Cave's maps) open as you play; the setup screen shows 🔒 and what opens each.
- **Your pages** (from your phone's 1 player lobby, or the Trophies page): **📊 My stats** (runs,
  favourite games, new personal bests, the last two weeks), **🎁 Collection** (every look and level,
  open or still locked) and **📅 Daily calendar** (the days you played and your streaks).
- **📱 Phone only, no TV**: open **/phone** on your phone (the same address as the TV's, with
  `/phone` on the end, or tap *No TV? Play the 1 player games on this phone alone* under the join
  form). Type your name and play: the phone opens a room of its own, with every solo game and the
  daily challenge, your bests and achievements as on the TV. The phone plays the sounds itself
  (🔊 in its ⋯ menu). The arcade games and 2048 split the screen: the game on top and the controls
  underneath (side by side when the phone is turned sideways). It works at home, not over the internet.

#### 🕹️ Arcade

| Game | How it plays |
| --- | --- |
| **Snake** | The classic, in Snake Battle's arena with just your snake: eat the glowing food to grow, don't hit a wall or your own tail. Every 4 bites the snake speeds up. Tap a side of the phone pad or swipe to turn (turns can be chained in one swipe); the arena is on your phone too. Before you start, pick the speed (Normal or ⚡ Fast) and the walls (🧱 Solid, or 🌀 Wrap round: come out on the other side). ⏸ Pause on the phone (or Start on a controller). Snakes to unlock (just for looks): 🌈 Rainbow (eat 10), 💜 Neon (25) and 👑 Gold (50). Score: food eaten; each speed and wall setting keeps its own bests. |
| **Brick Breaker 1P** | Keep the ball in play with your paddle and smash the wall. Slide a finger along the phone's strip to move the paddle (or the stick / D-pad). Where the ball hits the paddle sets its angle, and it speeds up a little on every hit. Higher rows score more (1, 3, 5, 7 points). Clear the wall for a new, faster level with a different pattern (and a life back); lose the ball 3 times and it's over. 🚀 Launch on the phone, or it goes by itself after 3 s. Pick 3 lives or 5 (easy, with its own scores). Ball and paddle styles to unlock (just for looks): 🔥 Fireball (clear a wall), 💎 Crystal (reach level 4) and 🌈 Rainbow (score 1,000). |
| **Blocks 1P** | The falling-block classic: pieces of four squares drop into a 10×20 well. Move and turn them so they fill whole rows, which clear. Every 10 rows the level goes up and pieces fall faster. Clearing several rows at once scores far more (100, 300, 500 or 800 points for 1 to 4 rows, times the level), plus a point a row when you drop a piece yourself. **Hold** puts a piece aside for later (once per piece); the TV shows it, the next three pieces and a shadow where yours will land. On the phone: ◀ ▶ move (hold to repeat), ⟲ ⟳ turn, ▼ soft drop, **⤓ Drop** drops it at once. Pieces come in shuffled sets of seven, so you never wait long for a straight piece. The run ends when a new piece has no room. Piece colours to unlock (just for looks): 🍬 Candy (clear 4 rows at once), 🟩 Retro green (40 rows in a run) and 💜 Neon (score 10,000). |
| **Flappy** | Tap the phone's big button to flap; the bird falls the rest of the time. Fly through the gaps between the pipes without touching them or the ground (the top just stops you). The pipes come a little faster and the gaps get a little smaller as you go. The first tap starts the run. Fly as something else (just for looks): a 🦇 Bat (10 pipes), a 🐧 Penguin (25) or a 🐉 Dragon (50). Score: pipes passed. |
| **Asteroids 1P** | Turn your ship, thrust and shoot. Big rocks split in two when you hit them, middle ones split again, small ones are gone; everything wraps round the edges of the screen. A rock that hits you costs a ship (3 to start, you come back in the middle and blink, safe, for a moment). Clear the screen and a bigger wave comes. On the phone: hold ⟲ ⟳ to turn and 🔥 Thrust to fly, tap 💥 Fire (a few shots at a time). Ships to unlock (just for looks): a 🚀 Rocket (wave 3), a 🛸 Saucer (wave 6) and ✨ Gold (score 10,000). Score: 20 for a big rock, 50 a middle one, 100 a small one; an extra ship every 10,000. |
| **Invaders** | Rows of aliens march side to side, step down at each edge and drop bombs: slide your cannon along the bottom and shoot them all before they land. One shot on screen at a time. Four bunkers give cover, and get chewed away by shots from both sides. The fewer aliens left, the faster they march; now and then a saucer flies across the top for a bonus. Clear a wave and the next starts a little lower. On the phone: slide a finger along the strip to move, tap 🔫 Fire. 3 lives. Invaders to unlock (just for looks): 🐙 Ocean (clear a wave), 👻 Spooky (shoot a saucer) and 🍭 Candy (score 5,000). Score: 10 to 30 an alien (the top rows are worth more), 50 to 300 a saucer. |
| **Runner** | You run on and on: jump the cactuses (one to three together, short or tall) and duck under the birds (low ones you can jump, high ones fly over you). Hold JUMP for a higher jump. The run gets faster the further you go. Your first jump starts it. Run as someone else (just for looks): a 🤖 Robot (100 m), a 🦖 Dino (500 m) or a 🥷 Ninja (1,000 m). Score: how far you got, in metres. |
| **Stack 1P** | A block slides back and forth above the tower: tap (the phone's big DROP button) to drop it. The part hanging over the edge is cut off and falls away, so the blocks get narrower; drop it right on top for a **Perfect!** and nothing is lost, and every third perfect drop in a row wins a little width back. Miss the tower and it's over. It speeds up as the tower grows. Block styles to unlock (just for looks): 🍬 Candy (10 blocks), 🧊 Glass (25) and 👑 Gold (5 perfect drops in a row). Score: blocks stacked. |
| **Helicopter Cave** | Hold the phone's big CLIMB button to rise, let go to drop, and fly down a winding cave without touching the walls. The cave gets narrower and faster the further you go, and after a while rocks stick out of the ceiling and the floor. The first hold takes off. Four maps, each with its own scores: the 💎 Crystal Cave, then the ⛏️ Old Mine (wooden props everywhere, unlocked by flying 100 m), the 🧊 Ice Tunnel (twistier, icicles; 300 m in the mine) and the 🌋 Volcano (faster; 300 m on the ice). Flying far also unlocks new things to fly (just for looks): a Jet (500 m), a UFO (300 m in the Volcano) and a Dragon (1,000 m). Locked choices show on the setup screen with what opens them. Score: metres flown. |
| **Bubble Shooter** | Coloured bubbles hang from the ceiling. Drag on the phone to aim the launcher (the TV shows the line, bouncing off the walls) and let go to fire: the bubble sticks where it touches, three or more of a colour together pop, and anything left hanging from nothing falls (worth double). Five shots in a row that pop nothing and the whole ceiling comes down a row; a bubble on the red line at the bottom ends it. Clear the board for 1,000 and a new one with another colour. Score: points. |
| **Road Hopper** | Get the frog to the far bank: hop across five lanes of traffic (cars and trucks, each lane its own speed), rest on the verge, then cross the river on the logs. Cars squash you, the water's deadly, and a log carries you along, off the edge if you stay on too long. Tap the phone's arrows or swipe. Three frogs, and 30 seconds for each go. Every crossing scores 50 plus 2 for each second left, and the next crossing is faster; each row further than before is 10. Score: points. |

#### 🧩 Puzzle

| Game | How it plays |
| --- | --- |
| **2048** | Swipe on the phone (or tap a side of the pad) to slide every tile on the 4×4 board; two equal tiles that bump into each other merge into their sum, which is added to your score. A new 2 (sometimes a 4) appears after every move. Make a 2048 tile and keep going; the run ends when nothing can move (or tap **End this run** twice). Tile looks to unlock (just for looks): 🌊 Ocean (make a 512) and 💜 Neon (make 2048). |
| **Minesweeper** | Mine Duel's field, the other goal: open every cell that isn't a mine. A number counts the mines in the 8 cells around it. Tap to dig, hold to flag (or switch the phone to 🚩 flag mode); tapping a number whose mines are all flagged opens the rest around it. The first cell you open is always safe. Three fields: Easy 9×9 (10 mines), Medium 16×16 (40), Hard 30×16 (99, shown turned on an upright phone). Score: your time, only when you clear the field; lower is better, and each field has its own bests. |
| **Sudoku** | Fill the 9×9 grid so every row, column and 3×3 box has 1 to 9 once each. Tap a cell on the phone, then a number; ✏️ Pencil switches to small notes (a number you place rubs out the same note around it), ⌫ clears. The picked cell, its row, column and box, and the same number elsewhere are shaded on the TV and the phone; two of the same number in a line or box turn red (that only says they can't both be right, not which is wrong). Every puzzle is made fresh with exactly one solution: Easy (40 numbers given), Medium (32) or Hard (26). Pausing hides the grid. Score: your time, per difficulty. |
| **Solitaire** | Klondike: build the four foundations up by suit from ace to king. In the seven columns cards go down in alternating colours, a face-up run moves together, and only a king goes into an empty column. Tap the stock to turn cards over (one at a time, or three: pick on the setup screen, each has its own scores); when it runs out it turns back over. **Tap a card and it goes where it fits** (home first). If it can't go anywhere it's picked up: tap where it should go. Undo as often as you like. Once every card is face up, ✨ Finish sends them all home. Score: your time; a game you give up on doesn't count. Card backs to unlock (just for looks): 🌌 Midnight (finish a game), 🌹 Rose (finish a Draw 3 game) and 👑 Gold (finish in under 5 minutes). |
| **FreeCell** | All 52 cards dealt face up into eight columns, plus four **free cells** that each hold one card for a while. Build the foundations up by suit from ace to king; in the columns cards go down in alternating colours, and any card can go into an empty column. A run of cards moves together if there's room to do it one card at a time (free cells + 1, doubled for each empty column). **Tap a card and it goes where it fits** (home, a column, then a free cell); if it can't, it's picked up and the next tap puts it down. Undo as often as you like; ✨ Finish sends everything home once every column is in order. Nearly every deal can be won. Score: your time; a game you give up on doesn't count. Looks to unlock: 🎨 Four colours (each suit its own colour; win a game), 🟩 Green felt (win in under 8 minutes) and 🌙 Night cards (win in under 120 moves). |
| **Mahjong Solitaire** | A pile of 76 tiles in four layers: take away matching pairs until it's gone. A tile can be taken when nothing lies on top of it and its left or right side is open (those are bright; the others a little dimmer). Every deal can be cleared, since it's dealt by playing the game backwards. Stuck? **Undo**, or **🔀 Shuffle** what's left (+30 s); **💡 Hint** lights up a pair (+15 s). Score: your time; giving up doesn't count. Tile colours to unlock: 🟢 Jade (clear the pile), ⚫ Ink (clear it without help) and 🌸 Rose (clear it in under 10 minutes). |
| **Sliding Puzzle** | Numbered tiles in a square with one gap: slide them back into order, 1, 2, 3… with the gap at the bottom right. Tap a tile in line with the gap to slide it (and any tiles between) over, or swipe. Every shuffle is made of real slides, so it can always be solved. 3×3, 4×4 or 5×5. The clock starts with your first slide. Score: your time, per size. |
| **Gem Swap** | Swap two touching gems to line up three or more of a colour: they vanish, the gems above fall and new ones drop in, and any new lines vanish too (a chain, each step scoring more). A swap that makes no line doesn't happen. Swipe a gem into its neighbour, or tap one then the other. 30 swaps; a board with no moves left is reshuffled. Gem sets to unlock (just for looks, every gem keeps its own shape): 🍒 Fruit (line up 5), 🪐 Space (a chain of 4) and 🍬 Candy (score 3,000). Score: 10 a gem, +50 for a line of four, +150 for five, times the chain step. |
| **Sokoban** | You're the warehouse worker: push every box onto a target (a box on one turns green). You can only push, one box at a time, never pull, so a box shoved into a corner is stuck: ↶ **Undo** or ↺ **Start again**. Ten levels, from one box to seven, each opened by solving the one before (the setup screen shows which are open), each with a par: the fewest moves it can be done in. Walk with the phone's arrows or swipe on the board. Score: the moves it took (fewer is better), per level. |
| **Nonograms** | Picture logic: the numbers by each row and column are the runs of filled squares in that line, in order ("3 1" means three filled, a gap, then one). Fill squares until every line matches and the picture appears. On the phone tap a square, or drag across several, to fill them; switch to ✕ **Cross out** to mark squares you know are empty. A line whose filled squares match its numbers turns grey. Every puzzle is a fresh random picture that can be solved one line at a time, without guessing. 5×5, 10×10 or 15×15. Pausing hides the grid. Score: your time, per size. |
| **KenKen** | Fill the grid so each row and column has every number once (1 to 4 on a 4 × 4, up to 6). The heavy outlines are cages: each cage's numbers make its target with its sign (add them, multiply them, or for two squares the difference or the division, bigger first); a one-square cage just gives its number. Tap a square on the phone, then a number; clashes show in red. Every puzzle is new and has exactly one answer. 4 × 4, 5 × 5 or 6 × 6. Score: your time, per size. |
| **Mastermind 1P** | The hub picks a secret code of coloured pegs (a colour can come up more than once). Tap colours on the phone to fill a row of pegs and press **Guess**: you're told how many are the right colour in the right place (⚫) and how many more are a right colour in the wrong place (⚪), but not which. Crack it in ten guesses. Every colour has a number too, so it plays without colour. Easy (4 pegs, 6 colours), Normal (4, 8) or Hard (5, 8). Score: the guesses it took (fewer is better), per level; a code you don't crack doesn't count. |
| **Flood-It** | A square of coloured cells, and you own the top-left corner. Pick a colour on the phone: your whole area turns that colour and swallows the matching cells beside it. Flood the entire board before the moves run out. The move limit is worked out for each board (a computer player's go, plus two spare), so every board can be done. Every colour has a number and a shape too. 10 × 10, 14 × 14 or 18 × 18. Score: the moves you used (fewer is better), per size; running out doesn't count. |
| **Color Lines** | A 9 × 9 board with a few coloured balls. Tap a ball, then an empty square it can walk to (up, down, left, right, round the other balls). Then three more balls drop in, and the next three colours are shown ahead. Line up five or more of one colour, across, down or diagonally, and they vanish; a move that clears a line earns the turn back, with no new balls. Every colour has a shape too. It ends when the board is full. Score: points (the longer the line, the more it's worth), higher is better. |
| **Dog Park** | The park is split into coloured areas: put one dog in every row, every column and every area, and no two dogs may touch, not even corner to corner. Trees and water take no dog. Tap a square for a ball ("no dog here"), again for a dog, again to clear it, or drag across the park to drop balls; **Fill** puts a ball on every square your dogs already rule out. Dogs that break a rule light up red. Every park has exactly one answer, so it's all logic, no guessing. 36 levels from 5 × 5 up to an Expert pack of 13 × 13, each opened by solving the one before (each with a par time), or a new random park of 7, 9 or 11 squares a side. Play with a golden retriever, or unlock the Aussie (and its bones) by solving your first park. **Hint** puts right one thing that's wrong, or places a dog, for 30 s. Score: the time it took (lower is better), per level or size. |
| **Lights Out** | A 5 × 5 grid of lights, some on. Tap a light to flip it and the four next to it (on goes off, off goes on): switch them all off. Every puzzle is made by flipping lights on a dark board, so it can always be solved, and par is how many flips made it. ↺ **Start again** puts the board back (the moves keep counting). Easy (par 4), Medium (8) or Hard (13). Score: the moves it took (fewer is better), per level. |
| **Word Search** | Word Hunt on your own, every word yours to find: Words are hidden in a grid of letters in straight lines: drag on the phone from a word's first letter to its last (or tap both) to mark it. The list says which words to find and crosses them off. 8 × 8 hides 6 words across and down, 10 × 10 hides 8 with diagonals too, and 12 × 12 hides 10 any way at all, even backwards. Score: your time to find them all, per size. |

#### 🧠 Brain

| Game | How it plays |
| --- | --- |
| **Simon** | The TV lights the four pads (each with its own note) in a sequence; tap them back in the same order on your phone's four big pads. Every round adds one more and plays a little faster. One wrong pad, or 5 s without a press, and it's over. Score: the longest sequence you repeated. Pad finishes to unlock (same four colours, as on the controller): 🍬 Pastel (repeat 10) and 💜 Neon (repeat 20). |
| **Memory Pairs** | Memory Match on your own: the cards lie face down: turn two over. A pair stays face up; two different ones turn back after a moment, so remember where they were. Find every pair in as few tries as you can: 4 × 4 (8 pairs), 6 × 4 (12) or 6 × 6 (18). Score: the tries it took (fewer is better), per size. Face sets to unlock: 🍕 Food (find every pair), 🐠 Sea (clear 4 × 4 in 12 tries or fewer) and 🚀 Space (clear 6 × 6). |
| **Five Letters** | Five Letters on your own: find the hidden five-letter word in six guesses, typed on the phone's keyboard (or the TV's, or with a controller). After each guess the letters turn green (right place), yellow (in the word, elsewhere) or grey (not in it), and so do the keyboard's keys. Guesses must be real words. 📅 **Today's word** is the same for everyone and can be played once a day (a new one at midnight UTC; a second go shows how you did); 🎲 **Practice** gives a new word every time. Score: the guesses it took; a word you don't find doesn't count. |
| **Reaction Rush** | Reaction Duel on your own: the screen says **Wait…** (red), then after a random moment **TAP!** (green): hit the phone's big button as fast as you can. Five rounds. Tap before green and it's a false start: that round starts again and 100 ms goes on your time. Score: your average time plus penalties, in ms (lower is better). No music, so you can concentrate. |
| **Quick Maths** | Sums against the clock: pick the right answer of four on the phone's big buttons. They start easy (adding small numbers) and get harder every 5 right answers: taking away, times tables, then a mix with dividing and bigger numbers. 60 seconds; a wrong answer costs 3 of them. Score: right answers. |
| **Colour Trap** | A colour's name shows up written in another colour: tap the colour of the **ink**, not what the word says (BLUE written in red is red). Your brain wants to read the word; that's the trap. 45 seconds; a wrong answer costs 3 of them. Score: right answers. |
| **Anagram Rush** | Anagram Duel on your own, against the clock. Five mixed-up letters: tap them in order to make a word that uses all five, and it goes off by itself once the last letter's in (⌫ takes one back). Any real word counts, not only the one they came from. 60 seconds; ⏭ **Skip** shows the word but costs 3 seconds. Score: words made. |
| **Number Memory** | A number shows on the TV for a moment (longer for longer numbers), then hides: type it back on the phone's keypad. Right, and the next one is a digit longer, starting from 3. Miss once and you get another number the same length; miss twice and it's over, with the digits you got wrong shown. Score: the most digits you remembered. |
| **Odd One Out** | A grid of squares all the same colour, except one a shade lighter or darker: tap it (on the phone, the same grid). Each find makes the grid bigger (3 × 3 up to 8 × 8) and the difference smaller. A wrong tap costs 3 seconds; 60 seconds in all. Score: odd ones found. |
| **Hangman** | Hangman on your own: the hub hides a word behind blanks; tap letters on the phone's keyboard (or on the TV, with its keyboard or a controller) and the right ones fill in. Seven wrong letters and the man is hanged: the run is over, and the word shows. Each word is worth 100 plus 20 for every wrong letter you didn't use, and the next word follows straight away. Score: points over the run. |
| **Trivia** | Quiz Battle on your own: twelve of its questions, four answers each, 15 seconds a question. A right answer scores 100, plus up to 100 more the faster you are; wrong or too slow scores nothing, and the right answer shows for a moment either way. Quiz Battle's 250 questions: play a mix, or pick a topic (each has its own scores). You won't see a question again until you've seen them all. Score: points. |

**Every game opens on a setup screen** where either player picks the match
settings on their phone (or a controller: ↑↓ picks a row, ←→ changes it, A
starts). The numbers above are the defaults; you can change, for example:

| Game | Setting |
| --- | --- |
| Reaction Duel, Rock Paper Scissors | Points to win: 3, 5 or 7 |
| Pong | Points to win: 3, 5, 7 or 11 |
| Volley Blobs | Points to win: 5, 7 or 11 |
| Brick Breaker Duel | Wall: 3, 5 or 7 rows of bricks; missed ball: a brick comes back, or just a moment lost |
| Asteroid Duel | Round wins needed: 2, 3 or 5 |
| Rally Tennis | Games to win: 3, 4 or 6 |
| Falling Blocks Battle | Round wins needed: 1, 2 or 3 |
| Air Hockey | Goals to win: 5, 7 or 10; own goals: count, or don't (your goal bounces out a puck you touched last) |
| Light Cycles, Snake Battle, Tank Duel, Sumo, Bomb Duel | Round wins needed: 2, 3 or 5 |
| Tower Defence Duel | 10, 20 or 30 lives |
| Connect Four | One round, or first to 3 or 5; timed (20 s a move) or no timer |
| Quiz Battle | 5, 10, 15 or 20 questions, and the topic (mixed or one category) |
| Fake Out | 4, 6 or 8 rounds; timed (60 s to write, 20 s to pick) or no timer |
| Draw Duel | 3, 5, 7 or 10 rounds; timed (20 s to draw) or no timer (draw until you both press Done) |
| Battleship | Classic or ⚡ Ultimate, the sea for Ultimate (Open Sea, Archipelago, Reef, Frozen Strait, Fog Bank, Volcano or any), and 15, 30 or 60 s per shot, or no timer (placing and firing wait for you) |
| Sketch & Guess | 4, 6, 8 or 10 rounds |
| Bomb Squad | Easy (2 modules), Normal (3), Hard (4) or Expert (6), and 1, 3 or 5 bombs |
| Marble Maze | 1, 3, 5 or all 8 mazes; split (one ↔, one ↕) or shared controls |
| Tower Stack | Normal (3 lives) or Easy (slower blocks, 5 lives, an easier perfect) |
| Trivia Quest | The topic (mixed or one category), Easy (7 hearts), Normal (5) or Hard (3), and no timer (the usual: a question waits for you both) or timed (15 s a question, 12 s for the Dragon, and faster hits harder) |
| Kitchen Rush | The kitchen (Diner, Split, Rush Hour or Food Truck) and a 2, 3 or 4 minute shift |
| Dungeon Duo | Who's the Fighter and who's the Healer; Normal (3 continues) or Easy (more hearts, 5 continues, a weaker Warden); the full quest (5 floors) or a short one (3) |
| Mind Meld | 4, 6, 8 or 10 rounds; no timer (the usual) or timed (90 s for the clue, 60 s to guess) |
| Liar's Dice | The how-to-play example round first, or skip it; 5, 3 or 4 dice each; ones wild or not |
| Dice Party | Full game (13 rounds) or quick (6); the screen: TV, or 📱 Handheld (the whole scorecard on your phone, no TV needed) |
| Crazy Eights | Action cards (2, Jack, Q♠) or classic rules; one hand, or first to 100 or 200 points; timed (30 s a turn) or no timer |
| Checkers | One game, or first to 2 or 3; timed (30 s a move) or no timer |
| Dots and Boxes | A 4 × 4, 3 × 3 or 5 × 5 grid; one game, or first to 2 or 3; timed (20 s a move) or no timer |
| Mancala | 4, 3 or 5 stones per bowl; one game, or first to 2 or 3; timed (30 s a move) or no timer |
| Reversi, Mine Duel | One game, or first to 2 or 3; timed (30 s a move in Reversi, 25 s a turn in Mine Duel) or no timer |
| Blackjack | 8, 5 or 12 hands; timed (20 s to bet, 25 s a move) or no timer |
| Backgammon | First to 3, 1, 5 or 7 points; the doubling cube on or off; timed (45 s a turn) or no timer |
| Gin Rummy | First to 100, 50 or 150 points; timed (30 s a turn) or no timer |
| Colour Clash | First to 200 or 500, or one hand; timed (30 s a turn) or no timer |
| Chess | 10, 5 or 15 minutes each, or no clock; one game, or first to 2 or 3 |
| Ludo | One game, or first to 2 or 3; timed (12 s to roll, 15 s to move) or no timer |
| Dominoes | First to 100, 50 or 150 points; timed (30 s a turn) or no timer |
| Five in a Row | Captures off or on; one game, or first to 2 or 3; timed (30 s a move) or no timer |
| Nine Men's Morris | One game, or first to 2 or 3; timed (30 s a move) or no timer |
| Five Letters | First to 3, 2 or 5 rounds; timed (3 minutes a word) or no timer |
| Code Breaker | First to 2 or 3 rounds, or one round; timed (60 s to set your code, 60 s a guess) or no timer |
| Hangman Duel | You set a word for each other, or the hub picks them; first to 2 or 3 rounds, or one round; timed (60 s to set your word, 150 s a round) or no timer |
| Make 24 | First to 5, 3 or 7; 90, 60 or 120 s a puzzle, or no timer (give up together to move on) |
| Micro Mayhem | 3 or 5 lives; normal pace or fast (starts at speed 3) |
| Party Minigames | First to 3, 4 or 5 wins; minigames: a random mix, random 2D, random 3D, or one minigame of your choice (to practise it) |
| Party Board | Map (random or one of seven), tile art ⚙️ steampunk with 3D models (default: steampunk tiles, a brass die with the roll on a number plate, a spinning collectible star, coins that pop up when won and scatter when lost), ⚙️ steampunk light (the faces on plain discs, for slower TVs) or 🎨 classic colours, board view 2D or 🧊 3D (every map has its own scenery: a palm island, sandy lagoons, a metal pipe yard, a foggy graveyard with ghosts, a lava field under a smoking peak, islands floating in the sky with a drawbridge, a market square with stalls; each player picks the steampunk engineer or mechanic miniature, which hop the paths, your character flies across the board when a warp flings it, a tumbling die, a camera that follows the turn), 10, 15 or 20 turns; minigames: a mix, 2D only or 3D only; bonus stars on or off; Harsh mode on or off |
| Word Race | Grid size, time per round, match length, and the mode: timed (shared words cancel) or Race to 20, 35 or 50 points |
| Anagram Duel | First to 3, 5 or 7 rounds |
| Word Hunt | Shared board or Race (your own board each), grid size (8 × 8, 10 × 10 or 12 × 12) and first to 1, 2 or 3 grids |
| Mini Golf | 3, 6, 9, 12 or 15 holes |
| Bowling | 10 frames or a quick 5; bumpers (no gutter balls) or none |
| Bomb Duel | Also how many crates |
| Kart Race | 🏁 Race or 🎈 Battle. Race: track (or a mix), 3, 5 or 8 laps, one race, best of 3 or a 🏆 cup (4 tracks, most wins), items on or off. Battle: arena (or a mix), one round, best of 3 or first to 3. Each player's racer and tyres |
| Kart Race 3D | As Kart Race (but 3 laps by default: a big track's lap is about a minute), with its five big tracks to pick from, plus **Field**: ⚔️ 1v1 or 🏁 8-kart Cup (then **Computer**: Easy, Normal or Hard, and the laps) |
| Memory Match | Take turns or Race, 16, 24 or 36 cards, the pictures (animals, food, sports, things, faces, nature, space & travel, ocean, or a mix), 10, 20 or 30 s per turn, or no timer |

The room remembers your choice for next time. At the end of a match,
**Rematch** plays again with the same settings and **⚙ Change settings** (or
**Y** on a controller) goes back to the setup screen. Beside the settings, the setup screen shows the
game: a picture of it and a dialog box that tells you about it a box at a time (what it is, the rules,
the controller buttons, the settings). It turns every 10 seconds; **RB** / **RT** turns to the next box
straight away, **LB** / **LT** goes back (or tap it). The games with their own setup menu (Kart Race,
Mini Golf, Memory Match…) show it beside their menu.

## Controllers

The TV's **keyboard** is a controller too, so a laptop (or the Steam Deck's keyboard) plays on its own:
arrows or WASD move, **Enter** / **Space** = A, **Backspace** = B, **Q** = X, **E** = Y, **P** = Start,
**Esc** = Back. Games that take letters or digits (the solo word and number games) take them typed.

Each player can use a phone **or** a game controller. Mix and match: two
controllers, two phones, or one of each. Connect Xbox, PlayStation or most
other controllers (Bluetooth or USB) to the device showing the TV screen: the
PC on HDMI, the Raspberry Pi, or the Google TV box. Then:

| Where | Button | Does |
| --- | --- | --- |
| Lobby | **A** / **Start** | Join (takes a free seat as "Controller 1/2") |
| Lobby | **D-pad**, then **A** | Pick a game and start it (the first card, 🎲 Random, lets the hub choose) |
| Lobby | **Y** | Change your name: cycles through names on the leaderboard (so your wins count for you), then ready-made ones (Ace, Blaze, Comet…) |
| Lobby | **X** | Tournament: off, best of 3, 5 or 7 games |
| Lobby | **LT** | Play the computer: it takes the free seat on Easy; press again for Normal, then Hard, then it leaves |
| Lobby | **LB** / **RB** | Pick your avatar and colour (D-pad to move, **A** to pick, **B** to close) |
| Lobby | **↑** past the top row of games | The top bar and the Invite button: **← →** along it, **A** presses (⚙ Settings, 🏆 leaderboard, sound, music…), **↓** or **B** back to the games |
| Mind Meld | **Left stick** or **D-pad ← →** turns the dial, **A** locks in | Controller players always guess; the clue-giver needs a phone to type |
| Marble Maze | **Left stick** or **D-pad** tilts the board | In split mode only your axis counts: player 1 left/right, player 2 forwards/back. **A** plays again at the end |
| Tower Stack | **A** (or **RT**) drops the block on your turn | Player 1 drops the blocks sliding left-right, player 2 the ones sliding front-back. **A** rematches at the end |
| Dice Party | **X** rolls · **← →** picks a die, **A** holds it · **↑ ↓** picks a box, **Y** scores it | The TV highlights your die and box; Liar's Dice needs phones (the dice are secret) |
| Checkers | **D-pad** moves the cursor · **A** picks a piece, **A** on a ◯ moves it · **B** drops it | |
| Dots and Boxes | **D-pad** moves to a dot · **A**, then a direction draws the line from that dot · **B** cancels | |
| Mancala | **D-pad ← →** picks one of your bowls (Player 2's are along the top) · **A** sows it | |
| Reversi | **D-pad** moves your ring · **A** places a disc (on a square that glows) | |
| Mine Duel | **D-pad** moves your spade · **A** digs | |
| Backgammon | **A** rolls · **◀ ▶** picks a checker, **A** moves it (◀ ▶ picks where), **B** puts it back · **X** undoes · **Y** doubles · on a double: **A** takes, **B** drops | Gin Rummy needs phones (the hands are secret) |
| Chess | **D-pad** moves the ring · **A** picks a piece, **A** again on a square moves it (a pawn at the end becomes a queen) · **B** puts it back | |
| Ludo | **A** rolls · **◀ ▶** picks a pawn, **A** moves it | Colour Clash and Dominoes need phones (the hands are secret) |
| Five in a Row | **D-pad** (or stick) moves your ring · **A** places a stone | |
| Nine Men's Morris | **◀ ▶** (or **▲ ▼**) steps through what you can pick · **A** picks it · **B** puts a piece back | Code Breaker and Hangman Duel need phones (the code and the word are secret) |
| Blackjack | Bet: **← →** picks a chip, **A** bets it · Play: **A** hit, **B** stand, **X** double, **Y** split | |
| Lobby | **B** | Leave your seat |
| Lobby | **Back** | Free the seats of phones that have left (shown as *Reconnecting…*) |
| Any game | **Back / Select** | Back to the lobby |
| Reaction Duel | any face button, bumper or trigger | Tap |
| Rock Paper Scissors | **X** ✊ · **Y** ✋ · **B** ✌️ (or D-pad ← ↑ →) | Pick (stays secret, the TV only shows 🔒) |
| Pong | **Left stick** or **D-pad ↑↓** | Move your paddle |
| Volley Blobs | **Left stick** or **D-pad ← →**, **A** | Slide, jump |
| Brick Breaker Duel | **Left stick** or **D-pad ← →** | Move your paddle |
| Asteroid Duel | **Left stick**, **D-pad** + **B**, hold **A** / **RT** | Steer (push the stick further to thrust; the D-pad turns, B thrusts), fire |
| Rally Tennis | **A** (or **B** / **RT**), **left stick** or **D-pad ← →** | Swing, aim |
| Falling Blocks Battle | **D-pad ← →** (or stick), **↓**, **↑**, **A** / **B** | Move (hold to repeat), soft drop, hard drop, rotate |
| Light Cycles | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Air Hockey | **Left stick** or **D-pad** | Move your mallet (in TV directions) |
| Snake Battle | **D-pad** / **left stick** (or **Y**↑ **A**↓ **X**← **B**→) | Turn |
| Tank Duel | **Left stick** or **D-pad** to drive, **A** / **RT** / **RB** / **X** to fire | Point where you want to go; the gun faces where you drive |
| Tower Defence Duel | **D-pad** moves your cursor on your side, **LB** / **RB** picks the tower, **A** builds or upgrades, **LT** sells; **X** / **Y** / **B** send a Runner / Brute / Swarm | The cursor shows the tower's range |
| Sumo | **Left stick** or **D-pad** to move, **A** / **B** / **RT** to dash | The dash goes where you're steering (or straight at your rival if you're not) |
| Bomb Duel | **D-pad** or **left stick** to walk (held), **A** / **B** / **X** / **RT** to drop a bomb | Setup: **↑↓** picks a row, **←→** changes it, **A** starts; at the end **A** rematches and **Y** changes the settings |
| Kart Race | **Left stick** or **D-pad ← →** to steer, **RT** / **A** gas, **LT** / **B** brake (hold to reverse), **X** / **RB** drift, **Y** / **LB** use your item | Let go of the gas to coast. Choosing your racer: the **D-pad** moves along them (**↑↓** a row), **A** confirms, **B** goes back; the same for your tyres. Then the track: **↑↓** picks a row, **←→** changes it, **A** starts; at the end **A** rematches and **Y** changes the settings |
| Kart Race 3D | As Kart Race | |
| Quiz Battle | **A** / **B** / **X** / **Y** to answer, or the **D-pad** as a diamond (↓ A, → B, ← X, ↑ Y) | Answer tiles on the TV are coloured like the buttons |
| Trivia Quest | **A** / **B** / **X** / **Y** to answer, or the **D-pad** as a diamond (↓ A, → B, ← X, ↑ Y); **LB** / **RB** is your 💡 50/50 | Your 50/50's two answers are struck out on the TV in your colour |
| Kitchen Rush | **Left stick** or **D-pad** to walk, **A** picks up / puts down / serves, hold **X** (or **B**) to chop | The tile you're facing is outlined in your colour |
| Dungeon Duo | **Left stick** or **D-pad** to walk, **A** attacks, **B** is your special (hold it for the Fighter's shield, press it for the Healer's circle) | Your hearts are on the TV; the Warden's next move shows as a red ring or lane on the floor first |
| Battleship | **D-pad** aims at the enemy grid on the TV, **A** fires | A controller player's fleet is placed at random, since the TV can't keep it secret · Ultimate: **←→** and **A** pick a commander, **LB** / **RB** choose the shot, a skill or the special, **Y** turns a line (or the side a torpedo comes from). |
| Mini Golf | **Left stick** aims (or **←→** turns the aim), hold **A** / **RT** to charge, let go to putt | The power meter swings up and down while you hold, so let go at the right moment. Setup: **←→** picks the holes, **A** starts; at the end **A** rematches and **Y** changes the holes |
| Bowling | **Left stick** or **D-pad ←→** moves where you stand, **↑↓** turns your aim, hold **A** / **RT** for power, let go to bowl | The power meter swings up and down while you hold; push the stick sideways as you let go for spin. **A** rematches at the end |
| Connect Four | **D-pad** ← → (or the stick) moves your disc over the columns, **A** or **↓** drops it | |
| Party Board | **← →** pick an answer, **A** confirms (roll, buy, use an item, stop the slot) | Minigames play as below |
| Micro Mayhem, Party Minigames | Follow the order: **A** taps / stops / pumps / fires / whacks / reels / snaps / drops, **A B X Y** are Simon's green / red / blue / yellow, **D-pad** picks and swipes (◀ ▶ on the Glass Bridge), the **stick** steers the Tap it! cursor, the Coin Grab runner and the Ice Rink Sumo puck, and wiggles to shake | **A** is Ready on the *Next up* card and rematch at the end |
| Memory Match | **D-pad** moves a cursor over the cards on the TV, **A** flips one (on your turn) | |
| Word Hunt | **D-pad** moves your cursor on the TV (in your colour), **A** on a word's first letter then **A** on its last, **B** lets go | |
| Game over | **A** / **Start** | Rematch |
| Snake | **D-pad** / stick (or **Y**↑ **A**↓ **X**← **B**→), **Start** pauses · keyboard: Arrows, **P** pauses | Turn |
| Brick Breaker 1P | Stick or **D-pad ← →**, **A** launches, **Start** pauses · keyboard: Arrows, **Enter**, **P** | Move the paddle |
| Blocks 1P | **D-pad ← →** move, **↓** soft drop, **↑** / **RT** drop, **A** / **X** turn ⟳, **B** turn ⟲, **Y** / **LB** / **RB** hold, **Start** pauses · keyboard: Arrows, **Enter** ⟳, **Backspace** ⟲, **E** hold, **P** | Held directions repeat |
| Flappy | **A**, **↑** or any face button, bumper or trigger; **Start** pauses · keyboard: **Space**, **Enter** or **↑**; **P** | Flap |
| Asteroids 1P | Stick / **D-pad ← →** turn, **↑**, **B** or **RT** thrust, **A** / **X** fire, **Start** pauses · keyboard: Arrows (↑ thrust), **Enter** / **Space** fire, **P** |  |
| Invaders | Stick / **D-pad ← →** move, **A** / **X** / **RT** fire, **Start** pauses · keyboard: Arrows, **Enter** / **Space**, **P** |  |
| Runner | **A** / **↑** (or any face button) jump, hold for higher; **↓** / **LT** / **LB** duck; **Start** pauses · keyboard: **↑** / **Space** jump, **↓** duck, **P** |  |
| Stack 1P | **A** (or any face button, bumper or trigger) drops, **Start** pauses · keyboard: **Space** / **Enter**, **P** |  |
| Helicopter Cave | Hold **A**, **↑** (or any face button, bumper or trigger) to climb; **Start** pauses · keyboard: Hold **Space**, **Enter** or **↑**; **P** | Climb |
| Bubble Shooter | Hold **←** / **→** (or the stick) to aim, **A** / **RT** / **↑** fires · keyboard: Hold arrows to aim, **Space** / **Enter** / **↑** fires |  |
| Road Hopper | **D-pad** / arrows hop, **Start** pauses · keyboard: Arrows, **P** |  |
| 2048 | **D-pad** / stick · keyboard: Arrows | Slide |
| Minesweeper | **D-pad** moves a cursor on the TV, **A** opens, **X** / **B** flags · keyboard: Arrows, **Enter**, **Q** / **Backspace** |  |
| Sudoku | **D-pad** moves, **A** places the pen number, **X** / **Y** change it, **B** clears, **Start** pauses · keyboard: Arrows, type **1**–**9**, **0** / **Backspace** clears, **P** |  |
| Solitaire | **D-pad** moves (↑ from a column goes to the top row), **A** picks up / puts down (on the stock: turn a card), **X** sends it where it fits, **B** drops it, **Y** undo, **Start** finish · keyboard: Arrows, **Enter**, **Q**, **Backspace**, **E**, **P** |  |
| FreeCell | **D-pad** moves (↑ from the top of a column goes to the cells and foundations), **A** picks up / puts down, **X** sends it where it fits, **B** drops it, **Y** undo, **Start** finish · keyboard: Arrows, **Enter**, **Q**, **Backspace**, **E**, **P** |  |
| Mahjong Solitaire | **D-pad** moves between tiles, **A** picks, **X** hint, **Y** undo, **LB** / **RB** shuffle, **Start** pauses · keyboard: Arrows, **Enter**, **Q**, **E**, **P** |  |
| Sliding Puzzle | **D-pad** / stick · keyboard: Arrows | Slide a tile into the gap (from the side the arrow points away from) |
| Gem Swap | **D-pad** moves, **A** picks a gem, then a direction swaps it; **B** lets go · keyboard: Arrows, **Enter**, **Backspace** |  |
| Sokoban | **D-pad** walks (and pushes), **Y** / **B** undo, **X** starts the level again · keyboard: Arrows, **E** / **Backspace** undo, **Q** restart |  |
| Nonograms | **D-pad** moves, **A** fills, **X** / **B** crosses out (again to clear), **Start** pauses · keyboard: Arrows, **Enter**, **Q** / **Backspace**, **P** |  |
| KenKen | **D-pad** moves, **A** next number, **Y** the one before, **X** / **B** clear · keyboard: Arrows, type the number, **Backspace** / **Delete** clear |  |
| Mastermind 1P | **← →** pick a peg, **↑ ↓** change its colour, **A** guesses (or jumps to the next empty peg), **B** clears the peg · keyboard: Type **1**–**8** to set a peg, **Backspace**, **Enter** guesses |  |
| Flood-It | **← →** pick a colour, **A** floods with it · keyboard: Press **1**–**6** |  |
| Color Lines | **D-pad** moves the cursor, **A** picks up a ball and then sends it to an empty square, **B** puts it down |  |
| Dog Park | **D-pad** moves, **A** ball / dog / empty, **B** empties the square, **LB** / **RB** fill balls, **X** hint, **Y** undo, **Start** pause · keyboard: **F** fills balls, **Q** hint, **E** undo, **P** pause |  |
| Lights Out | **D-pad** moves, **A** flips, **Y** starts again · keyboard: Arrows, **Enter**, **E** |  |
| Word Search | **D-pad** moves, **A** on a word's first letter then **A** on its last, **B** lets go · keyboard: Arrows, **Enter**, **Backspace** | Drag from the first letter to the last |
| Five Letters (1 player) | **D-pad** picks a key on the TV's keyboard, **A** types it, **B** deletes, **Start** / **X** enters · keyboard: Just type: letters, **Backspace**, **Enter** |  |
| Simon | **A** green, **B** red, **Y** yellow, **X** blue, or the **D-pad** by position (↑ green, → red, ← yellow, ↓ blue) · keyboard: Arrows by position |  |
| Memory Pairs | **D-pad** moves, **A** turns a card over · keyboard: Arrows, **Enter** |  |
| Reaction Rush | Any face button, bumper or trigger · keyboard: **Enter** / **Space** | Tap |
| Quick Maths | **A**, **B**, **X**, **Y**: the answer next to that letter on the TV · keyboard: **1**–**4** |  |
| Colour Trap | The face button of that colour: **B** red, **X** blue, **A** green, **Y** yellow · keyboard: **R**, **B**, **G**, **Y** (or **1**–**4**) |  |
| Anagram Rush | **D-pad ← →** picks a letter, **A** uses it, **B** takes one back, **Y** skips · keyboard: Just type the word, **Backspace**, **Tab** skips |  |
| Number Memory | **← →** pick a digit, **A** types it, **B** deletes, **Start** / **X** done · keyboard: Type the digits, **Backspace**, **Enter** |  |
| Odd One Out | **D-pad** moves, **A** picks · keyboard: Arrows, **Enter** |  |
| Hangman | **D-pad** moves over the keyboard, **A** guesses · keyboard: Just type the letters |  |
| Trivia | **A**, **B**, **X**, **Y**: the answer next to that letter on the TV · keyboard: **1**–**4** |  |

Buttons use Xbox names. On a PlayStation controller A = ✕, B = ○, X = □, Y = △.
Browsers only notice a controller after one of its buttons is pressed, so
press A once if the TV says no controller is connected. Controllers rumble on
input where the browser supports it.

Word Race, Anagram Duel, Draw Duel, Liar's Dice, Bomb Squad, Sketch & Guess, Fake Out and Crazy
Eights need two phones, so they're greyed out in the lobby while a controller is seated.

## Profiles

Every player has an **avatar** (a fox, a robot, a rocket…) and a **colour**. The avatar shows on the
TV's player cards, in the phone's header and next to your name in the standings and rivalries; the
colour is the circle around it (the seats and games keep their Player 1 / Player 2 colours, so you
can always tell who's who). Pick them on your phone (tap your avatar at the top, or ⋯ → 🎨 Avatar
and colour), or on the TV: click a player's avatar, or press **LB** / **RB** on your controller.
Until you pick, your name gives you one of its own, the same every time. They're kept per name in
`profiles.json` in the data folder, so they survive updates.

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

### HD graphics

The 3D games (the 3D Party Board, Kart Race 3D, Dungeon Duo, Marble Maze, Bowling, Tower Stack and
the 3D minigames) draw in **HD** by default:
- **Glow:** what's meant to glow does (lava, lanterns, the goal ring, sparks, the players' rings).
- **Reflections:** soft studio reflections on the shiny things (balls, marbles, metal).
- **Shadows:** four times sharper.

The colours stay exactly as before. The **HD** button in the TV's top bar switches that TV to
**SD** (standard, the lighter look) for a slower screen, and back; it's remembered on that TV. HD
is made for a Steam Deck and up. The code is in `public/shared/hd3d.js`: a 3D renderer draws
through `ArkHD.create(...)`, and a material can opt in or out of the glow with `userData.glow`.

## Tournament

Play a series across games: in the lobby (TV or either phone) pick
**Best of 3**, **5** or **7**, or **Off** (the default). Every competitive match
you finish counts (rematches too). A draw scores nothing, and casual games
don't count. The first to win most of the games, e.g. 3 of 5, takes the
tournament. The score sits in the TV's top bar during games and on the phones
at the end of each match. **↺ Start over** clears it. After a win, the next
game starts a new series. A new player taking a seat also starts a new series.
On a controller, **X** in the lobby cycles the length.
Won tournaments are saved: the leaderboard (`/stats/`) counts each player's
🏆 titles and lists recent tournaments. The lobby shows the two players'
tournament record next to their head to head.

## Secure page (https)

The hub answers both `http://` and `https://` on the same port (3000).
Phones need the https page for the motion sensor (📱 Tilt in Kart Race, Tank
Duel and Sumo). When a phone picks Tilt on the http page, it offers
**🔒 Switch to the secure page**: the same room and the same seat, over https.
The hub signs its own certificate (made once and kept in the data folder), so
each phone warns the first time. Choose **Advanced → Proceed** (Android) or
**Show details → visit this website** (iPhone). To make every phone start on
https, set the join address in Settings (`/admin/`) to
`https://<your-server>:3000`. Set `HTTPS=off` to serve plain http only.

## Online play

Your friend isn't in the same room? Press **🌍 Invite someone online** under the seats on the TV.
The hub opens a temporary internet address (a free Cloudflare **quick tunnel**: no account, no
setup; `cloudflared` comes with the Docker image and the desktop app) and shows a second QR code
for their phone, plus a **remote screen** link (`/host/?watch=ROOM`) for a laptop or smart TV: it
mirrors your TV live, but they can't press anything on it. It's https, so tilt and motion work on
their phone too. **Stop** (or closing the room) takes the address down again.

While someone's online, the game cards say which games play well that way: **🌍 Great online**
for the ones that are all on the phone (📱 No TV needed), and **🐢 Best in the same room** for
fast action games, where a moment's internet delay shows.

Only the game pages go out over the internet: Settings (`/admin/`) and the leaderboard and
trophies (your household's names and results) stay at home, nobody outside can open a room on
your hub, and only the room that invited someone can be joined or watched, with
the invite's own key (it's in the QR code and links; a new one each invite), after so many wrong
tries from one address it waits a while. **Stop** (or turning online play off) sends whoever
came in over the internet away again. In Settings, **Online play** can turn the button off, stop
everything, or use **your own tunnel address** instead of a quick tunnel (if you already run a
Cloudflare tunnel, or any https address, to the hub: point it at port 3000 and paste its
address). Through a proxy of your own, keep the original Host (or send `X-Forwarded-Host`):
that's how the hub tells internet visitors from home.

## Leaderboard and match history

Every finished match (and every tournament won) is saved (in `stats.json` in the data folder, so it
survives updates). The lobby on the TV and phones shows the record between the
two players seated, e.g. **🏆 Abe 14 – 9 Sam · last: Pong, Abe won 5–3**, plus
stars earned together in casual games. The 🏆 button on the TV (and the link in
the phone lobby) opens `/stats/`: players ranked by wins, rivalries, the best
player per game, and recent matches. Players are matched by name (ignoring
capitals), so use the same name each time. Settings (`/admin/`) can clear the
history.

## Trophies and practice

**🏆 Trophies** are each player's own achievements (by name, like the leaderboard), 27 of them:
playing 10, 25 or every game; your first win, a clean sweep (they never score), 10 different games
won, 50 wins, 10 wins over the same rival, a best-of-7 tournament; feats like a Kart Race cup, a
Party Board win, Micro Mayhem without losing a life, beating the Stone Warden (and with every
star), three stars in Kitchen Rush's Rush Hour, a perfect nine-star Trivia Quest, every star in
Marble Maze, Bomb Squad (five bombs) or Mind Meld, a Turkey (three strikes in a row) and a perfect 300 in Bowling; and practice ones: beating the computer, on
Hard, on Hard in 10 games and in every game, and every star in a co-op game with it as your
teammate. A card slides in on the TV (and on your phone) when you earn one. The leaderboard
lists who has how many; tap a name (or **🏆 My trophies** in a phone's ⋯ menu) for the whole set,
with the ones still to earn greyed out and how to get them.

**🤖 Practice**: games against the computer stay out of the leaderboard and match history, but
your own record against it is kept (in `practice.json`): while it's seated, each game card shows
the levels you've beaten (**🤖 E✓ N✓ H·**), or your best stars with it as your teammate in the
co-op games. Settings (`/admin/`) can clear the trophies and practice records.

## Quick start

### Desktop app (Steam Deck, Linux, Windows)

One app runs the hub and opens the TV screen full screen: an **AppImage** for the Steam Deck and
Linux (add it to Steam as a non-Steam game to launch it from Game Mode) and an **installer** for
Windows. No Docker needed. Download them from the repository's **Releases** page. GitHub builds
them with **Actions → Desktop app → Run workflow**. The app updates itself: a new version shows an
**Update** banner in the lobby. Each release also has Steam library artwork. See
[desktop/README.md](desktop/README.md), and for the Deck the step-by-step
[Steam Deck guide](docs/STEAM-DECK.md).

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

1. On Player 1's phone, open the menu (⋯) → **⚙ Settings**. Or open
   `http://<server-ip>:3000/admin/` on a phone or PC, or press ⚙ on the TV screen.
2. Press **Use this page's address**, or type the address, then **Save**. The QR
   code on the TV updates right away.

Settings has no password: it opens on your home network only (never over the
internet, even while someone is invited online). Of the two phones, only Player 1's has the button.
A controller works on Settings (and the leaderboard and trophies) too: the D-pad moves between the
choices, **A** picks, **B** goes back to the TV.

The setting is stored in the `ark-data` Docker volume, so it survives updates.
You can also set `PUBLIC_URL` in `docker-compose.yml`:
it overrides the saved address.

#### Themes and layouts

Settings (`/admin/`) also picks the look of the TV and the phones: **Default**, **Neon** (a split
screen, the two players face to face with big scoreboard names), **Cozy** (games as boxes on a
shelf, wood and paper, players as game pieces) or **Daylight** (bright paper and ink for a sunny
room; the games themselves stay dark). It changes on every screen straight away. The themes
dress the lobby, the frame around a match (the top bar, the winner's name, the scoreboards, the
Rematch button, each game's "You win!"), the leaderboard and the trophies, and give the TV its own
sound when a player sits down (chalk in Neon, a wooden knock in Cozy). **Layout** is picked apart from it: **Classic** (the QR
code, two seats and a grid of games), **Versus** (the two players face to face across a split
screen, big names, the games as a running order), **Shelf** (the games as boxes on a shelf, the
chosen one pulled out) or **Arcade** (a cabinet's select screen: big game tiles in a strip, P1 / P2
badges along the bottom). Any theme goes with any layout. Player 1 can also change both on the TV with
a controller: **RT** in the lobby, ↑ ↓ theme or layout, ← → to choose, A to try it on.

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

Full guide: [docs/raspberry-pi.md](docs/raspberry-pi.md). The installer also
adds a colour emoji font for the TV (Memory Match cards, power-up icons); on a
Pi set up before that, run `sudo apt install fonts-noto-color-emoji` once.

## Developing

Running it from source, how it works inside, adding a game, and the roadmap: see
[docs/DEVELOPING.md](docs/DEVELOPING.md). In short:

```bash
npm ci             # ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci skips the desktop app's Electron
npm run dev        # http://localhost:3000 (TV), /play/ (phones); restarts on file changes
npm test           # every test; npm run test:fast for quick checks, npm run lint for ESLint
```

## Notes

- A board, card or casino game in progress (the 🎲 Board Games and 🃏 Cards & Casino folders)
  survives an update or a power cut: when the TV comes back it picks the game up where it was,
  and the phones rejoin their own seats. A game that nobody comes back to within a day is dropped.
- Reaction times are measured on the server, so they include Wi-Fi latency
  (usually a few ms on a LAN). It's the same for both players.
- Phone screen wake-lock and vibration work where the browser allows it;
  iOS needs HTTPS for wake-lock, which the hub's secure page provides (see
  [Secure page (https)](#secure-page-https)).

