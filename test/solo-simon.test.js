import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Simon, TIMING } from '../server/solo/games/simon.js';

/** Run the clock until Simon waits for you. */
function untilRepeat(ctx, g) {
  for (let i = 0; i < 1000 && g.phase !== 'repeat'; i++) ctx.advance(50);
  assert.equal(g.phase, 'repeat');
}

test('shows the sequence one pad at a time, then waits for you', () => {
  const ctx = fakeCtx();
  const g = new Simon(ctx, seeded(3));
  g.start();
  const lit = [];
  for (let i = 0; i < 200 && g.phase !== 'repeat'; i++) {
    ctx.advance(20);
    if (g.lit !== null && lit[lit.length - 1] !== g.lit) lit.push(g.lit);
  }
  assert.deepEqual(lit, g.seq);
  assert.equal(g.hostView().lit, null);
});

test('repeat it right and the sequence grows; the score counts sequences done', () => {
  const ctx = fakeCtx();
  const g = new Simon(ctx, seeded(3));
  g.start();
  for (let round = 1; round <= 4; round++) {
    untilRepeat(ctx, g);
    assert.equal(g.seq.length, round);
    for (const pad of g.seq) g.onInput({ type: 'press', pad });
    assert.equal(g.hostView().score, round);
  }
});

test('a wrong pad ends it and shows the right one', () => {
  const ctx = fakeCtx();
  const g = new Simon(ctx, seeded(3));
  g.start();
  untilRepeat(ctx, g);
  const right = g.seq[0];
  g.onInput({ type: 'press', pad: (right + 1) % 4 });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.expected, right);
  assert.equal(v.score, 0);
  assert.equal(ctx.pendingTimers(), 0);
});

test('waiting too long ends it', () => {
  const ctx = fakeCtx();
  const g = new Simon(ctx, seeded(3));
  g.start();
  untilRepeat(ctx, g);
  ctx.advance(TIMING.pressMs);
  assert.equal(g.phase, 'over');
  assert.equal(g.timedOut, true);
});

test('presses while the sequence plays, and bad pads, are ignored', () => {
  const ctx = fakeCtx();
  const g = new Simon(ctx, seeded(3));
  g.start();
  ctx.advance(TIMING.startMs);
  assert.equal(g.phase, 'show');
  g.onInput({ type: 'press', pad: 0 });
  untilRepeat(ctx, g);
  for (const pad of [4, -1, 1.5, '0']) g.onInput({ type: 'press', pad });
  assert.equal(g.phase, 'repeat');
  assert.equal(g.step, 0);
});
