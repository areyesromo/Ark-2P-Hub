// Party Board: the map, the one-minigame runner, and the board game itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { MAPS } from '../server/games/board/maps.js';
import { OneMini, TIMING as MINI } from '../server/games/minis/runner.js';

/** A party minigame won by whoever says so ('draw' for a draw). */
const claim = {
  id: 'claim', kind: 'party', look: '2d', name: 'Claim', order: 'CLAIM!', howTo: 'say', durationMs: 20000,
  create(api) {
    return { start() {}, onInput: (slot, input) => api.end({ winner: input.type === 'draw' ? null : slot }), view: () => ({}) };
  },
};

test('map island: a loop of 24-32 spaces with the right counts', () => {
  const s = MAPS.island.spaces;
  assert.ok(s.length >= 24 && s.length <= 32);
  const n = (t) => s.filter((x) => x.type === t).length;
  assert.equal(s[0].type, 'start');
  assert.equal(n('shop'), 2);
  assert.equal(n('event'), 3);
  assert.equal(n('bonus'), 2);
  const stars = s.filter((x) => x.starCandidate);
  assert.ok(stars.length >= 4 && stars.length <= 6);
  assert.ok(stars.every((x) => x.type === 'blue'));
  assert.ok(n('blue') >= 1.5 * n('red') && n('red') >= 3);
  for (const x of s) assert.ok(x.x >= 0 && x.x <= 1 && x.y >= 0 && x.y <= 1);
  assert.equal(new Set(s.map((x) => x.x + ',' + x.y)).size, s.length);
});

test('OneMini plays one party minigame and reports its result', () => {
  const ctx = fakeCtx();
  const done = [];
  const m = new OneMini(ctx, [claim], Math.random, (r) => done.push(r));
  m.start();
  m.onInput(0, { type: 'ready' });
  m.onInput(1, { type: 'ready' });
  m.onInput(1, { type: 'win' });
  assert.equal(done.length, 0, 'the result card shows first');
  ctx.advance(MINI.resultPartyMs);
  assert.deepEqual(done, [{ winner: 1 }]);
  ctx.advance(60000);
  assert.equal(done.length, 1);
});
