import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OddEven, TIMING } from '../server/games/odd-even.js';
import { oddEvenBot } from '../server/games/guess-bots.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new OddEven(ctx);
  g.start();
  return { ctx, g };
}

test('secret fingers; an odd total is Odd\'s point, even is Even\'s; the roles swap', () => {
  const { ctx, g } = setup();
  assert.equal(g.odd, 0);
  g.onInput(0, { type: 'pick', fingers: 2 });
  assert.equal(g.playerView(1).mine, null);
  g.onInput(1, { type: 'pick', fingers: 3 }); // 5: odd
  assert.deepEqual(g.scores, [1, 0]);
  ctx.advance(TIMING.revealMs);
  assert.equal(g.odd, 1);
  g.onInput(0, { type: 'pick', fingers: 4 });
  g.onInput(1, { type: 'pick', fingers: 2 }); // 6: even, seat 0 is Even now
  assert.deepEqual(g.scores, [2, 0]);
  for (const bad of [{ type: 'pick', fingers: 0 }, { type: 'pick', fingers: 6 }, { type: 'pick', fingers: 2.5 }]) g.onInput(0, bad);
});

test('out of time loses the round; first to the points wins', () => {
  const { ctx, g } = setup({ wins: 3 });
  for (let k = 0; k < 3; k++) {
    g.onInput(1, { type: 'pick', fingers: 1 });
    ctx.advance(TIMING.pickMs);
    if (g.phase !== 'over') ctx.advance(TIMING.revealMs);
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 1);
});

test('the computer reads your parity, and Easy beats a player who leaves it to the clock', () => {
  // Seat 0 always shows an even number when it's Even; the computer is Odd now: it shows odd.
  const history = [1, 2, 3].map(() => ({ odd: 1, picks: [2, 3], point: 1 }));
  const v = { phase: 'pick', you: 1, round: 7, odd: 1, mine: null, history };
  assert.equal(oddEvenBot(v, 'normal', seeded(1)).fingers % 2, 1);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('odd-even', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
