import reactionDuel from './reaction-duel.js';
import rockPaperScissors from './rock-paper-scissors.js';
import pong from './pong.js';
import tron from './tron.js';
import airHockey from './air-hockey.js';
import snake from './snake.js';
import tanks from './tanks.js';
import quiz, { TOPICS } from './quiz.js';
import drawDuel from './draw-duel.js';
import battleship from './battleship.js';
import sketchGuess from './sketch-guess.js';
import connectFour from './connect-four.js';
import sumo from './sumo.js';
import wordRace from './word-race.js';
import miniGolf from './mini-golf.js';
import bombDuel from './bomb-duel.js';
import kartRace from './kart-race.js';
import memoryMatch from './memory-match.js';
import bombSquad, { LEVELS as BOMB_LEVELS } from './bomb-squad.js';
import marbleMaze, { LEVELS as MAZE_LEVELS } from './marble-maze.js';
import mindMeld from './mind-meld.js';
import { withSetup } from './options.js';

/**
 * Every game is a module exporting:
 *
 *   { id, name, tagline, category?, create(ctx) }
 *
 * category is 'competitive' (the default: you play against each other) or
 * 'casual' (you play together, nobody really loses). The lobby groups them.
 * needsPhone: true keeps a game out of "random" when both players use
 * controllers (it needs a private screen).
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
  withSetup(snake, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(tanks, firstTo(ROUNDS_WON, [3, 2, 5])),
  withSetup(sumo, firstTo(ROUNDS_WON, [3, 2, 5])),
  bombDuel,
  kartRace,
  withSetup(quiz, {
    questions: { title: 'Number of questions', values: [10, 5, 15, 20], label: (n) => String(n) },
    topic: { title: 'Topic', values: TOPICS.map((_, i) => i).concat(TOPICS.length), label: (n) => (n === 0 ? 'Mixed' : TOPICS[n - 1]) },
  }),
  wordRace,
  miniGolf,
  withSetup(drawDuel, { rounds: { title: 'Shapes to draw', values: [5, 3, 7, 10], label: (n) => `${n} rounds` } }),
  withSetup(battleship, { shotSeconds: { title: 'Time per shot', values: [30, 15, 60], label: (n) => `${n} s` } }),
  withSetup(connectFour, firstTo(ROUNDS_WON, [3, 1, 5])),
  memoryMatch,
  withSetup(bombSquad, {
    level: { title: 'Difficulty', values: [2, 1, 3], label: (n) => `${BOMB_LEVELS[n].name} · ${BOMB_LEVELS[n].modules} modules, ${BOMB_LEVELS[n].ms / 60000} min` },
    bombs: { title: 'Bombs (you swap roles each one)', values: [3, 1, 5], label: (n) => (n === 1 ? 'One bomb' : `${n} bombs`) },
  }),
  withSetup(marbleMaze, {
    levels: { title: 'Mazes', values: [3, 5, 1], label: (n) => (n === 1 ? 'One maze' : n === MAZE_LEVELS.length ? `All ${n} mazes` : `${n} mazes`) },
    controls: { title: 'Who tilts what', values: [1, 2], label: (n) => (n === 1 ? 'Split: one ↔, one ↕' : 'Shared: both steer') },
  }),
  withSetup(mindMeld, { rounds: { title: 'Rounds (you swap who gives the clue)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
  withSetup(sketchGuess, { rounds: { title: 'Rounds (you take turns drawing)', values: [6, 4, 8, 10], label: (n) => `${n} rounds` } }),
];

export const CATEGORIES = ['competitive', 'casual'];
/** Background music moods a game can ask for; by default competitive games get 'action', casual ones 'casual'. */
export const MUSIC_MOODS = ['action', 'thinking', 'casual'];

/** Games for the lobby, grouped by category (in CATEGORIES order) so lists and controller focus agree. */
export function listGames() {
  const byCategory = (g) => CATEGORIES.indexOf(g.category || 'competitive');
  return GAMES.slice()
    .sort((a, b) => byCategory(a) - byCategory(b))
    .map(({ id, name, tagline, category, needsPhone, music }) => ({
      id,
      name,
      tagline,
      category: category || 'competitive',
      needsPhone: Boolean(needsPhone),
      // The TV's background music for this game (see public/host/music.js).
      music: MUSIC_MOODS.includes(music) ? music : category === 'casual' ? 'casual' : 'action',
    }));
}

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}
