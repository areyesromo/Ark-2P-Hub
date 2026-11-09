import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor() { this.children = []; this.attrs = {}; this.listeners = {}; this.innerHTML = ''; this.hidden = false; }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(el) { this.children.push(el); }
  insertBefore(el) { this.children.unshift(el); }
  querySelector() { return this.button || (this.button = new Element()); }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  remove() { this.removed = true; }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
async function wrapper(create) {
  let registration;
  const window = { KR3D: { create }, ArkKartTV: { make: opts => opts }, ArkKart3DUI: { create: () => ({}) } };
  const Ark = { loadCss() {}, loadScript: async () => {}, register: (_kind, _id, renderer) => { registration = renderer; } };
  vm.runInNewContext(fs.readFileSync('public/games/kart-race-3d/host.js', 'utf8'), { Ark, window, document: { createElement: () => new Element() } });
  return (await registration).stage;
}

test('3D loading is visible, failure can retry by gamepad, and the latest view reaches the scene', async () => {
  let attempts = 0;
  let latest;
  let disposed = 0;
  const stage = await wrapper(() => ++attempts === 1 ? Promise.reject(Error('graphics unavailable')) : Promise.resolve({ update(v) { latest = v; }, dispose() { disposed++; } }));
  const arena = new Element();
  stage.mount(arena);
  const message = arena.children[1];
  assert.match(message.innerHTML, /Preparing the grid/);
  await flush();
  assert.match(message.innerHTML, /Retry loading/);
  assert.equal(message.hidden, false);
  assert.equal(stage.pad('A'), false, 'ordinary ready input is not consumed');
  const view = { phase: 'race' };
  stage.update(view);
  assert.equal(stage.pad('X'), true);
  assert.match(message.innerHTML, /Preparing the grid/);
  await flush();
  assert.equal(attempts, 2);
  assert.equal(latest, view);
  assert.equal(message.hidden, true);
  stage.unmount();
  assert.equal(disposed, 1);
  assert.equal(message.removed, true);
});

test('a scene that arrives after leaving the game is disposed and never updated', async () => {
  const pending = deferred();
  let disposed = 0;
  let updated = 0;
  const stage = await wrapper(() => pending.promise);
  stage.mount(new Element());
  stage.update({ phase: 'race' });
  await flush();
  stage.unmount();
  pending.resolve({ update() { updated++; }, dispose() { disposed++; } });
  await flush();
  assert.equal(updated, 0);
  assert.equal(disposed, 1);
});

test('a world initialization failure disposes the scene and leaves recovery visible', async () => {
  let disposed = 0;
  const stage = await wrapper(async () => ({ update() { throw Error('world failed'); }, dispose() { disposed++; } }));
  const arena = new Element();
  stage.mount(arena);
  stage.update({ phase: 'race' });
  await flush();
  assert.equal(disposed, 1);
  assert.equal(arena.children[1].hidden, false);
  assert.match(arena.children[1].innerHTML, /Retry loading/);
  assert.equal(typeof arena.children[1].querySelector('button').listeners.click, 'function');
  stage.unmount();
});
