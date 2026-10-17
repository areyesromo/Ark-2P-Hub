import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MiniGolf, COURSE, FIELD, BALL_R, MAX_STROKES, TIMING, PHYSICS, inPolygon, wallsOf, pickHoles, bladeOf } from '../server/games/mini-golf.js';
import { fakeCtx } from './helpers.js';

/** A game on a given course hole (index into COURSE), in the play phase. */
function onHole(index) {
  const ctx = fakeCtx();
  const game = new MiniGolf(ctx);
  game.start();
  game.onInput(0, { type: 'go' });
  game.holes = [index].concat(game.holes.filter((i) => i !== index)); // play this hole first
  game.index = -1;
  game.nextHole();
  ctx.advance(TIMING.introMs + 50);
  assert.equal(game.phase, 'play');
  return { ctx, game };
}

/** Shoot and let the ball roll to a stop. */
function putt(ctx, game, slot, angle, power) {
  game.onInput(slot, { type: 'shoot', angle, power });
  const b = game.balls[slot];
  for (let t = 0; t < 600 && (b.vx || b.vy); t++) ctx.advance(PHYSICS.tickMs);
}

const outside = (hole, x, y) =>
  !inPolygon(hole.bounds, x, y) || (hole.blocks || []).some((p) => inPolygon(p, x, y));

test('every hole is sound: tee and cup on open green, away from walls and hazards', () => {
  assert.equal(COURSE.length, 9);
  for (const hole of COURSE) {
    for (const [x, y] of [hole.tee, hole.cup]) {
      assert.ok(x > 0 && x < FIELD.w && y > 0 && y < FIELD.h, hole.name);
      assert.ok(!outside(hole, x, y), `${hole.name}: tee/cup inside the course`);
      assert.ok(!(hole.water || []).some((p) => inPolygon(p, x, y)), `${hole.name}: not in water`);
      for (const w of wallsOf(hole)) {
        // distance from the point to the wall segment
        const dx = w[2] - w[0];
        const dy = w[3] - w[1];
        const t = Math.max(0, Math.min(1, ((x - w[0]) * dx + (y - w[1]) * dy) / (dx * dx + dy * dy)));
        assert.ok(Math.hypot(x - (w[0] + t * dx), y - (w[1] + t * dy)) > BALL_R * 2, `${hole.name}: clear of walls`);
      }
    }
    assert.ok(hole.par >= 2 && hole.par <= 5);
  }
});

test('the ball never leaves the course or ends up inside a wall, whatever you hit', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let h = 0; h < COURSE.length; h++) {
    const { ctx, game } = onHole(h);
    const hole = COURSE[h];
    for (let shot = 0; shot < 6; shot++) {
      const b = game.balls[0];
      if (b.done) break;
      game.onInput(0, { type: 'shoot', angle: rng() * Math.PI * 2, power: 0.3 + rng() * 0.7 });
      for (let t = 0; t < 120; t++) {
        ctx.advance(PHYSICS.tickMs);
        assert.ok(!outside(hole, b.x, b.y), `${hole.name}: ball at ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
        if (!(b.vx || b.vy)) break;
      }
    }
  }
});

test('a good putt drops; strokes count; a ball can only be hit when it has stopped', () => {
  const { ctx, game } = onHole(0); // Warm-up: a straight 14 units to the cup
  game.onInput(0, { type: 'shoot', angle: 0, power: 0.5 });
  game.onInput(0, { type: 'shoot', angle: Math.PI, power: 1 }); // still rolling: ignored
  ctx.advance(12000);
  const b = game.balls[0];
  assert.equal(b.strokes, 1);
  assert.ok(b.x > 3 && b.x < 17 && !b.holed, 'half power stops short');
  putt(ctx, game, 0, Math.atan2(6 - b.y, 17 - b.x), 0.6);
  assert.equal(b.holed, true);
  assert.equal(b.strokes, 2);
  assert.equal(game.hostView().balls[0].holed, true);
  for (const bad of [{ angle: NaN, power: 1 }, { angle: 0, power: 'x' }]) game.onInput(1, { type: 'shoot', ...bad });
  assert.equal(game.balls[1].strokes, 0);
});

test('water costs a stroke and puts you back where you shot from', () => {
  const { ctx, game } = onHole(5); // Water Hazard: a pond between tee and cup
  const b = game.balls[0];
  putt(ctx, game, 0, 0, 0.5);
  assert.equal(b.strokes, 2, 'the shot plus the penalty');
  assert.deepEqual([b.x, b.y], COURSE[5].tee);
  assert.ok(game.events.splashes >= 1);
});

test('sand slows the ball much more than the green', () => {
  const roll = (index, y) => {
    const { ctx, game } = onHole(index);
    const b = game.balls[0];
    b.x = 11;
    b.y = y;
    putt(ctx, game, 0, 0, 0.45);
    return b.x - 11;
  };
  const sandy = roll(4, 6); // Sand Trap: the trap sits at x 13.5 - 15.5
  const clean = roll(4, 3); // the same putt above the trap
  assert.ok(sandy < clean - 1, `sand ${sandy.toFixed(2)} vs green ${clean.toFixed(2)}`);
});

test('the windmill blade spins and knocks balls back', () => {
  const mill = COURSE[6].windmill;
  const [ax, ay, bx, by] = bladeOf(mill, 0);
  assert.deepEqual([ax, ay, bx, by], [mill.x - mill.len, mill.y, mill.x + mill.len, mill.y]);
  const { ctx, game } = onHole(6);
  // Freeze the blade across the gap and putt straight into it.
  game.holeStart = Infinity;
  game.millAngle = () => Math.PI / 2;
  const b = game.balls[0];
  putt(ctx, game, 0, 0, 0.6);
  assert.ok(b.x < mill.x, 'bounced back off the blade');
});

test('after MAX_STROKES you pick up; the hole ends when both are done; fewest strokes wins', () => {
  const ctx = fakeCtx();
  const game = new MiniGolf(ctx);
  game.start();
  game.onInput(0, { type: 'setting', key: 'holes', value: 3 });
  game.onInput(0, { type: 'go' });
  game.holes = [0, 2, 3];
  game.index = -1;
  game.nextHole();
  ctx.advance(TIMING.introMs + 50);
  // Player 2 taps the ball MAX_STROKES times without getting close.
  for (let i = 0; i < MAX_STROKES; i++) putt(ctx, game, 1, i % 2 ? Math.PI / 2 : -Math.PI / 2, 0.1);
  assert.equal(game.balls[1].done, true, 'picked up');
  assert.equal(game.phase, 'play', 'still waiting for player 1');
  // Player 1 holes out in two.
  putt(ctx, game, 0, 0, 0.5);
  const b = game.balls[0];
  putt(ctx, game, 0, Math.atan2(6 - b.y, 17 - b.x), 0.6);
  ctx.advance(100);
  assert.equal(game.phase, 'holeEnd');
  assert.deepEqual(game.card, [[2], [MAX_STROKES + 1]]);
  ctx.advance(TIMING.holeEndMs + 100);
  assert.equal(game.phase, 'intro');
  assert.equal(game.hostView().holeNo, 2);
  // Nobody plays the last two holes: time runs out and both pick up.
  for (let h = 0; h < 2; h++) ctx.advance(TIMING.introMs + TIMING.playMs + TIMING.holeEndMs + 200);
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.totals(), [2 + 2 * (MAX_STROKES + 1), 3 * (MAX_STROKES + 1)]);
  assert.equal(game.winner, 0);
  assert.deepEqual(game.hostView().scores, game.totals());
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'intro');
  assert.equal(game.holes.length, 3, 'rematch keeps the settings');
});

test('controllers: the stick aims, holding A charges, letting go shoots', () => {
  const { ctx, game } = onHole(0);
  const b = game.balls[1];
  game.onInput(1, { type: 'pad', x: 0, y: -1, turn: 0, charge: false });
  ctx.advance(100);
  assert.ok(Math.abs(b.aim.angle + Math.PI / 2) < 1e-9, 'aiming up the screen');
  game.onInput(1, { type: 'pad', x: 1, y: 0, turn: 0, charge: true });
  ctx.advance(PHYSICS.chargeMs / 4);
  assert.ok(b.aim.power > 0.4 && b.aim.power < 0.6, `power ${b.aim.power}`);
  game.onInput(1, { type: 'pad', x: 1, y: 0, turn: 0, charge: false });
  assert.equal(b.strokes, 1);
  assert.ok(b.vx > 0);
  // The D-pad turns the aim.
  ctx.advance(12000);
  const before = b.aim.angle;
  game.onInput(1, { type: 'pad', x: 0, y: 0, turn: 1, charge: false });
  ctx.advance(500);
  assert.ok(b.aim.angle > before + 0.5);
});

test('setup: pick 3, 6 or 9 holes (remembered), drawn from the course in order', () => {
  const ctx = fakeCtx();
  const game = new MiniGolf(ctx);
  game.start();
  assert.equal(game.hostView().phase, 'setup');
  assert.equal(game.settings.holes, 6);
  game.onInput(0, { type: 'setting', key: 'holes', value: 9 });
  game.onInput(0, { type: 'setting', key: 'holes', value: 4 }); // not a choice
  assert.equal(game.settings.holes, 9);
  assert.deepEqual(ctx.saved.settings, { holes: 9 });
  game.onInput(0, { type: 'go' });
  assert.deepEqual(game.holes, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  const three = pickHoles(3);
  assert.equal(three.length, 3);
  assert.deepEqual(three, three.slice().sort((a, b) => a - b));
  assert.equal(new Set(three).size, 3);
});
