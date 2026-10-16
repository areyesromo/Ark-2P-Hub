import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battleship, FLEET, SIZE, TIMING, randomFleet, validFleet, shipCells } from '../server/games/battleship.js';
import { fakeCtx } from './helpers.js';

// A fixed fleet: every ship in its own row, starting at column 0.
const ROWS = FLEET.map((f, i) => ({ x: 0, y: i * 2, dir: 'h' }));

function setup({ local = [false, false] } = {}) {
  const ctx = fakeCtx();
  local.forEach((l, slot) => (ctx.players[slot].local = l));
  const game = new Battleship(ctx);
  game.start();
  return { ctx, game };
}

/** Both place the fixed fleet; player 0 fires first in the first match. */
function toBattle() {
  const s = setup();
  s.game.onInput(0, { type: 'ready', ships: ROWS });
  s.game.onInput(1, { type: 'ready', ships: ROWS });
  return s;
}

/** Fire at (x, y), then let the shot's pause run out so the turn passes. */
function shoot(ctx, game, slot, x, y) {
  game.onInput(slot, { type: 'fire', x, y });
  if (game.phase === 'shot') ctx.advance(TIMING.shotMs);
}

test('fleets: random ones are always valid; bad ones are rejected', () => {
  for (let i = 0; i < 200; i++) assert.ok(validFleet(randomFleet()));
  assert.ok(validFleet(ROWS));
  const overlap = ROWS.map((s) => ({ ...s, y: 0 }));
  const offGrid = ROWS.map((s, i) => (i === 0 ? { x: 7, y: 0, dir: 'h' } : s));
  const short = ROWS.slice(1);
  const junk = ROWS.map((s, i) => (i === 2 ? { x: '1', y: 0, dir: 'h' } : s));
  const badDir = ROWS.map((s, i) => (i === 2 ? { ...s, dir: 'd' } : s));
  for (const f of [overlap, offGrid, short, junk, badDir, null, 'x']) assert.equal(validFleet(f), false);
});

test('placing: phones start with a random fleet, ready up with their own; battle starts when both are ready', () => {
  const { game } = setup();
  assert.equal(game.phase, 'place');
  assert.ok(validFleet(game.playerView(0).mine.ships.map((s) => ({ x: s.x, y: s.y, dir: s.dir }))));
  game.onInput(0, { type: 'ready', ships: ROWS.map((s) => ({ ...s, y: 0 })) }); // invalid: ignored
  assert.deepEqual(game.ready, [false, false]);
  game.onInput(0, { type: 'ready', ships: ROWS });
  game.onInput(0, { type: 'unready' });
  assert.deepEqual(game.ready, [false, false], 'can change your mind');
  game.onInput(0, { type: 'ready', ships: ROWS });
  assert.equal(game.phase, 'place');
  game.onInput(1, { type: 'ready', ships: ROWS });
  assert.equal(game.phase, 'aim');
  assert.equal(game.turn, 0);
  assert.deepEqual(game.fleets[0], ROWS);
});

test('placing: the clock running out starts the battle with whatever is placed', () => {
  const { ctx, game } = setup();
  game.onInput(1, { type: 'ready', ships: ROWS });
  ctx.advance(TIMING.placeMs);
  assert.equal(game.phase, 'aim');
  assert.ok(validFleet(game.fleets[0]));
});

test('controller players get a random fleet and are ready at once', () => {
  let { game } = setup({ local: [false, true] });
  assert.deepEqual(game.ready, [false, true]);
  game.onInput(1, { type: 'unready' });
  assert.deepEqual(game.ready, [false, true], "a controller can't un-ready (it couldn't place in secret)");
  ({ game } = setup({ local: [true, true] }));
  assert.equal(game.phase, 'aim', 'two controllers go straight to battle');
});

test('fleets stay secret: the TV and the opponent only see shots and sunk ships', () => {
  const { game } = toBattle();
  const host = JSON.stringify(game.hostView());
  assert.deepEqual(game.hostView().boards[0].ships, []);
  assert.ok(!host.includes('"dir"'), 'no ship positions in the TV view');
  assert.deepEqual(game.playerView(1).theirs.ships, []);
  assert.equal(game.playerView(0).mine.ships.length, FLEET.length, 'you see your own fleet');
});

test('turns alternate; hits, misses and sinking', () => {
  const { ctx, game } = toBattle();
  game.onInput(1, { type: 'fire', x: 0, y: 0 }); // not their turn
  assert.equal(game.phase, 'aim');
  shoot(ctx, game, 0, 9, 9); // miss: ROWS only uses the even rows
  assert.equal(game.lastShot.result, 'miss');
  assert.equal(game.turn, 1);
  // Player 1 sinks the Destroyer (len 2 at y=8), with player 0 missing in between.
  shoot(ctx, game, 1, 0, 8);
  assert.equal(game.lastShot.result, 'hit');
  shoot(ctx, game, 0, 8, 9);
  game.onInput(1, { type: 'fire', x: 0, y: 8 }); // already shot there: ignored
  assert.equal(game.phase, 'aim');
  shoot(ctx, game, 1, 1, 8);
  assert.deepEqual(game.lastShot, { by: 1, x: 1, y: 8, result: 'sunk', ship: 'Destroyer' });
  const seen = game.hostView().boards[0].ships;
  assert.deepEqual(seen.map((s) => s.name), ['Destroyer'], 'sunk ships are revealed');
  assert.equal(game.hostView().boards[0].afloat, FLEET.length - 1);
  assert.deepEqual(game.hits, [0, 2]);
  assert.deepEqual(game.fired, [2, 2]);
});

test('a turn that runs out fires a random shot at an open cell', () => {
  const { ctx, game } = toBattle();
  ctx.advance(1000);
  assert.equal(game.hostView().timeLeftMs, TIMING.turnMs - 1000, 'the turn clock is pushed every second');
  ctx.advance(TIMING.turnMs - 1000);
  assert.equal(game.phase, 'shot');
  assert.equal(game.lastShot.by, 0);
  assert.equal(game.shots[1].filter((v) => v !== 0).length, 1);
});

test('sinking the whole fleet wins, reveals every ship, and rematch swaps who starts', () => {
  const { ctx, game } = toBattle();
  const targets = [];
  ROWS.forEach((s, i) => shipCells(s, FLEET[i].len).forEach((c) => targets.push(c)));
  let miss = 0;
  for (const [x, y] of targets) {
    shoot(ctx, game, 0, x, y);
    if (game.phase === 'over') break;
    shoot(ctx, game, 1, miss % SIZE, 1 + 2 * Math.floor(miss / SIZE)); // player 1 keeps missing in the empty odd rows
    miss++;
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.equal(game.lastShot.result, 'sunk');
  assert.equal(game.hostView().boards[1].ships.length, FLEET.length, 'all ships shown at the end');
  assert.equal(game.hostView().boards[0].ships.length, FLEET.length);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'place');
  assert.equal(game.turn, 1, 'the other player fires first next time');
  assert.deepEqual(game.fired, [0, 0]);
});

test('bad fire input is ignored', () => {
  const { game } = toBattle();
  for (const bad of [{ x: -1, y: 0 }, { x: SIZE, y: 0 }, { x: 1.5, y: 2 }, { x: '1', y: 2 }, {}]) {
    game.onInput(0, { type: 'fire', ...bad });
  }
  game.onInput(0, { type: 'ready', ships: ROWS }); // not placing any more
  assert.equal(game.phase, 'aim');
  assert.equal(game.fired[0], 0);
});
