import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Slide } from '../server/solo/games/slide.js';

function game(size = 3, seed = 2) {
  const ctx = fakeCtx('Ana', { size });
  const g = new Slide(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('starts shuffled, with every tile there once', () => {
  for (const n of [3, 4, 5]) {
    const { g } = game(n);
    assert.equal(g.solved, false);
    assert.deepEqual(g.tiles.slice().sort((a, b) => a - b), [...Array(n * n).keys()]);
    assert.equal(g.hostView().variant, `${n}×${n}`);
  }
});

test('a tap in line with the gap slides the whole row; other taps do nothing', () => {
  const { g } = game(4);
  g.tiles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
  g.phase = 'play';
  g.onInput({ type: 'tap', cell: 12 }); // the far left of the gap's row: three tiles slide right
  assert.deepEqual(g.tiles.slice(12), [0, 13, 14, 15]);
  assert.equal(g.moves, 1);
  g.onInput({ type: 'tap', cell: 5 }); // not in line: nothing
  assert.equal(g.moves, 1);
  g.onInput({ type: 'tap', cell: 99 });
  g.onInput({ type: 'move', dir: 'sideways' });
  assert.equal(g.moves, 1);
});

test('solving it ends the run; the clock starts with the first slide', () => {
  const { ctx, g } = game(3);
  ctx.advance(5000);
  g.tiles = [1, 2, 3, 4, 5, 6, 7, 0, 8];
  g.onInput({ type: 'move', dir: 'left' }); // the 8 slides left into the gap
  // Solved on the first slide, so the time is 0 ms: the clock only started then.
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 0);
  assert.equal(ctx.pendingTimers(), 0);
});

test('directions move the tile on the far side of the gap', () => {
  const { ctx, g } = game(3);
  g.tiles = [1, 2, 3, 4, 0, 5, 6, 7, 8];
  g.onInput({ type: 'move', dir: 'up' }); // the 7 below the gap moves up
  assert.deepEqual(g.tiles, [1, 2, 3, 4, 7, 5, 6, 0, 8]);
  ctx.advance(10000);
  g.onInput({ type: 'move', dir: 'left' });
  assert.equal(g.hostView().elapsed, 10000);
});
