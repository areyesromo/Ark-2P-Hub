import reactionDuel from './reaction-duel.js';
import rockPaperScissors from './rock-paper-scissors.js';
import pong from './pong.js';
import tron from './tron.js';
import airHockey from './air-hockey.js';
import volleyBlobs from './volley-blobs.js';
import brickDuel from './brick-duel.js';
import asteroidDuel from './asteroid-duel.js';
import rallyTennis from './rally-tennis.js';
import snake from './snake.js';
import tanks from './tanks.js';
import quiz, { TOPICS } from './quiz.js';
import drawDuel from './draw-duel.js';
import battleship from './battleship.js';
import sketchGuess from './sketch-guess.js';
import connectFour from './connect-four.js';
import sumo from './sumo.js';
import wordRace from './word-race.js';
import anagramDuel from './anagram-duel.js';
import wordHunt, { SIZES as HUNT_SIZES } from './word-hunt.js';
import miniGolf from './mini-golf.js';
import bombDuel from './bomb-duel.js';
import kartRace from './kart-race.js';
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

const GAMES = [
  withSetup(reactionDuel, firstTo('Points to win', [3, 5, 7])),
  withSetup(rockPaperScissors, firstTo('Points to win', [3, 5, 7])),
  withSetup(pong, firstTo('Points to win', [5, 3, 7, 11])),
  withSetup(tron, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(airHockey, firstTo('Goals to win', [7, 5, 10])),
  withSetup(volleyBlobs, firstTo('Points to win', [7, 5, 11])),
  withSetup(brickDuel, { rows: { title: 'Wall', values: [5, 3, 7], label: (n) => `${n} rows of bricks` } }),
  withSetup(asteroidDuel, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(rallyTennis, firstTo('Games to win', [4, 3, 6])),
  withSetup(snake, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(tanks, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(sumo, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(partyBoard, {
    map: {
      title: 'Map',
      values: ['random', 'island', 'lagoons', 'pipes', 'haunted', 'volcano'],
      label: (m) => ({ random: '🎲 Random', island: '🏝️ Party Island · Easy', lagoons: '🌊 Twin Lagoons · Easy', pipes: '🔧 Pipe Works · Medium', haunted: '👻 Haunted Maze · Hard', volcano: '🌋 Volcano Peak · Expert' })[m],
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
  bombDuel,
  kartRace,
  withSetup(quiz, {
    questions: { title: 'Number of questions', values: [10, 5, 15, 20], label: (n) => String(n) },
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
  }),
  wordRace,
  withSetup(anagramDuel, firstTo('Rounds to win', [5, 3, 7])),
  withSetup(wordHunt, {
    size: { title: 'Grid', values: ['medium', 'small', 'large'], label: (k) => `${HUNT_SIZES[k].name} · ${HUNT_SIZES[k].words} words${k === 'small' ? ', across and down' : k === 'medium' ? ', diagonals too' : ', any way, even backwards'}` },
    ...firstTo('Grids to win', [2, 1, 3]),
  }),
  miniGolf,
  withSetup(drawDuel, { rounds: { title: 'Shapes to draw', values: [5, 3, 7, 10], label: (n) => `${n} rounds` } }),
  withSetup(battleship, { shotSeconds: { title: 'Time per shot', values: [30, 15, 60], label: (n) => `${n} s` } }),
  withSetup(connectFour, firstTo(ROUNDS_WON, [3, 1, 5])),
  memoryMatch,
  withSetup(bombSquad, {
    level: { title: 'Difficulty', values: [2, 1, 3, 4], label: (n) => `${BOMB_LEVELS[n].name} · ${BOMB_LEVELS[n].modules} modules, ${BOMB_LEVELS[n].ms / 60000} min` },
    bombs: { title: 'Bombs (you swap roles each one)', values: [3, 1, 5], label: (n) => (n === 1 ? 'One bomb' : `${n} bombs`) },
  }),
  withSetup(marbleMaze, {
    levels: { title: 'Mazes', values: [3, 5, 1], label: (n) => (n === 1 ? 'One maze' : n === MAZE_LEVELS.length ? `All ${n} mazes` : `${n} mazes`) },
    controls: { title: 'Who tilts what', values: [1, 2], label: (n) => (n === 1 ? 'Split: one ↔, one ↕' : 'Shared: both steer') },
  }),
  withSetup(mindMeld, { rounds: { title: 'Rounds (you swap who gives the clue)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
  withSetup(liarsDice, {
    tutorial: { title: 'How to play', values: [1, 0], label: (t) => (t ? '📖 Show a quick example round first' : 'Skip it, we know the rules') },
    dice: { title: 'Dice each', values: [5, 3, 4], label: (n) => `${n} dice` },
    wild: { title: 'Ones', values: [1, 0], label: (n) => (n ? 'Wild (count as any face)' : 'Just ones') },
  }),
  withSetup(checkers, firstTo('Games to win', [1, 2, 3])),
  withSetup(dotsBoxes, {
    size: { title: 'Grid', values: [4, 3, 5], label: (n) => `${n} × ${n} boxes` },
    ...firstTo('Games to win', [1, 2, 3]),
  }),
  withSetup(mancala, {
    seeds: { title: 'Stones per pit', values: [4, 3, 5], label: (n) => `${n} stones` },
    ...firstTo('Games to win', [1, 2, 3]),
  }),
  withSetup(diceParty, { rounds: { title: 'Game length', values: [13, 6], label: (n) => (n === 13 ? 'Full game (13 turns each)' : `Quick (${n} turns each)`) } }),
  withSetup(sketchGuess, { rounds: { title: 'Rounds (you take turns drawing)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
];

export const CATEGORIES = ['competitive', 'board', 'casual'];
/** Background music moods a game can ask for; by default competitive games get 'action', casual ones 'casual'. */
export const MUSIC_MOODS = ['action', 'thinking', 'casual'];

/** Games for the lobby, grouped by category (in CATEGORIES order) so lists and controller focus agree. */
export function listGames() {
  const byCategory = (g) => CATEGORIES.indexOf(g.category || 'competitive');
  return GAMES.slice()
    .sort((a, b) => byCategory(a) - byCategory(b))
    .map(({ id, name, tagline, category, needsPhone, phoneOnly, music }) => ({
      id,
      name,
      tagline,
      category: category || 'competitive',
      needsPhone: Boolean(needsPhone || phoneOnly),
      phoneOnly: Boolean(phoneOnly),
      // The TV's background music for this game (see public/host/music.js).
      music: MUSIC_MOODS.includes(music) ? music : category === 'casual' ? 'casual' : 'action',
    }));
}

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}
