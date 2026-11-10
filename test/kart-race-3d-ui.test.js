import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { kartViews } from './fixtures/kart-race-3d-views.js';

function ui() {
  const context = vm.createContext({ window: {}, Ark: { escapeHtml: s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;') } });
  context.window = context;
  for (const file of ['kart-race/track.js', 'kart-race/items.js', 'kart-race-3d/ui.js']) vm.runInContext(fs.readFileSync('public/games/' + file, 'utf8'), context);
  return { context, instance: context.ArkKart3DUI.create() };
}

// Minimal nodes expose the HUD's output without requiring a graphics engine or browser.
class Node {
  constructor() { this.children = new Map(); this.attrs = {}; this.style = {}; this.textContent = ''; this.innerHTML = ''; this.classes = new Set(); this.classList = { toggle: (k, v) => v ? this.classes.add(k) : this.classes.delete(k) }; }
  querySelector(key) { if (!this.children.has(key)) this.children.set(key, new Node()); return this.children.get(key); }
  querySelectorAll(key) { return [this.querySelector(key + '0'), this.querySelector(key + '1')]; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
const helpers = { settings: () => '<button type="button">Race</button>', preview: () => 'Track preview', picks: () => 'Racer picks', board: () => 'Standings table' };

test('3D menus render server snapshots, readiness, battle, times and escaped player names', () => {
  const { instance } = ui();
  const views = kartViews();
  for (const v of Object.values(views)) assert.equal(typeof instance.overlay(v, helpers), 'string');
  assert.match(instance.overlay(views.setup, helpers), /Kart Race <em>3D/);
  assert.match(instance.overlay(views.setup, helpers), /Waiting for ready/);
  assert.match(instance.overlay(views.setup, helpers), /tabindex="-1" aria-disabled="true"/);
  assert.match(instance.overlay(views['battle-setup'], helpers), /THE ARENA/);
  assert.match(instance.overlay(views.over, helpers), /Did not finish/);
  views.over.players[0].name = '<img src=x onerror=bad()>';
  const result = instance.overlay(views.over, helpers);
  assert.ok(!result.includes('<img'));
  assert.match(result, /&lt;img/);
});

test('3D HUD preserves lap information during a penalty and updates existing nodes', () => {
  const { instance } = ui();
  const v = kartViews().race;
  const el = new Node();
  instance.hud(v, el);
  const first = el.querySelectorAll('.kr3d-driver')[0];
  const lap = first.querySelector('.kr3d-lap');
  const structure = el.innerHTML;
  assert.equal(lap.textContent, 'LAP 2 / 5');
  assert.equal(first.querySelector('.kr3d-drift').querySelector('span').textContent, 'RELEASE · BOOST');
  v.karts[0].jumped = true;
  v.karts[0].speed = -1;
  instance.hud(v, el);
  assert.equal(lap.textContent, 'LAP 2 / 5');
  assert.equal(first.querySelector('.kr3d-alert').textContent, 'Jump start · 1 s penalty');
  assert.equal(first.querySelector('.kr3d-speed strong').textContent, 'R 12');
  assert.equal(el.innerHTML, structure);
  v.phase = 'finish';
  instance.hud(v, el);
  assert.equal(el.hidden, true, 'overview camera does not show a misleading split HUD');
});

test('map uses the actual track width and current positions, with no battle finish line', () => {
  const { instance, context } = ui();
  const el = new Node();
  const v = kartViews().race;
  let calls = 0;
  const line = context.ArkKartTrack.centreLine;
  context.ArkKartTrack.centreLine = (...args) => { calls++; return line(...args); };
  instance.hud(v, el);
  instance.hud(v, el);
  const svg = el.querySelector('.kr3d-map').querySelector('svg');
  assert.equal(calls, 1, 'reuse geometry between updates');
  assert.equal(svg.querySelector('.kr3d-map-road').attrs['stroke-width'], v.trackWidth);
  assert.ok(!svg.querySelector('.kr3d-map-start').attrs.d.includes('NaN'));
  v.karts[0].x = 10;
  instance.hud(v, el);
  assert.equal(svg.querySelector('.p1').attrs.transform, 'translate(10 ' + v.karts[0].y + ')');
  instance.hud(kartViews().battle, el);
  assert.equal(svg.querySelector('.kr3d-map-start').style.display, 'none');
  instance.dispose();
  const replacement = new Node();
  instance.hud(v, replacement);
  assert.ok(replacement.innerHTML.includes('kr3d-driver'));
});

test('3D clock rolls over without showing 0:60.0', () => {
  const { context } = ui();
  assert.equal(context.ArkKart3DUI.clock(59999), '0:59.9');
  assert.equal(context.ArkKart3DUI.clock(60000), '1:00.0');
  assert.equal(context.ArkKart3DUI.clock(null), '—');
});

test("the HUD says when you're looking back", () => {
  const { instance } = ui();
  const v = kartViews().race;
  v.karts[0] = { ...v.karts[0], back: true, jumped: false, cut: false };
  const el = new Node();
  instance.hud(v, el);
  assert.equal(el.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-alert').textContent, '👀 Looking back');
});
