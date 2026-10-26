// Kart Race 3D's TV and phone in a vm: they reuse Kart Race's, registered under the new id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/** An Ark stub that records register() calls. */
function arkStub(extra = {}) {
  const registered = [];
  const Ark = {
    escapeHtml: String,
    loadCss() {},
    loadScript: () => new Promise(() => {}), // helpers never arrive: only the registration matters here
    register: (kind, id, r) => registered.push({ kind, id, r }),
    setup: {},
    ...extra,
  };
  return { Ark, registered };
}

test('a renderer registered as a promise loads as the renderer it resolves to', async () => {
  const window = {};
  const document = {
    createElement: () => ({}),
    head: {
      appendChild(s) {
        // The "script" runs: it registers a promise of its renderer, then the load event fires.
        queueMicrotask(() => {
          window.Ark.register('host', 'x', Promise.resolve({ mount() {} }));
          s.onload();
        });
      },
    },
  };
  vm.runInNewContext(fs.readFileSync('public/shared/common.js', 'utf8'), { window, document, location: {}, navigator: {}, setTimeout, clearTimeout, console });
  const r = await window.Ark.loadRenderer('host', 'x');
  assert.equal(typeof r.mount, 'function');
});

test('the 2D Kart Race TV exposes make() and still registers kart-race', () => {
  const window = {};
  const { Ark, registered } = arkStub();
  vm.runInNewContext(fs.readFileSync('public/games/kart-race/host.js', 'utf8'), { Ark, window, setTimeout, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  assert.equal(typeof window.ArkKartTV.make, 'function');
  assert.equal(registered.length, 1);
  assert.equal(registered[0].kind, 'host');
  assert.equal(registered[0].id, 'kart-race');
  assert.deepEqual(Object.keys(registered[0].r), Object.keys(window.ArkKartTV.make({})));
});

test("Kart Race 3D's phone is the Kart Race phone", () => {
  const marker = Promise.resolve({ mount() {} });
  const asked = [];
  const { Ark, registered } = arkStub({ loadRenderer: (kind, id) => (asked.push([kind, id]), marker) });
  vm.runInNewContext(fs.readFileSync('public/games/kart-race-3d/player.js', 'utf8'), { Ark, window: {} });
  assert.deepEqual(asked, [['player', 'kart-race']]);
  assert.equal(registered.length, 1);
  assert.equal(registered[0].id, 'kart-race-3d');
  assert.equal(registered[0].r, marker);
});

test("Kart Race 3D's TV is the Kart Race TV with a stage: sounds, pad hooks and all", async () => {
  const window = {};
  const { Ark, registered } = arkStub();
  const context = vm.createContext({ Ark, window, setTimeout, performance, requestAnimationFrame() {}, cancelAnimationFrame() {} });
  // Loading the Kart Race TV runs it in the same page; its own helpers never arrive.
  Ark.loadScript = (src) => {
    if (src !== '/games/kart-race/host.js') return new Promise(() => {});
    vm.runInContext(fs.readFileSync('public' + src, 'utf8'), context);
    return Promise.resolve();
  };
  vm.runInContext(fs.readFileSync('public/games/kart-race-3d/host.js', 'utf8'), context);
  const mine = registered.find((x) => x.id === 'kart-race-3d');
  assert.equal(mine.kind, 'host');
  const r = await mine.r;
  for (const hook of ['sounds', 'pad', 'padPoll', 'mount', 'update', 'unmount']) assert.equal(typeof r[hook], 'function', hook);
  assert.equal(typeof r.padHint, 'string');
});
