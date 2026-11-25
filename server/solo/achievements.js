// Achievements: goals to chase in a one-player hub. Each is checked when a
// run ends, against that run (its score and the game's last TV view) and the
// player's history; once unlocked it stays (kept in stats.json, see Stats).
//
// An achievement:
//   { id, game?, icon, name, desc, check(run, view, history) -> true when earned }
// game ties it to one game (the lobby card shows that game's count); without
// it, it's about playing the hub as a whole.
//
// run: { game, score, variant } (score is null when the run doesn't count).
// history: the player's runs so far, this one included (see Stats#historyOf).

const DAY = 86400000;
const MIN = 60000;
const scored = (run) => run.score !== null && run.score !== undefined;

const game = (id, list) => list.map((a) => ({ ...a, game: id }));

export const ACHIEVEMENTS = [
  // ---- the hub ----
  { id: 'first-run', icon: '👋', name: 'First steps', desc: 'Finish a run of any game.', check: (r, v, h) => h.runs >= 1 },
  { id: 'runs-25', icon: '🎮', name: 'Regular', desc: 'Finish 25 runs.', check: (r, v, h) => h.runs >= 25 },
  { id: 'runs-100', icon: '🕹️', name: 'Arcade rat', desc: 'Finish 100 runs.', check: (r, v, h) => h.runs >= 100 },
  { id: 'taster', icon: '🍱', name: 'Taster', desc: 'Score in 5 different games.', check: (r, v, h) => h.games >= 5 },
  { id: 'explorer', icon: '🧭', name: 'Explorer', desc: 'Score in every game in the hub.', check: (r, v, h) => h.games >= h.gamesInHub },
  { id: 'bests-10', icon: '📈', name: 'Getting better', desc: 'Set 10 personal bests.', check: (r, v, h) => h.bests >= 10 },
  { id: 'top-spot', icon: '🥇', name: 'Top of the table', desc: 'Hold the best score on this hub in any game.', check: (r, v, h) => h.topSpots >= 1 },
  { id: 'streak-3', icon: '📅', name: 'Three days running', desc: 'Play on 3 days in a row.', check: (r, v, h) => h.streak >= 3 },
  { id: 'streak-7', icon: '🔥', name: 'A whole week', desc: 'Play on 7 days in a row.', check: (r, v, h) => h.streak >= 7 },
  { id: 'daily-1', icon: '📆', name: 'Daily dealer', desc: 'Play a daily challenge.', check: (r, v, h) => h.dailyChallenges >= 1 },
  { id: 'daily-7', icon: '🗓️', name: 'Seven deals', desc: 'Play 7 daily challenges.', check: (r, v, h) => h.dailyChallenges >= 7 },

  // ---- arcade ----
  ...game('snake', [
    { id: 'snake-10', icon: '🐍', name: 'Snack time', desc: 'Snake: eat 10 in one run.', check: (r) => r.score >= 10 },
    { id: 'snake-25', icon: '🐍', name: 'Long boi', desc: 'Snake: eat 25 in one run.', check: (r) => r.score >= 25 },
    { id: 'snake-50', icon: '🐉', name: 'Dragon', desc: 'Snake: eat 50 in one run.', check: (r) => r.score >= 50 },
  ]),
  ...game('brick-duel', [
    { id: 'breaker-level2', icon: '🧱', name: 'Wall breaker', desc: 'Brick Breaker: clear a whole wall.', check: (r, v) => v.level >= 2 },
    { id: 'breaker-level4', icon: '🏗️', name: 'Demolition crew', desc: 'Brick Breaker: reach level 4.', check: (r, v) => v.level >= 4 },
    { id: 'breaker-1000', icon: '💯', name: 'Four figures', desc: 'Brick Breaker: score 1,000.', check: (r) => r.score >= 1000 },
  ]),
  ...game('blocks-1p', [
    { id: 'blocks-four', icon: '🟦', name: 'Four at once', desc: 'Blocks: clear 4 rows with one piece.', check: (r, v) => v.bestClear >= 4 },
    { id: 'blocks-40', icon: '📏', name: 'Forty lines', desc: 'Blocks: clear 40 rows in one run.', check: (r, v) => v.lines >= 40 },
    { id: 'blocks-10k', icon: '🏆', name: 'Block master', desc: 'Blocks: score 10,000.', check: (r) => r.score >= 10000 },
  ]),
  ...game('flappy', [
    { id: 'flappy-10', icon: '🐤', name: 'Fledgling', desc: 'Flappy: pass 10 pipes.', check: (r) => r.score >= 10 },
    { id: 'flappy-25', icon: '🕊️', name: 'Taking flight', desc: 'Flappy: pass 25 pipes.', check: (r) => r.score >= 25 },
    { id: 'flappy-50', icon: '🦅', name: 'Eagle', desc: 'Flappy: pass 50 pipes.', check: (r) => r.score >= 50 },
  ]),
  ...game('asteroid-duel', [
    { id: 'asteroids-wave3', icon: '☄️', name: 'Rock breaker', desc: 'Asteroids: reach wave 3.', check: (r, v) => v.wave >= 3 },
    { id: 'asteroids-wave6', icon: '🚀', name: 'Deep space', desc: 'Asteroids: reach wave 6.', check: (r, v) => v.wave >= 6 },
    { id: 'asteroids-10k', icon: '⭐', name: 'Ace pilot', desc: 'Asteroids: score 10,000 (an extra ship!).', check: (r) => r.score >= 10000 },
  ]),
  ...game('tower-stack', [
    { id: 'stack-10', icon: '🧱', name: 'Steady hands', desc: 'Stack: stack 10 blocks.', check: (r) => r.score >= 10 },
    { id: 'stack-25', icon: '🏙️', name: 'Skyscraper', desc: 'Stack: stack 25 blocks.', check: (r) => r.score >= 25 },
    { id: 'stack-perfect5', icon: '🎯', name: 'Spot on', desc: 'Stack: 5 perfect drops in a row.', check: (r, v) => v.bestPerfects >= 5 },
  ]),
  ...game('cave', [
    { id: 'cave-100', icon: '🚁', name: 'Lift off', desc: 'Helicopter Cave: fly 100 m.', check: (r) => r.score >= 100 },
    { id: 'cave-500', icon: '🦇', name: 'Cave diver', desc: 'Helicopter Cave: fly 500 m.', check: (r) => r.score >= 500 },
    { id: 'cave-1000', icon: '🏔️', name: 'Deep down', desc: 'Helicopter Cave: fly 1,000 m.', check: (r) => r.score >= 1000 },
    // Each of these opens the next map or a vehicle (see MAPS and VEHICLES in server/games/cave.js).
    { id: 'cave-mine', icon: '⛏️', name: 'Down the shaft', desc: 'Helicopter Cave: fly 300 m in the Old Mine.', check: (r) => r.variant === 'Old Mine' && r.score >= 300 },
    { id: 'cave-ice', icon: '🧊', name: 'Thin ice', desc: 'Helicopter Cave: fly 300 m in the Ice Tunnel.', check: (r) => r.variant === 'Ice Tunnel' && r.score >= 300 },
    { id: 'cave-volcano', icon: '🌋', name: 'Through the fire', desc: 'Helicopter Cave: fly 300 m in the Volcano.', check: (r) => r.variant === 'Volcano' && r.score >= 300 },
  ]),
  ...game('bubbles', [
    { id: 'bubbles-clear', icon: '🫧', name: 'Clean sweep', desc: 'Bubble Shooter: clear a whole board.', check: (r, v) => v.cleared >= 1 },
    { id: 'bubbles-combo', icon: '💥', name: 'Avalanche', desc: 'Bubble Shooter: bring down 10 bubbles with one shot.', check: (r, v) => v.bestCombo >= 10 },
    { id: 'bubbles-5k', icon: '🎈', name: 'Bubble trouble', desc: 'Bubble Shooter: score 5,000.', check: (r) => r.score >= 5000 },
  ]),
  ...game('hopper', [
    { id: 'hopper-cross', icon: '🐸', name: 'Why did the frog…', desc: 'Road Hopper: make it across.', check: (r, v) => v.crossings >= 1 },
    { id: 'hopper-5', icon: '🛣️', name: 'Road warrior', desc: 'Road Hopper: make 5 crossings in one run.', check: (r, v) => v.crossings >= 5 },
    { id: 'hopper-1000', icon: '🏆', name: 'Hop star', desc: 'Road Hopper: score 1,000.', check: (r) => r.score >= 1000 },
  ]),
  ...game('invaders', [
    { id: 'invaders-wave2', icon: '👾', name: 'Defender', desc: 'Invaders: clear a whole wave.', check: (r, v) => v.wave >= 2 },
    { id: 'invaders-saucer', icon: '🛸', name: 'Saucer spotter', desc: 'Invaders: shoot down a saucer.', check: (r, v) => v.saucers >= 1 },
    { id: 'invaders-5k', icon: '🌍', name: 'Earth\'s hero', desc: 'Invaders: score 5,000.', check: (r) => r.score >= 5000 },
  ]),
  ...game('runner', [
    { id: 'runner-100', icon: '🏃', name: 'Jogger', desc: 'Runner: run 100 m.', check: (r) => r.score >= 100 },
    { id: 'runner-500', icon: '🏃‍♀️', name: 'Sprinter', desc: 'Runner: run 500 m.', check: (r) => r.score >= 500 },
    { id: 'runner-1000', icon: '🏅', name: 'Marathon', desc: 'Runner: run 1,000 m.', check: (r) => r.score >= 1000 },
  ]),

  // ---- puzzle ----
  ...game('2048', [
    { id: '2048-512', icon: '🔢', name: 'Halfway there', desc: '2048: make a 512 tile.', check: (r, v) => v.biggest >= 512 },
    { id: '2048-2048', icon: '🎯', name: '2048!', desc: '2048: make the 2048 tile.', check: (r, v) => v.biggest >= 2048 },
  ]),
  ...game('mine-duel', [
    { id: 'mines-easy', icon: '🚩', name: 'Sweeper', desc: 'Minesweeper: clear an Easy field.', check: (r, v) => scored(r) && r.variant === 'Easy' },
    { id: 'mines-easy-60', icon: '⏱️', name: 'Quick sweep', desc: 'Minesweeper: clear an Easy field in under a minute.', check: (r) => scored(r) && r.variant === 'Easy' && r.score < MIN },
    { id: 'mines-hard', icon: '💣', name: 'Bomb squad', desc: 'Minesweeper: clear a Hard field.', check: (r) => scored(r) && r.variant === 'Hard' },
  ]),
  ...game('sudoku', [
    { id: 'sudoku-easy', icon: '✏️', name: 'Number cruncher', desc: 'Sudoku: solve a puzzle.', check: (r) => scored(r) },
    { id: 'sudoku-hard', icon: '🧩', name: 'Hard nut', desc: 'Sudoku: solve a Hard puzzle.', check: (r) => scored(r) && r.variant === 'Hard' },
    { id: 'sudoku-fast', icon: '⚡', name: 'Speed solver', desc: 'Sudoku: solve a Medium or Hard puzzle in under 10 minutes.', check: (r) => scored(r) && r.variant !== 'Easy' && r.score < 10 * MIN },
  ]),
  ...game('solitaire', [
    { id: 'solitaire-win', icon: '🃏', name: 'Patience', desc: 'Solitaire: finish a game.', check: (r) => scored(r) },
    { id: 'solitaire-draw3', icon: '🂡', name: 'Three card trick', desc: 'Solitaire: finish a Draw 3 game.', check: (r) => scored(r) && r.variant === 'Draw 3' },
    { id: 'solitaire-fast', icon: '🏎️', name: 'Card shark', desc: 'Solitaire: finish a game in under 5 minutes.', check: (r) => scored(r) && r.score < 5 * MIN },
  ]),
  ...game('slide', [
    { id: 'slide-3', icon: '🔢', name: 'In order', desc: 'Sliding Puzzle: solve a 3×3.', check: (r) => scored(r) && r.variant === '3×3' },
    { id: 'slide-4-2min', icon: '⏱️', name: 'Smooth slider', desc: 'Sliding Puzzle: solve a 4×4 in under 2 minutes.', check: (r) => scored(r) && r.variant === '4×4' && r.score < 2 * MIN },
    { id: 'slide-5', icon: '🧊', name: 'Big puzzle', desc: 'Sliding Puzzle: solve a 5×5.', check: (r) => scored(r) && r.variant === '5×5' },
  ]),
  ...game('nonogram', [
    { id: 'nonogram-solve', icon: '🖼️', name: 'Picture this', desc: 'Nonograms: solve a puzzle.', check: (r) => scored(r) },
    { id: 'nonogram-10-5', icon: '⏱️', name: 'Quick sketch', desc: 'Nonograms: solve a 10×10 in under 5 minutes.', check: (r, v) => scored(r) && v.n === 10 && r.score < 5 * MIN },
    { id: 'nonogram-15', icon: '🎨', name: 'Big picture', desc: 'Nonograms: solve a 15×15.', check: (r, v) => scored(r) && v.n === 15 },
  ]),
  ...game('flood', [
    { id: 'flood-win', icon: '🌊', name: 'Flooded', desc: 'Flood-It: flood a whole board.', check: (r) => scored(r) },
    { id: 'flood-par', icon: '🎯', name: 'Sharp tide', desc: 'Flood-It: flood a board in 20 moves or fewer.', check: (r) => scored(r) && r.score <= 20 },
    { id: 'flood-large', icon: '🌍', name: 'Ocean', desc: 'Flood-It: flood the 18 × 18 board.', check: (r) => scored(r) && r.variant === '18 × 18' },
  ]),
  ...game('dogpark', [
    { id: 'dogpark-solve', icon: '🐶', name: 'Good dog', desc: 'Dog Park: solve a park.', check: (r) => scored(r) },
    { id: 'dogpark-10', icon: '🦮', name: 'Pack leader', desc: 'Dog Park: solve level 10.', check: (r) => scored(r) && r.variant === 'Level 10' },
    { id: 'dogpark-nohint', icon: '🎾', name: 'Off the leash', desc: 'Dog Park: solve a 9 × 9 park or bigger without a hint.', check: (r, v) => scored(r) && v.n >= 9 && !v.hints },
    { id: 'dogpark-30', icon: '🏆', name: 'Top dog', desc: 'Dog Park: solve level 30.', check: (r) => scored(r) && r.variant === 'Level 30' },
    { id: 'dogpark-expert', icon: '🎖️', name: 'Best in show', desc: 'Dog Park: solve level 36, the last of the Expert pack.', check: (r) => scored(r) && r.variant === 'Level 36' },
  ]),
  ...game('lines', [
    { id: 'lines-first', icon: '🎱', name: 'Five of a kind', desc: 'Color Lines: finish a game with 10 points or more.', check: (r) => scored(r) && r.score >= 10 },
    { id: 'lines-100', icon: '🌈', name: 'Rainbow runner', desc: 'Color Lines: score 100 points.', check: (r) => scored(r) && r.score >= 100 },
    { id: 'lines-300', icon: '🧠', name: 'Board tamer', desc: 'Color Lines: score 300 points.', check: (r) => scored(r) && r.score >= 300 },
  ]),
  ...game('mastermind-1p', [
    { id: 'mastermind-solve', icon: '🔐', name: 'Code breaker', desc: 'Mastermind: crack a code.', check: (r) => scored(r) },
    { id: 'mastermind-5', icon: '🕵️', name: 'Sharp deduction', desc: 'Mastermind: crack a code in 5 guesses or fewer.', check: (r) => scored(r) && r.score <= 5 },
    { id: 'mastermind-hard', icon: '🧩', name: 'Cipher master', desc: 'Mastermind: crack a Hard code.', check: (r) => scored(r) && r.variant === 'Hard' },
  ]),
  ...game('sokoban', [
    { id: 'sokoban-3', icon: '📦', name: 'Warehouse worker', desc: 'Sokoban: solve level 3.', check: (r) => scored(r) && r.variant === 'Level 3' },
    { id: 'sokoban-par', icon: '⭐', name: 'By the book', desc: 'Sokoban: solve a level from 4 on in par.', check: (r, v) => scored(r) && v.levelNo >= 4 && r.score <= v.par },
    { id: 'sokoban-10', icon: '🏭', name: 'Head of logistics', desc: 'Sokoban: solve level 10.', check: (r) => scored(r) && r.variant === 'Level 10' },
  ]),
  ...game('kenken', [
    { id: 'kenken-solve', icon: '➗', name: 'Number cruncher', desc: 'KenKen: solve a puzzle.', check: (r) => scored(r) },
    { id: 'kenken-5-3', icon: '⏱️', name: 'Mental maths', desc: 'KenKen: solve a 5 × 5 in under 3 minutes.', check: (r, v) => scored(r) && v.n === 5 && r.score < 3 * MIN },
    { id: 'kenken-6', icon: '🧮', name: 'Calculator brain', desc: 'KenKen: solve a 6 × 6.', check: (r, v) => scored(r) && v.n === 6 },
  ]),
  ...game('lights', [
    { id: 'lights-solve', icon: '💡', name: 'Lights out', desc: 'Lights Out: switch every light off.', check: (r) => scored(r) },
    { id: 'lights-par', icon: '⭐', name: 'On par', desc: 'Lights Out: solve a Hard puzzle in par or fewer.', check: (r, v) => scored(r) && r.variant === 'Hard' && r.score <= v.par },
    { id: 'lights-noreset', icon: '🔦', name: 'No going back', desc: 'Lights Out: solve a Hard puzzle without starting again.', check: (r, v) => scored(r) && r.variant === 'Hard' && v.resets === 0 },
  ]),
  ...game('word-hunt', [
    { id: 'wordsearch-solve', icon: '🔍', name: 'Word finder', desc: 'Word Search: find every word.', check: (r) => scored(r) },
    { id: 'wordsearch-fast', icon: '⏱️', name: 'Eagle eyes', desc: 'Word Search: clear the 8 × 8 in under a minute.', check: (r) => scored(r) && r.variant === '8 × 8' && r.score < MIN },
    { id: 'wordsearch-large', icon: '🗺️', name: 'Every which way', desc: 'Word Search: clear the 12 × 12.', check: (r) => scored(r) && r.variant === '12 × 12' },
  ]),
  ...game('freecell', [
    { id: 'freecell-win', icon: '🃏', name: 'Free and clear', desc: 'FreeCell: win a game.', check: (r) => scored(r) },
    { id: 'freecell-8min', icon: '⏱️', name: 'Card sharp', desc: 'FreeCell: win in under 8 minutes.', check: (r) => scored(r) && r.score < 8 * MIN },
    { id: 'freecell-120', icon: '🎯', name: 'No wasted moves', desc: 'FreeCell: win in under 120 moves.', check: (r, v) => scored(r) && v.moves < 120 },
  ]),
  ...game('mahjong', [
    { id: 'mahjong-clear', icon: '🀄', name: 'Clean sweep', desc: 'Mahjong Solitaire: clear the pile.', check: (r) => scored(r) },
    { id: 'mahjong-nohelp', icon: '🧘', name: 'No help needed', desc: 'Mahjong Solitaire: clear it without a hint or a shuffle.', check: (r, v) => scored(r) && !v.hints && !v.shuffles },
    { id: 'mahjong-10min', icon: '⏱️', name: 'Tile racer', desc: 'Mahjong Solitaire: clear it in under 10 minutes.', check: (r) => scored(r) && r.score < 10 * MIN },
  ]),
  ...game('gems', [
    { id: 'gems-five', icon: '💎', name: 'Five in a row', desc: 'Gem Swap: line up 5 of a colour.', check: (r, v) => v.biggest >= 5 },
    { id: 'gems-chain4', icon: '⛓️', name: 'Chain reaction', desc: 'Gem Swap: set off a chain of 4.', check: (r, v) => v.bestChain >= 4 },
    { id: 'gems-3000', icon: '💰', name: 'Treasure', desc: 'Gem Swap: score 3,000.', check: (r) => r.score >= 3000 },
  ]),

  // ---- brain ----
  ...game('five-letters', [
    { id: 'word-first', icon: '🔤', name: 'Wordsmith', desc: 'Five Letters: find a word.', check: (r) => scored(r) },
    { id: 'word-3', icon: '🧠', name: 'Sharp', desc: 'Five Letters: find a word in 3 guesses or fewer.', check: (r) => scored(r) && r.score <= 3 },
    { id: 'word-daily-5', icon: '📆', name: 'Daily habit', desc: 'Five Letters: find today\'s word on 5 different days.', check: (r, v, h) => h.dailyWords >= 5 },
  ]),
  ...game('simon', [
    { id: 'simon-10', icon: '🟢', name: 'Good memory', desc: 'Simon: repeat a sequence of 10.', check: (r) => r.score >= 10 },
    { id: 'simon-20', icon: '🧠', name: 'Elephant', desc: 'Simon: repeat a sequence of 20.', check: (r) => r.score >= 20 },
  ]),
  ...game('maths', [
    { id: 'maths-20', icon: '➕', name: 'Number whiz', desc: 'Quick Maths: 20 right in one go.', check: (r) => r.score >= 20 },
    { id: 'maths-40', icon: '🧮', name: 'Human calculator', desc: 'Quick Maths: 40 right in one go.', check: (r) => r.score >= 40 },
    { id: 'maths-perfect', icon: '✅', name: 'No mistakes', desc: 'Quick Maths: 15 or more right without a wrong one.', check: (r, v) => r.score >= 15 && v.wrong === 0 },
  ]),
  ...game('colours', [
    { id: 'colours-20', icon: '🎨', name: 'Not fooled', desc: 'Colour Trap: 20 right in one go.', check: (r) => r.score >= 20 },
    { id: 'colours-40', icon: '🌈', name: 'Colour master', desc: 'Colour Trap: 40 right in one go.', check: (r) => r.score >= 40 },
    { id: 'colours-streak', icon: '🔥', name: 'Unshakeable', desc: 'Colour Trap: 25 right in a row.', check: (r, v) => v.bestStreak >= 25 },
  ]),
  ...game('quiz', [
    { id: 'trivia-1500', icon: '🧠', name: 'Know-it-all', desc: 'Trivia: score 1,500.', check: (r) => r.score >= 1500 },
    { id: 'trivia-perfect', icon: '🎓', name: 'Full marks', desc: 'Trivia: get all 12 right.', check: (r, v) => v.of > 0 && v.right === v.of },
    { id: 'trivia-fast', icon: '⚡', name: 'Buzzer beater', desc: 'Trivia: a right answer in under 2 seconds.', check: (r, v) => v.fastest !== null && v.fastest < 2000 },
  ]),
  ...game('anagram-duel', [
    { id: 'anagram-10', icon: '🔤', name: 'Wordsmith', desc: 'Anagram Rush: make 10 words.', check: (r) => r.score >= 10 },
    { id: 'anagram-20', icon: '📚', name: 'Lexicon', desc: 'Anagram Rush: make 20 words.', check: (r) => r.score >= 20 },
    { id: 'anagram-streak', icon: '🔥', name: 'On a roll', desc: 'Anagram Rush: 8 words in a row without a skip.', check: (r, v) => v.bestStreak >= 8 },
  ]),
  ...game('numbers', [
    { id: 'numbers-7', icon: '🔢', name: 'Phone number', desc: 'Number Memory: remember 7 digits.', check: (r) => r.score >= 7 },
    { id: 'numbers-10', icon: '🧠', name: 'Ten digits', desc: 'Number Memory: remember 10 digits.', check: (r) => r.score >= 10 },
    { id: 'numbers-14', icon: '🐘', name: 'Never forgets', desc: 'Number Memory: remember 14 digits.', check: (r) => r.score >= 14 },
  ]),
  ...game('oddone', [
    { id: 'oddone-15', icon: '👁️', name: 'Keen eye', desc: 'Odd One Out: find 15.', check: (r) => r.score >= 15 },
    { id: 'oddone-25', icon: '🦅', name: 'Eagle eye', desc: 'Odd One Out: find 25.', check: (r) => r.score >= 25 },
    { id: 'oddone-clean', icon: '🎯', name: 'Sure thing', desc: 'Odd One Out: find 12 without a wrong tap.', check: (r, v) => r.score >= 12 && v.wrong === 0 },
  ]),
  ...game('hangman', [
    { id: 'hangman-5', icon: '🔠', name: 'Word detective', desc: 'Hangman: guess 5 words in one run.', check: (r, v) => v.solved >= 5 },
    { id: 'hangman-10', icon: '🗝️', name: 'Escape artist', desc: 'Hangman: guess 10 words in one run.', check: (r, v) => v.solved >= 10 },
    { id: 'hangman-flawless', icon: '✨', name: 'Not a slip', desc: 'Hangman: guess 3 words with no wrong guess in one run.', check: (r, v) => v.perfects >= 3 },
  ]),
  ...game('memory-match', [
    { id: 'memory-solve', icon: '🃏', name: 'Total recall', desc: 'Memory Pairs: find every pair.', check: (r) => scored(r) },
    { id: 'memory-12', icon: '🧠', name: 'Sharp memory', desc: 'Memory Pairs: clear 4 × 4 in 12 tries or fewer.', check: (r, v) => scored(r) && v.w === 4 && v.h === 4 && r.score <= 12 },
    { id: 'memory-large', icon: '🐘', name: 'Elephant', desc: 'Memory Pairs: clear 6 × 6.', check: (r, v) => scored(r) && v.w === 6 && v.h === 6 },
  ]),
  ...game('reaction-duel', [
    { id: 'reaction-300', icon: '⚡', name: 'Quick', desc: 'Reaction Rush: average under 300 ms.', check: (r) => scored(r) && r.score < 300 },
    { id: 'reaction-250', icon: '⚡', name: 'Lightning', desc: 'Reaction Rush: average under 250 ms.', check: (r) => scored(r) && r.score < 250 },
    { id: 'reaction-clean', icon: '🎯', name: 'Steady hands', desc: 'Reaction Rush: five rounds, no false starts, every one under 350 ms.', check: (r, v) => scored(r) && v.falseStarts === 0 && v.times.length >= 5 && v.times.every((t) => t < 350) },
  ]),
];

const byId = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const getAchievement = (id) => byId.get(id) || null;

/** What a screen needs to show an achievement (the check stays on the server). */
export const describe = (a, at = null) => ({ id: a.id, game: a.game || null, icon: a.icon, name: a.name, desc: a.desc, at });

/** The longest run of consecutive days (UTC) in a list of timestamps. */
export function longestStreak(times) {
  const days = [...new Set(times.map((t) => Math.floor(t / DAY)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

/**
 * The achievements this run earns that the player didn't have. A check that
 * throws (a view missing a field) counts as not earned.
 */
export function newlyEarned(run, view, history, have) {
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (have[a.id] || (a.game && a.game !== run.game)) continue;
    let ok;
    try {
      ok = Boolean(a.check(run, view || {}, history));
    } catch {
      ok = false; // (a check that trips over an odd view just isn't earned)
    }
    if (ok) out.push(a);
  }
  return out;
}
