import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarbleMaze, LEVELS, TIMING, PHYSICS, MARBLE, parseLevel, shortestPath } from '../server/games/marble-maze.js';
import { fakeCtx } from './helpers.js';

function playing(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const game = new MarbleMaze(ctx);
  game.start();
  ctx.advance(TIMING.introMs + 20);
  assert.equal(game.phase, 'play');
  return { ctx, game };
}

/** Run the physics for `ms`, a tick at a time (onTick can steer). */
function run(ctx, ms, onTick) {
  for (let t = 0; t < ms; t += PHYSICS.tickMs) {
    if (onTick && onTick() === false) return;
    ctx.advance(PHYSICS.tickMs);
  }
}

/** Steer like two careful players: P1 handles left/right, P2 forwards/back, aiming at the next cell on the shortest path. */
function autopilot(game) {
  const m = game.marble;
  const map = game.level.map;
  const cx = Math.floor(m.x);
  const cy = Math.floor(m.y);
  // Breadth-first from the goal, so each cell knows its distance to it.
  let goal;
  map.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'G') goal = [x, y]; }));
  const dist = new Map([[goal.join(), 0]]);
  const q = [goal];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = x + dx + ',' + (y + dy);
      const c = map[y + dy] && map[y + dy][x + dx];
      if (!c || c === '#' || c === 'O' || dist.has(k)) continue;
      dist.set(k, dist.get(x + ',' + y) + 1);
      q.push([x + dx, y + dy]);
    }
  }
  let best = [cx, cy];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const d = dist.get(cx + dx + ',' + (cy + dy));
    if (d !== undefined && d < (dist.get(best.join()) ?? Infinity)) best = [cx + dx, cy + dy];
  }
  const tx = best[0] + 0.5;
  const ty = best[1] + 0.5;
  const steer = (err, v) => Math.max(-1, Math.min(1, err * 1.6 - v * 0.9));
  game.onInput(0, { type: 'move', x: steer(tx - m.x, m.vx), y: 0 });
  game.onInput(1, { type: 'move', x: 0, y: steer(ty - m.y, m.vy) });
}

test('every maze parses and can be solved without crossing a hole', () => {
  assert.equal(LEVELS.length, 5);
  for (const l of LEVELS) {
    const p = parseLevel(l);
    assert.ok(l.map.every((r) => r.length === p.w), l.name + ': rectangular');
    assert.ok(p.start && p.goal, l.name + ': has S and G');
    assert.ok(p.path > 0, l.name + ': solvable');
    assert.ok(l.map[0].split('').every((c) => c === '#') && l.map.at(-1).split('').every((c) => c === '#'), l.name + ': walled');
    assert.ok(l.map.every((r) => r[0] === '#' && r.at(-1) === '#'));
  }
  assert.equal(shortestPath(['#####', '#SOG#', '#####']), null, 'a hole across a corridor blocks it');
});

test('tilting rolls the marble; walls stop it', () => {
  const { ctx, game } = playing();
  const x0 = game.marble.x;
  game.onInput(0, { type: 'move', x: 1, y: 0 });
  run(ctx, 400);
  assert.ok(game.marble.x > x0 + 0.2, 'rolls right');
  assert.ok(game.tilt.x > 0.7, 'the board tilts');
  run(ctx, 4000);
  // First roll: S is at column 1, the first wall to the right is column 6.
  assert.ok(game.marble.x <= 6 - MARBLE.r + 1e-6, 'stopped by the wall');
  assert.ok(game.marble.y > 1 && game.marble.y < 2, 'still in its row');
});

test('split controls: player 1 only tilts left/right, player 2 only forwards/back; shared adds both', () => {
  const { game } = playing();
  game.onInput(1, { type: 'move', x: 1, y: 0.5 });
  game.onInput(0, { type: 'move', x: -0.5, y: 1 });
  assert.deepEqual(game.target(), { x: -0.5, y: 0.5 });
  assert.deepEqual(game.playerView(0).axis, 'x');
  assert.deepEqual(game.playerView(1).axis, 'y');
  const { game: g2 } = playing({ controls: 2 });
  g2.onInput(0, { type: 'move', x: 0.5, y: 0.2 });
  g2.onInput(1, { type: 'move', x: 0.7, y: -0.6 });
  const t = g2.target();
  assert.deepEqual([t.x, Math.round(t.y * 10) / 10], [1, -0.4]);
  assert.equal(g2.playerView(1).axis, 'both');
});

test('two careful players clear every maze; a hole costs a respawn; stars by time', () => {
  const { ctx, game } = playing({ levels: 5 });
  for (let i = 0; i < 5; i++) {
    assert.equal(game.levelIndex, i);
    run(ctx, 100000, () => {
      if (game.phase === 'clear') return false;
      autopilot(game);
    });
    assert.equal(game.phase, 'clear', LEVELS[i].name + ' cleared');
    assert.ok(game.result.cleared);
    assert.ok(game.result.stars >= 2, LEVELS[i].name + ': ' + game.result.ms + ' ms, par ' + game.level.parMs);
    ctx.advance(TIMING.clearMs + 20);
    if (i < 4) ctx.advance(TIMING.introMs + 20);
  }
  assert.equal(game.phase, 'over');
  const v = game.hostView();
  assert.equal(v.history.length, 5);
  assert.equal(v.maxStars, 15);
  assert.ok(v.stars >= 10);
  assert.equal(ctx.pendingTimers(), 0);
});

test('falling down a hole: the marble sinks, then starts again; running out of time scores nothing', () => {
  const { ctx, game } = playing({ levels: 3 });
  // On to Swiss cheese, which has holes, and put the marble on one.
  game.endLevel(true);
  ctx.advance(TIMING.clearMs + TIMING.introMs + 40);
  assert.equal(game.level.name, 'Swiss cheese');
  const hole = parseLevel(LEVELS[1]).holes[0];
  game.marble.x = hole.x + 0.1;
  game.marble.y = hole.y;
  ctx.advance(PHYSICS.tickMs * 2);
  assert.equal(game.phase, 'fall');
  assert.equal(game.falls, 1);
  ctx.advance(TIMING.fallMs + 40);
  assert.equal(game.phase, 'play');
  assert.deepEqual([game.marble.x, game.marble.y], [1.5, 1.5], 'back at the start');
  ctx.advance(TIMING.levelMs + 40);
  assert.equal(game.phase, 'clear');
  assert.deepEqual([game.result.cleared, game.result.stars], [false, 0]);
});
