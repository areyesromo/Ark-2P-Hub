import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectionFor, countOpen } from '../server/solo/collection.js';
import { LOOKS } from '../server/solo/games/looks.js';

const groups = (have = {}, solved = []) => collectionFor({ have, bestOf: (game, variant) => (game === 'sokoban' && solved.includes(variant) ? 10 : null) });
const find = (gs, game, key) => gs.find((g) => g.game === game).rows.find((r) => r.key === key);

test('every game with something to unlock is listed, rows and all', () => {
  const gs = groups();
  const names = gs.map((g) => g.game);
  for (const game of ['cave', 'sokoban', ...Object.keys(LOOKS)]) assert.ok(names.includes(game), game);
  assert.deepEqual(find(gs, 'cave', 'map').items.map((i) => i.label), ['Crystal Cave', 'Old Mine', 'Ice Tunnel', 'Volcano']);
  assert.equal(find(gs, 'snake', 'look').items.length, 4);
});

test('a new player has the first of each open and the rest locked with how to open them', () => {
  const gs = groups();
  for (const g of gs) for (const r of g.rows) {
    assert.equal(r.items[0].open, true, `${g.game} ${r.key}`);
    for (const i of r.items.slice(1)) {
      assert.equal(i.open, false, `${g.game} ${r.key} ${i.label}`);
      assert.match(i.how, / to unlock$/);
    }
  }
  assert.match(find(gs, 'cave', 'map').items[1].how, /100 m/);
});

test('achievements open their items; Sokoban levels need the level before solved', () => {
  const gs = groups({ 'cave-100': 1, 'snake-25': 1 }, ['Level 1', 'Level 2']);
  assert.deepEqual(find(gs, 'cave', 'map').items.map((i) => i.open), [true, true, false, false]);
  assert.deepEqual(find(gs, 'snake', 'look').items.map((i) => i.open), [true, false, true, false]);
  const levels = find(gs, 'sokoban', 'level').items.map((i) => i.open);
  assert.deepEqual(levels.slice(0, 4), [true, true, true, false]);
  assert.match(find(gs, 'sokoban', 'level').items[3].how, /level 3/);
});

test('counts the open ones, and the total only grows when a game adds something', () => {
  const none = countOpen(groups());
  const some = countOpen(groups({ 'cave-100': 1 }));
  assert.equal(none.total, some.total);
  assert.equal(some.got, none.got + 1);
  assert.equal(none.got, groups().reduce((n, g) => n + g.rows.length, 0), 'one open per row to start with');
});
