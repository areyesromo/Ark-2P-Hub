// Party Board maps: graphs of spaces, checked for dead ends and bad links.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, validateMap } from '../server/games/board/maps.js';

/** A minimal valid map: a 10-space loop with the required space types. */
function loop(n = 10) {
  const types = ['start', 'blue', 'shop', 'event', 'event', 'bonus', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue'];
  return {
    name: 'Test', tier: 'easy', starPrice: 20, shopMarkup: 1,
    spaces: Array.from({ length: n }, (_, i) => ({ x: (i + 1) / (n + 2), y: 0.5, type: types[i] || 'blue', next: [(i + 1) % n], starCandidate: i >= 6 })),
  };
}

test('validateMap: the island is valid', () => {
  assert.deepEqual(validateMap(MAPS.island), []);
});

test('validateMap catches a dead end, a bad link, a 3-way fork and a self-link', () => {
  assert.deepEqual(validateMap(loop()), []);
  let m = loop();
  m.spaces[4].next = [4];
  assert.ok(validateMap(m).some((p) => /itself/.test(p)));
  m = loop();
  m.spaces[3].next = [99];
  assert.ok(validateMap(m).some((p) => /link/.test(p)));
  m = loop();
  m.spaces[3].next = [4, 5, 6];
  assert.ok(validateMap(m).some((p) => /fork/.test(p)));
  m = loop();
  m.spaces[5].next = [6, 9];
  m.spaces[8].next = [8 === 8 ? 7 : 0]; // 7 -> 8 -> 7: a trap that never gets back to the start
  m.spaces[7].next = [8];
  assert.ok(validateMap(m).some((p) => /start/.test(p)));
});

test('warp spaces have no fixed exit (where they send you is random)', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    for (const s of m.spaces) assert.equal(s.warp, undefined, id);
  }
});

test('the island keeps its 28-space loop', () => {
  const s = MAPS.island.spaces;
  assert.equal(s.length, 28);
  s.forEach((sp, i) => assert.deepEqual(sp.next, [(i + 1) % 28]));
  assert.equal(MAPS.island.tier, 'easy');
  assert.equal(MAPS.island.starPrice, 20);
  assert.equal(MAPS.island.shopMarkup, 1);
});

const forks = (m) => m.spaces.filter((s) => s.next.length === 2).length;
const warps = (m) => m.spaces.map((s, i) => [s, i]).filter(([s]) => s.type === 'warp');
const redShare = (m) => {
  const red = m.spaces.filter((s) => s.type === 'red').length;
  const blue = m.spaces.filter((s) => s.type === 'blue').length;
  return red / (red + blue);
};

test('every map is valid (no dead ends, no bad links)', () => {
  assert.deepEqual(Object.keys(MAPS), ['island', 'lagoons', 'pipes', 'haunted', 'volcano']);
  for (const [id, m] of Object.entries(MAPS)) assert.deepEqual(validateMap(m), [], id);
});

test('tiers and prices', () => {
  const t = Object.fromEntries(Object.entries(MAPS).map(([id, m]) => [id, [m.tier, m.starPrice, m.shopMarkup]]));
  assert.deepEqual(t, {
    island: ['easy', 20, 1], lagoons: ['easy', 20, 1], pipes: ['medium', 20, 1], haunted: ['hard', 25, 1], volcano: ['expert', 30, 1.5],
  });
});

test('layouts get harder: forks, warps and red spaces', () => {
  assert.ok(forks(MAPS.lagoons) >= 1);
  assert.ok(forks(MAPS.pipes) >= 2 && warps(MAPS.pipes).length >= 2);
  assert.ok(forks(MAPS.haunted) >= 3 && warps(MAPS.haunted).length >= 2 && redShare(MAPS.haunted) >= 0.35);
  assert.ok(forks(MAPS.volcano) >= 4 && warps(MAPS.volcano).length >= 3 && redShare(MAPS.volcano) >= 0.5);
});

test('spaces are never on top of each other', () => {
  for (const [id, m] of Object.entries(MAPS)) {
    m.spaces.forEach((a, i) => m.spaces.forEach((b, j) => {
      if (i < j) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 0.07, `${id}: ${i} and ${j} are too close`);
    }));
  }
});
