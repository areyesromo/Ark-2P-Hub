import test from 'node:test';
import assert from 'node:assert/strict';
import { listGames, FOLDERS } from '../server/games/index.js';

test('board and card games sit in their lobby folders', () => {
  const games = listGames();
  const folderOf = Object.fromEntries(games.map((g) => [g.id, g.folder]));
  for (const id of ['checkers', 'connect-four', 'mancala', 'dots-boxes', 'battleship', 'dice-party']) assert.equal(folderOf[id], 'board', id);
  for (const id of ['crazy-eights', 'liars-dice', 'memory-match']) assert.equal(folderOf[id], 'cards', id);
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
