# Ark 2P Hub: game catalog

Every game and minigame in the hub, what it is and where its code lives. **Check here before adding
a game**, so it doesn't repeat one we have; add new ideas to the list at the bottom.

The tables are generated from the code: run `node tools/games-catalog.mjs` after adding or
renaming a game or minigame (`test/catalog.test.js` fails until you do). A game is a module in
`server/games/` listed in `server/games/index.js`, with its TV and phone screens in
`public/games/<id>/`; a minigame is a module in `server/games/minis/` listed in
`server/games/minis/index.js`, with its screens in `public/games/minis/<id>.js`.

## Games (40)

### ⚔️ Competitive (29)

| Game | id | What it is | Files |
| --- | --- | --- | --- |
| Reaction Duel | `reaction-duel` | Wait for GO… then tap faster than your rival. Jump early and you lose the point. | `server/games/reaction-duel.js`, `public/games/reaction-duel/`, `test/reaction-duel.test.js` |
| Rock Paper Scissors | `rock-paper-scissors` | Pick in secret on your phone or controller. The TV reveals both. First to 3. | `server/games/rock-paper-scissors.js`, `public/games/rock-paper-scissors/`, `test/rock-paper-scissors.test.js`, `test/sounds.test.js` |
| Pong | `pong` | The classic. Drag on your phone or use the stick to move your paddle. First to 5. | `server/games/pong.js`, `public/games/pong/`, `test/pong.test.js` |
| Light Cycles | `tron` | Tron-style. Leave a wall behind you and make your rival crash into it. First to 3. | `server/games/tron.js`, `public/games/tron/`, `test/tron.test.js` |
| Air Hockey | `air-hockey` | The whole table on your phone too: slide your mallet and smash the puck into their goal. First to 7. | `server/games/air-hockey.js`, `public/games/air-hockey/`, `test/air-hockey.test.js` |
| Volley Blobs | `volley-blobs` | Beach volleyball for two bouncy blobs. Slide, jump and bounce the ball over the net. First to 7. | `server/games/volley-blobs.js`, `public/games/volley-blobs/`, `test/volley-blobs.test.js` |
| Brick Breaker Duel | `brick-duel` | Race to break your wall first. Power bricks shrink their paddle, give you an extra ball or add a row to their wall. | `server/games/brick-duel.js`, `public/games/brick-duel/`, `test/brick-duel.test.js` |
| Asteroid Duel | `asteroid-duel` | Two ships in a field of drifting rocks. Turn, thrust and shoot your rival; mind the rocks. Three lives a round. | `server/games/asteroid-duel.js`, `public/games/asteroid-duel/`, `test/asteroid-duel.test.js` |
| Rally Tennis | `rally-tennis` | Tennis from above: your player runs to the ball, you time the swing and aim. Spot-on timing hits hardest. | `server/games/rally-tennis.js`, `public/games/rally-tennis/`, `test/rally-tennis.test.js` |
| Falling Blocks Battle | `block-battle` | Side-by-side falling blocks. Clear lines to send junk rows to your rival; fill your well and you lose the round. | `server/games/block-battle.js`, `public/games/block-battle/`, `test/block-battle.test.js` |
| Snake Battle | `snake` | Two snakes, one arena. Eat to grow, make your rival crash. Longest snake wins when time runs out. First to 3. | `server/games/snake.js`, `public/games/snake/`, `test/snake.test.js` |
| Tank Duel | `tanks` | Top-down tank battle. Drive with the joystick, fire bouncing shells around cover. 3 hits and you are out. First to 3. | `server/games/tanks.js`, `public/games/tanks/`, `test/tanks.test.js` |
| Sumo | `sumo` | Shove your rival off a shrinking ring. Steer with the stick, DASH to hit hard. First to 3. | `server/games/sumo.js`, `public/games/sumo/`, `test/sounds.test.js`, `test/sumo.test.js` |
| Party Board | `party-board` | A Mario Party-style board for two: roll, pick your path across one of seven maps, grab coins, buy ⭐ stars, raid the shop for items, and battle in a party minigame every round. Most stars wins. | `server/games/party-board.js`, `server/games/board/`, `public/games/minis/`, `public/games/party-board/`, `test/party-board-twists.test.js`, `test/party-board.test.js`, `test/sounds.test.js` |
| Party Minigames | `party-minis` | Mario Party-style showdowns: pump a balloon till it pops, pass the hot potato, out-draw your rival, repeat the glowing path. Win a minigame to score; first to 3 takes it. | `server/games/party-minis.js`, `server/games/minis/`, `public/games/minis/`, `public/games/party-minis/`, `test/minis-motion.test.js`, `test/minis-party2.test.js`, `test/minis-party5.test.js`, `test/party-minis.test.js`, `test/sounds.test.js` |
| Micro Mayhem | `micro-mayhem` | Tiny games, three seconds each, both of you at once: TAP IT! STOP IT! SHAKE IT! Fail one and lose a life. It keeps getting faster; last one standing wins. | `server/games/micro-mayhem.js`, `server/games/minis/`, `public/games/minis/`, `public/games/micro-mayhem/`, `test/micro-mayhem.test.js`, `test/sounds.test.js` |
| Bomb Duel | `bomb-duel` | Bomberman-style: blast crates for power-ups and trap your rival in a cross of fire. Walls close in after 90 s. | `server/games/bomb-duel.js`, `public/games/bomb-duel/`, `test/bomb-duel.test.js` |
| Kart Race | `kart-race` | Top-down racing: pick one of 12 racers and your tyres, hold GAS, steer, brake for the bends (hold it to reverse), drift for a mini-boost, collect coins to go faster, use items (hold up to 3), hit the boost pads and bump your rival off the line. Six tracks, or a balloon battle in one of three arenas. | `server/games/kart-race.js`, `public/games/kart-race/`, `test/kart-race-battle.test.js`, `test/kart-race.test.js`, `test/kart-racers.test.js` |
| Quiz Battle | `quiz` | 10 trivia questions. Answer on your phone or controller; right and fast scores more. Most points wins. | `server/games/quiz-questions.js`, `server/games/quiz.js`, `public/games/quiz/`, `test/quiz.test.js`, `test/setup.test.js`, `test/sounds.test.js` |
| Fake Out | `fake-out` | Bluffing quiz: write a fake answer to a strange-but-true fact, then spot the real one among the fakes. Find the truth for 1000, fool your rival for 500. | `server/games/fake-out-questions.js`, `server/games/fake-out.js`, `public/games/fake-out/`, `test/fake-out.test.js` |
| Crazy Eights | `crazy-eights` | Card game: match the top card's suit or rank, eights are wild (call the suit), 2s make them draw. First to empty their hand wins the hand. | `server/games/crazy-eights.js`, `public/games/crazy-eights/`, `test/crazy-eights.test.js` |
| Word Race | `word-race` | Same letter grid, against the clock: swipe words on your phone. Words you both find cancel out, so go rare. Pick the grid size, time and rounds. | `server/games/word-race.js`, `public/games/word-race/`, `test/anagram-duel.test.js`, `test/word-race.test.js` |
| Anagram Duel | `anagram-duel` | Same five mixed-up letters for both of you: the first to make a word with all of them takes the round. | `server/games/anagram-duel.js`, `server/games/anagram-words.js`, `public/games/anagram-duel/`, `test/anagram-duel.test.js` |
| Word Hunt | `word-hunt` | One word search, two hunters: mark a hidden word first and it's yours. Find more than half to take the grid. | `server/games/word-hunt-words.js`, `server/games/word-hunt.js`, `public/games/word-hunt/`, `test/word-hunt.test.js` |
| Mini Golf | `mini-golf` | Same hole, same time: pull back and putt on your phone. Walls, bumpers, sand, water and a windmill. Fewest strokes wins. | `server/games/mini-golf.js`, `public/games/mini-golf/`, `test/mini-golf.test.js` |
| Draw Duel | `draw-duel` | A shape flashes up, then vanishes. Redraw it from memory on your phone; the closest match scores the most. 5 rounds. | `server/games/draw-duel.js`, `server/games/draw-shapes.js`, `server/games/shape-library.js`, `public/games/draw-duel/`, `test/draw-duel.test.js`, `test/sounds.test.js` |
| Battleship | `battleship` | Hide your fleet on your phone, then take turns firing at the enemy grid. Sink all 5 ships to win. | `server/games/battleship.js`, `public/games/battleship/`, `test/battleship.test.js`, `test/sounds.test.js` |
| Connect Four | `connect-four` | Drop discs, line up four in a row before your rival does. Tap a column on your phone. First to 3. | `server/games/connect-four.js`, `public/games/connect-four/`, `test/connect-four.test.js`, `test/sounds.test.js` |
| Memory Match | `memory-match` | Take turns flipping two cards: find a pair and go again. Remember what your rival turned over. Most pairs wins. | `server/games/memory-match.js`, `public/games/memory-match/`, `test/memory-match.test.js` |

### 🎲 Dice & Board (5)

| Game | id | What it is | Files |
| --- | --- | --- | --- |
| Liar's Dice | `liars-dice` | Your dice are hidden on your phone. Bid how many of a face there are between you both, or call "Liar!". Lose a die each time you're wrong; last one with dice wins. | `server/games/liars-dice.js`, `public/games/liars-dice/`, `test/dice.test.js`, `test/sounds.test.js` |
| Checkers | `checkers` | Classic draughts: move diagonally, jump to capture (jumps are a must, and keep going if you can), reach the far side to crown a king. Take all their pieces or leave them stuck. | `server/games/checkers.js`, `public/games/checkers/`, `test/checkers.test.js` |
| Dots and Boxes | `dots-boxes` | Take turns joining two dots. Close the fourth side of a box to claim it and go again; careful not to hand your rival a chain. Most boxes wins. | `server/games/dots-boxes.js`, `public/games/dots-boxes/`, `test/dots-boxes.test.js` |
| Mancala | `mancala` | Sow stones around the bowls. End in your store to go again; end in an empty bowl of yours to capture across. Fullest store wins. | `server/games/mancala.js`, `public/games/mancala/`, `test/mancala.test.js` |
| Dice Party | `dice-party` | Yahtzee-style: roll five dice up to three times, hold the ones you want, and score them in one of 13 boxes. Full house, straights, five of a kind… highest total wins. | `server/games/dice-party.js`, `public/games/dice-party/`, `test/dice.test.js`, `test/sounds.test.js` |

### 🤝 Co-op & casual (6)

| Game | id | What it is | Files |
| --- | --- | --- | --- |
| Trivia Quest | `trivia-quest` | Co-op quiz: answer together to bring down three monsters (Goo Blob, Stone Golem, Dragon). Right and fast hits harder; every wrong answer costs a shared heart. | `server/games/trivia-quest.js`, `server/games/quiz.js`, `server/games/quiz-questions.js`, `public/games/quiz/style.css`, `public/games/trivia-quest/`, `test/trivia-quest.test.js` |
| Kitchen Rush | `kitchen-rush` | Co-op cooking: chop, cook, plate up and serve the orders before they run out. Three kitchens, one of them split down the middle. | `server/games/kitchen-rush.js`, `public/games/kitchen-rush/`, `test/kitchen-rush.test.js` |
| Bomb Squad | `bomb-squad` | Co-op: one of you has a bomb on your phone, the other has the manual (new rules every bomb). Talk it through and defuse it before the timer runs out. Swap every bomb. | `server/games/bomb-squad-modules.js`, `server/games/bomb-squad.js`, `public/games/bomb-squad/`, `test/bomb-squad.test.js` |
| Marble Maze | `marble-maze` | Co-op 3D: tilt the board together to roll the marble to the goal. One of you tilts left and right, the other forwards and back. Mind the holes! | `server/games/marble-maze.js`, `public/games/marble-maze/`, `test/marble-maze.test.js` |
| Mind Meld | `mind-meld` | Co-op: one of you secretly sees a spot on a scale (Cold ↔ Hot) and gives a clue; the other turns the dial to it. Closer means more stars. | `server/games/mind-meld.js`, `public/games/mind-meld/`, `test/mind-meld.test.js` |
| Sketch & Guess | `sketch-guess` | One of you draws a secret word on your phone, the other guesses. Play as a team and collect stars. 6 rounds. | `server/games/sketch-guess.js`, `server/games/sketch-words.js`, `public/games/sketch-guess/`, `test/sketch-guess.test.js`, `test/sounds.test.js` |

## Minigames (35)

Micro minigames (a few seconds each) play in **Micro Mayhem**; party minigames (up to about 30 s)
play in **Party Minigames** and after every round of **Party Board**. 3D ones use three.js.

| Minigame | id | Kind | Look | How to play | Files |
| --- | --- | --- | --- | --- | --- |
| Tap it! | `tap-it` | micro | 2D | Tap the moving target | `server/games/minis/tap-it.js`, `public/games/minis/tap-it.js`, `test/minis-micro.test.js` |
| Stop it! | `stop-it` | micro | 2D | Stop the needle in the green | `server/games/minis/stop-it.js`, `public/games/minis/stop-it.js`, `test/minis-micro.test.js` |
| Shake it! | `shake-it` | micro | 2D | Shake your phone (or tap fast) | `server/games/minis/shake-it.js`, `public/games/minis/shake-it.js`, `test/minis-micro.test.js` |
| Odd one out! | `odd-one` | micro | 2D | Pick the one that is different | `server/games/minis/odd-one.js`, `public/games/minis/odd-one.js`, `test/minis-micro.test.js` |
| Count 'em! | `count-em` | micro | 2D | How many sheep? Pick the number | `server/games/minis/count-em.js`, `public/games/minis/count-em.js`, `test/minis-micro.test.js` |
| Swipe it! | `swipe-it` | micro | 2D | Swipe the way each arrow points | `server/games/minis/swipe-it.js`, `public/games/minis/swipe-it.js`, `test/minis-micro.test.js` |
| Don't touch! | `dont-touch` | micro | 2D | Hands off! Any tap fails | `server/games/minis/dont-touch.js`, `public/games/minis/dont-touch.js`, `test/minis-micro.test.js` |
| Quick math! | `quick-math` | micro | 2D | Pick the right answer | `server/games/minis/quick-math.js`, `public/games/minis/quick-math.js`, `test/minis-micro.test.js` |
| Balloon Pump | `balloon` | party | 2D | Mash PUMP (or A) to pop your balloon first | `server/games/minis/balloon.js`, `public/games/minis/balloon.js`, `test/minis-party.test.js` |
| Hot Potato | `hot-potato` | party | 2D | Holding the bomb? Tap PASS (or A) to throw it back | `server/games/minis/hot-potato.js`, `public/games/minis/hot-potato.js`, `test/minis-party.test.js` |
| Quick Draw | `quick-draw` | party | 2D | Fire (or A) on BANG! Too early loses | `server/games/minis/quick-draw.js`, `public/games/minis/quick-draw.js`, `test/minis-party.test.js` |
| Memory Path | `memory-path` | party | 2D | Watch the path, then tap it back in order | `server/games/minis/memory-path.js`, `public/games/minis/memory-path.js`, `test/minis-party.test.js` |
| Sweet Spot | `sweet-spot` | party | 2D | Stop your wheel (or A) on the biggest number, 3 times | `server/games/minis/sweet-spot.js`, `public/games/minis/sweet-spot.js`, `test/minis-party.test.js` |
| Coin Grab | `coin-grab` | party | 2D | Move (joystick / stick) to grab coins, dodge the bombs | `server/games/minis/coin-grab.js`, `public/games/minis/coin-grab.js`, `test/minis-party2.test.js` |
| Tug of War | `tug-of-war` | party | 2D | Tap (or A) on the beat: timing beats mashing | `server/games/minis/tug-of-war.js`, `public/games/minis/tug-of-war.js`, `test/minis-party2.test.js` |
| Tower Stack | `tower-stack` | party | 3D | Tap (or A) to drop the swinging block on your tower | `server/games/minis/tower-stack.js`, `public/games/minis/tower-stack.js`, `test/minis-party2.test.js` |
| Bowling Bash | `bowling` | party | 3D | Swipe up the lane: the angle aims, the speed is your power. Two rolls | `server/games/minis/bowling.js`, `public/games/minis/bowling.js`, `test/minis-party2.test.js` |
| Penalty Shootout | `penalty` | party | 3D | Kicker: pick a corner. Keeper: pick where to dive | `server/games/minis/penalty.js`, `public/games/minis/penalty.js`, `test/minis-party2.test.js` |
| Whack-a-Mole | `whack-a-mole` | party | 2D | Whack the moles in your colour (gold: +2), not theirs | `server/games/minis/whack-a-mole.js`, `public/games/minis/whack-a-mole.js`, `test/minis-party3.test.js` |
| Fishing | `fishing` | party | 2D | Wait for the bite, HOOK it (jerk the phone up, or tap), then REEL (wind the phone round, or tap) without snapping the line | `server/games/minis/fishing.js`, `public/games/minis/fishing.js`, `test/minis-party3.test.js` |
| Glass Bridge | `glass-bridge` | party | 3D | Pick ◀ left or right ▶ glass, row by row: one of each pair breaks | `server/games/minis/glass-bridge.js`, `public/games/minis/glass-bridge.js`, `test/minis-party3.test.js` |
| Ice Rink Sumo | `ice-sumo` | party | 3D | Steer (joystick / stick) on the slippery ice and bump your rival off | `server/games/minis/ice-sumo.js`, `public/games/minis/ice-sumo.js`, `test/minis-party3.test.js` |
| Simon Says | `simon-says` | party | 2D | Press the colour only when Simon says so | `server/games/minis/simon-says.js`, `public/games/minis/simon-says.js`, `test/minis-party3.test.js` |
| Sword Duel | `sword-duel` | party | 2D | When the arrow shows, slash your phone that way (or swipe). Too soon or the wrong way: out of that point | `server/games/minis/sword-duel.js`, `public/games/minis/sword-duel.js`, `test/minis-motion.test.js` |
| Pour It | `pour-it` | party | 2D | Hold the phone up like a bottle and tip it sideways to pour (or hold POUR); stand it up to stop. Closest to the line wins; spill and you lose | `server/games/minis/pour-it.js`, `public/games/minis/pour-it.js`, `test/minis-motion.test.js` |
| Hurdle Dash | `hurdle-dash` | party | 2D | Tap JUMP (or A) just before each hurdle | `server/games/minis/hurdle-dash.js`, `public/games/minis/hurdle-dash.js`, `test/minis-party4.test.js` |
| Laser Dodge | `laser-dodge` | party | 2D | Low beam: JUMP (A). High beam: hold DUCK (B) | `server/games/minis/laser-dodge.js`, `public/games/minis/laser-dodge.js`, `test/minis-party4.test.js` |
| Pop the Most | `pop-the-most` | party | 2D | Steer (joystick / stick) and POP (A) your colour and the gold ones | `server/games/minis/pop-the-most.js`, `public/games/minis/pop-the-most.js`, `test/minis-party4.test.js` |
| Safe Cracker | `safe-cracker` | party | 2D | Turn the dial (← → on a controller); when it clicks, TRY (A) | `server/games/minis/safe-cracker.js`, `public/games/minis/safe-cracker.js`, `test/minis-party5.test.js` |
| Reflex Grid | `reflex-grid` | party | 2D | Tap the lit squares before they fade (D-pad + A on a controller) | `server/games/minis/reflex-grid.js`, `public/games/minis/reflex-grid.js`, `test/minis-party5.test.js` |
| Mirror Me | `mirror-me` | party | 2D | Watch the shape, then join the dots on your phone to draw it from memory | `server/games/minis/mirror-me.js`, `public/games/minis/mirror-me.js`, `test/minis-party5.test.js` |
| Cannon Lob | `cannon-lob` | party | 2D | Drag to aim (stick up / down), hold FIRE (A) to charge, let go to lob it over the wall. Watch the wind! | `server/games/minis/cannon-lob.js`, `public/games/minis/cannon-lob.js`, `test/minis-party6.test.js` |
| Stack Attack | `stack-attack` | party | 2D | Slide your tray (joystick / tilt / stick) to catch the crates. Catch them in the middle or the stack leans and topples! | `server/games/minis/stack-attack.js`, `public/games/minis/stack-attack.js`, `test/minis-party6.test.js` |
| Bumper Cars | `bumper-cars` | party | 3D | Steer (joystick / stick) and ram your rival in the side or from behind. Head-on doesn't count! | `server/games/minis/bumper-cars.js`, `public/games/minis/bumper-cars.js`, `test/minis-party7.test.js` |
| Paint Grab | `paint-grab` | party | 3D | Move (joystick / stick) to paint the tiles your colour. Grab the paint buckets for a big splash! | `server/games/minis/paint-grab.js`, `public/games/minis/paint-grab.js`, `test/minis-party7.test.js` |

## Ideas (not built yet)
<!-- ideas: hand-written below this line, kept when the file is regenerated -->

One line each: **name**, what it is, and how it would play. When an idea gets built, delete it from
here (the test fails while an idea has the same name as a game or minigame in the tables above).

### Games

- **Desktop / Steam edition**: not a game, the big platform project (see the README's roadmap).
- **Dungeon Duo**: co-op 3D dungeon crawl: each phone is a hero (fighter, healer), with keys, traps and a boss.
- **Tower Defence Duel**: build towers on your phone and send waves at your rival's base on the TV.
