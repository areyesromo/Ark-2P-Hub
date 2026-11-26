import test from 'node:test';
import assert from 'node:assert/strict';
import { listGames, FOLDERS } from '../server/games/index.js';

test('board and card games sit in their lobby folders', () => {
  const games = listGames();
  const folderOf = Object.fromEntries(games.filter((g) => !g.solo).map((g) => [g.id, g.folder])); // (the folders are the 2 player lobby's)
  for (const id of ['chess', 'checkers', 'connect-four', 'five-in-a-row', 'morris', 'reversi', 'backgammon', 'ludo', 'dominoes', 'mine-duel', 'mancala', 'dots-boxes', 'battleship', 'dice-party']) assert.equal(folderOf[id], 'board', id);
  for (const id of ['crazy-eights', 'colour-clash', 'gin-rummy', 'blackjack', 'speed', 'holdem', 'liars-dice', 'memory-match']) assert.equal(folderOf[id], 'cards', id);
  assert.equal(folderOf.pong, null);
});

test('every folder lists real games, each in one folder only', () => {
  const ids = new Set(listGames().map((g) => g.id));
  const seen = new Set();
  for (const [key, ids2] of Object.entries(FOLDERS)) {
    assert.ok(ids2.length, key);
    for (const id of ids2) {
      assert.ok(ids.has(id), id);
      assert.ok(!seen.has(id), id);
      seen.add(id);
    }
  }
});
