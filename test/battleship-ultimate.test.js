// Ultimate Battleship: commanders with their own fleets (angled shapes too), seas with terrain,
// ship skills paid with energy, and a commander's special charged by hits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import {
  UltimateBattleship, SEAS, SEA_IDS, COMMANDERS, COMMANDER_IDS, SKILLS, ENERGY, UTIMING,
  shapeCells, placedCells, validFleet, randomFleet, terrain,
} from '../server/games/battleship-ultimate.js';

// Vega's fleet laid out in rows down the left of the open sea: Carrier on row 0, Battleship
// row 2, Cruiser row 4, Submarine row 6, Destroyer row 8, Patrol Boat at (9, 9).
const VEGA_ROWS = [{ x: 0, y: 0, rot: 0 }, { x: 0, y: 2, rot: 0 }, { x: 0, y: 4, rot: 0 }, { x: 0, y: 6, rot: 0 }, { x: 0, y: 8, rot: 0 }, { x: 9, y: 9, rot: 0 }];

/** A game on `sea`, both commanders picked and both fleets placed; player 1 (slot 0) to fire. */
function battle({ sea = 'open', commanders = ['vega', 'vega'], fleets = [VEGA_ROWS, VEGA_ROWS], turnMs } = {}) {
  const ctx = fakeCtx();
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new UltimateBattleship(ctx, () => 0.3, { sea, turnMs });
  g.start();
  g.onInput(0, { type: 'commander', id: commanders[0] });
  g.onInput(1, { type: 'commander', id: commanders[1] });
  g.onInput(0, { type: 'ready', ships: fleets[0] });
  g.onInput(1, { type: 'ready', ships: fleets[1] });
  assert.equal(g.phase, 'aim');
  return { ctx, g };
}

/** Let the pause after an action run out (the turn passes). */
const next = (h) => h.ctx.advance(UTIMING.shotMs + 10);

test('shapes turn four ways (an L, a T and a Z look different each way); every fleet is about the same size', () => {
  const key = (cells) => JSON.stringify(cells.slice().sort());
  for (const shape of ['L5', 'T5', 'Z5', 'L4']) {
    const turns = new Set([0, 1, 2, 3].map((r) => key(shapeCells(shape, r))));
    assert.ok(turns.size >= 2, shape);
  }
  assert.equal(new Set([0, 1, 2, 3].map((r) => key(shapeCells('L5', r)))).size, 4);
  for (const id of COMMANDER_IDS) {
    const c = COMMANDERS[id];
    const cells = c.fleet.reduce((n, e) => n + shapeCells(e.shape, 0).length, 0);
    assert.ok(cells >= 17 && cells <= 18, id + ': ' + cells + ' cells');
    assert.ok(c.fleet.some((e) => e.skill), id);
    assert.ok(c.special.charge >= 4, id);
  }
  assert.equal(COMMANDER_IDS.length, 5);
  assert.ok(COMMANDER_IDS.some((id) => COMMANDERS[id].fleet.some((e) => /^[LTZO]/.test(e.shape))), 'angled shapes in the fleets');
});

test('the seas: each a rectangle; every commander\'s fleet fits on every sea; land, ice, overlaps and big ships in shallows are refused', () => {
  for (const id of SEA_IDS) {
    const rows = SEAS[id].rows;
    assert.ok(rows.every((r) => r.length === rows[0].length), id);
    for (const c of COMMANDER_IDS) assert.ok(validFleet(id, c, randomFleet(id, c, Math.random)), id + ' ' + c);
  }
  assert.ok(validFleet('open', 'vega', VEGA_ROWS));
  const moved = (i, s) => VEGA_ROWS.map((x, j) => (j === i ? s : x));
  assert.ok(!validFleet('open', 'vega', moved(1, { x: 0, y: 0, rot: 0 })), 'overlap');
  assert.ok(!validFleet('open', 'vega', moved(0, { x: 6, y: 0, rot: 0 })), 'off the edge');
  assert.ok(!validFleet('open', 'vega', moved(0, { x: 0, y: 0, rot: 7 })), 'a turn of 0-3');
  assert.ok(!validFleet('open', 'vega', VEGA_ROWS.slice(1)), 'every ship placed');
  // Archipelago: (2, 1) is land.
  assert.equal(terrain('archipelago', 2, 1), '#');
  assert.ok(!validFleet('archipelago', 'vega', moved(5, { x: 2, y: 1, rot: 0 })));
  // Reef shallows at (1, 1)-(2, 2): a Patrol Boat may sit there, the Carrier may not.
  const REEF = [{ x: 0, y: 0, rot: 0 }, { x: 0, y: 5, rot: 0 }, { x: 0, y: 9, rot: 0 }, { x: 6, y: 9, rot: 0 }, { x: 7, y: 0, rot: 0 }, { x: 1, y: 1, rot: 0 }];
  assert.equal(terrain('reef', 1, 1), '~');
  assert.ok(validFleet('reef', 'vega', REEF), 'the Patrol Boat in the shallows');
  assert.ok(!validFleet('reef', 'vega', [{ x: 0, y: 1, rot: 0 }].concat(REEF.slice(1))), 'the Carrier in the shallows');
});

test('commanders are picked in secret (each shows as "picked" until you both have); then you place a fleet on your phone', () => {
  const ctx = fakeCtx();
  const g = new UltimateBattleship(ctx, () => 0.3, {});
  g.start();
  assert.equal(g.phase, 'pick');
  g.onInput(0, { type: 'commander', id: 'frost' });
  assert.deepEqual(g.playerView(1).commanders, ['picked', null]);
  g.onInput(0, { type: 'commander', id: 'ash' }); // no changing your mind once picked
  g.onInput(1, { type: 'commander', id: 'nobody' });
  assert.equal(g.phase, 'pick');
  g.onInput(1, { type: 'commander', id: 'nova' });
  assert.equal(g.phase, 'place');
  assert.deepEqual(g.hostView().commanders, ['frost', 'nova']);
  // A fleet to start from on your phone, never on the other's or the TV.
  const v = g.playerView(0);
  assert.equal(v.placing.length, COMMANDERS.frost.fleet.length);
  assert.equal(g.playerView(1).placing.length, COMMANDERS.nova.fleet.length);
  assert.ok(!JSON.stringify(g.hostView()).includes('"placing"'));
  assert.deepEqual(g.hostView().boards[0].ships, []);
});

test('a shot: a hit gives energy and charges your special; energy comes at the start of each turn too; the turn passes after a pause', () => {
  const h = battle();
  const { g } = h;
  assert.equal(g.energy[0], ENERGY.perTurn);
  g.onInput(0, { type: 'fire', x: 0, y: 0 }); // the Carrier
  assert.equal(g.last.cells[0].result, 'hit');
  assert.equal(g.energy[0], ENERGY.perTurn + ENERGY.perHit);
  assert.equal(g.charge[0], 1);
  g.onInput(0, { type: 'fire', x: 1, y: 0 }); // not twice
  assert.equal(g.hits[0], 1);
  next(h);
  assert.equal(g.turn, 1);
  assert.equal(g.energy[1], ENERGY.perTurn);
  g.onInput(1, { type: 'fire', x: 5, y: 5 });
  assert.equal(g.last.cells[0].result, 'miss');
});

test('skills cost energy, need their ship afloat, and do what they say: an Air Strike hits 3 in a line', () => {
  const h = battle();
  const { g } = h;
  g.energy[0] = 3;
  g.onInput(0, { type: 'skill', skill: 'airstrike', x: 0, y: 0, dir: 'h' });
  assert.deepEqual(g.last.cells.map((c) => c.result), ['hit', 'hit', 'hit']);
  assert.equal(g.energy[0], 0 + 3, 'paid 3, then 3 hits gave 3 back');
  next(h);
  // Not enough energy: nothing happens.
  g.energy[1] = 1;
  g.onInput(1, { type: 'skill', skill: 'barrage', x: 5, y: 5 });
  assert.equal(g.phase, 'aim');
  // Sink player 2's Carrier: player 2 loses the Air Strike.
  g.onInput(1, { type: 'fire', x: 9, y: 0 });
  next(h);
  g.charge[0] = 0;
  g.energy[0] = 0;
  g.fleets[1] = VEGA_ROWS;
  [0, 1, 2, 3, 4].forEach((x) => { g.shots[1][x] = 2; });
  assert.ok(!g.playerView(1).skills.includes('airstrike'));
  assert.ok(g.playerView(1).skills.includes('barrage'));
});

test('a Barrage hits a plus; a Double Shot fires twice; Sonar counts ship cells in a 3×3 but not submarines', () => {
  const h = battle();
  const { g } = h;
  g.energy[0] = 10;
  g.onInput(0, { type: 'skill', skill: 'barrage', x: 1, y: 1 });
  assert.equal(g.last.cells.length, 5);
  assert.equal(g.last.cells.filter((c) => c.result === 'hit').length, 2, '(1,0) and (1,2) are ships');
  next(h);
  g.onInput(1, { type: 'fire', x: 9, y: 5 });
  next(h);
  g.energy[0] = 10;
  g.onInput(0, { type: 'skill', skill: 'double', x: 5, y: 2, x2: 6, y2: 2 });
  assert.equal(g.last.cells.length, 2);
  next(h);
  g.onInput(1, { type: 'fire', x: 9, y: 4 });
  next(h);
  // Sonar around (1, 5): the Cruiser on row 4 (3 cells) and the Submarine on row 6 (hidden).
  g.energy[0] = 10;
  g.onInput(0, { type: 'skill', skill: 'sonar', x: 1, y: 5 });
  assert.equal(g.last.count, 3);
  assert.deepEqual(g.hostView().sonar.at(-1), { by: 0, x: 1, y: 5, count: 3 });
});

test('a Torpedo runs along a row and hits the first ship; ice stops it', () => {
  const h = battle();
  const { g } = h;
  g.energy[0] = 10;
  g.onInput(0, { type: 'skill', skill: 'torpedo', x: 0, y: 4, from: 'e' }); // from the right: the Cruiser's far end
  assert.deepEqual(g.last.cells.map((c) => [c.x, c.result]), [[2, 'hit']]);
  // On the Frozen Strait, ice at (1, 1) stops a torpedo from the left on row 1.
  const STRAIT = [{ x: 3, y: 0, rot: 0 }, { x: 3, y: 1, rot: 0 }, { x: 0, y: 3, rot: 0 }, { x: 0, y: 5, rot: 0 }, { x: 0, y: 9, rot: 0 }, { x: 11, y: 9, rot: 0 }];
  const s = battle({ sea: 'strait', fleets: [STRAIT, STRAIT] });
  s.g.energy[0] = 10;
  s.g.onInput(0, { type: 'skill', skill: 'torpedo', x: 0, y: 1, from: 'w' });
  assert.deepEqual(s.g.last.cells, [{ x: 1, y: 1, result: 'stopped' }]);
});

test('a Shield on your own sea stops the next hit on each of its cells, and only your phone knows it\'s there', () => {
  const h = battle({ commanders: ['frost', 'vega'], fleets: [[{ x: 0, y: 0, rot: 0 }, { x: 5, y: 0, rot: 0 }, { x: 0, y: 4, rot: 0 }, { x: 0, y: 6, rot: 0 }, { x: 0, y: 8, rot: 0 }, { x: 9, y: 9, rot: 0 }], VEGA_ROWS] });
  const { g } = h;
  g.energy[0] = 10;
  g.onInput(0, { type: 'skill', skill: 'shield', x: 0, y: 4 }); // over the Cruiser
  assert.ok(g.playerView(0).mine.shields.length === 4);
  assert.equal(g.playerView(1).theirs.shields, undefined, 'not on their phone');
  assert.deepEqual(g.playerView(1).mine.shields, [], '(their own sea has none)');
  assert.ok(!JSON.stringify(g.hostView()).includes('shields'));
  next(h);
  g.onInput(1, { type: 'fire', x: 0, y: 4 });
  assert.equal(g.last.cells[0].result, 'blocked');
  assert.equal(g.shots[0][g.idx(0, 4)], 0, 'still open: the shield is used up');
});

test('specials charge with hits: Deep Freeze skips your rival\'s turn, Broadside hits a 3×3, Full Scan shows only you their ships', () => {
  const h = battle({ commanders: ['frost', 'ash'], fleets: [[{ x: 0, y: 0, rot: 0 }, { x: 5, y: 0, rot: 0 }, { x: 0, y: 4, rot: 0 }, { x: 0, y: 6, rot: 0 }, { x: 0, y: 8, rot: 0 }, { x: 9, y: 9, rot: 0 }], [{ x: 0, y: 0, rot: 0 }, { x: 0, y: 4, rot: 0 }, { x: 0, y: 6, rot: 0 }, { x: 0, y: 8, rot: 0 }, { x: 5, y: 8, rot: 0 }, { x: 9, y: 9, rot: 0 }]] });
  const { g } = h;
  g.onInput(0, { type: 'special' }); // not charged: nothing
  assert.equal(g.phase, 'aim');
  g.charge[0] = COMMANDERS.frost.special.charge;
  g.onInput(0, { type: 'special' });
  next(h);
  assert.equal(g.turn, 0, 'player 2 was frozen: player 1 again');
  g.onInput(0, { type: 'fire', x: 9, y: 0 });
  next(h);
  g.charge[1] = COMMANDERS.ash.special.charge;
  g.onInput(1, { type: 'special', x: 1, y: 1 });
  assert.equal(g.last.cells.length, 9);
  assert.equal(g.charge[1], 0, 'spent');
  // Full Scan (Nova).
  const n = battle({ commanders: ['nova', 'vega'], fleets: [randomFleet('open', 'nova', () => 0.5), VEGA_ROWS] });
  n.g.charge[0] = COMMANDERS.nova.special.charge;
  n.g.onInput(0, { type: 'special', x: 2, y: 2 });
  assert.ok(n.g.playerView(0).theirs.spotted.length > 0);
  assert.equal(JSON.stringify(n.g.playerView(1)).includes('"spotted":[0'), false);
  assert.deepEqual(n.g.playerView(1).theirs.spotted, []);
});

test('rival fleets stay hidden until sunk; sink every ship to win; a rematch picks commanders again', () => {
  const h = battle();
  const { g, ctx } = h;
  assert.deepEqual(g.playerView(1).theirs.ships, []);
  assert.deepEqual(g.hostView().boards[1].ships, []);
  // Hit every one of player 2's ship cells.
  g.fleets[1].forEach((s, i) => placedCells(COMMANDERS.vega.fleet[i], s).forEach(([x, y]) => { g.shots[1][g.idx(x, y)] = 2; }));
  g.shots[1][g.idx(9, 9)] = 0;
  g.onInput(0, { type: 'fire', x: 9, y: 9 });
  assert.equal(g.phase, 'over');
  assert.equal(g.winner, 0);
  assert.equal(g.hostView().boards[1].ships.length, 6, 'everything shows at the end');
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(1, { type: 'rematch' });
  assert.equal(g.phase, 'pick');
  assert.deepEqual(g.commanders, [null, null]);
});

test('no timer is honoured; bad input is ignored', () => {
  const h = battle({ turnMs: 0 });
  const { g, ctx } = h;
  ctx.advance(UTIMING.turnMs * 5);
  assert.equal(g.phase, 'aim');
  assert.equal(g.turn, 0);
  for (const bad of [{ type: 'fire', x: '1', y: 1 }, { type: 'fire', x: 99, y: 0 }, { type: 'skill', skill: 'nuke', x: 1, y: 1 }, { type: 'skill', skill: 'airstrike' }, { type: 'skill', skill: 'toString', x: 1, y: 1 }]) g.onInput(0, bad);
  g.onInput(1, { type: 'fire', x: 1, y: 1 }); // not your turn
  assert.equal(g.phase, 'aim');
  assert.equal(g.fired[0] + g.fired[1], 0);
  assert.ok(SKILLS.airstrike.cost > 0);
});

test('in the lobby: Battleship\'s setup has the mode (classic or Ultimate) and the sea; Ultimate starts on the commander pick', async () => {
  const { getGame } = await import('../server/games/index.js');
  const setup = getGame('battleship').create(fakeCtx());
  assert.deepEqual(setup.options.mode, ['classic', 'ultimate']);
  assert.deepEqual(setup.options.sea, ['open', 'archipelago', 'reef', 'strait', 'random']);
  const ctx = fakeCtx();
  ctx.settings = { mode: 'ultimate', sea: 'reef', shotSeconds: 0 };
  const g = (await import('../server/games/battleship.js')).default.create(ctx);
  g.start();
  assert.equal(g.phase, 'pick');
  assert.equal(g.hostView().sea, 'reef');
  assert.equal(g.hostView().timed, false);
  assert.equal(g.hostView().roster.length, 5);
});
