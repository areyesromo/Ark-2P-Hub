// Kart Race battle mode: three balloons each in a wide arena, items pop them, last one with
// balloons left wins the round (or the most when time runs out).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KartRace, ARENAS, BATTLE, FIELD, TIMING, ITEMS, ODDS, buildArena, pointAt } from '../server/games/kart-race.js';
import { rollItem, hazardCheck } from '../server/games/kart-items.js';
import { fakeCtx } from './helpers.js';

const TICK = 1000 / 60;

/** A battle in arena `arena` (1-based, as in the settings), past the lights. Every update builds every view. */
function battling({ arena = 1, races = 1, items = 1, rng = () => 0 } = {}) {
  const ctx = fakeCtx();
  let game = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (game) [game.hostView(), game.playerView(0), game.playerView(1)];
    update();
  };
  game = new KartRace(ctx, rng);
  game.start();
  for (const [key, value] of Object.entries({ mode: 1, arena, races, items })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  assert.equal(game.phase, 'race');
  return { ctx, game };
}

/** Run the clock a little (a few ticks). */
function ticks(ctx, n = 3) {
  for (let i = 0; i < n; i++) ctx.advance(TICK);
}

test('arenas: wide loops round an island, on the field, no bend tighter than half the road, the same both ways up', () => {
  assert.equal(ARENAS.length, 3);
  for (let i = 0; i < ARENAS.length; i++) {
    const a = buildArena(i);
    const reach = a.width / 2 + a.out + 0.3; // the barrier and its thickness
    for (const [x, y] of a.line) assert.ok(x >= reach && y >= reach && x <= FIELD.w - reach && y <= FIELD.h - reach, `${a.name} on the field`);
    assert.ok(a.width >= 5.5, `${a.name} is wide`);
    // A bend tighter than half the road would fold its inside edge over.
    const Road = globalThis.ArkKartTrack;
    assert.ok(Road.tightest(a.line).r > a.width / 2 + 0.2, `${a.name}: no bend folds over`);
    // Mirror image top to bottom (both karts start alike): p and 0.5 - p mirror each other, boxes too.
    for (let k = 0; k < 40; k++) {
      const p = pointAt(a, k / 40);
      const q = pointAt(a, 0.5 - k / 40);
      assert.ok(Math.hypot(p.x - q.x, p.y - (FIELD.h - q.y)) < 0.05, `${a.name} mirrors at ${k / 40}`);
    }
    const boxes = a.boxes.map(([p, off]) => pointAt(a, p, off));
    // (Within a tenth: the road's direction at the ends is sampled, so the side boxes tilt a hair.)
    for (const b of boxes) assert.ok(boxes.some((c) => Math.hypot(b.x - c.x, b.y - (FIELD.h - c.y)) < 0.1), `${a.name}: every box has its mirror`);
    assert.deepEqual(a.boosts, [], 'no boost pads');
  }
});

test('battle: three balloons each, karts start on opposite sides heading round opposite ways, boxes out even with items off, no coins', () => {
  const { game } = battling({ arena: 2, items: 0 });
  const [a, b] = game.karts;
  assert.equal(game.track.name, ARENAS[1].name);
  assert.deepEqual(game.karts.map((k) => k.balloons), [BATTLE.balloons, BATTLE.balloons]);
  assert.equal(BATTLE.balloons, 3);
  // Mirror images of each other, top and bottom, both facing the same way on screen.
  assert.ok(Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - (FIELD.h - b.y)) < 0.01);
  // Mirror images facing the same way on screen (so opposite ways round the loop).
  assert.ok(Math.abs(Math.sin(a.angle + b.angle)) < 1e-6 && Math.cos(a.angle) > 0.99 && Math.cos(b.angle) > 0.99, 'facing the same way on screen: opposite ways round');
  assert.ok(game.boxes.length >= 8, 'boxes');
  assert.equal(game.coins.length, 0);
  const v = game.playerView(0);
  assert.equal(v.battle.msLeft, BATTLE.ms - (game.ctx.now() - game.raceStart));
  assert.deepEqual(v.karts.map((k) => k.balloons), [3, 3]);
  assert.equal(v.itemsOn, true);
});

test('battle: a spin-out pops a balloon; a shield takes the hit instead; a web or a wall pops nothing', () => {
  const { ctx, game } = battling();
  const [a] = game.karts;
  game.hitKart(a, ctx.now());
  assert.equal(a.balloons, 2);
  assert.equal(game.events.pops, 1);
  ticks(ctx, 90); // the spin wears off
  a.shieldUntil = ctx.now() + 5000;
  game.hitKart(a, ctx.now());
  assert.equal(a.balloons, 2, 'shield');
  ticks(ctx, 60);
  // A web and an oil slick it drives into: caught, nothing popped.
  game.webs.push({ x: a.x, y: a.y, owner: 1, safeUntil: 0 });
  hazardCheck(game, a, 0, ctx.now());
  assert.ok(a.webUntil > ctx.now(), 'caught in the web');
  game.oils.push({ x: a.x, y: a.y, owner: 1, safeUntil: 0 });
  hazardCheck(game, a, 0, ctx.now());
  assert.ok(a.oilUntil > ctx.now(), 'oiled');
  // And a head-on wall hit.
  a.speed = 6;
  game.hit(a, Math.cos(a.angle), Math.sin(a.angle));
  assert.equal(a.balloons, 2);
});

test('battle: a Star ram pops a balloon, and so does your own Bouncer once it is flying', () => {
  const { ctx, game } = battling();
  const [a, b] = game.karts;
  b.starUntil = ctx.now() + 5000;
  Object.assign(b, { x: a.x - 0.8, y: a.y, angle: a.angle, speed: 0 });
  a.speed = 0;
  ticks(ctx, 1);
  assert.equal(a.balloons, 2, 'rammed');
  assert.equal(b.balloons, 3);
  ticks(ctx, 90);
  // Your own Bouncer, back at you after its safe moment.
  b.starUntil = 0;
  Object.assign(b, { x: a.x + 6, y: a.y });
  game.shots.push({ kind: 'bouncer', x: a.x + 0.9, y: a.y, angle: Math.PI, speed: 12, owner: 0, bornAt: ctx.now() - 1000, until: ctx.now() + 3000 });
  ticks(ctx, 2);
  assert.equal(a.balloons, 1);
});

test('battle: lose your last balloon and the round is the other player\'s', () => {
  const { ctx, game } = battling({ races: 3 });
  const [a] = game.karts;
  a.balloons = 1;
  game.hitKart(a, ctx.now());
  ticks(ctx, 1);
  assert.equal(game.phase, 'finish');
  assert.deepEqual(game.result, { winner: 1, time: game.result.time, draw: false });
  assert.deepEqual(game.scores, [0, 1]);
  // Nothing more happens in the moment after: no more pops, no items.
  const b = game.karts[1];
  game.hitKart(b, ctx.now());
  assert.equal(b.balloons, 3);
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'standings');
  assert.equal(game.history[0].winner, 1);
  assert.match(game.hostView().next.track, /./);
});

test('battle: both last balloons popped in the same moment (one bomb) is a draw round: nobody scores, play another', () => {
  const { ctx, game } = battling({ races: 1 });
  const [a, b] = game.karts;
  a.balloons = b.balloons = 1;
  // Side by side, a bomb going off between them.
  Object.assign(b, { x: a.x + 1.2, y: a.y, angle: a.angle, speed: 0 });
  Object.assign(a, { speed: 0 });
  game.shots.push({ kind: 'bomb', x: a.x + 0.6, y: a.y, angle: 0, owner: 0, bornAt: ctx.now(), until: ctx.now() });
  ticks(ctx, 1);
  assert.deepEqual([a.balloons, b.balloons], [0, 0]);
  assert.equal(game.result.draw, true);
  assert.equal(game.result.winner, null);
  assert.deepEqual(game.scores, [0, 0]);
  ctx.advance(TIMING.finishMs + 100);
  assert.equal(game.phase, 'standings', 'a one-round battle that ends level goes on');
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.karts.map((k) => k.balloons), [3, 3], 'fresh balloons');
});

test('battle: when time runs out, more balloons wins; level is a draw round', () => {
  const t1 = battling({ races: 3 });
  t1.game.karts[1].balloons = 2;
  t1.ctx.advance(BATTLE.ms + 50);
  assert.equal(t1.game.result.winner, 0);
  assert.deepEqual(t1.game.scores, [1, 0]);

  const t2 = battling({ races: 3 });
  t2.ctx.advance(t2.game.raceStart + BATTLE.ms - 500 - t2.ctx.now());
  assert.equal(t2.game.phase, 'race', 'still going just before the end');
  t2.ctx.advance(600);
  assert.equal(t2.game.result.draw, true);
  assert.deepEqual(t2.game.scores, [0, 0]);
});

test('battle: rounds to win: one battle, best of 3, first to 3; a match ends with the winner in the view', () => {
  const g = battling({ races: 3 });
  assert.equal(g.game.winScore, 2);
  for (let round = 0; round < 2; round++) {
    g.game.karts[0].balloons = 1;
    g.game.hitKart(g.game.karts[0], g.ctx.now());
    g.ctx.advance(TIMING.finishMs + 100);
    if (round === 0) {
      g.game.onInput(0, { type: 'go' });
      g.game.onInput(1, { type: 'go' });
      g.ctx.advance(TIMING.countdownMs + 50);
    }
  }
  assert.equal(g.game.phase, 'over');
  assert.equal(g.game.hostView().winner, 1);
  assert.deepEqual(g.game.hostView().scores, [0, 2]);
  assert.equal(battling({ races: 4 }).game.winScore, 3);
  assert.equal(battling({ races: 4 }).game.cup, false, 'no cup in battle');
});

test('battle: a draw round inside a best of 3 scores nobody, and the match goes on to a real winner', () => {
  const g = battling({ races: 3 });
  const next = () => {
    g.ctx.advance(TIMING.finishMs + 100);
    if (g.game.phase !== 'standings') return;
    g.game.onInput(0, { type: 'go' });
    g.game.onInput(1, { type: 'go' });
    g.ctx.advance(TIMING.countdownMs + 50);
  };
  const pop = (slot) => {
    g.game.karts[slot].balloons = 1;
    g.game.hitKart(g.game.karts[slot], g.ctx.now());
  };
  pop(0);
  next(); // 0-1
  g.ctx.advance(g.game.raceStart + BATTLE.ms + 50 - g.ctx.now()); // level at the bell: a draw
  assert.equal(g.game.result.draw, true);
  next();
  assert.deepEqual(g.game.scores, [0, 1]);
  pop(1);
  next(); // 1-1
  pop(0);
  next(); // 1-2
  assert.equal(g.game.phase, 'over');
  const v = g.game.hostView();
  assert.equal(v.winner, 1);
  assert.deepEqual(v.scores, [1, 2]);
  assert.deepEqual(v.history.map((h) => h.winner), [1, null, 0, 1]);
});

test('battle: a box both karts reach in the same tick goes to the nearer one; a dead heat alternates', () => {
  const { ctx, game } = battling();
  const [a, b] = game.karts;
  const box = game.boxes.find((x) => x.double);
  const set = (da, db) => {
    for (const k of game.karts) Object.assign(k, { items: [], speed: 0, angle: 0, spinUntil: 0 });
    Object.assign(a, { x: box.x, y: box.y - da });
    Object.assign(b, { x: box.x, y: box.y + db });
    box.backAt = 0;
    ticks(ctx, 1);
    return [a.items.length, b.items.length];
  };
  assert.deepEqual(set(0.6, 0.55), [0, 2], 'the nearer kart (slot 2) gets it');
  assert.deepEqual(set(0.55, 0.6), [2, 0]);
  const first = set(0.58, 0.58);
  const second = set(0.58, 0.58);
  assert.notDeepEqual(first, second, 'dead heats take turns');
  assert.deepEqual([first[0] + first[1], second[0] + second[1]], [2, 2]);
});

test('battle: items come from the battle list, with the same odds for both players however many balloons they have', () => {
  const { game } = battling();
  game.karts[0].balloons = 1;
  const seen = [new Set(), new Set()];
  for (let i = 0; i < 400; i++) {
    const r = (i + 0.5) / 400;
    game.rng = () => r;
    for (const slot of [0, 1]) seen[slot].add(rollItem(game, slot));
  }
  assert.deepEqual([...seen[0]].sort(), [...seen[1]].sort());
  assert.deepEqual([...seen[0]].sort(), Object.keys(ODDS.battle).sort());
  for (const kind of ['coinbag', 'swap', 'magnet']) assert.ok(!(kind in ODDS.battle), kind);
});

test('battle: a Seeker heads round the short way to the rival', () => {
  const { ctx, game } = battling({ arena: 1 });
  const [a, b] = game.karts;
  const at = (k, p) => Object.assign(k, pointAt(game.track, p), { speed: 0, progress: p, seg: Math.round(p * 240) % 240 });
  at(a, 0.1);
  at(b, 0.0); // just behind a, the "wrong" way round the loop
  a.angle = pointAt(game.track, 0.1).angle; // facing on round, away from b
  a.items = ['seeker'];
  game.useItem(0);
  let hit = false;
  for (let i = 0; i < 60 && !hit; i++) {
    ctx.advance(TICK);
    hit = b.balloons < 3;
  }
  assert.ok(hit, 'the Seeker turned back and hit b within a second');
});

test('battle: no laps, no shortcuts; driving across the start does nothing', () => {
  const { ctx, game } = battling();
  const a = game.karts[0];
  game.onInput(0, { type: 'drive', steer: 0, gas: true });
  ctx.advance(3000);
  assert.equal(a.laps, 0);
  assert.equal(game.events.cuts, 0);
  assert.equal(game.phase, 'race');
});

test('battle: a rematch starts with full balloons and the clock reset', () => {
  const g = battling({ races: 1 });
  g.game.karts[0].balloons = 1;
  g.game.hitKart(g.game.karts[0], g.ctx.now());
  g.ctx.advance(TIMING.finishMs + 100);
  assert.equal(g.game.phase, 'over');
  g.game.onInput(0, { type: 'rematch' });
  g.game.onInput(1, { type: 'rematch' });
  g.ctx.advance(TIMING.countdownMs + 50);
  assert.equal(g.game.phase, 'race');
  assert.deepEqual(g.game.karts.map((k) => k.balloons), [3, 3]);
  assert.deepEqual(g.game.scores, [0, 0]);
  assert.equal(g.game.playerView(0).battle.msLeft, BATTLE.ms - (g.ctx.now() - g.game.raceStart));
  assert.ok(g.ctx.now() - g.game.raceStart < 2000);
});

test('the setup offers Race and Battle, and the arenas; race mode is unchanged (no balloons, no battle clock)', () => {
  const ctx = fakeCtx();
  const game = new KartRace(ctx, () => 0);
  game.start();
  const v = game.hostView();
  assert.deepEqual(v.options.mode, [0, 1]);
  assert.deepEqual(v.options.arena, [0, 1, 2, 3]);
  assert.equal(v.settings.mode, 0, 'racing by default');
  assert.deepEqual(v.arenaNames, ARENAS.map((a) => a.name));
  assert.equal(v.arenaPoints.length, 3);
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  // The grid as before: side by side just past the line.
  for (const [slot, k] of game.karts.entries()) {
    const p = pointAt(game.track, 0.012, slot === 0 ? -0.75 : 0.75);
    assert.ok(Math.hypot(k.x - p.x, k.y - p.y) < 1e-9 && k.progress === 0.012 && k.angle === p.angle);
  }
  ctx.advance(TIMING.countdownMs + 50);
  const r = game.hostView();
  assert.equal(r.battle, null);
  assert.equal(r.karts[0].balloons, undefined);
  assert.ok(game.coins.length > 0);
  // ...and the race's own item odds, by place.
  game.rng = () => 0.999;
  assert.equal(rollItem(game, 0), Object.keys(ODDS.first).at(-1));
  assert.equal(rollItem(game, 1), Object.keys(ODDS.second).at(-1));
});

test('battle: a random arena is never the same twice in a row', () => {
  // (An rng that always says 0 would pick the same arena again if it could.)
  const g = battling({ arena: 0, races: 3, rng: () => 0 });
  const seen = [g.game.track.name];
  for (let round = 0; round < 1; round++) {
    g.game.karts[0].balloons = 1;
    g.game.hitKart(g.game.karts[0], g.ctx.now());
    g.ctx.advance(TIMING.finishMs + 100);
    g.game.onInput(0, { type: 'go' });
    g.game.onInput(1, { type: 'go' });
    seen.push(g.game.track.name);
  }
  assert.notEqual(seen[0], seen[1]);
  assert.ok(ARENAS.some((a) => a.name === seen[1]));
});
