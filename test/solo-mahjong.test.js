import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Mahjong, LAYOUT, FACES, PENALTY, isFree } from '../server/solo/games/mahjong.js';

function game(seed = 7) {
  const ctx = fakeCtx('Ana');
  const g = new Mahjong(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}

/** Play the deal's own solution through the inputs. True when that clears it. */
function playSolution(g) {
  for (const [a, b] of g.solution) {
    g.onInput({ type: 'pick', tile: a });
    g.onInput({ type: 'pick', tile: b });
  }
  return g.here.every((h) => !h);
}

test('the layout: 76 tiles, no two in the same place, each face four times', () => {
  assert.equal(LAYOUT.length, 76);
  assert.equal(new Set(LAYOUT.map((p) => `${p.x},${p.y},${p.z}`)).size, 76);
  const { g } = game();
  for (const f of FACES) assert.equal(g.tiles.filter((t) => t.face === f).length, 4);
});

test('free means nothing on top and a side open', () => {
  const tiles = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 1, y: 0, z: 1 }];
  const here = [true, true, true, true];
  assert.equal(isFree(tiles, here, 0), false, 'covered by the tile on top');
  assert.equal(isFree(tiles, here, 1), false, 'covered and hemmed in');
  assert.equal(isFree(tiles, here, 2), true);
  assert.equal(isFree(tiles, here, 3), true);
  here[3] = false;
  assert.equal(isFree(tiles, here, 0), true);
  assert.equal(isFree(tiles, here, 1), false, 'both sides taken');
});

test('every deal can be cleared (its own solution works), and the solution stays on the server', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const { g } = game(seed);
    assert.equal(JSON.stringify(g.hostView()).includes('solution'), false);
    assert.ok(playSolution(g), `seed ${seed}`);
  }
});

test('two free tiles with the same face go; other picks change the pick or shake', () => {
  const { g } = game();
  const [a, b] = g.pairs()[0];
  const covered = g.tiles.findIndex((_, i) => g.here[i] && !g.free(i));
  g.onInput({ type: 'pick', tile: covered });
  assert.equal(g.nope, 1);
  assert.equal(g.selected, null);
  g.onInput({ type: 'pick', tile: a });
  assert.equal(g.selected, a);
  g.onInput({ type: 'pick', tile: b });
  assert.equal(g.here[a] || g.here[b], false);
  assert.equal(g.hostView().left, 74);
  g.onInput({ type: 'undo' });
  assert.equal(g.hostView().left, 76);
});

test('clearing it ends the run with the time plus penalties', () => {
  const { ctx, g } = game();
  ctx.advance(60000);
  g.onInput({ type: 'hint' });
  assert.equal(g.hint.length, 2);
  playSolution(g);
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 60000 + PENALTY.hint);
  assert.equal(ctx.pendingTimers(), 0);
});

test('a shuffle keeps the same faces on the same tiles still there, and can still be cleared', () => {
  const { g } = game(4);
  const [a, b] = g.pairs()[0];
  g.onInput({ type: 'pick', tile: a });
  g.onInput({ type: 'pick', tile: b });
  const before = g.tiles.filter((_, i) => g.here[i]).map((t) => t.face).sort();
  g.onInput({ type: 'shuffle' });
  const after = g.tiles.filter((_, i) => g.here[i]).map((t) => t.face).sort();
  assert.deepEqual(after, before);
  assert.equal(g.shuffles, 1);
  assert.equal(g.hostView().canUndo, false);
  assert.ok(playSolution(g));
});

test('giving up doesn\'t count; pause hides the faces; bad input is ignored', () => {
  const { g } = game();
  g.onInput({ type: 'pause' });
  assert.ok(g.hostView().tiles.every((t) => t.face === ''));
  g.onInput({ type: 'pick', tile: g.pairs()[0][0] });
  assert.equal(g.selected, null, 'no picks while paused');
  g.onInput({ type: 'pause' });
  for (const input of [{ type: 'pick', tile: 76 }, { type: 'pick', tile: -1 }, { type: 'pick', tile: '3' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.selected, null);
  g.onInput({ type: 'give-up' });
  assert.equal(g.hostView().phase, 'over');
  assert.equal(g.hostView().score, null);
});
