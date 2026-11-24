import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Invaders, ALIENS, SHIP, FIELD, LIVES, TIMING } from '../server/solo/games/invaders.js';

function game() {
  const ctx = fakeCtx();
  const g = new Invaders(ctx, seeded(3));
  g.start();
  return { ctx, g };
}

test('a wave of 45 aliens marching sideways, then down at the edge', () => {
  const { ctx, g } = game();
  assert.equal(g.alive.length, ALIENS.cols * ALIENS.rows);
  const y = g.aliens[0].y;
  g.bombs = [];
  g.nextBomb = Infinity;
  ctx.advance(8000);
  assert.ok(g.aliens[0].y > y, 'stepped down after reaching an edge');
});

test('one shot at a time; a hit scores by row and the shot is spent', () => {
  const { ctx, g } = game();
  g.nextBomb = Infinity;
  const target = g.aliens.find((a) => a.row === ALIENS.rows - 1 && a.col === 4);
  g.shipX = target.x + ALIENS.w / 2;
  g.onInput({ type: 'fire' });
  const first = g.shot;
  g.onInput({ type: 'fire' });
  assert.equal(g.shot, first, 'no second shot while one is flying');
  ctx.advance(800);
  assert.equal(g.kills, 1);
  assert.equal(g.score, ALIENS.points[ALIENS.rows - 1]);
  assert.equal(g.shot, null);
});

test('the cannon follows the phone and the stick, inside the field', () => {
  const { ctx, g } = game();
  g.nextBomb = Infinity;
  g.onInput({ type: 'aim', x: 1 });
  ctx.advance(2000);
  assert.equal(g.shipX, FIELD.w - SHIP.w / 2);
  g.onInput({ type: 'axis', v: -1 });
  ctx.advance(2000);
  assert.equal(g.shipX, SHIP.w / 2);
  g.onInput({ type: 'aim', x: 'left' });
  g.onInput({ type: 'axis', v: NaN });
  assert.equal(g.axis, -1);
});

test('bombs cost lives; bunkers soak them up; no lives left ends it', () => {
  const { ctx, g } = game();
  const before = g.bunkers[0].cells.filter(Boolean).length;
  assert.ok(g.chewBunkers(g.bunkers[0].x + 3, 58, 1, 1)); // (its top corners are cut away)
  assert.ok(g.bunkers[0].cells.filter(Boolean).length < before);
  for (let life = LIVES; life > 0; life--) {
    g.bombs = [{ x: g.shipX, y: SHIP.y - 0.5 }];
    g.nextBomb = Infinity;
    ctx.advance(100);
    if (life > 1) {
      assert.equal(g.phase, 'hit');
      ctx.advance(TIMING.hitMs);
    }
  }
  assert.equal(g.phase, 'over');
  assert.equal(ctx.pendingTimers(), 0);
});

test('aliens reaching the bottom end it; clearing a wave brings the next, lower', () => {
  const { ctx, g } = game();
  for (const a of g.aliens) a.alive = false;
  g.aliens[0].alive = true;
  g.nextBomb = Infinity;
  const a = g.aliens[0];
  g.shipX = a.x + ALIENS.w / 2;
  g.dir = 0; // hold still for the shot
  for (const b of g.bunkers) b.cells.fill(false); // nothing in the way
  g.onInput({ type: 'fire' });
  ctx.advance(1000);
  assert.equal(g.phase, 'cleared');
  ctx.advance(TIMING.waveMs + 50);
  assert.equal(g.wave, 2);
  assert.ok(g.aliens[0].y > ALIENS.top);
  for (const al of g.aliens) al.y = SHIP.y;
  ctx.advance(50);
  assert.equal(g.phase, 'over');
});

test('pause freezes the march', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'pause' });
  const x = g.aliens[0].x;
  ctx.advance(3000);
  assert.equal(g.aliens[0].x, x);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'pause' });
  assert.equal(g.phase, 'play');
});
