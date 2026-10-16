import reactionDuel from './reaction-duel.js';
import rockPaperScissors from './rock-paper-scissors.js';
import pong from './pong.js';
import tron from './tron.js';
import airHockey from './air-hockey.js';
import snake from './snake.js';
import tanks from './tanks.js';
import quiz from './quiz.js';
import drawDuel from './draw-duel.js';
import battleship from './battleship.js';
import sketchGuess from './sketch-guess.js';
import connectFour from './connect-four.js';

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
const GAMES = [reactionDuel, rockPaperScissors, pong, tron, airHockey, snake, tanks, quiz, drawDuel, battleship, connectFour, sketchGuess];

export const CATEGORIES = ['competitive', 'casual'];

/** Games for the lobby, grouped by category (in CATEGORIES order) so lists and controller focus agree. */
export function listGames() {
  const byCategory = (g) => CATEGORIES.indexOf(g.category || 'competitive');
  return GAMES.slice()
    .sort((a, b) => byCategory(a) - byCategory(b))
    .map(({ id, name, tagline, category, needsPhone }) => ({ id, name, tagline, category: category || 'competitive', needsPhone: Boolean(needsPhone) }));
}

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}
