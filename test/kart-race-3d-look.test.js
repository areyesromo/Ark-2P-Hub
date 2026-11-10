// Kart Race 3D: looking back and glancing sideways. The server keeps where each player looks; the
// controller's right stick and the phone send it (see also kart-race-3d-phone and -scene tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/track.js';
import { TIMING } from '../server/games/kart-race.js';
import { KartRace3D } from '../server/games/kart-race-3d.js';
import { fakeCtx } from './helpers.js';

/** A 3D race, settings applied, lights out. */
function racing(settings = {}) {
  const ctx = fakeCtx();
  const game = new KartRace3D(ctx, () => 0.5);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

const drive = (game, extra) => game.onInput(0, { type: 'drive', steer: 0, gas: true, ...extra });

test('look and back reach the view', () => {
  const { game } = racing();
  drive(game, { look: 0.46, back: true });
  const k = game.hostView().karts[0];
  assert.equal(k.look, 0.5);
  assert.equal(k.back, true);
});

test('bad look values are clamped or dropped', () => {
  const { game } = racing();
  const look = (value) => {
    drive(game, { look: value });
    return game.hostView().karts[0].look;
  };
  assert.equal(look(5), 1);
  assert.equal(look(-3), -1);
  assert.equal(look('x'), 0);
  assert.equal(look(NaN), 0);
  drive(game, { back: 'yes' });
  assert.equal(game.hostView().karts[0].back, true);
});

test('look resets when the next race starts', () => {
  const { game } = racing();
  drive(game, { back: true, look: 1 });
  game.newRace();
  const k = game.hostView().karts[0];
  assert.equal(k.back, false);
  assert.equal(k.look, 0);
});

test('computer racers never look', () => {
  const { game } = racing({ field: 1 });
  const k = game.hostView().karts[2];
  assert.ok(k, 'an 8-kart field');
  assert.equal(k.look, 0);
  assert.equal(k.back, false);
});
