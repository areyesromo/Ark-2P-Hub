import reactionDuel from './reaction-duel.js';
import { SOLO_GAMES, SOLO_CATEGORIES } from '../solo/games/index.js';
import { soloGame } from '../solo/adapter.js';
import rockPaperScissors from './rock-paper-scissors.js';
import pong from './pong.js';
import tron from './tron.js';
import airHockey from './air-hockey.js';
import volleyBlobs from './volley-blobs.js';
import brickDuel from './brick-duel.js';
import asteroidDuel from './asteroid-duel.js';
import rallyTennis from './rally-tennis.js';
import blockBattle from './block-battle.js';
import snake from './snake.js';
import tanks from './tanks.js';
import quiz, { TOPICS } from './quiz.js';
import triviaQuest from './trivia-quest.js';
import fakeOut from './fake-out.js';
import crazyEights from './crazy-eights.js';
import kitchenRush from './kitchen-rush.js';
import towerDuel from './tower-duel.js';
import dungeonDuo from './dungeon-duo.js';
import drawDuel from './draw-duel.js';
import battleship from './battleship.js';
import { SEAS } from './battleship-ultimate.js';
import { battleshipBot } from './battleship-bot.js';
import { connectFourBot } from './connect-four-bot.js';
import { checkersBot } from './checkers-bot.js';
import { dotsBoxesBot } from './dots-boxes-bot.js';
import { mancalaBot } from './mancala-bot.js';
import { rpsBot } from './rock-paper-scissors-bot.js';
import { memoryMatchBot } from './memory-match-bot.js';
import { diceBot } from './dice-party-bot.js';
import { pongBot } from './pong-bot.js';
import { airHockeyBot } from './air-hockey-bot.js';
import { snakeBot } from './snake-bot.js';
import { tronBot } from './tron-bot.js';
import { tanksBot } from './tanks-bot.js';
import { wordHuntBot } from './word-hunt-bot.js';
import { volleyBlobsBot } from './volley-blobs-bot.js';
import { brickDuelBot } from './brick-duel-bot.js';
import { asteroidDuelBot } from './asteroid-duel-bot.js';
import { rallyTennisBot } from './rally-tennis-bot.js';
import { sumoBot } from './sumo-bot.js';
import { miniGolfBot } from './mini-golf-bot.js';
import { tenPinBot } from './ten-pin-bot.js';
import { blockBattleBot } from './block-battle-bot.js';
import { crazyEightsBot } from './crazy-eights-bot.js';
import { liarsDiceBot } from './liars-dice-bot.js';
import { anagramDuelBot } from './anagram-duel-bot.js';
import { wordRaceBot } from './word-race-bot.js';
import { miniBot } from './minis/bots.js';
import { partyBoardBot } from './party-board-bot.js';
import { marbleMazeBot } from './marble-maze-bot.js';
import { kitchenRushBot } from './kitchen-rush-bot.js';
import { dungeonDuoBot } from './dungeon-duo-bot.js';
import { bombDuelBot } from './bomb-duel-bot.js';
import { kartRaceBot } from './kart-race-bot.js';
import { towerDuelBot } from './tower-duel-bot.js';
const SEA_NAMES = Object.fromEntries(Object.entries(SEAS).map(([k, v]) => [k, v.name]));
import sketchGuess from './sketch-guess.js';
import connectFour from './connect-four.js';
import sumo from './sumo.js';
import wordRace from './word-race.js';
import anagramDuel from './anagram-duel.js';
import wordHunt, { SIZES as HUNT_SIZES } from './word-hunt.js';
import miniGolf from './mini-golf.js';
import tenPin from './ten-pin.js';
import towerStack from './tower-stack.js';
import bombDuel from './bomb-duel.js';
import kartRace from './kart-race.js';
import kartRace3d from './kart-race-3d.js';
import memoryMatch from './memory-match.js';
import bombSquad, { LEVELS as BOMB_LEVELS } from './bomb-squad.js';
import marbleMaze, { LEVELS as MAZE_LEVELS } from './marble-maze.js';
import mindMeld from './mind-meld.js';
import liarsDice from './liars-dice.js';
import microMayhem from './micro-mayhem.js';
import partyMinis from './party-minis.js';
import partyBoard from './party-board.js';
import diceParty from './dice-party.js';
import checkers from './checkers.js';
import { PARTIES } from './minis/index.js';
import mancala from './mancala.js';
import dotsBoxes from './dots-boxes.js';
import reversi from './reversi.js';
import { reversiBot } from './reversi-bot.js';
import blackjack from './blackjack.js';
import holdem from './holdem.js';
import { holdemBot } from './holdem-bot.js';
import speed from './speed.js';
import { speedBot } from './speed-bot.js';
import cribbage from './cribbage.js';
import { cribbageBot } from './cribbage-bot.js';
import luckySeven from './lucky-seven.js';
import { luckySevenBot } from './lucky-seven-bot.js';
import videoPoker from './video-poker.js';
import { videoPokerBot } from './video-poker-bot.js';
import goFish from './go-fish.js';
import { goFishBot } from './go-fish-bot.js';
import spades from './spades.js';
import { spadesBot } from './spades-bot.js';
import hearts from './hearts.js';
import { heartsBot } from './hearts-bot.js';
import whichBox from './which-box.js';
import oddEven from './odd-even.js';
import { whichBoxBot, oddEvenBot } from './guess-bots.js';
import hex from './hex.js';
import { hexBot } from './hex-bot.js';
import ultimateTtt from './ultimate-ttt.js';
import { ultimateTttBot } from './ultimate-ttt-bot.js';
import redDog from './red-dog.js';
import { redDogBot } from './red-dog-bot.js';
import baccarat from './baccarat.js';
import { baccaratBot } from './baccarat-bot.js';
import { blackjackBot } from './blackjack-bot.js';
import fiveLetters from './five-letters.js';
import { fiveLettersBot } from './five-letters-bot.js';
import make24 from './make-24.js';
import { make24Bot } from './make-24-bot.js';
import mineDuel from './mine-duel.js';
import { mineDuelBot } from './mine-duel-bot.js';
import backgammon from './backgammon.js';
import { backgammonBot } from './backgammon-bot.js';
import ginRummy from './gin-rummy.js';
import { ginRummyBot } from './gin-rummy-bot.js';
import colourClash from './colour-clash.js';
import { colourClashBot } from './colour-clash-bot.js';
import chess from './chess.js';
import { chessBot } from './chess-bot.js';
import ludo from './ludo.js';
import { ludoBot } from './ludo-bot.js';
import dominoes from './dominoes.js';
import { dominoesBot } from './dominoes-bot.js';
import fiveInARow from './five-in-a-row.js';
import { fiveInARowBot } from './five-in-a-row-bot.js';
import morris from './morris.js';
import { morrisBot } from './morris-bot.js';
import codeBreaker from './code-breaker.js';
import { codeBreakerBot } from './code-breaker-bot.js';
import hangman from './hangman.js';
import { hangmanBot } from './hangman-bot.js';
import { withSetup } from './options.js';
import { BLURBS } from './blurbs.js';

/**
 * Every game is a module exporting:
 *
 *   { id, name, tagline, category?, create(ctx) }
 *
 * category is 'competitive' (the default: you play against each other),
 * 'board' (dice, cards and board games, also head to head) or 'casual'
 * (you play together, nobody really loses). The lobby groups them.
 * The solo games (the lobby's 1 player mode, from Ark 1P Hub) add 'arcade', 'puzzle'
 * and 'brain', with solo: true and score: { better, unit }: they keep their own contract
 * (server/solo/games/index.js) and the room plays them through soloGame (server/solo/adapter.js).
 * needsPhone: true keeps a game out of "random" when both players use
 * controllers (one of them needs a private screen).
 * phoneOnly: true means both players need a phone: with a controller seated, the
 * lobby greys the game out and the room won't start it.
 * handheld: true labels it "📱 No TV needed" in the lobby (it can be played on the
 * phones alone); motion: true labels it "🤸 Motion" (phones can tilt or move to play).
 * bot(view, level, rng, retries, memory): the computer opponent ("🤖 Vs computer" in the lobby).
 * Given the computer's own view and its level ('easy', 'normal', 'hard'), it gives its next input,
 * or null when it has no move. The view is playerView, or botView(slot) if the game has one (what
 * else the computer may see, such as the minis' timing). The input
 * may carry botDelayMs, its pause before playing it (a reaction time: what it worked out when it
 * looked is what it plays then; with botAnticipate, a move it saw coming and timed, such as its
 * own planned turn, it judges afresh at that moment; with botFor, what it's for, such as a piece,
 * it isn't played if that has changed by then); memory is an object kept
 * for the match (what it has seen, how you play); retries counts the times the same move came
 * back (the game refused it). The room seats it as a controller player (ctx.players[slot].bot
 * is its level) and plays its moves after a pause (Room#driveBot). Games without one can't be
 * started while it's seated.
 * resumes: true (see RESUMES below) for a game the room saves while it waits for a move, so a
 * restart picks it up again. Its state must be plain data (arrays, objects, Sets, Maps); the
 * room puts it back on a fresh instance from create(ctx), and calls resumed() if it has one.
 * steers: true for a game played by steering with a stick (Tank Duel, Asteroid Duel): there the
 * room shows the computer each view a reaction time late and plays what it decides at once, as
 * a person keeps steering on what they saw a moment ago (see Sight in bot-human.js); botDelayMs
 * is then ignored. (Games where it goes to a spot, with a hand, are tuned for a move per reaction.)
 *
 * create(ctx) returns an instance with:
 *   start()                  begin (or restart) the match
 *   onInput(slot, input)     a phone sent { type, ... }
 *   hostView()               plain object rendered by public/games/<id>/host.js
 *   playerView(slot)         plain object rendered by public/games/<id>/player.js
 *
 * ctx gives the game: players, now(), setTimeout/clearTimeout (auto-cleared
 * when the game ends), and update() to push fresh views to every screen.
 *
 * To add a game: write the module, list it below, and add the two renderers
 * under public/games/<id>/.
 */
// Setup screens for the games that don't draw their own (see withSetup in
// options.js). The first value of each list is the default.
const firstTo = (title, values) => ({ wins: { title, values, label: (n) => (n === 1 ? 'One round' : `First to ${n}`) } });
const ROUNDS_WON = 'Round wins needed';
/**
 * Timed (the game's usual times, said in `times`) or no timer (a turn or answer waits for you).
 * `usual` is the one picked first: 'off' for the co-op thinking games, 'timed' where a timer stops
 * one player stalling the other. The game reads it with settingOf(ctx, 'timer', ...).
 */
const timer = (usual, times) => ({
  timer: { title: 'Timer', values: usual === 'off' ? ['off', 'timed'] : ['timed', 'off'], label: (k) => (k === 'off' ? 'No timer: it waits for you' : `⏱ Timed: ${times}`) },
});

/** Party Minigames and Micro Mayhem: the computer is the minigame player (minis/bots.js). */
const minigamesBot = (view, level, rng, retries, memory) => miniBot(view, level, rng, memory);

const GAMES = [
  withSetup(reactionDuel, firstTo('Points to win', [3, 5, 7])),
  withSetup({ ...rockPaperScissors, bot: rpsBot }, firstTo('Points to win', [3, 5, 7])),
  withSetup({ ...pong, bot: pongBot }, firstTo('Points to win', [5, 3, 7, 11])),
  withSetup({ ...tron, bot: tronBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...airHockey, bot: airHockeyBot }, {
    ...firstTo('Goals to win', [7, 5, 10]),
    ownGoals: { title: 'Own goals', values: ['count', 'bounce'], label: (k) => (k === 'count' ? 'Count, as in real air hockey' : "Don't count: your goal bounces it out") },
  }),
  withSetup({ ...volleyBlobs, bot: volleyBlobsBot }, firstTo('Points to win', [7, 5, 11])),
  withSetup({ ...brickDuel, bot: brickDuelBot }, {
    rows: { title: 'Wall', values: [5, 3, 7], label: (n) => `${n} rows of bricks` },
    misses: { title: 'Missed ball', values: ['brick', 'moment'], label: (k) => (k === 'brick' ? 'A brick comes back' : 'Just a moment lost') },
  }),
  withSetup({ ...asteroidDuel, bot: asteroidDuelBot, steers: true }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...rallyTennis, bot: rallyTennisBot }, firstTo('Games to win', [4, 3, 6])),
  withSetup({ ...blockBattle, bot: blockBattleBot }, firstTo(ROUNDS_WON, [2, 1, 3])),
  withSetup({ ...snake, bot: snakeBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...tanks, bot: tanksBot, steers: true }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...sumo, bot: sumoBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...partyBoard, bot: partyBoardBot }, {
    map: {
      title: 'Map',
      values: ['random', 'island', 'lagoons', 'pipes', 'skybridges', 'haunted', 'market', 'volcano'],
      label: (m) => ({ random: '🎲 Random', island: '🏝️ Party Island · Easy', lagoons: '🌊 Twin Lagoons · Easy', pipes: '🔧 Pipe Works · Medium', skybridges: '🌉 Sky Bridges · Medium', haunted: '👻 Haunted Maze · Hard', market: '🛒 Market Square · Hard', volcano: '🌋 Volcano Peak · Expert' })[m],
    },
    turns: { title: 'Game length', values: [10, 15, 20], label: (n) => `${n} turns` },
    style: { title: 'Minigames', values: ['mix', '2d', '3d'], label: (s) => ({ mix: 'Mix of 2D and 3D', '2d': '2D only', '3d': '3D only' })[s] },
    bonus: { title: 'Bonus stars at the end', values: [1, 0], label: (b) => (b ? 'Bonus stars' : 'No bonus stars') },
    view: { title: 'Board view', values: ['2d', '3d'], label: (v) => (v === '3d' ? '🧊 3D (best on a PC or Steam Deck)' : '🗺️ 2D') },
    tiles: { title: 'Tile art', values: ['art', 'light', 'classic'], label: (v) => ({ art: '⚙️ Steampunk (3D models)', light: '⚙️ Steampunk (light, for slower TVs)', classic: '🎨 Classic colours' })[v] },
    harsh: { title: 'Hazards', values: [0, 1], label: (h) => (h ? '💀 Harsh mode (⚡ 💀 🌪️ spaces)' : 'Normal spaces') },
  }),
  withSetup({ ...partyMinis, bot: minigamesBot }, {
    ...firstTo('Wins needed', [3, 4, 5]),
    // A mix, or just one minigame over and over (to practise it, or a favourite).
    style: {
      title: 'Minigames',
      values: ['mix', '2d', '3d', ...PARTIES.map((m) => m.id)],
      label: (s) => ({ mix: '🎲 Random mix', '2d': '🎲 Random 2D', '3d': '🎲 Random 3D' })[s] || `🎯 ${PARTIES.find((m) => m.id === s).name}`,
    },
  }),
  withSetup({ ...microMayhem, bot: minigamesBot }, {
    lives: { title: 'Lives', values: [3, 5], label: (n) => `${n} lives` },
    pace: { title: 'Pace', values: ['normal', 'fast'], label: (p) => (p === 'fast' ? 'Fast (starts at speed 3)' : 'Normal') },
  }),
  { ...bombDuel, bot: bombDuelBot },
  { ...kartRace, bot: kartRaceBot },
  { ...kartRace3d, bot: kartRaceBot },
  withSetup(quiz, {
    questions: { title: 'Number of questions', values: [10, 5, 15, 20], label: (n) => String(n) },
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
  }),
  withSetup(triviaQuest, {
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
    hearts: { title: 'Difficulty', values: [5, 7, 3], label: (n) => (n === 7 ? 'Easy · 7 ❤️' : n === 5 ? 'Normal · 5 ❤️' : 'Hard · 3 ❤️') },
    ...timer('off', '15 s a question (12 s for the Dragon), faster hits harder'),
  }),
  withSetup(fakeOut, { rounds: { title: 'Rounds', values: [6, 4, 8], label: (n) => `${n} rounds` }, ...timer('timed', '60 s to write, 20 s to pick') }),
  withSetup({ ...crazyEights, bot: crazyEightsBot }, {
    actions: { title: 'Rules', values: [1, 0], label: (n) => (n ? 'Action cards (2, Jack, Q♠)' : 'Classic') },
    target: { title: 'Match', values: [100, 0, 200], label: (n) => (n ? `First to ${n}` : 'One hand') },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup({ ...kitchenRush, bot: kitchenRushBot }, {
    kitchen: { title: 'Kitchen', values: [0, 1, 2, 3], label: (n) => ['Diner', 'Split (pass it over)', 'Rush Hour', 'Food Truck (cheese, a moving hatch)'][n] },
    minutes: { title: 'Shift', values: [3, 2, 4], label: (n) => `${n} minutes` },
  }),
  withSetup({ ...towerDuel, bot: towerDuelBot }, { lives: { title: 'Lives', values: [20, 10, 30], label: (n) => `${n} lives` } }),
  withSetup(towerStack, {
    difficulty: { title: 'Difficulty', values: [0, 1], label: (n) => (n ? 'Easy (slower blocks, 5 lives, an easier perfect)' : 'Normal (3 lives)') },
  }),
  withSetup({ ...dungeonDuo, bot: dungeonDuoBot }, {
    heroes: { title: 'Heroes', values: [0, 1], label: (n) => (n ? 'Player 1 the ✨ Healer, player 2 the 🛡️ Fighter' : 'Player 1 the 🛡️ Fighter, player 2 the ✨ Healer') },
    difficulty: { title: 'Difficulty', values: [0, 1], label: (n) => (n ? 'Easy (more hearts, 5 continues, a weaker Warden)' : 'Normal (3 continues)') },
    quest: { title: 'Quest', values: [5, 3], label: (n) => (n === 5 ? 'Full: 5 floors (with the Ice Caves and the Armory)' : 'Short: 3 floors') },
  }),
  { ...wordRace, bot: wordRaceBot },
  withSetup({ ...codeBreaker, bot: codeBreakerBot }, { ...firstTo('Rounds to win', [2, 1, 3]), ...timer('timed', '60 s to set your code, 60 s a guess') }),
  withSetup({ ...hangman, bot: hangmanBot }, {
    words: { title: 'Words', values: ['players', 'hub'], label: (k) => (k === 'hub' ? 'The hub picks a word for each of you' : 'You set a word for each other') },
    ...firstTo('Rounds to win', [2, 1, 3]),
    ...timer('timed', '60 s to set your word, 150 s a round'),
  }),
  withSetup({ ...fiveLetters, bot: fiveLettersBot }, { ...firstTo('Rounds to win', [3, 2, 5]), ...timer('timed', '180 s a word') }),
  withSetup({ ...make24, bot: make24Bot }, {
    ...firstTo('Rounds to win', [5, 3, 7]),
    seconds: { title: 'Time per puzzle', values: [90, 60, 120, 0], label: (n) => (n ? `${n} s` : 'No timer: it waits for you (give up together to move on)') },
  }),
  withSetup({ ...anagramDuel, bot: anagramDuelBot }, firstTo('Rounds to win', [5, 3, 7])),
  withSetup({ ...wordHunt, bot: wordHuntBot }, {
    mode: { title: 'Mode', values: ['shared', 'race'], label: (k) => (k === 'race' ? 'Race (two phones): your own board each, first to find every word' : 'Shared board: first to mark a word gets it') },
    size: { title: 'Grid', values: ['medium', 'small', 'large'], label: (k) => `${HUNT_SIZES[k].name} · ${HUNT_SIZES[k].words} words${k === 'small' ? ', across and down' : k === 'medium' ? ', diagonals too' : ', any way, even backwards'}` },
    ...firstTo('Grids to win', [2, 1, 3]),
  }),
  { ...miniGolf, bot: miniGolfBot },
  withSetup({ ...tenPin, bot: tenPinBot }, {
    frames: { title: 'Game length', values: [10, 5], label: (n) => (n === 10 ? '10 frames (a full game)' : '5 frames (a quick one)') },
    bumpers: { title: 'Bumpers', values: [0, 1], label: (b) => (b ? '🛡️ Bumpers up: no gutter balls' : 'No bumpers') },
  }),
  withSetup(drawDuel, { rounds: { title: 'Shapes to draw', values: [5, 3, 7, 10], label: (n) => `${n} rounds` }, ...timer('timed', '20 s to draw') }),
  withSetup({ ...battleship, bot: battleshipBot }, {
    mode: { title: 'Mode', values: ['classic', 'ultimate'], label: (k) => (k === 'ultimate' ? '⚡ Ultimate: commanders, shaped ships and skills' : 'Classic: 5 ships, one shot a turn') },
    sea: { title: 'Sea (Ultimate)', values: ['open', 'archipelago', 'reef', 'strait', 'fog', 'volcano', 'random'], label: (k) => (k === 'random' ? '🎲 Any sea' : SEA_NAMES[k]) },
    shotSeconds: { title: 'Time per shot', values: [30, 15, 60, 0], label: (n) => (n ? `${n} s` : 'No timer: it waits for you') },
  }),
  withSetup({ ...connectFour, bot: connectFourBot }, { ...firstTo(ROUNDS_WON, [3, 1, 5]), ...timer('timed', '20 s a move') }),
  { ...memoryMatch, bot: memoryMatchBot },
  withSetup(bombSquad, {
    level: { title: 'Difficulty', values: [2, 1, 3, 4], label: (n) => `${BOMB_LEVELS[n].name} · ${BOMB_LEVELS[n].modules} modules, ${BOMB_LEVELS[n].ms / 60000} min` },
    bombs: { title: 'Bombs (you swap roles each one)', values: [3, 1, 5], label: (n) => (n === 1 ? 'One bomb' : `${n} bombs`) },
  }),
  withSetup({ ...marbleMaze, bot: marbleMazeBot }, {
    levels: { title: 'Mazes', values: [3, 8, 5, 1], label: (n) => (n === 1 ? 'One maze' : n === MAZE_LEVELS.length ? `All ${n} mazes` : `${n} mazes`) },
    controls: { title: 'Who tilts what', values: [1, 2], label: (n) => (n === 1 ? 'Split: one ↔, one ↕' : 'Shared: both steer') },
  }),
  withSetup(mindMeld, { rounds: { title: 'Rounds (you swap who gives the clue)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` }, ...timer('off', '90 s for the clue, 60 s to guess') }),
  withSetup({ ...liarsDice, bot: liarsDiceBot }, {
    tutorial: { title: 'How to play', values: [1, 0], label: (t) => (t ? '📖 Show a quick example round first' : 'Skip it, we know the rules') },
    dice: { title: 'Dice each', values: [5, 3, 4], label: (n) => `${n} dice` },
    wild: { title: 'Ones', values: [1, 0], label: (n) => (n ? 'Wild (count as any face)' : 'Just ones') },
  }),
  withSetup({ ...checkers, bot: checkersBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '30 s a move') }),
  withSetup({ ...dotsBoxes, bot: dotsBoxesBot }, {
    size: { title: 'Grid', values: [4, 3, 5], label: (n) => `${n} × ${n} boxes` },
    ...firstTo('Games to win', [1, 2, 3]),
    ...timer('timed', '20 s a move'),
  }),
  withSetup({ ...mancala, bot: mancalaBot }, {
    seeds: { title: 'Stones per pit', values: [4, 3, 5], label: (n) => `${n} stones` },
    ...firstTo('Games to win', [1, 2, 3]),
    ...timer('timed', '30 s a move'),
  }),
  withSetup({ ...chess, bot: chessBot }, {
    minutes: { title: 'Clock', values: [10, 5, 15, 0], label: (n) => (n ? `${n} minutes each` : 'No clock: it waits for you') },
    ...firstTo('Games to win', [1, 2, 3]),
  }),
  withSetup({ ...dominoes, bot: dominoesBot }, {
    target: { title: 'Game', values: [100, 50, 150], label: (n) => `First to ${n} points` },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup({ ...ludo, bot: ludoBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '12 s to roll, 15 s to move') }),
  withSetup({ ...fiveInARow, bot: fiveInARowBot }, {
    ...firstTo('Games to win', [1, 2, 3]),
    captures: { title: 'Captures', values: [0, 1], label: (n) => (n ? 'On: take pairs (five pairs also wins)' : 'Off: just five in a row') },
    ...timer('timed', '30 s a move'),
  }),
  withSetup({ ...morris, bot: morrisBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '30 s a move') }),
  withSetup({ ...reversi, bot: reversiBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '30 s a move') }),
  withSetup({ ...backgammon, bot: backgammonBot }, {
    points: { title: 'Match', values: [3, 1, 5, 7], label: (n) => (n === 1 ? 'One game' : `First to ${n} points`) },
    cube: { title: 'Doubling cube', values: [1, 0], label: (n) => (n ? 'On (not in a one-game match)' : 'Off') },
    ...timer('timed', '45 s a turn'),
  }),
  withSetup({ ...mineDuel, bot: mineDuelBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '25 s a turn') }),
  withSetup({ ...colourClash, bot: colourClashBot }, {
    target: { title: 'Match', values: [200, 0, 500], label: (n) => (n ? `First to ${n}` : 'One hand') },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup({ ...ginRummy, bot: ginRummyBot }, {
    target: { title: 'Game', values: [100, 50, 150], label: (n) => `First to ${n} points` },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup({ ...blackjack, bot: blackjackBot }, {
    hands: { title: 'Match', values: [8, 5, 12], label: (n) => `${n} hands` },
    ...timer('timed', '20 s to bet, 25 s a move'),
  }),
  withSetup({ ...holdem, bot: holdemBot }, {
    blinds: { title: 'Blinds go up', values: [6, 3, 10], label: (n) => `Every ${n} hands${n === 3 ? ' (a quick match)' : n === 10 ? ' (a long one)' : ''}` },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup({ ...speed, bot: speedBot }, firstTo('Rounds to win', [2, 1, 3])),
  withSetup({ ...cribbage, bot: cribbageBot }, {
    target: { title: 'Game', values: [121, 61], label: (n) => (n === 121 ? 'To 121 (the full game)' : 'To 61 (a short one)') },
    ...timer('timed', '40 s to lay two in the crib, 30 s a card'),
  }),
  withSetup({ ...luckySeven, bot: luckySevenBot }, {
    target: { title: 'Game', values: [200, 150, 300], label: (n) => `First to ${n}` },
    ...timer('timed', '20 s a turn'),
  }),
  withSetup({ ...videoPoker, bot: videoPokerBot }, {
    hands: { title: 'Match', values: [10, 6, 15], label: (n) => `${n} hands` },
    ...timer('timed', '30 s to hold'),
  }),
  withSetup({ ...goFish, bot: goFishBot }, timer('timed', '25 s a turn')),
  withSetup({ ...hearts, bot: heartsBot }, {
    target: { title: 'Game', values: [50, 100, 30], label: (n) => `To ${n} points (lowest score wins)` },
    ...timer('timed', '20 s to draw, 25 s a card'),
  }),
  withSetup({ ...spades, bot: spadesBot }, {
    target: { title: 'Game', values: [300, 200, 500], label: (n) => `First to ${n}` },
    ...timer('timed', '20 s to draw, 30 s to bid, 25 s a card'),
  }),
  withSetup({ ...whichBox, bot: whichBoxBot }, {
    rounds: { title: 'Match', values: [5, 3, 7], label: (n) => `${n} rounds each way (${n * 2} in all)` },
    ...timer('timed', '15 s to pick'),
  }),
  withSetup({ ...oddEven, bot: oddEvenBot }, { ...firstTo('Points to win', [5, 3, 7]), ...timer('timed', '12 s to pick') }),
  withSetup({ ...hex, bot: hexBot }, {
    size: { title: 'Board', values: [9, 11, 7], label: (n) => `${n} × ${n}` },
    swap: { title: 'Swap rule', values: [1, 0], label: (n) => (n ? 'On: after the first stone, the other may take it' : 'Off') },
    ...firstTo('Games to win', [1, 2, 3]),
    ...timer('timed', '30 s a move'),
  }),
  withSetup({ ...ultimateTtt, bot: ultimateTttBot }, { ...firstTo('Games to win', [1, 2, 3]), ...timer('timed', '30 s a move') }),
  withSetup({ ...redDog, bot: redDogBot }, {
    hands: { title: 'Match', values: [12, 8, 16], label: (n) => `${n} hands` },
    ...timer('timed', '15 s to raise'),
  }),
  withSetup({ ...baccarat, bot: baccaratBot }, {
    coups: { title: 'Match', values: [10, 6, 15], label: (n) => `${n} coups` },
    ...timer('timed', '20 s to bet'),
  }),
  withSetup({ ...diceParty, bot: diceBot }, {
    rounds: { title: 'Game length', values: [13, 6], label: (n) => (n === 13 ? 'Full game (13 turns each)' : `Quick (${n} turns each)`) },
    screen: { title: 'Screen', values: [0, 1], label: (n) => (n ? '📱 Handheld (the scorecard on your phone, no TV needed)' : '📺 TV') },
  }),
  withSetup(sketchGuess, { rounds: { title: 'Rounds (you take turns drawing)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
];

// The solo games: the lobby's 1 player mode (see server/solo/games/index.js). One with a 1v1 game's id
// is that game's 1 player mode (Snake, in Snake Battle's arena): it rides on the 1v1 game as `soloDef`,
// so the game is one game in both lobbies (one id, one set of screens). The others are games of their own.
for (const def of SOLO_GAMES.map(soloGame)) {
  const twin = GAMES.find((g) => g.id === def.id);
  if (twin) twin.soloDef = def;
  else GAMES.push(def);
}

export const CATEGORIES = ['competitive', 'board', 'casual', ...SOLO_CATEGORIES];
/** Background music moods a game can ask for; by default competitive games get 'action', casual ones 'casual'. */
export const MUSIC_MOODS = ['action', 'thinking', 'casual'];

/** The solo games' music by category (a game can still ask for its own). */
const SOLO_MOOD = { arcade: 'action', puzzle: 'thinking', brain: 'casual' };

/** Games the computer opponent is planned for: "⏳ Coming soon" in the lobby while it's seated. */
const BOT_SOON = new Set([
]);

/** Games for the lobby, grouped by category (in CATEGORIES order) so lists and controller focus agree. */
/** Fast action games: over the internet a moment's delay shows, so they're best in the same room. */
const FAST = new Set([
  'pong', 'air-hockey', 'snake', 'tron', 'tanks', 'volley-blobs', 'brick-duel', 'asteroid-duel', 'rally-tennis', 'sumo',
  'bomb-duel', 'kart-race', 'kart-race-3d', 'block-battle', 'reaction-duel', 'micro-mayhem',
]);

/**
 * Lobby folders: one tile in the lobby that opens to these games (it keeps the list short).
 * Each game still has its own records, trophies and computer. The names are on the screens
 * (Ark.lobbyEntries in public/shared/common.js).
 */
/**
 * Games that pick up where they were after a restart (an update, a power cut): the board, card
 * and casino games, the long ones you sit down for. The room saves them while they wait for a
 * move (see Room#saveGame and saves.js); a game with a turn clock gives resumed() to restart it.
 */
export const RESUMES = ['checkers', 'connect-four', 'mancala', 'dots-boxes', 'battleship', 'dice-party', 'crazy-eights', 'liars-dice', 'memory-match', 'reversi', 'blackjack', 'mine-duel', 'backgammon', 'gin-rummy', 'colour-clash', 'chess', 'ludo', 'dominoes', 'five-in-a-row', 'morris', 'holdem', 'cribbage', 'lucky-seven', 'video-poker', 'go-fish', 'spades', 'hex', 'ultimate-ttt', 'red-dog', 'hearts', 'baccarat'];
for (const g of GAMES) if (RESUMES.includes(g.id)) g.resumes = true;

export const FOLDERS = {
  board: ['chess', 'checkers', 'connect-four', 'five-in-a-row', 'hex', 'ultimate-ttt', 'morris', 'reversi', 'backgammon', 'ludo', 'dominoes', 'mine-duel', 'mancala', 'dots-boxes', 'battleship', 'dice-party'],
  cards: ['crazy-eights', 'colour-clash', 'gin-rummy', 'blackjack', 'holdem', 'speed', 'cribbage', 'lucky-seven', 'liars-dice', 'memory-match', 'video-poker', 'go-fish', 'spades', 'hearts', 'red-dog', 'baccarat'],
};
const folderOf = (id) => Object.keys(FOLDERS).find((k) => FOLDERS[k].includes(id)) || null;

/**
 * Every game's lobby entry. A game for both modes has two (the same id): its 1v1 one and its
 * 1 player one (solo: true), each listed in its own lobby.
 */
export function listGames() {
  const byCategory = (g) => CATEGORIES.indexOf(g.category || 'competitive');
  const both = new Set(GAMES.filter((g) => g.soloDef).map((g) => g.id));
  return GAMES.flatMap((g) => (g.soloDef ? [g, g.soloDef] : [g]))
    .sort((a, b) => byCategory(a) - byCategory(b))
    .map(({ id, name, tagline, category, needsPhone, phoneOnly, music, handheld, motion, bot, solo, score, phone }) => ({
      id,
      bothModes: both.has(id), // a game for both modes: its 1 player entry has its own preview picture (preview-solo.jpg)
      name,
      tagline,
      // the lobby card's short line (the tagline is on the setup screen); 'solo:<id>' is a both-modes game's 1 player one
      blurb: (solo && BLURBS['solo:' + id]) || BLURBS[id] || tagline,
      category: category || 'competitive',
      folder: solo ? null : folderOf(id), // in a lobby folder (see FOLDERS), or null (the folders are the 2 player lobby's)
      needsPhone: Boolean(needsPhone || phoneOnly),
      phoneOnly: Boolean(phoneOnly),
      handheld: Boolean(handheld), // lobby label: 📱 No TV needed
      motion: Boolean(motion), // lobby label: 🤸 Motion
      vsComputer: Boolean(bot), // lobby label: 🤖 Vs computer (a `bot` plays the other seat: see Room#driveBot)
      botSoon: !bot && BOT_SOON.has(id), // the computer can't play it yet, but will: "⏳ Coming soon"
      fast: FAST.has(id), // played over the internet: "🐢 Best in the same room" (a moment's delay shows)
      // A solo game (the lobby's 1 player mode): one player, scored against their best (see server/solo/).
      solo: Boolean(solo),
      // and phone: true or 'split' when it can be played on the phone alone (/phone; 'split': the TV's picture above the controls).
      ...(solo ? { score, phone: phone || false } : {}),
      // The TV's background music for this game (see public/host/music.js).
      music: MUSIC_MOODS.includes(music) ? music : SOLO_MOOD[category] || (category === 'casual' ? 'casual' : 'action'),
    }));
}

/** A game by id: the 1v1 one for a game in both modes (see soloGameOf for its 1 player one). */
export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}

/** The 1 player game with this id: a solo game, or a 1v1 game's 1 player mode; null if there's none. */
export function soloGameOf(id) {
  const g = getGame(id);
  return g ? (g.solo ? g : g.soloDef || null) : null;
}

/** The game with this id as the given lobby mode plays it ('duo' or 'solo'), or null. */
export function gameFor(id, mode) {
  if (mode === 'solo') return soloGameOf(id);
  const g = getGame(id);
  return g && !g.solo ? g : null;
}
