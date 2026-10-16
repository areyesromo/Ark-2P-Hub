import reactionDuel from './reaction-duel.js';
import rockPaperScissors from './rock-paper-scissors.js';
import pong from './pong.js';
import tron from './tron.js';
import airHockey from './air-hockey.js';
import snake from './snake.js';
import tanks from './tanks.js';

/**
 * Every game is a module exporting:
 *
 *   { id, name, tagline, create(ctx) }
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
const GAMES = [reactionDuel, rockPaperScissors, pong, tron, airHockey, snake, tanks];

export function listGames() {
  return GAMES.map(({ id, name, tagline }) => ({ id, name, tagline }));
}

export function getGame(id) {
  return GAMES.find((g) => g.id === id) || null;
}
