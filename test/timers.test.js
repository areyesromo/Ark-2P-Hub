// The Timer choice: games whose timer only keeps the game moving let you turn it off in setup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { getGame } from '../server/games/index.js';

test('a Timer choice in setup: no timer first for the co-op thinking games, timed first for head-to-head', () => {
  const usual = {
    'mind-meld': 'off', 'trivia-quest': 'off',
    'fake-out': 'timed', 'crazy-eights': 'timed', checkers: 'timed', mancala: 'timed',
    'connect-four': 'timed', 'dots-boxes': 'timed', 'draw-duel': 'timed',
  };
  for (const [id, first] of Object.entries(usual)) {
    const setup = getGame(id).create(fakeCtx());
    assert.deepEqual(setup.options.timer, first === 'off' ? ['off', 'timed'] : ['timed', 'off'], id);
    const row = setup.rows.find((r) => r.key === 'timer');
    assert.match(row.labels.timed, /^⏱ Timed: \d+ s/, id);
    assert.match(row.labels.off, /No timer/, id);
  }
  // Battleship and Memory Match have their own time choices, each with no timer as one of them.
  assert.ok(getGame('battleship').create(fakeCtx()).options.shotSeconds.includes(0));
  const mm = getGame('memory-match').create(fakeCtx());
  mm.start();
  assert.ok(mm.hostView().options.turnSeconds.includes(0));
});
