import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VideoPoker, TIMING, START_CHIPS, anteFor } from '../server/games/video-poker.js';
import { videoPokerBot, thumbHold } from '../server/games/video-poker-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}, seed = 5) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new VideoPoker(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const ALL = [true, true, true, true, true];
const NONE = [false, false, false, false, false];

test('the same five for you both; the ante goes in the pot; holds are secret till you both lock', () => {
  const { g } = setup();
  assert.equal(g.playerView(0).dealt.join(), g.playerView(1).dealt.join());
  assert.equal(g.pot, 2 * anteFor(1, 10));
  assert.equal(g.chips[0], START_CHIPS - anteFor(1, 10));
  g.onInput(0, { type: 'hold', hold: [true, false, true, false, false] });
  assert.deepEqual(g.playerView(0).holds[0], [true, false, true, false, false]);
  assert.equal(g.playerView(1).holds[0], null);
  assert.equal(g.hostView().holds[0], null);
  for (const bad of [{ type: 'hold', hold: [true] }, { type: 'hold', hold: [1, 0, 0, 0, 0] }, { type: 'hold' }]) g.onInput(1, bad);
  assert.equal(g.holds[1], null);
});

test('the draw: held cards stay, the rest come off the same spare cards in order; the better hand takes the pot', () => {
  const { g } = setup();
  g.dealt = ['AS', 'AD', '7C', '4H', '2S'];
  g.spare = ['AC', 'KD', '9H', '5C', '3D'];
  g.onInput(0, { type: 'hold', hold: [true, true, false, false, false] }); // aces: gets AC KD 9H = three aces
  g.onInput(1, { type: 'hold', hold: NONE }); // five new: AC KD 9H 5C 3D, ace high
  assert.deepEqual(g.finals[0], ['AS', 'AD', 'AC', 'KD', '9H']);
  assert.deepEqual(g.finals[1], ['AC', 'KD', '9H', '5C', '3D']);
  assert.equal(g.result.winner, 0);
  assert.equal(g.chips[0], START_CHIPS - anteFor(1, 10) + g.result.pot);
  assert.equal(g.phase, 'reveal');
});

test('out of time folds you; the match ends after the hands, most chips winning', () => {
  const { ctx, g } = setup({ hands: 6 });
  g.onInput(1, { type: 'hold', hold: ALL });
  ctx.advance(TIMING.holdMs);
  assert.equal(g.result.winner, 1, 'seat 0 ran out of time: folded');
  for (let k = 0; k < 6; k++) {
    ctx.advance(TIMING.revealMs);
    if (g.phase === 'over') break;
    g.onInput(0, { type: 'hold', hold: ALL });
    g.onInput(1, { type: 'hold', hold: ALL });
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.chips[0] + g.chips[1], 2 * START_CHIPS);
});

test('the computer keeps the obvious, and Easy beats a player who leaves it to the clock', () => {
  assert.deepEqual(thumbHold(['KS', 'KD', '7C', '4H', '2S']), [true, true, false, false, false]);
  assert.deepEqual(thumbHold(['2H', '5H', '9H', 'JH', 'KS']), [true, true, true, true, false]);
  const view = { phase: 'hold', you: 1, hand: 1, locked: [false, false], dealt: ['QS', 'QD', 'QC', '4H', '2S'] };
  const m = videoPokerBot(view, 'normal', seeded(1));
  assert.deepEqual(m.hold.slice(0, 3), [true, true, true]);
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('video-poker', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
