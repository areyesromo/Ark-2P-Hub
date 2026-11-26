import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Pipes, makeBoard, flow, turned, neighbour, HINT_PENALTY, N, E, S, W } from '../server/solo/games/pipes.js';

function game(size = 7, edges = 'solid', seed = 3) {
  const ctx = fakeCtx('Ana', { size, edges });
  const g = new Pipes(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

test('turning: a quarter clockwise moves each opening round one side', () => {
  assert.equal(turned(N, 1), E);
  assert.equal(turned(N | E, 1), E | S);
  assert.equal(turned(W, 1), N);
  assert.equal(turned(N | S, 2), N | S);
  assert.equal(turned(N | E | S, -1), W | N | E);
});

test('a made board joins every square from the tap with no open end; wrap boards use the edges', () => {
  for (const [n, wrap] of [[5, false], [7, false], [9, false], [7, true]]) {
    const { masks, tap } = makeBoard(n, wrap, seeded(n + (wrap ? 50 : 0)));
    const f = flow(n, wrap, masks, tap);
    assert.equal(f.wet.size, n * n, `${n} ${wrap}`);
    assert.equal(f.open, 0);
    assert.ok(masks.every((m) => m > 0));
  }
  assert.equal(neighbour(5, false, 0, -1, 0), -1);
  assert.equal(neighbour(5, true, 0, -1, 0), 4);
  const { masks } = makeBoard(5, false, seeded(9));
  assert.ok(!masks.some((m) => m === 15), 'no crosses on a 5 × 5');
});

test('the scramble isn\'t solved; turning every piece back solves it and scores the time', () => {
  const { ctx, g } = game(5);
  assert.equal(g.phase, 'play');
  assert.ok(!g.solved());
  ctx.advance(47000);
  for (let i = 0; i < 25; i++) {
    while (turned(g.base[i], g.rots[i]) !== g.answer[i]) {
      g.onInput({ type: 'tap', cell: i });
      if (g.phase === 'over') break;
    }
    if (g.phase === 'over') break;
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 47000);
  assert.equal(v.answer, undefined);
  assert.equal(ctx.pendingTimers(), 0);
});

test('locks, undo, the turn back, and hints (each locks a piece the right way, 30 s)', () => {
  const { g } = game(7);
  const cell = g.firstTurnable();
  const r = g.rots[cell];
  g.onInput({ type: 'lock', cell });
  g.onInput({ type: 'tap', cell });
  assert.equal(g.rots[cell], r, 'locked');
  g.onInput({ type: 'lock', cell });
  g.onInput({ type: 'tap', cell });
  g.onInput({ type: 'tap', cell, back: true });
  assert.equal(g.rots[cell], r);
  g.onInput({ type: 'tap', cell });
  g.onInput({ type: 'undo' });
  assert.equal(g.rots[cell], r);
  for (const bad of [{ type: 'tap', cell: -1 }, { type: 'tap', cell: 1.5 }, { type: 'lock' }, { type: 'nope' }]) g.onInput(bad);
  g.onInput({ type: 'hint' });
  assert.equal(g.locked[g.hint], true);
  assert.equal(turned(g.base[g.hint], g.rots[g.hint]), g.answer[g.hint]);
  for (let i = 0; i < 60 && g.phase === 'play'; i++) g.onInput({ type: 'hint' });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.hints * HINT_PENALTY);
});

test('pause hides the pipes; the settings pick the size and the wrap; variants keep them apart', () => {
  const { ctx, g } = game(9, 'wrap');
  assert.equal(g.hostView().variant, '9 × 9 wrap');
  ctx.advance(2000);
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().base.every((m) => m === 0));
  ctx.advance(9000);
  g.onInput({ type: 'pause' });
  assert.equal(g.hostView().elapsed, 2000);
  assert.equal(game(6).g.n, 7, 'a size not offered falls back');
});
