import reactionDuel from './reaction-duel.js';
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
import { quizBot } from './quiz-bot.js';
import { reactionDuelBot } from './reaction-duel-bot.js';
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
import { blockBattleBot } from './block-battle-bot.js';
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
import { withSetup } from './options.js';

/**
 * Every game is a module exporting:
 *
 *   { id, name, tagline, category?, create(ctx) }
 *
 * category is 'competitive' (the default: you play against each other),
 * 'board' (dice, cards and board games, also head to head) or 'casual'
 * (you play together, nobody really loses). The lobby groups them.
 * needsPhone: true keeps a game out of "random" when both players use
 * controllers (one of them needs a private screen).
 * phoneOnly: true means both players need a phone: with a controller seated, the
 * lobby greys the game out and the room won't start it.
 * handheld: true labels it "📱 No TV needed" in the lobby (it can be played on the
 * phones alone); motion: true labels it "🤸 Motion" (phones can tilt or move to play).
 * bot(view, level, rng, retries, memory): the computer opponent ("🤖 Vs computer" in the lobby).
 * Given the computer's own view and its level ('easy', 'normal', 'hard'), it gives its next input,
 * or null when it has no move. The view is playerView, or botView(slot) if the game has one (a
 * quiz adds the answer there, for the computer to get right as often as its level says). The input
 * may carry botDelayMs, its pause before playing it (a reaction time: what it worked out when it
 * looked is what it plays then; with botAnticipate, a move it saw coming and timed, such as its
 * own planned turn, it judges afresh at that moment); memory is an object kept
 * for the match (what it has seen, how you play); retries counts the times the same move came
 * back (the game refused it). The room seats it as a controller player (ctx.players[slot].bot
 * is its level) and plays its moves after a pause (Room#driveBot). Games without one can't be
 * started while it's seated.
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

const GAMES = [
  withSetup({ ...reactionDuel, bot: reactionDuelBot }, firstTo('Points to win', [3, 5, 7])),
  withSetup({ ...rockPaperScissors, bot: rpsBot }, firstTo('Points to win', [3, 5, 7])),
  withSetup({ ...pong, bot: pongBot }, firstTo('Points to win', [5, 3, 7, 11])),
  withSetup({ ...tron, bot: tronBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...airHockey, bot: airHockeyBot }, firstTo('Goals to win', [7, 5, 10])),
  withSetup({ ...volleyBlobs, bot: volleyBlobsBot }, firstTo('Points to win', [7, 5, 11])),
  withSetup({ ...brickDuel, bot: brickDuelBot }, { rows: { title: 'Wall', values: [5, 3, 7], label: (n) => `${n} rows of bricks` } }),
  withSetup({ ...asteroidDuel, bot: asteroidDuelBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...rallyTennis, bot: rallyTennisBot }, firstTo('Games to win', [4, 3, 6])),
  withSetup({ ...blockBattle, bot: blockBattleBot }, firstTo(ROUNDS_WON, [2, 1, 3])),
  withSetup({ ...snake, bot: snakeBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...tanks, bot: tanksBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup({ ...sumo, bot: sumoBot }, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(partyBoard, {
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
  withSetup(partyMinis, {
    ...firstTo('Wins needed', [3, 4, 5]),
    // A mix, or just one minigame over and over (to practise it, or a favourite).
    style: {
      title: 'Minigames',
      values: ['mix', '2d', '3d', ...PARTIES.map((m) => m.id)],
      label: (s) => ({ mix: '🎲 Random mix', '2d': '🎲 Random 2D', '3d': '🎲 Random 3D' })[s] || `🎯 ${PARTIES.find((m) => m.id === s).name}`,
    },
  }),
  withSetup(microMayhem, {
    lives: { title: 'Lives', values: [3, 5], label: (n) => `${n} lives` },
    pace: { title: 'Pace', values: ['normal', 'fast'], label: (p) => (p === 'fast' ? 'Fast (starts at speed 3)' : 'Normal') },
  }),
  { ...bombDuel, bot: bombDuelBot },
  { ...kartRace, bot: kartRaceBot },
  { ...kartRace3d, bot: kartRaceBot },
  withSetup({ ...quiz, bot: quizBot }, {
    questions: { title: 'Number of questions', values: [10, 5, 15, 20], label: (n) => String(n) },
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
  }),
  withSetup({ ...triviaQuest, bot: quizBot }, {
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
    hearts: { title: 'Difficulty', values: [5, 7, 3], label: (n) => (n === 7 ? 'Easy · 7 ❤️' : n === 5 ? 'Normal · 5 ❤️' : 'Hard · 3 ❤️') },
    ...timer('off', '15 s a question (12 s for the Dragon), faster hits harder'),
  }),
  withSetup(fakeOut, { rounds: { title: 'Rounds', values: [6, 4, 8], label: (n) => `${n} rounds` }, ...timer('timed', '60 s to write, 20 s to pick') }),
  withSetup(crazyEights, {
    actions: { title: 'Rules', values: [1, 0], label: (n) => (n ? 'Action cards (2, Jack, Q♠)' : 'Classic') },
    target: { title: 'Match', values: [100, 0, 200], label: (n) => (n ? `First to ${n}` : 'One hand') },
    ...timer('timed', '30 s a turn'),
  }),
  withSetup(kitchenRush, {
    kitchen: { title: 'Kitchen', values: [0, 1, 2], label: (n) => ['Diner', 'Split (pass it over)', 'Rush Hour'][n] },
    minutes: { title: 'Shift', values: [3, 2, 4], label: (n) => `${n} minutes` },
  }),
  withSetup({ ...towerDuel, bot: towerDuelBot }, { lives: { title: 'Lives', values: [20, 10, 30], label: (n) => `${n} lives` } }),
  withSetup(dungeonDuo, {
    heroes: { title: 'Heroes', values: [0, 1], label: (n) => (n ? 'Player 1 the ✨ Healer, player 2 the 🛡️ Fighter' : 'Player 1 the 🛡️ Fighter, player 2 the ✨ Healer') },
    difficulty: { title: 'Difficulty', values: [0, 1], label: (n) => (n ? 'Easy (more hearts, 5 continues, a weaker Warden)' : 'Normal (3 continues)') },
  }),
  wordRace,
  withSetup(anagramDuel, firstTo('Rounds to win', [5, 3, 7])),
  withSetup({ ...wordHunt, bot: wordHuntBot }, {
    mode: { title: 'Mode', values: ['shared', 'race'], label: (k) => (k === 'race' ? 'Race (two phones): your own board each, first to find every word' : 'Shared board: first to mark a word gets it') },
    size: { title: 'Grid', values: ['medium', 'small', 'large'], label: (k) => `${HUNT_SIZES[k].name} · ${HUNT_SIZES[k].words} words${k === 'small' ? ', across and down' : k === 'medium' ? ', diagonals too' : ', any way, even backwards'}` },
    ...firstTo('Grids to win', [2, 1, 3]),
  }),
  { ...miniGolf, bot: miniGolfBot },
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
  withSetup(marbleMaze, {
    levels: { title: 'Mazes', values: [3, 5, 1], label: (n) => (n === 1 ? 'One maze' : n === MAZE_LEVELS.length ? `All ${n} mazes` : `${n} mazes`) },
    controls: { title: 'Who tilts what', values: [1, 2], label: (n) => (n === 1 ? 'Split: one ↔, one ↕' : 'Shared: both steer') },
  }),
  withSetup(mindMeld, { rounds: { title: 'Rounds (you swap who gives the clue)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` }, ...timer('off', '90 s for the clue, 60 s to guess') }),
  withSetup(liarsDice, {
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
  withSetup({ ...diceParty, bot: diceBot }, {
    rounds: { title: 'Game length', values: [13, 6], label: (n) => (n === 13 ? 'Full game (13 turns each)' : `Quick (${n} turns each)`) },
    screen: { title: 'Screen', values: [0, 1], label: (n) => (n ? '📱 Handheld (the scorecard on your phone, no TV needed)' : '📺 TV') },
  }),
  withSetup(sketchGuess, { rounds: { title: 'Rounds (you take turns drawing)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
];

export const CATEGORIES = ['competitive', 'board', 'casual'];
/** Background music moods a game can ask for; by default competitive games get 'action', casual ones 'casual'. */
export const MUSIC_MOODS = ['action', 'thinking', 'casual'];

/** Games the computer opponent is planned for: "⏳ Coming soon" in the lobby while it's seated. */
const BOT_SOON = new Set([
  'crazy-eights', 'liars-dice', 'anagram-duel', 'word-race', // next: the card and word games
  'party-board', 'party-minis', 'micro-mayhem', // the party games
  'kitchen-rush', 'dungeon-duo', 'marble-maze', // and a teammate in the co-op games
]);

/** Games for the lobby, grouped by category (in CATEGORIES order) so lists and controller focus agree. */
export function listGames() {
  const byCategory = (g) => CATEGORIES.indexOf(g.category || 'competitive');
  return GAMES.slice()
    .sort((a, b) => byCategory(a) - byCategory(b))
    .map(({ id, name, tagline, category, needsPhone, phoneOnly, music, handheld, motion, bot }) => ({
      id,
      name,
      tagline,
      category: category || 'competitive',
      needsPhone: Boolean(needsPhone || phoneOnly),
      phoneOnly: Boolean(phoneOnly),
      handheld: Boolean(handheld), // lobby label: 📱 No TV needed
      motion: Boolean(motion), // lobby label: 🤸 Motion
      vsComputer: Boolean(bot), // lobby label: 🤖 Vs computer (a `bot` plays the other seat: see Room#driveBot)
      botSoon: !bot && BOT_SOON.has(id), // the computer can't play it yet, but will: "⏳ Coming soon"
      // The TV's background music for this game (see public/host/music.js).
      music: MUSIC_MOODS.includes(music) ? music : category === 'casual' ? 'casual' : 'action',
    }));
}

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}
