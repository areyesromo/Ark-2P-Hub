// Kart Race 3D: its own game in the hub, playing by Kart Race's rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listGames } from '../server/games/index.js';
import { KartRace, TIMING, BATTLE } from '../server/games/kart-race.js';
import kartRace3d, { KartRace3D } from '../server/games/kart-race-3d.js';
import { fakeCtx } from './helpers.js';

/** Setup, both ready, lights out. */
function started(settings = {}) {
  const ctx = fakeCtx();
  const game = kartRace3d.create(ctx);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

test('Kart Race 3D is its own game in the hub, after Kart Race', () => {
  const ids = listGames().map((g) => g.id);
  assert.ok(ids.includes('kart-race-3d'));
  assert.equal(ids.indexOf('kart-race-3d'), ids.indexOf('kart-race') + 1);
  const def = listGames().find((g) => g.id === 'kart-race-3d');
  assert.equal(def.name, 'Kart Race 3D');
  assert.match(def.tagline, /PC or Steam Deck/);
});

test('it plays a race to the end with the Kart Race rules', () => {
  const { ctx, game } = started();
  assert.ok(game instanceof KartRace);
  assert.ok(game instanceof KartRace3D);
  assert.equal(game.phase, 'race');
  game.finishLine(1, ctx.now());
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
});

test('a Battle round works too', () => {
  const { game } = started({ mode: 1 });
  assert.equal(game.phase, 'race');
  assert.equal(game.battle, true);
  assert.deepEqual(game.karts.map((k) => k.balloons), [BATTLE.balloons, BATTLE.balloons]);
});
