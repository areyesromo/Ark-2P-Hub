import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battleshipBot, BOT_LEVELS } from '../server/games/battleship-bot.js';
import { Battleship, SIZE, TIMING } from '../server/games/battleship.js';
import { UltimateBattleship, SEA_IDS, UTIMING, COMMANDERS, terrain } from '../server/games/battleship-ultimate.js';
import { fakeCtx } from './helpers.js';

/** A seeded rng (mulberry32), so a whole game plays out the same each run. */
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

/** A classic aim view for player 0, firing at an empty grid with `shots` set ({ index: 1 | 2 }). */
function classicView(shots = {}, ships = []) {
  const grid = new Array(SIZE * SIZE).fill(0);
  for (const [k, v] of Object.entries(shots)) grid[Number(k)] = v;
  return { phase: 'aim', you: 0, turn: 0, size: SIZE, theirs: { shots: grid, ships, afloat: 5 }, mine: { shots: [], ships: [] } };
}

const at = (x, y) => y * SIZE + x;

test('the computer waits its turn, and fires at a square still open', () => {
  for (const level of BOT_LEVELS) {
    assert.equal(battleshipBot({ phase: 'setup' }, level), null);
    assert.equal(battleshipBot({ ...classicView(), turn: 1 }, level), null);
    assert.equal(battleshipBot({ ...classicView(), phase: 'shot' }, level), null);
    assert.equal(battleshipBot({ ...classicView(), phase: 'over' }, level), null, 'a rematch is the people\'s call');
    // Every square but one shot: that's the one.
    const shots = {};
    for (let k = 0; k < SIZE * SIZE; k++) if (k !== at(3, 7)) shots[k] = 1;
    assert.deepEqual(battleshipBot(classicView(shots), level, Math.random), { type: 'fire', x: 3, y: 7 });
  }
});

test('Normal and Hard hunt around a hit, and follow a line of hits', () => {
  for (const level of ['normal', 'hard']) {
    for (let i = 0; i < 20; i++) {
      const m = battleshipBot(classicView({ [at(4, 4)]: 2 }), level, Math.random);
      assert.equal(Math.abs(m.x - 4) + Math.abs(m.y - 4), 1, level + ' next to the hit');
      const line = battleshipBot(classicView({ [at(4, 4)]: 2, [at(5, 4)]: 2 }), level, Math.random);
      assert.equal(line.y, 4, level + ' along the line');
      assert.ok(line.x === 3 || line.x === 6, level + ' at an end of the line');
    }
  }
});

test('a sunk ship\'s hits are done with: no hunting around them', () => {
  // The Destroyer (2 long) sunk at (0,0)-(1,0): its hits aren't worth following.
  const view = classicView({ [at(0, 0)]: 2, [at(1, 0)]: 2 }, [{ name: 'Destroyer', len: 2, x: 0, y: 0, dir: 'h', sunk: true }]);
  let next = 0;
  for (let i = 0; i < 40; i++) {
    const m = battleshipBot(view, 'normal', Math.random);
    if ((m.x === 2 && m.y === 0) || (m.x === 0 && m.y === 1) || (m.x === 1 && m.y === 1)) next++;
  }
  assert.ok(next < 10, 'not stuck beside the wreck: ' + next);
});

test('Hard never fires where no ship is left that could fit', () => {
  // (5,5) is boxed in by misses; the smallest ship left is 2 long, so it can't be there.
  const shots = { [at(4, 5)]: 1, [at(6, 5)]: 1, [at(5, 4)]: 1, [at(5, 6)]: 1 };
  for (let i = 0; i < 30; i++) {
    const m = battleshipBot(classicView(shots), 'hard', Math.random);
    assert.ok(!(m.x === 5 && m.y === 5));
  }
});

/** Play a classic game with the computer on both sides; gives [game, moves]. */
function classicGame(levels, rng) {
  const ctx = fakeCtx();
  ctx.players.forEach((p) => (p.local = true));
  const g = new Battleship(ctx, rng);
  g.start();
  let moves = 0;
  while (g.phase !== 'over' && moves < 400) {
    const slot = g.turn;
    const input = battleshipBot(g.playerView(slot), levels[slot], rng);
    assert.ok(input, 'a move every turn');
    g.onInput(slot, input);
    assert.ok(g.phase === 'shot' || g.phase === 'over', 'the move was taken: ' + JSON.stringify(input));
    moves++;
    ctx.advance(TIMING.shotMs);
  }
  return [g, moves];
}

test('a whole classic game plays out, and Hard beats Easy far more often than not', () => {
  let hardWins = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const [g, moves] = classicGame(['hard', 'easy'], seeded(seed));
    assert.equal(g.phase, 'over');
    assert.ok(moves <= 2 * SIZE * SIZE);
    if (g.winner === 0) hardWins++;
  }
  assert.ok(hardWins >= 22, 'Hard won ' + hardWins + ' of 30');
});

/** Play an Ultimate game with the computer on both sides (it picks, the game places: they're local). */
function ultimateGame(sea, levels, rng) {
  const ctx = fakeCtx();
  ctx.players.forEach((p) => (p.local = true));
  const g = new UltimateBattleship(ctx, rng, { sea, turnMs: 0 });
  g.start();
  const used = new Set();
  for (const slot of [0, 1]) {
    const input = battleshipBot(g.playerView(slot), levels[slot], rng);
    assert.equal(input.type, 'commander');
    assert.ok(COMMANDERS[input.id]);
    g.onInput(slot, input);
  }
  assert.equal(g.phase, 'aim', 'controller seats are placed for them');
  let moves = 0;
  while (g.phase !== 'over' && moves < 500) {
    const slot = g.turn;
    const input = battleshipBot(g.playerView(slot), levels[slot], rng);
    assert.ok(input, 'a move every turn');
    g.onInput(slot, input);
    assert.ok(g.phase === 'shot' || g.phase === 'over', sea + ': the move was taken: ' + JSON.stringify(input));
    if (input.type !== 'fire') used.add(input.type === 'special' ? 'special' : input.skill);
    moves++;
    ctx.advance(UTIMING.shotMs);
  }
  return [g, used];
}

test('Ultimate: the computer picks a commander, and plays a whole game on every sea, skills and all', () => {
  const used = new Set();
  for (const sea of SEA_IDS) {
    for (let seed = 1; seed <= 3; seed++) {
      const [g, u] = ultimateGame(sea, ['hard', 'normal'], seeded(seed * 31 + sea.length));
      assert.equal(g.phase, 'over', sea);
      u.forEach((s) => used.add(s));
    }
  }
  assert.ok(used.has('special'), 'specials get used');
  assert.ok(used.size >= 4, 'several skills get used: ' + [...used]);
});

test('Ultimate: the computer never aims at land, ice or lava', () => {
  for (const sea of ['archipelago', 'strait', 'volcano']) {
    const ctx = fakeCtx();
    ctx.players.forEach((p) => (p.local = true));
    const g = new UltimateBattleship(ctx, seeded(5), { sea, turnMs: 0 });
    g.start();
    g.onInput(0, { type: 'commander', id: 'vega' });
    g.onInput(1, { type: 'commander', id: 'vega' });
    g.energy[g.turn] = 0; // a plain shot
    for (let i = 0; i < 20; i++) {
      const m = battleshipBot(g.playerView(g.turn), 'easy', Math.random);
      if (m.type === 'fire') assert.ok(!['#', '*', '^'].includes(terrain(sea, m.x, m.y)), sea + ' ' + JSON.stringify(m));
    }
  }
});

test('told its move was refused, the computer falls back to a plain shot', () => {
  const m = battleshipBot(classicView({ [at(4, 4)]: 2 }), 'hard', Math.random, 2);
  assert.equal(m.type, 'fire');
});
