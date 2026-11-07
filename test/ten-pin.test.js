import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { scoreCard, rollBall, rackPins, LANE, PINS } from '../server/games/ten-pin-roll.js';
import { TenPin, TIMING } from '../server/games/ten-pin.js';
import { tenPinBot, bestThrow } from '../server/games/ten-pin-bot.js';
import { getGame } from '../server/games/index.js';

/** A seeded rng (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- scoring ----

test('scoring: open frames add up; a spare adds the next ball, a strike the next two', () => {
  assert.equal(scoreCard(Array(20).fill(4), 10).total, 80);
  assert.equal(scoreCard([5, 5, 3, 0, ...Array(16).fill(0)], 10).total, 16);
  assert.equal(scoreCard([10, 3, 4, ...Array(16).fill(0)], 10).total, 24);
  assert.equal(scoreCard([10, 10, 10, ...Array(14).fill(0)], 10).total, 60);
  // Frame by frame: running totals, null while a bonus is still to come.
  const c = scoreCard([10, 5], 10);
  assert.equal(c.frames[0].total, null, 'a strike waits for its two balls');
  assert.deepEqual(c.frames[0].balls, [10]);
  assert.deepEqual(c.frames[1].balls, [5]);
});

test('scoring: the last frame gives a strike two more balls and a spare one more; twelve strikes is 300', () => {
  assert.equal(scoreCard(Array(12).fill(10), 10).total, 300);
  assert.equal(scoreCard(Array(12).fill(10), 10).done, true);
  assert.equal(scoreCard([...Array(18).fill(0), 7, 3, 5], 10).total, 15);
  assert.equal(scoreCard([...Array(18).fill(0), 7, 3], 10).done, false, 'the bonus ball is still to come');
  assert.equal(scoreCard([...Array(18).fill(0), 7, 2], 10).done, true, 'an open last frame ends it');
  assert.equal(scoreCard([...Array(18).fill(0), 10, 10, 10], 10).total, 30);
  // A short game: the same, over five frames.
  assert.equal(scoreCard(Array(7).fill(10), 5).total, 150);
  assert.equal(scoreCard(Array(7).fill(10), 5).done, true);
  // Which ball comes next: the frame, its ball, and whether the rack is fresh.
  assert.deepEqual(scoreCard([], 10).next, { frame: 0, ball: 0, fresh: true });
  assert.deepEqual(scoreCard([7], 10).next, { frame: 0, ball: 1, fresh: false });
  assert.deepEqual(scoreCard([10], 10).next, { frame: 1, ball: 0, fresh: true });
  assert.deepEqual(scoreCard([...Array(18).fill(0), 10], 10).next, { frame: 9, ball: 1, fresh: true });
  assert.deepEqual(scoreCard([...Array(18).fill(0), 10, 4], 10).next, { frame: 9, ball: 2, fresh: false });
  assert.deepEqual(scoreCard([...Array(18).fill(0), 6, 4], 10).next, { frame: 9, ball: 2, fresh: true });
});

// ---- the roll ----

test('ten pins in a triangle at the end of the lane, the head pin nearest you', () => {
  assert.equal(PINS.length, 10);
  const rack = rackPins();
  assert.equal(rack.length, 10);
  assert.ok(rack.every((p) => p.z >= LANE.headPin - 0.01 && Math.abs(p.x) < LANE.hw));
  assert.equal(rack[0].x, 0);
  assert.equal(rack[0].z, LANE.headPin);
});

test('a roll is decided by the throw and the rng: the same again gives the same pins', () => {
  const t = { stance: 0.1, aim: -0.1, power: 0.8, spin: 0.2 };
  const a = rollBall(t, rackPins(), { rng: seeded(7) });
  const b = rollBall(t, rackPins(), { rng: seeded(7) });
  assert.deepEqual(a.down, b.down);
  assert.deepEqual(a.standing, b.standing);
  assert.ok(a.frames.length > 10, 'frames for the TV to play back');
  assert.ok(a.ms > 1500 && a.ms < 6000, 'a roll takes a couple of seconds: ' + a.ms);
});

test('straight down the middle hits the head pin and knocks pins down; off the side it\'s a gutter ball', () => {
  const mid = rollBall({ stance: 0, aim: 0, power: 0.8, spin: 0 }, rackPins(), { rng: seeded(1) });
  assert.ok(mid.down.includes(0), 'the head pin');
  assert.ok(mid.down.length >= 4, 'pins fall: ' + mid.down.length);
  const gutter = rollBall({ stance: 0.4, aim: 1, power: 0.8, spin: 0 }, rackPins(), { rng: seeded(1) });
  assert.equal(gutter.gutter, true);
  assert.equal(gutter.down.length, 0);
  // With bumpers it bounces back in instead.
  const bump = rollBall({ stance: 0.4, aim: 1, power: 0.8, spin: 0 }, rackPins(), { rng: seeded(1), bumpers: true });
  assert.equal(bump.gutter, false);
  assert.ok(bump.down.length > 0, 'off the bumper into the pins');
});

test('spin curves the ball, more of it the further down the lane', () => {
  const end = (spin) => { const r = rollBall({ stance: 0, aim: 0, power: 0.7, spin }, [], { rng: seeded(1) }); return r.frames.find((f) => f.b[1] > LANE.headPin - 1).b[0]; };
  assert.ok(end(1) > 0.15 && end(-1) < -0.15, end(1) + ' ' + end(-1));
  assert.ok(Math.abs(end(0)) < 0.01);
});

test('a good throw into the pocket strikes often; a spare can be picked up by aiming at what\'s left', () => {
  const best = bestThrow(rackPins(), { stance: 0.25 });
  let strikes = 0;
  for (let s = 1; s <= 20; s++) if (rollBall(best, rackPins(), { rng: seeded(s) }).down.length === 10) strikes++;
  assert.ok(strikes >= 8, 'strikes from the pocket: ' + strikes + '/20');
  // Only the 7 pin left (back left corner): aimed at, it falls.
  const seven = rackPins().filter((p) => p.i === 6);
  const t = bestThrow(seven, { stance: 0 });
  let made = 0;
  for (let s = 1; s <= 10; s++) if (rollBall(t, seven, { rng: seeded(s) }).down.length === 1) made++;
  assert.ok(made >= 8, 'the 7 pin: ' + made + '/10');
});

test('pins left standing stay where they ended up (a pin that only wobbled doesn\'t move)', () => {
  const r = rollBall({ stance: -0.2, aim: 0.05, power: 0.5, spin: 0 }, rackPins(), { rng: seeded(3) });
  for (const p of r.standing) {
    const home = rackPins().find((q) => q.i === p.i);
    assert.ok(Math.hypot(p.x - home.x, p.z - home.z) < 0.2, 'pin ' + p.i);
  }
  assert.equal(r.standing.length + r.down.length, 10);
});

// ---- the game ----

function game({ frames = 10, bumpers = 0, rng = seeded(5) } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { frames, bumpers };
  const g = new TenPin(ctx, rng);
  g.start();
  ctx.advance(TIMING.introMs + 10);
  return { ctx, g };
}
/** Throw for whoever's up and wait for the roll to finish. */
function bowl(ctx, g, t = { stance: 0, aim: 0, power: 0.8, spin: 0 }) {
  const slot = g.turn;
  g.onInput(slot, { type: 'throw', ...t });
  ctx.advance(30000);
  return slot;
}

test('players take turns a frame at a time: two balls each unless the first is a strike', () => {
  const { ctx, g } = game();
  assert.equal(g.phase, 'aim');
  assert.equal(g.turn, 0);
  g.onInput(1, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  assert.equal(g.phase, 'aim', 'not your turn');
  bowl(ctx, g, { stance: 0.4, aim: 1, power: 0.8, spin: 0 }); // a gutter ball
  assert.equal(g.turn, 0, 'a second ball');
  assert.deepEqual(g.balls[0], [0]);
  bowl(ctx, g, { stance: 0.4, aim: 1, power: 0.8, spin: 0 });
  assert.equal(g.turn, 1, 'over to player 2');
  assert.equal(g.hostView().standing.length, 10, 'a fresh rack');
  // A strike ends the frame at once.
  g.rollFn = () => ({ down: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], standing: [], gutter: false, frames: [{ t: 0, b: [0, 0], p: [] }], ms: 2000 });
  bowl(ctx, g);
  assert.equal(g.turn, 0);
  assert.deepEqual(g.balls[1], [10]);
  assert.equal(g.hostView().cards[1].frames[0].balls[0], 10);
});

test('the second ball faces only the pins still standing, where they stood', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  const knocked = g.roll.down.length;
  ctx.advance(30000);
  assert.equal(g.hostView().standing.length, 10 - knocked);
  assert.deepEqual(g.balls[0], [knocked]);
});

test('the stance moves while you aim (only yours, only on your turn), and bad input is ignored', () => {
  const { g } = game();
  g.onInput(0, { type: 'stance', x: 0.3 });
  assert.equal(g.hostView().stance, 0.3);
  g.onInput(0, { type: 'stance', x: 9 });
  assert.equal(g.hostView().stance, LANE.maxStance);
  g.onInput(1, { type: 'stance', x: -0.2 });
  assert.equal(g.hostView().stance, LANE.maxStance, 'not your turn');
  for (const bad of [{ type: 'throw', stance: 0, aim: NaN, power: 1, spin: 0 }, { type: 'throw', stance: 0, aim: 0, power: '1', spin: 0 }, { type: 'throw' }, null, { type: 'stance', x: Infinity }]) g.onInput(0, bad);
  assert.equal(g.phase, 'aim');
  g.onInput(0, { type: 'throw', stance: 5, aim: -5, power: 7, spin: 3 });
  assert.equal(g.phase, 'rolling', 'out-of-range numbers are clamped, not refused');
  assert.equal(g.lastThrow.stance, LANE.maxStance);
  assert.equal(g.lastThrow.power, 1);
});

test('the game ends after the last frame: the higher total wins (a tie is a draw), and a rematch starts over', () => {
  const { ctx, g } = game({ frames: 5 });
  let n = 0;
  g.rollFn = (t, pins) => ({ down: t.power > 0.9 ? pins.map((p) => p.i) : [], standing: t.power > 0.9 ? [] : pins, gutter: false, frames: [{ t: 0, b: [0, 0], p: [] }], ms: 1500 });
  while (g.phase !== 'over' && n++ < 100) bowl(ctx, g, { stance: 0, aim: 0, power: g.turn === 0 ? 1 : 0.5, spin: 0 });
  assert.equal(g.phase, 'over');
  const v = g.hostView();
  assert.deepEqual(v.scores, [150, 0]);
  assert.equal(v.winner, 0);
  assert.equal(v.cards[0].total, 150);
  assert.equal(v.perfect[0], true);
  g.onInput(1, { type: 'rematch' });
  ctx.advance(TIMING.introMs + 10);
  assert.equal(g.phase, 'aim');
  assert.deepEqual(g.balls, [[], []]);
  // A tie.
  const t = game({ frames: 5 });
  t.g.rollFn = (x, pins) => ({ down: [], standing: pins, gutter: true, frames: [{ t: 0, b: [0, 0], p: [] }], ms: 1500 });
  n = 0;
  while (t.g.phase !== 'over' && n++ < 100) bowl(t.ctx, t.g);
  assert.equal(t.g.hostView().winner, null);
  assert.equal(t.g.hostView().draw, true);
});

test('the view: the roll to play back while it rolls, both score cards, whose turn; best streak for the trophies', () => {
  const { ctx, g } = game();
  const v = g.playerView(1);
  assert.equal(v.you, 1);
  assert.equal(v.cards.length, 2);
  assert.equal(v.frames, 10);
  g.onInput(0, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  assert.ok(g.hostView().roll && g.hostView().roll.frames.length > 0);
  ctx.advance(30000);
  assert.equal(g.hostView().roll, null);
  assert.deepEqual(g.hostView().bestStreak, [g.balls[0][0] === 10 ? 1 : 0, 0]);
});

test('in the lobby: Bowling, with the length and bumpers to pick, and a computer opponent', () => {
  const def = getGame('ten-pin');
  assert.equal(def.name, 'Bowling');
  assert.equal(typeof def.bot, 'function');
  const setup = def.create(fakeCtx());
  assert.deepEqual(setup.options.frames, [10, 5]);
  assert.deepEqual(setup.options.bumpers, [0, 1]);
});

test('the computer bowls on its turn (and only then), better on Hard than on Easy', () => {
  const { g } = game();
  assert.equal(tenPinBot(g.playerView(1), 'hard', seeded(1), 0, {}), null, 'not its turn');
  g.onInput(0, tenPinBot(g.playerView(0), 'hard', seeded(1), 0, {})); // (to its spot)
  const m = tenPinBot(g.playerView(0), 'hard', seeded(1), 0, {});
  assert.equal(m.type, 'throw');
  for (const k of ['stance', 'aim', 'power', 'spin']) assert.ok(Number.isFinite(m[k]), k);
  const avg = (level) => {
    let sum = 0;
    for (let s = 1; s <= 12; s++) {
      const r = seeded(s);
      const t = tenPinBot(g.playerView(0), level, r, 0, {});
      if (t.type === 'stance') { g.onInput(0, t); s--; continue; } // (to its spot first)
      sum += rollBall(t, rackPins(), { rng: r }).down.length;
    }
    return sum / 12;
  };
  const easy = avg('easy');
  const hard = avg('hard');
  assert.ok(hard > easy + 0.8, 'hard ' + hard + ' vs easy ' + easy);
  assert.ok(hard >= 8, 'hard ' + hard);
});

test('a second tap while the ball rolls is ignored (one roll, one timer)', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  const id = g.rollId;
  g.onInput(0, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  assert.equal(g.rollId, id);
  assert.equal(ctx.pendingTimers(), 1);
});

test('the last frame: after a strike and 4, the third ball faces what the 4 left; after a spare, a fresh rack', () => {
  const { ctx, g } = game({ frames: 5 });
  g.balls = [[10, 10, 10, 10], [10, 10, 10, 10]];
  const plan = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 1, 2, 3]];
  g.rollFn = (t, pins) => { const want = plan.shift() || []; return { down: pins.filter((p) => want.includes(p.i)).map((p) => p.i), standing: pins.filter((p) => !want.includes(p.i)), gutter: false, frames: [{ t: 0, b: [0, 0], p: [] }], ms: 1500 }; };
  bowl(ctx, g); // strike: a fresh rack
  assert.equal(g.turn, 0);
  assert.equal(g.pins.length, 10);
  bowl(ctx, g); // 4 down
  assert.equal(g.turn, 0);
  assert.equal(g.pins.length, 6, 'the six the 4 left');
  bowl(ctx, g);
  assert.equal(g.turn, 1, 'then the other player');
  // A spare in the last frame: the bonus ball at a fresh rack.
  plan.push([0, 1, 2], [3, 4, 5, 6, 7, 8, 9]);
  bowl(ctx, g);
  bowl(ctx, g);
  assert.equal(g.turn, 1);
  assert.equal(g.pins.length, 10);
});

test('the roll in the view: how far in it is (a TV that reloads catches up), and the phones don\'t get its frames', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'throw', stance: 0, aim: 0, power: 0.8, spin: 0 });
  assert.equal(g.hostView().roll.at, 0);
  ctx.advance(700);
  assert.equal(g.hostView().roll.at, 700);
  const p = g.playerView(0).roll;
  assert.ok(p && p.id && p.frames === undefined, 'no frames on the phone');
});

test('the computer steps to its spot first (so the TV shows where it bowls from), then throws', () => {
  const { g } = game();
  g.turn = 1;
  const m = tenPinBot(g.playerView(1), 'hard', seeded(1), 0, {});
  assert.equal(m.type, 'stance');
  g.onInput(1, m);
  const t = tenPinBot(g.playerView(1), 'hard', seeded(1), 0, {});
  assert.equal(t.type, 'throw');
  assert.equal(t.stance, g.hostView().stance);
});
