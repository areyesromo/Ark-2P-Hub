// Kart Race's setup rows on the TV (host.js) and the phones (player.js), in a vm: the 2D game's rows
// as ever, Kart Race 3D's with a Field row, and the 8-kart Cup's short list.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/** Load one of the shared Kart Race screens and return its rowsFor. */
function rowsFrom(file, global) {
  const window = {};
  const Ark = {
    escapeHtml: String,
    loadCss() {},
    loadScript: () => new Promise(() => {}), // helpers never arrive: only the rows matter here
    register() {},
    setup: {},
  };
  const storage = { getItem: () => null, setItem() {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { Ark, window, localStorage: storage, navigator: {}, location: {}, setTimeout, clearTimeout, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  return window[global].rowsFor;
}

const screens = [['public/games/kart-race/host.js', 'ArkKartTV'], ['public/games/kart-race/player.js', 'ArkKartPhone']];
const keys = (rowsFor, v) => [...rowsFor(v)].map((r) => r.key); // (copied out of the vm's own arrays)
const options2d = { mode: [0, 1], arena: [0, 1, 2, 3], track: [0, 1, 2, 3, 4, 5, 6], laps: [5, 3, 8], races: [1, 3, 4], items: [1, 0] };
const options3d = { ...options2d, track: [0, 1, 2, 3, 4, 5], field: [0, 1], cpu: ['normal', 'easy', 'hard'] };

for (const [file, global] of screens) {
  test(`${global}: Kart Race's rows are as they were`, () => {
    const rowsFor = rowsFrom(file, global);
    assert.deepEqual(keys(rowsFor, { options: options2d, settings: { mode: 0 } }), ['mode', 'track', 'laps', 'races', 'items']);
    assert.deepEqual(keys(rowsFor, { options: options2d, settings: { mode: 1 } }), ['mode', 'arena', 'races']);
  });

  test(`${global}: Kart Race 3D adds the Field row; the 8-kart Cup is Field, Computer, Laps`, () => {
    const rowsFor = rowsFrom(file, global);
    assert.deepEqual(keys(rowsFor, { options: options3d, settings: { field: 0, mode: 0 } }), ['field', 'mode', 'track', 'laps', 'races', 'items']);
    assert.deepEqual(keys(rowsFor, { options: options3d, settings: { field: 0, mode: 1 } }), ['field', 'mode', 'arena', 'races']);
    const cup = [...rowsFor({ options: options3d, settings: { field: 1, mode: 1 } })];
    assert.deepEqual(cup.map((r) => r.key), ['field', 'cpu', 'laps']);
    assert.equal(cup[0].fmt(1), '🏁 8-kart Cup');
    assert.equal(cup[0].fmt(0), '⚔️ 1v1');
    assert.deepEqual(['easy', 'normal', 'hard'].map(cup[1].fmt), ['Easy', 'Normal', 'Hard']);
  });
}
