import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WhichBox, TIMING } from '../server/games/which-box.js';
import { whichBoxBot } from '../server/games/guess-bots.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new WhichBox(ctx);
  g.start();
  return { ctx, g };
}

test('hide and seek in secret: found is the seeker\'s point, missed the hider\'s; then you swap', () => {
  const { ctx, g } = setup();
  assert.equal(g.hider, 0);
  g.onInput(0, { type: 'pick', box: 2 });
  assert.equal(g.playerView(1).mine, null);
  assert.ok(!JSON.stringify(g.hostView()).includes('"mine":2'));
  g.onInput(1, { type: 'pick', box: 2 });
  assert.deepEqual(g.scores, [0, 1]);
  assert.equal(g.result.found, true);
  ctx.advance(TIMING.revealMs);
  assert.equal(g.hider, 1);
  g.onInput(1, { type: 'pick', box: 0 });
  g.onInput(0, { type: 'pick', box: 1 });
  assert.deepEqual(g.scores, [0, 2]);
  for (const bad of [{ type: 'pick', box: 3 }, { type: 'pick', box: 'x' }]) g.onInput(0, bad);
});

test('out of time: not hidden is found; no look is a miss; the match ends after the rounds', () => {
  const { ctx, g } = setup({ rounds: 3 });
  g.onInput(1, { type: 'pick', box: 1 }); // the seeker looks; the hider never hides
  ctx.advance(TIMING.pickMs);
  assert.equal(g.result.point, 1);
  ctx.advance(TIMING.revealMs);
  g.onInput(1, { type: 'pick', box: 0 }); // now seat 1 hides; seat 0 never looks
  ctx.advance(TIMING.pickMs);
  assert.equal(g.result.point, 1);
  for (let k = 0; k < 10 && g.phase !== 'over'; k++) ctx.advance(TIMING.pickMs + TIMING.revealMs);
  assert.equal(g.phase, 'over');
  assert.equal(g.history.length, 6);
});

test('the computer reads a habit, and Easy beats a player who leaves it to the clock', () => {
  const history = [1, 1, 1].map(() => ({ hider: 0, hid: 1, sought: 0, found: false }));
  const v = { phase: 'pick', you: 1, round: 7, hider: 0, mine: null, history };
  assert.equal(whichBoxBot(v, 'normal', seeded(1)).box, 1, 'they always hide in the middle');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('which-box', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
