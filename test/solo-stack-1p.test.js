import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Stack, BASE, PERFECT, GROW, LAG } from '../server/solo/games/stack-1p.js';

function game() {
  const ctx = fakeCtx('Ana');
  const g = new Stack(ctx);
  g.start();
  return { ctx, g };
}

/** The ms after launch at which the block's left edge is at x (going right on its first pass). */
const whenAt = (g, x) => ((x - g.moving.from) / g.moving.speed) * 1000;

test('the block slides from one edge to the other and back', () => {
  const { g } = game();
  const m = g.moving;
  assert.equal(m.w, BASE.w);
  assert.equal(g.xAt(0), 0);
  const across = (m.span / m.speed) * 1000;
  assert.ok(Math.abs(g.xAt(across) - m.span) < 1e-9);
  assert.ok(Math.abs(g.xAt(across * 1.5) - m.span / 2) < 1e-9);
  assert.ok(Math.abs(g.xAt(across * 2)) < 1e-9);
});

test('a perfect drop keeps the full width; a sloppy one cuts the overhang off', () => {
  const { ctx, g } = game();
  ctx.advance(whenAt(g, BASE.x + PERFECT / 2));
  g.onInput({ type: 'drop' });
  assert.equal(g.placed, 1);
  assert.deepEqual(g.top, { x: BASE.x, w: BASE.w });
  assert.equal(g.perfects, 1);
  // The next block starts on the right and slides left.
  assert.equal(g.moving.dir, -1);
  const span = g.moving.span;
  const t = ((span - (BASE.x + 10)) / g.moving.speed) * 1000; // left edge at BASE.x + 10
  ctx.advance(t);
  g.onInput({ type: 'drop' });
  assert.ok(Math.abs(g.top.x - (BASE.x + 10)) < 1e-6);
  assert.ok(Math.abs(g.top.w - (BASE.w - 10)) < 1e-6);
  assert.ok(Math.abs(g.cut.x - (BASE.x + BASE.w)) < 1e-6, 'the right-hand overhang falls');
  assert.equal(g.perfects, 0);
});

test('missing the tower ends it, scoring the blocks stacked', () => {
  const { ctx, g } = game();
  ctx.advance(whenAt(g, BASE.x));
  g.onInput({ type: 'drop' });
  // Make the next block narrow and far off to one side.
  g.tower.push({ x: 90, w: 5 });
  g.launch();
  g.onInput({ type: 'drop' }); // at its start, far from x 90
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 2);
  assert.equal(v.cut.all, true);
  g.onInput({ type: 'rematch' });
  assert.equal(g.placed, 0);
});

test('perfect drops in a row win width back', () => {
  const { ctx, g } = game();
  g.tower = [{ x: 30, w: 40 }];
  g.launch();
  for (let i = 0; i < GROW.every; i++) {
    const x = g.top.x;
    const m = g.moving;
    const t = m.dir > 0 ? ((x - m.from) / m.speed) * 1000 : ((m.from - x) / m.speed) * 1000;
    ctx.advance(t);
    g.onInput({ type: 'drop' });
  }
  assert.equal(g.top.w, 40 + GROW.by);
  assert.equal(g.top.x, 30 - GROW.by / 2);
});

test('a drop uses the moment the player saw, if it is close enough to ours', () => {
  const { ctx, g } = game();
  const target = whenAt(g, BASE.x);
  ctx.advance(target + 80); // the drop arrives 80 ms late
  g.onInput({ type: 'drop', t: target });
  assert.equal(g.perfects, 1, 'counted as the player saw it');
  // A moment too far back (where the block was nowhere near) isn't believed: ours is used.
  const { ctx: ctx2, g: g2 } = game();
  const target2 = whenAt(g2, BASE.x);
  ctx2.advance(target2);
  g2.onInput({ type: 'drop', t: target2 - LAG.early - 100 });
  assert.equal(g2.perfects, 1);
});

test('pause freezes the block; bad input is ignored', () => {
  const { ctx, g } = game();
  ctx.advance(300);
  const x = g.xAt(g.movingFor);
  g.onInput({ type: 'pause' });
  ctx.advance(5000);
  assert.equal(g.xAt(g.movingFor), x);
  g.onInput({ type: 'drop' });
  assert.equal(g.drops, 0, 'no drops while paused');
  g.onInput({ type: 'pause' });
  assert.equal(g.xAt(g.movingFor), x);
  for (const input of [{ type: 'zap' }, { type: 'drop', t: 'soon' }, { type: 'rematch' }]) g.onInput(input);
  assert.equal(g.phase, 'play');
});
