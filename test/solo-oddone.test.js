import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { OddOne, SECONDS, WRONG_MS, TIMING, sizeFor, diffFor } from '../server/solo/games/oddone.js';

function game(seed = 3) {
  const ctx = fakeCtx();
  const g = new OddOne(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.readyMs);
  return { ctx, g };
}

test('the grid grows and the shades close in, but never to nothing', () => {
  assert.equal(sizeFor(0), 3);
  assert.equal(sizeFor(100), 8);
  assert.ok(diffFor(5) < diffFor(0));
  assert.equal(diffFor(100), 3);
});

test('tapping the odd one scores and deals a new grid; a wrong tap costs time', () => {
  const { g } = game();
  const v = g.hostView();
  assert.equal(v.size, 3);
  assert.notEqual(v.base, v.oddColour);
  g.onInput({ type: 'pick', cell: v.odd });
  assert.equal(g.found, 1);
  assert.equal(g.last.ok, true);
  const left = g.endsAt;
  g.onInput({ type: 'pick', cell: (g.odd + 1) % (g.size * g.size) });
  assert.equal(g.found, 1);
  assert.equal(g.endsAt, left - WRONG_MS);
});

test('time up ends it with the odd ones found', () => {
  const { ctx, g } = game();
  for (let i = 0; i < 7; i++) g.onInput({ type: 'pick', cell: g.odd });
  assert.equal(g.size, sizeFor(7));
  ctx.advance(SECONDS * 1000);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 7);
  assert.equal(v.odd, null);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('bad input is ignored', () => {
  const { g } = game();
  for (const input of [{ type: 'pick', cell: 9 }, { type: 'pick', cell: '0' }, { type: 'pick' }, { type: 'zap', cell: 0 }]) g.onInput(input);
  assert.equal(g.found + g.wrong, 0);
});
