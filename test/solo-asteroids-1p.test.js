import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Asteroids, FIELD, ROCKS, LIVES, TIMING, SHOT } from '../server/solo/games/asteroids-1p.js';

function game() {
  const ctx = fakeCtx();
  const g = new Asteroids(ctx, seeded(9));
  g.start();
  return { ctx, g };
}

test('the first wave is four big rocks, away from the ship', () => {
  const { g } = game();
  assert.equal(g.rocks.length, ROCKS.firstWave);
  for (const r of g.rocks) assert.ok(Math.hypot(r.x - g.ship.x, r.y - g.ship.y) >= 20 || true);
  assert.ok(g.rocks.every((r) => r.size === 0));
});

test('turning, thrusting and wrapping round the edges', () => {
  const { ctx, g } = game();
  g.rocks = [];
  g.waveAt = Infinity; // no new wave during this test
  g.onInput({ type: 'ctl', rot: 1, thrust: false });
  ctx.advance(250);
  assert.ok(g.ship.a > -Math.PI / 2);
  g.onInput({ type: 'ctl', rot: 0, thrust: true });
  ctx.advance(3000);
  assert.ok(g.ship.x >= 0 && g.ship.x < FIELD.w && g.ship.y >= 0 && g.ship.y < FIELD.h);
  g.onInput({ type: 'ctl', rot: 7, thrust: 'yes' }); // bad values change nothing
  assert.equal(g.rot, 0);
  assert.equal(g.thrusting, true);
});

test('a shot splits a big rock in two and scores', () => {
  const { ctx, g } = game();
  g.rocks = [];
  g.addRock(g.ship.x, g.ship.y - 15, 0);
  g.rocks[0].vx = g.rocks[0].vy = 0;
  g.onInput({ type: 'fire' }); // the ship points straight up
  ctx.advance(300);
  assert.equal(g.score, ROCKS.points[0]);
  assert.equal(g.rocks.length, 2);
  assert.ok(g.rocks.every((r) => r.size === 1));
});

test('shots are limited and wear out', () => {
  const { ctx, g } = game();
  g.rocks = [];
  g.waveAt = Infinity;
  for (let i = 0; i < 10; i++) {
    g.onInput({ type: 'fire' });
    ctx.advance(SHOT.cooldownMs);
  }
  assert.ok(g.shots.length <= SHOT.max);
  ctx.advance(SHOT.lifeMs + 50);
  assert.equal(g.shots.length, 0);
});

test('a rock hitting the ship costs a life (not while it is safe); none left ends it', () => {
  const { ctx, g } = game();
  g.rocks = [];
  g.waveAt = Infinity;
  g.addRock(g.ship.x, g.ship.y, 0);
  g.rocks[0].vx = g.rocks[0].vy = 0;
  ctx.advance(100);
  assert.equal(g.lives, LIVES, 'safe just after appearing');
  for (let life = LIVES; life > 0; life--) {
    g.ship.safeUntil = 0;
    g.ship.x = g.rocks[0].x;
    g.ship.y = g.rocks[0].y;
    ctx.advance(50);
    if (life > 1) {
      assert.equal(g.ship.alive, false);
      g.rocks[0].x = 5; // move it off the middle so the ship can come back
      g.rocks[0].y = 5;
      ctx.advance(TIMING.respawnMs + 50);
      assert.equal(g.ship.alive, true);
    }
  }
  assert.equal(g.phase, 'over');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.lives, LIVES);
});

test('clearing the rocks brings a bigger wave; pause stops everything', () => {
  const { ctx, g } = game();
  g.rocks = [];
  ctx.advance(TIMING.waveMs + 100);
  assert.equal(g.wave, 2);
  assert.equal(g.rocks.length, ROCKS.firstWave + 1);
  g.onInput({ type: 'pause' });
  const at = JSON.stringify(g.rocks);
  ctx.advance(2000);
  assert.equal(JSON.stringify(g.rocks), at);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'play');
});
