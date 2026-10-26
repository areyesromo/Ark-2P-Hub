// public/host/host.js (the TV page) in a vm, with a do-anything stub for the DOM and the page's other
// globals, and a fake socket to send it room states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/** A stand-in for anything: every property is another one, and calling it returns one. */
function any() {
  const props = new Map();
  return new Proxy(function () {}, {
    get(_, key) {
      if (key === 'then') return undefined; // not a promise
      if (key === Symbol.toPrimitive) return () => '';
      if (key === 'length') return 0;
      if (!props.has(key)) props.set(key, any());
      return props.get(key);
    },
    set(_, key, value) {
      props.set(key, value);
      return true;
    },
    apply: () => any(),
    construct: () => any(),
  });
}

/** The TV page with Ark.loadRenderer answered by `load(gameId)`. Returns its socket's handlers. */
function tv(load) {
  const handlers = {};
  const socket = new Proxy({}, {
    get: (_, key) => (key === 'on' ? (name, fn) => { handlers[name] = fn; } : () => {}),
  });
  const stub = any;
  const Ark = stub();
  Ark.loadRenderer = (kind, gameId) => load(gameId);
  Ark.escapeHtml = String;
  const window = stub();
  window.arkDesktop = undefined; // a browser, not the desktop app
  const document = stub();
  const els = {};
  document.getElementById = (id) => els[id] || (els[id] = stub()); // the same element each time
  const context = {
    io: () => socket,
    Ark,
    window,
    document,
    localStorage: { getItem: () => null, setItem() {} },
    location: { origin: 'http://tv' },
    navigator: stub(),
    ArkSound: stub(),
    ArkPads: stub(),
    ArkMusic: stub(),
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {},
    console,
  };
  vm.runInNewContext(fs.readFileSync('public/host/host.js', 'utf8'), context);
  return { h: handlers, els };
}

const players = [{ slot: 0, name: 'Ana' }, { slot: 1, name: 'Ben' }];
const games = [{ id: 'pong', name: 'Pong', tagline: '', category: 'competitive' }, { id: 'tron', name: 'Tron', tagline: '', category: 'competitive' }];

test('leaving a game whose TV renderer is still loading goes back to the lobby without an error', () => {
  const { h } = tv(() => new Promise(() => {})); // never arrives
  h['room:state']({ phase: 'playing', gameId: 'pong', players, games });
  assert.doesNotThrow(() => h['room:state']({ phase: 'lobby', gameId: null, players, games }));
});

test('a renderer that arrives after its game was left is never mounted, and a late load error is not shown', async () => {
  let resolve;
  let reject;
  const mounted = [];
  const { h, els } = tv((id) => new Promise((res, rej) => { if (id === 'pong') resolve = res; else reject = rej; }));
  h['room:state']({ phase: 'playing', gameId: 'pong', players, games });
  h['room:state']({ phase: 'lobby', gameId: null, players, games });
  resolve({ mount: () => mounted.push('pong'), update() {} });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(mounted, []);
  h['room:state']({ phase: 'playing', gameId: 'tron', players, games });
  h['room:state']({ phase: 'lobby', gameId: null, players, games });
  reject(new Error('Could not load /games/tron/host.js'));
  await new Promise((r) => setImmediate(r));
  assert.ok(!String(els.stage.innerHTML).includes('Could not load'), 'the lobby shows no error from a game already left');
});
