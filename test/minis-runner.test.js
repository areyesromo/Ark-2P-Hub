// The shared minigame engine: playlist, phases, timers and the timing clamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MiniGame, Playlist, TIMING, plausibleT } from '../server/games/minis/runner.js';

/** Stub minigames that record what reaches them. */
function stubs() {
  const made = [];
  const micro = {
    id: 'm1', kind: 'micro', name: 'Go', order: 'GO!', howTo: 'Press go', durationMs: 1000,
    create(api) {
      const got = [false, false];
      const inst = {
        inputs: 0,
        start() {},
        onInput(slot, input) {
          inst.inputs++;
          if (input.type !== 'go') return;
          got[slot] = true;
          if (got[0] && got[1]) api.end({ pass: [true, true] });
        },
        view: () => ({ got }),
      };
      made.push({ inst, api });
      return inst;
    },
  };
  const party = {
    id: 'p1', kind: 'party', name: 'Race', order: 'RACE!', howTo: 'Press win', durationMs: 5000,
    create(api) {
      const inst = { start() {}, onInput: (slot, input) => input.type === 'win' && api.end({ winner: slot }), view: () => ({}) };
      made.push({ inst, api });
      return inst;
    },
  };
  return { made, micro, party };
}

class TestGame extends MiniGame {
  reset() {
    this.results = [];
    this.scores = [0, 0];
  }
  score(result) {
    this.results.push(result);
  }
  isOver() {
    return this.results.length >= (this.overAfter || Infinity);
  }
}

test('plausibleT trusts a sane phone time and clamps the rest', () => {
  assert.equal(plausibleT(120, 500), 120);
  assert.equal(plausibleT(-5, 500), 500);
  assert.equal(plausibleT(NaN, 500), 500);
  assert.equal(plausibleT('9', 500), 500);
  assert.equal(plausibleT(651, 500), 500);
  assert.equal(plausibleT(650, 500), 650);
});

test('Playlist: every id once per block, never the same twice in a row', () => {
  let x = 7;
  const rng = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const p = new Playlist(['a', 'b', 'c'], rng);
  const seq = Array.from({ length: 30 }, () => p.next());
  for (let i = 0; i < 30; i += 3) assert.deepEqual(seq.slice(i, i + 3).sort(), ['a', 'b', 'c']);
  for (let i = 1; i < 30; i++) assert.notEqual(seq[i], seq[i - 1]);
});

test('micro flow: intro, play, result, next intro', () => {
  const { made, micro } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [micro]);
  g.start();
  assert.equal(g.hostView().phase, 'intro');
  assert.equal(g.hostView().mini.order, 'GO!');
  ctx.advance(TIMING.introMicroMs);
  assert.equal(g.hostView().phase, 'play');
  g.onInput(0, { type: 'go' });
  g.onInput(1, { type: 'go' });
  const v = g.hostView();
  assert.equal(v.phase, 'result');
  assert.deepEqual(v.lastResult, { pass: [true, true] });
  assert.equal(v.count, 1);
  ctx.advance(TIMING.resultMicroMs);
  assert.equal(g.hostView().phase, 'intro');
  assert.equal(made.length, 2);
});

test('time-up with no input: nobody passes', () => {
  const { micro } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [micro]);
  g.start();
  ctx.advance(TIMING.introMicroMs + micro.durationMs);
  assert.equal(g.hostView().phase, 'result');
  assert.deepEqual(g.hostView().lastResult, { pass: [false, false] });
});

test('inputs outside play never reach the minigame', () => {
  const { made, micro } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [micro]);
  g.start();
  g.onInput(0, { type: 'go' }); // intro
  assert.equal(made[0].inst.inputs, 0);
  ctx.advance(TIMING.introMicroMs);
  g.onInput(0, { type: 'go' });
  g.onInput(1, { type: 'go' });
  g.onInput(0, { type: 'go' }); // result: late tap
  assert.equal(made[0].inst.inputs, 2);
  ctx.advance(TIMING.resultMicroMs);
  assert.equal(made[1].inst.inputs, 0);
});

test('a stale end from an old minigame is ignored after a rematch', () => {
  const { made, micro } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [micro]);
  g.start();
  ctx.advance(TIMING.introMicroMs);
  const old = made[0].api;
  g.start();
  ctx.advance(TIMING.introMicroMs);
  old.end({ pass: [true, false] });
  assert.equal(g.hostView().phase, 'play');
  assert.equal(g.hostView().count, 0);
});

test('party intro: both ready starts at once; otherwise after the wait', () => {
  const { party } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [party]);
  g.start();
  assert.equal(g.hostView().phase, 'intro');
  g.onInput(0, { type: 'ready' });
  assert.deepEqual(g.hostView().ready, [true, false]);
  g.onInput(1, { type: 'ready' });
  assert.equal(g.hostView().phase, 'play');
  g.onInput(1, { type: 'win' });
  ctx.advance(TIMING.resultPartyMs);
  assert.equal(g.hostView().phase, 'intro');
  g.onInput(0, { type: 'ready' });
  ctx.advance(TIMING.readyMaxMs - 1);
  assert.equal(g.hostView().phase, 'intro');
  ctx.advance(1);
  assert.equal(g.hostView().phase, 'play');
});

test('over when the game says so; rematch starts again', () => {
  const { micro } = stubs();
  const ctx = fakeCtx();
  const g = new TestGame(ctx, [micro]);
  g.overAfter = 1;
  g.start();
  ctx.advance(TIMING.introMicroMs + micro.durationMs + TIMING.resultMicroMs);
  assert.equal(g.hostView().phase, 'over');
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.hostView().phase, 'intro');
  assert.equal(g.hostView().count, 0);
  assert.equal(g.playerView(1).you, 1);
});
