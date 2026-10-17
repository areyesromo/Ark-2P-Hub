import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { PartyMinis } from '../server/games/party-minis.js';
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
