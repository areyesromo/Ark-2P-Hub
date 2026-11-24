import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Numbers, FIRST, TIMING } from '../server/solo/games/numbers.js';

function game(seed = 3) {
  const ctx = fakeCtx();
  const g = new Numbers(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.readyMs);
  return { ctx, g };
}

test('the number shows, then hides before the answer', () => {
  const { ctx, g } = game();
  const v = g.hostView();
  assert.equal(v.phase, 'show');
  assert.match(v.number, /^[1-9][0-9]{2}$/);
  ctx.advance(v.showMs);
  assert.equal(g.phase, 'answer');
  assert.equal(g.hostView().number, null);
  assert.equal(JSON.stringify(g.playerView()).includes(g.number), false);
});

test('right answers grow the number; the second miss ends it with the longest remembered', () => {
  const { ctx, g } = game();
  for (let i = 0; i < 3; i++) {
    ctx.advance(g.showMs);
    g.onInput({ type: 'answer', digits: g.number });
    assert.equal(g.result.ok, true);
    ctx.advance(TIMING.resultMs);
  }
  assert.equal(g.length, FIRST + 3);
  assert.equal(g.number.length, FIRST + 3);
  g.onInput({ type: 'answer', digits: '1' }); // answering while it shows is allowed, just risky
  assert.equal(g.result.ok, false);
  assert.equal(g.lives, 1);
  ctx.advance(TIMING.resultMs);
  assert.equal(g.number.length, FIRST + 3, 'same length again after a miss');
  g.onInput({ type: 'answer', digits: '2' });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, FIRST + 2);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('bad input is ignored', () => {
  const { ctx, g } = game();
  ctx.advance(g.showMs);
  for (const input of [{ type: 'answer', digits: 123 }, { type: 'answer', digits: '12a' }, { type: 'answer', digits: '' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.phase, 'answer');
  assert.equal(g.result, null);
});
