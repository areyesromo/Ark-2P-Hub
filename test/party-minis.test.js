import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PartyMinis, poolFor } from '../server/games/party-minis.js';
import { PARTIES } from '../server/games/minis/index.js';
import { TIMING } from '../server/games/minis/runner.js';
import { listGames } from '../server/games/index.js';

/** A party minigame won by whoever says so (or a draw). */
const stub = {
  id: 'claim', kind: 'party', name: 'Claim', order: 'CLAIM!', howTo: 'win or draw', durationMs: 20000,
  create(api) {
    return {
      start() {},
      onInput: (slot, input) => api.end({ winner: input.type === 'draw' ? null : slot }),
      view: () => ({}),
    };
  },
};

function game(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const g = new PartyMinis(ctx, [stub]);
  g.start();
  const round = (slot, type = 'win') => {
    g.onInput(0, { type: 'ready' });
    g.onInput(1, { type: 'ready' });
    g.onInput(slot, { type });
    ctx.advance(TIMING.resultPartyMs);
  };
  return { g, ctx, round };
}

test('Party Minigames: a win scores, a draw scores nobody', () => {
  const { g, round } = game();
  round(0);
  assert.deepEqual(g.hostView().wins, [1, 0]);
  round(1, 'draw');
  assert.deepEqual(g.hostView().wins, [1, 0]);
  assert.deepEqual(g.hostView().scores, [1, 0]);
});

test('Party Minigames: first to 3 wins the match', () => {
  const { g, round } = game();
  assert.equal(g.hostView().target, 3);
  round(1);
  round(1);
  round(0);
  round(1);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 1);
  assert.equal(v.draw, false);
});

test('Party Minigames: first to 4 setting', () => {
  const { g } = game({ wins: 4 });
  assert.equal(g.hostView().target, 4);
});

test('Party Minigames: a player who never presses Ready still gets the game going', () => {
  const { g, ctx } = game();
  g.onInput(0, { type: 'ready' });
  assert.equal(g.hostView().phase, 'intro');
  ctx.advance(TIMING.readyMaxMs);
  assert.equal(g.hostView().phase, 'play');
});

test('Party Minigames is in the lobby as a competitive game', () => {
  const g = listGames().find((x) => x.id === 'party-minis');
  assert.ok(g);
  assert.equal(g.category, 'competitive');
});

test('Party Minigames style: 2D only, 3D only or a mix', async () => {
  const { PARTIES } = await import('../server/games/minis/index.js');
  for (const m of PARTIES) assert.ok(m.look === '2d' || m.look === '3d', `${m.id} has a look`);
  const pool = (style) => {
    const ctx = fakeCtx();
    if (style) ctx.settings = { style };
    return new PartyMinis(ctx).pool.map((m) => m.look);
  };
  assert.ok(pool().includes('2d') && pool().includes('3d'));
  assert.ok(pool('2d').every((l) => l === '2d'));
  assert.ok(pool('3d').length >= 3 && pool('3d').every((l) => l === '3d'));
});

test('the Minigames setting can pick one minigame: the match plays only that one', () => {
  const g = listGames().find((x) => x.id === 'party-minis');
  assert.ok(g);
  assert.deepEqual(poolFor(PARTIES, 'fishing').map((m) => m.id), ['fishing']);
  assert.equal(poolFor(PARTIES, 'mix').length, PARTIES.length);
  assert.ok(poolFor(PARTIES, '3d').every((m) => m.look === '3d'));
  assert.equal(poolFor(PARTIES, 'nope').length, PARTIES.length, 'an unknown value falls back to the mix');
});
