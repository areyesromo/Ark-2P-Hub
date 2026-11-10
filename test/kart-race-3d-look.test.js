// Kart Race 3D: looking back and glancing sideways. The server keeps where each player looks; the
// controller's right stick and the phone send it (see also kart-race-3d-phone and -scene tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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

// ---- the controller ----

test('the pad reader reports the right stick and its click', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
  buttons[11] = { pressed: true, value: 1 };
  const pad = { index: 0, connected: true, axes: [0, 0, 0.7, 0.8], buttons };
  let frames = 0;
  const window = {};
  const navigator = { getGamepads: () => [pad] };
  vm.runInNewContext(fs.readFileSync('public/host/gamepads.js', 'utf8'), {
    window, navigator, requestAnimationFrame: (fn) => { if (frames++ < 1) fn(); },
  });
  assert.deepEqual({ ...window.ArkPads.stick2(0) }, { x: 0.7, y: 0.8 }); // (a copy: the vm's objects have their own prototype)
  assert.ok(window.ArkPads.held(0).includes('RS'));
  assert.deepEqual({ ...window.ArkPads.stick2(5) }, { x: 0, y: 0 });
});

function tv() {
  const window = {};
  const Ark = { escapeHtml: String, loadCss() {}, loadScript: () => new Promise(() => {}), register() {}, setup: {} };
  vm.runInNewContext(fs.readFileSync('public/games/kart-race/host.js', 'utf8'), { Ark, window, setTimeout, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  return window.ArkKartTV;
}
const pad = (stick2, held = []) => ({ held, stick: { x: 0, y: 0 }, stick2 });

test('the 3D pad maps the right stick to look and back', () => {
  const poll = tv().make({ look: true }).padPoll;
  const v = { phase: 'race' };
  assert.equal(poll(pad({ x: 0.5, y: 0 }), v).look, 0.5);
  assert.equal(poll(pad({ x: 0.5, y: 0 }), v).back, false);
  assert.equal(poll(pad({ x: 0, y: 0.7 }), v).back, true);
  assert.equal(poll(pad({ x: 0, y: 0 }, ['RS']), v).back, true);
  assert.equal(poll(pad({ x: 0.1, y: 0 }), v).look, 0);
  assert.equal(poll({ held: [], stick: { x: 0, y: 0 } }, v).look, 0, 'an old host with no stick2');
});

test('the 2D pad sends no look', () => {
  const input = tv().make({}).padPoll(pad({ x: 0.5, y: 0.9 }, ['RS']), { phase: 'race' });
  assert.ok(!('look' in input) && !('back' in input), JSON.stringify(input));
});

test('the 3D pad hint mentions looking round; the 2D one does not', () => {
  assert.match(tv().make({ look: true }).padHint, /R-stick: look/);
  assert.doesNotMatch(tv().make({}).padHint, /R-stick/);
});
