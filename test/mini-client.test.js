// public/games/minis/mini.js in a vm: loading minigame renderers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('a minigame script that failed to load is tried again next time', async () => {
  let calls = 0;
  const window = {};
  const Ark = {
    escapeHtml: String,
    loadScript: () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('network'));
      window.ArkMini.register('x', { host: {}, phone: {} });
      return Promise.resolve();
    },
  };
  vm.runInNewContext(fs.readFileSync('public/games/minis/mini.js', 'utf8'), { Ark, window, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  await assert.rejects(window.ArkMini.load('x'));
  const r = await window.ArkMini.load('x');
  assert.ok(r && r.host);
  assert.equal(calls, 2);
});

test('ArkMini.keyed keeps one element per id: new ones made, old ones updated in place, gone ones removed', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/games/minis/mini.js', 'utf8'), { Ark: { escapeHtml: String, loadScript: () => Promise.resolve() }, window, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  const kids = [];
  const parent = { appendChild: (el) => kids.push(el), removeChild: (el) => kids.splice(kids.indexOf(el), 1) };
  let made = 0;
  const make = (item) => ({ made: ++made, id: item.id, remove() { parent.removeChild(this); } });
  const set = (el, item) => { el.x = item.x; };
  window.ArkMini.keyed(parent, [{ id: 1, x: 0 }, { id: 2, x: 0 }], (i) => i.id, make, set);
  const first = kids[0];
  window.ArkMini.keyed(parent, [{ id: 1, x: 5 }, { id: 3, x: 1 }], (i) => i.id, make, set);
  assert.equal(made, 3, 'only id 3 is new');
  assert.equal(kids[0], first, 'id 1 kept its element');
  assert.equal(first.x, 5, 'and was updated');
  assert.deepEqual(kids.map((k) => k.id), [1, 3], 'id 2 removed');
});

test('ArkMini.moveCursor stops at the edges of a row (no wrapping to the next one)', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/games/minis/mini.js', 'utf8'), { Ark: { escapeHtml: String, loadScript: () => Promise.resolve() }, window, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  const move = window.ArkMini.moveCursor;
  assert.equal(move(2, 'RIGHT', 9, 3), 2, 'right edge');
  assert.equal(move(3, 'LEFT', 9, 3), 3, 'left edge');
  assert.equal(move(4, 'RIGHT', 9, 3), 5);
  assert.equal(move(1, 'DOWN', 9, 3), 4);
  assert.equal(move(7, 'DOWN', 9, 3), 7, 'bottom edge');
});
