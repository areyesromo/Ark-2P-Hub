// Tower Defence Duel: build towers on your side, send creeps to theirs; lose all your lives and you lose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { TowerDuel, GRID, PATH, pathTiles, TOWERS, CREEPS, ECONOMY, TIMING, pointAt, pathLength, waveOf, MAX_SENT } from '../server/games/tower-duel.js';
import { getGame } from '../server/games/index.js';

/** A game past the countdown, every update building every view (as the room does). */
function duel({ lives = 20 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { lives };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new TowerDuel(ctx, () => 0.5);
  g.start();
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(g.phase, 'play');
  return { ctx, g };
}

/** A free (non-path) tile next to the path, near distance d along it. */
function besidePath(d) {
  const path = pathTiles();
  const p = pointAt(d);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
    const x = Math.floor(p.x) + dx;
    const y = Math.floor(p.y) + dy;
    if (x >= 0 && y >= 0 && x < GRID.w && y < GRID.h && !path.has(x + ',' + y)) return [x, y];
  }
  throw new Error('no tile');
}

const creep = (g, side, kind, d = 0) => {
  const c = g.spawn(side, kind);
  c.d = d;
  return c;
};

test('the path: one winding road from the top edge to the base at the bottom, the same on both sides', () => {
  assert.ok(PATH.length >= 4);
  assert.ok(PATH[0][1] < 0, 'comes in over the top edge');
  assert.ok(PATH[PATH.length - 1][1] > GRID.h - 1, 'ends at the base, off the bottom');
  for (let i = 1; i < PATH.length; i++) assert.ok(PATH[i][0] === PATH[i - 1][0] || PATH[i][1] === PATH[i - 1][1], 'straight runs');
  const tiles = pathTiles();
  assert.ok(tiles.size > 20 && tiles.size < GRID.w * GRID.h / 2);
  for (const k of tiles) {
    const [x, y] = k.split(',').map(Number);
    assert.ok(x >= 0 && y >= 0 && x < GRID.w && y < GRID.h, k);
  }
  assert.ok(pathLength() > GRID.h * 2, 'a long road');
  const { g } = duel();
  assert.deepEqual(g.hostView().path, PATH, 'both sides draw the same road');
});

test('building: on your own free tiles only, paid in gold; never on the road, a tower or off the grid', () => {
  const { g } = duel();
  const s = g.sides[0];
  const gold = s.gold;
  const [x, y] = besidePath(3);
  g.onInput(0, { type: 'build', x, y, kind: 'arrow' });
  assert.equal(s.gold, gold - TOWERS.arrow.cost);
  assert.deepEqual(g.hostView().sides[0].towers, [{ x, y, kind: 'arrow', level: 1 }]);
  assert.deepEqual(g.hostView().sides[1].towers, [], 'your side only');
  const [px, py] = [...pathTiles()][5].split(',').map(Number);
  for (const bad of [{ x, y, kind: 'arrow' }, { x: px, y: py, kind: 'arrow' }, { x: -1, y: 0, kind: 'arrow' }, { x: GRID.w, y: 0, kind: 'arrow' },
    { x: 0.5, y: 0, kind: 'arrow' }, { x: 0, y: 0, kind: 'laser' }, { x: '1', y: 0, kind: 'arrow' }]) {
    g.onInput(0, { type: 'build', ...bad });
  }
  assert.equal(g.hostView().sides[0].towers.length, 1);
  s.gold = TOWERS.cannon.cost - 1;
  const [x2, y2] = besidePath(10);
  g.onInput(0, { type: 'build', x: x2, y: y2, kind: 'cannon' });
  assert.equal(g.hostView().sides[0].towers.length, 1, 'not enough gold');
});

test('upgrading (twice at most) and selling (for part of what you paid)', () => {
  const { g } = duel();
  const s = g.sides[0];
  s.gold = 1000;
  const [x, y] = besidePath(3);
  g.onInput(0, { type: 'build', x, y, kind: 'frost' });
  g.onInput(0, { type: 'upgrade', x, y, level: 1 });
  g.onInput(0, { type: 'upgrade', x, y, level: 1 }); // a double tap: already level 2
  assert.equal(g.hostView().sides[0].towers[0].level, 2, 'one upgrade for one tap');
  g.onInput(0, { type: 'upgrade', x, y }); // no level: ignored
  assert.equal(g.hostView().sides[0].towers[0].level, 2);
  g.onInput(0, { type: 'upgrade', x, y, level: 2 });
  g.onInput(0, { type: 'upgrade', x, y, level: 3 });
  const t = g.hostView().sides[0].towers[0];
  assert.equal(t.level, 3);
  const spent = TOWERS.frost.cost + TOWERS.frost.upgrade[0] + TOWERS.frost.upgrade[1];
  assert.equal(s.gold, 1000 - spent);
  g.onInput(0, { type: 'sell', x, y });
  assert.equal(s.gold, 1000 - spent + Math.floor(spent * ECONOMY.refund));
  assert.deepEqual(g.hostView().sides[0].towers, []);
  g.onInput(1, { type: 'sell', x, y }); // nothing of theirs there
  assert.equal(g.sides[1].gold, ECONOMY.startGold);
});

test('sending creeps: paid in gold, they appear on your rival\'s road, and your income goes up as each one sets off', () => {
  const { ctx, g } = duel();
  const me = g.sides[0];
  me.gold = 100;
  const income = me.income;
  g.onInput(0, { type: 'send', kind: 'brute' });
  assert.equal(me.gold, 100 - CREEPS.brute.cost);
  assert.equal(me.income, income, 'not until it sets off');
  ctx.advance(100);
  assert.equal(me.income, income + CREEPS.brute.income);
  g.onInput(0, { type: 'send', kind: 'swarm' });
  ctx.advance(3000);
  const theirs = g.sides[1].creeps;
  assert.equal(theirs.filter((c) => c.kind === 'brute').length, 1);
  assert.equal(theirs.filter((c) => c.kind === 'swarm').length, CREEPS.swarm.count);
  assert.equal(g.sides[0].creeps.length, 0, 'none on your own road');
  me.gold = 1;
  g.onInput(0, { type: 'send', kind: 'runner' });
  assert.equal(me.gold, 1, 'can\'t afford it');
  g.onInput(0, { type: 'send', kind: 'dragon' });
  assert.equal(me.gold, 1);
});

test('a road holds only so many sent creeps waiting at once: no banking a huge income from a queue that never arrives', () => {
  const { g } = duel();
  const me = g.sides[0];
  me.gold = 100000;
  for (let i = 0; i < 200; i++) g.onInput(0, { type: 'send', kind: 'runner' });
  assert.equal(g.sides[1].queue.length, MAX_SENT);
  assert.equal(me.gold, 100000 - MAX_SENT * CREEPS.runner.cost, 'paid only for the ones sent');
});

test('house waves come on time to both roads, whatever has been sent down them', () => {
  const { ctx, g } = duel();
  g.sides[0].gold = 100000;
  for (let i = 0; i < 40; i++) g.onInput(0, { type: 'send', kind: 'swarm' });
  ctx.advance(TIMING.firstWaveMs + 100);
  const house = (side) => g.sides[side].creeps.filter((c) => c.house).length;
  assert.ok(house(0) >= 1 && house(1) >= 1, 'both roads, straight away: ' + house(0) + ' / ' + house(1));
  assert.equal(house(0), house(1));
});

test('the countdown counts down on the screens', () => {
  const ctx = fakeCtx();
  const g = new TowerDuel(ctx, () => 0.5);
  const seen = new Set();
  const update = ctx.update.bind(ctx);
  ctx.update = () => { seen.add(g.hostView().countdown); update(); };
  g.start();
  ctx.advance(TIMING.countdownMs + 50);
  assert.ok(seen.has(3) && seen.has(2) && seen.has(1), [...seen].join());
});

test('the house waves get tougher fast enough that every game ends', () => {
  const w10 = waveOf(10);
  const w30 = waveOf(30);
  assert.ok(w30.hpScale > 10 * w10.hpScale, 'much tougher later on');
  assert.ok(w30.spacingMs < waveOf(1).spacingMs, 'and closer together');
  // Twenty waves of a road full of top-level cannons: the base still falls.
  const { ctx, g } = duel({ lives: 30 });
  g.sides[0].gold = g.sides[1].gold = 1e9;
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      for (const slot of [0, 1]) {
        g.onInput(slot, { type: 'build', x, y, kind: 'cannon' });
        g.onInput(slot, { type: 'upgrade', x, y, level: 1 });
        g.onInput(slot, { type: 'upgrade', x, y, level: 2 });
      }
    }
  }
  for (let t = 0; t < 40 * 60000 && g.phase === 'play'; t += 5000) ctx.advance(5000);
  assert.equal(g.phase, 'over', 'over within 40 minutes, at wave ' + g.wave);
});

test('income comes in every few seconds', () => {
  const { ctx, g } = duel();
  const s = g.sides[1];
  const gold = s.gold;
  ctx.advance(ECONOMY.incomeEveryMs + 20);
  assert.equal(s.gold, gold + s.income);
});

test('a creep that reaches your base costs lives (a brute costs two)', () => {
  const { ctx, g } = duel({ lives: 20 });
  const len = pathLength();
  creep(g, 0, 'runner', len - 0.05);
  creep(g, 0, 'brute', len - 0.05);
  ctx.advance(200);
  assert.equal(g.sides[0].lives, 20 - CREEPS.runner.lives - CREEPS.brute.lives);
  assert.equal(CREEPS.brute.lives, 2);
  assert.equal(g.sides[0].creeps.length, 0);
});

test('towers shoot the creep furthest along in range; a kill pays its bounty to the defender', () => {
  const { ctx, g } = duel();
  const s = g.sides[1];
  s.gold = 1000;
  const [x, y] = besidePath(6);
  g.onInput(1, { type: 'build', x, y, kind: 'arrow' });
  const near = creep(g, 1, 'runner', 5.5);
  const further = creep(g, 1, 'runner', 6.2);
  near.speed = further.speed = 0; // stand still for the test
  const gold = s.gold;
  ctx.advance(TOWERS.arrow.every[0] + 60);
  assert.ok(further.hp < further.max, 'the one further along is hit first');
  assert.equal(near.hp, near.max);
  ctx.advance(4000);
  assert.ok(!s.creeps.includes(further) && !s.creeps.includes(near));
  assert.equal(s.gold, gold + 2 * CREEPS.runner.bounty, 'the bounties (no income tick in between)');
  assert.equal(g.sides[0].creeps.length, 0);
});

test('a cannon hits everything close to its target; frost slows', () => {
  const { ctx, g } = duel();
  const s = g.sides[0];
  s.gold = 1000;
  const [x, y] = besidePath(8);
  g.onInput(0, { type: 'build', x, y, kind: 'cannon' });
  const a = creep(g, 0, 'brute', 8);
  const b = creep(g, 0, 'brute', 8.3);
  a.speed = b.speed = 0;
  ctx.advance(TOWERS.cannon.every[0] + 60);
  assert.ok(a.hp < a.max && b.hp < b.max, 'splash');
  const { g: h, ctx: c2 } = duel();
  h.sides[0].gold = 1000;
  const [fx, fy] = besidePath(8);
  h.onInput(0, { type: 'build', x: fx, y: fy, kind: 'frost' });
  const r = creep(h, 0, 'runner', 8);
  c2.advance(TOWERS.frost.every[0] + 60);
  assert.ok(r.slowUntil > c2.now());
  const before = r.d;
  c2.advance(500);
  assert.ok(r.d - before < CREEPS.runner.speed * 0.5 * 0.8, 'slowed');
});

test('house waves come to both roads alike, a little stronger each time', () => {
  const { ctx, g } = duel();
  ctx.advance(TIMING.firstWaveMs);
  ctx.advance(3000);
  const a = g.sides[0].creeps.map((c) => [c.kind, c.max]);
  const b = g.sides[1].creeps.map((c) => [c.kind, c.max]);
  assert.ok(a.length > 0);
  assert.deepEqual(a, b, 'the same for both');
  const first = Math.max(...a.map((x) => x[1]));
  ctx.advance(TIMING.waveEveryMs * 3);
  const later = Math.max(...g.sides[0].creeps.filter((c) => c.house).map((c) => c.max));
  assert.ok(later > first, 'stronger');
  assert.ok(g.hostView().wave >= 4);
});

test('out of lives: the other player wins; both at once is a draw; it ends once, with nothing left running', () => {
  const { ctx, g } = duel({ lives: 10 });
  g.sides[0].lives = 1;
  creep(g, 0, 'runner', pathLength() - 0.01);
  ctx.advance(200);
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().winner, 1);
  assert.deepEqual(g.hostView().scores, [0, 10]);
  assert.equal(ctx.pendingTimers(), 0);
  const d = duel();
  d.g.sides[0].lives = d.g.sides[1].lives = 1;
  creep(d.g, 0, 'runner', pathLength() - 0.01);
  creep(d.g, 1, 'runner', pathLength() - 0.01);
  d.ctx.advance(200);
  assert.equal(d.g.phase, 'over');
  assert.equal(d.g.hostView().winner, null);
  // Rematch.
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'countdown');
  assert.deepEqual(g.sides.map((s) => [s.lives, s.gold, s.income, s.creeps.length, s.queue.length, Object.keys(s.towers).length]), [[10, ECONOMY.startGold, ECONOMY.income, 0, 0, 0], [10, ECONOMY.startGold, ECONOMY.income, 0, 0, 0]]);
  assert.equal(g.wave, 0);
  assert.equal(ctx.pendingTimers(), 1, 'the clock runs again');
});

test('nothing happens outside play; bad input is ignored', () => {
  const ctx = fakeCtx();
  const g = new TowerDuel(ctx, () => 0.5);
  g.start();
  const [x, y] = besidePath(3);
  g.onInput(0, { type: 'build', x, y, kind: 'arrow' });
  g.onInput(0, { type: 'send', kind: 'runner' });
  assert.equal(g.sides[0].gold, ECONOMY.startGold, 'not during the countdown');
  ctx.advance(TIMING.countdownMs + 10);
  g.onInput(5, { type: 'send', kind: 'runner' });
  g.onInput(0, { type: 'upgrade', x: 99, y: 99 });
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.sides.map((s) => s.gold), [ECONOMY.startGold, ECONOMY.startGold]);
});

test('in the lobby: a head-to-head game with phones or controllers, and the lives to pick', () => {
  const def = getGame('tower-duel');
  assert.ok(!def.phoneOnly);
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"lives"'));
  assert.ok(setup.includes('20 lives') && setup.includes('10 lives') && setup.includes('30 lives'));
});
