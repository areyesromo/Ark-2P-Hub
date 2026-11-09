// Kart Race 3D's screens in an 8-kart Cup: places out of eight, the order list, eight dots on the
// course map, the cup's points table, and the phones (2-kart races show what they always did).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { kartViews, kartCupViews } from './fixtures/kart-race-3d-views.js';

function ui() {
  const context = vm.createContext({ window: {}, Ark: { escapeHtml: (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;') } });
  context.window = context;
  for (const file of ['kart-race/track.js', 'kart-race/items.js', 'kart-race-3d/ui.js']) vm.runInContext(fs.readFileSync('public/games/' + file, 'utf8'), context);
  return context.ArkKart3DUI.create();
}

// Minimal nodes, as in kart-race-3d-ui.test.js.
class Node {
  constructor() { this.children = new Map(); this.attrs = {}; this.style = {}; this.textContent = ''; this.innerHTML = ''; this.classes = new Set(); this.classList = { toggle: (k, v) => (v ? this.classes.add(k) : this.classes.delete(k)) }; }
  querySelector(key) { if (!this.children.has(key)) this.children.set(key, new Node()); return this.children.get(key); }
  querySelectorAll(key) { return [this.querySelector(key + '0'), this.querySelector(key + '1')]; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
const helpers = { settings: () => '', preview: () => '', picks: () => '', board: () => 'Standings table' };

test('the HUD places you out of eight; two-kart races keep 1st and 2nd', () => {
  const instance = ui();
  const el = new Node();
  instance.hud(kartCupViews().race, el);
  assert.equal(el.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-position').textContent, '3rd / 8');
  assert.equal(el.querySelectorAll('.kr3d-driver')[1].querySelector('.kr3d-position').textContent, '5th / 8');
  assert.match(el.querySelector('.kr3d-series').textContent, /CUP · RACE 1 \/ 5/);
  const two = new Node();
  ui().hud(kartViews().race, two);
  assert.match(two.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-position').textContent, /^(1st|2nd)$/);
});

test('an order list of all eight, the players marked', () => {
  const el = new Node();
  ui().hud(kartCupViews().race, el);
  const list = el.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-order').innerHTML;
  assert.equal((list.match(/<li/g) || []).length, 8);
  assert.match(list, /class="p1[^"]*"[^>]*>\s*<b>3<\/b>/);
  assert.match(list, /class="p2[^"]*"[^>]*>\s*<b>5<\/b>/);
  assert.equal(el.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-order').hidden, false);
  const two = new Node();
  ui().hud(kartViews().race, two);
  assert.equal(two.querySelectorAll('.kr3d-driver')[0].querySelector('.kr3d-order').hidden, true);
});

test('eight dots on the course map: six small computer ones', () => {
  const el = new Node();
  ui().hud(kartCupViews().race, el);
  const cpus = el.querySelector('.kr3d-map').querySelector('svg').querySelector('.kr3d-map-cpus').innerHTML;
  assert.equal((cpus.match(/<circle/g) || []).length, 6);
});

test("the cup's table: eight rows by total, this race's place and points, the players marked", () => {
  const html = ui().overlay(kartCupViews().standings, helpers);
  const rows = html.match(/<tr class="kr3d-cup-row[^"]*"/g) || [];
  assert.equal(rows.length, 8);
  // Totals after race 1 by kart: [6, 4, 10, 8, 5, 3, 2, 1]: kart 2 leads, then 3, then player 1...
  const totals = [...html.matchAll(/<td class="kr3d-total">(\d+)<\/td>/g)].map((m) => Number(m[1]));
  assert.deepEqual(totals, [10, 8, 6, 5, 4, 3, 2, 1]);
  assert.match(html, /<tr class="kr3d-cup-row p1"/);
  assert.match(html, /<tr class="kr3d-cup-row p2"/);
  const over = ui().overlay(kartCupViews().over, helpers);
  assert.match(over, /wins the cup/);
  assert.match(over, /\(CPU\) topped the table/);
});

// ---- the phones ----

class Element {
  constructor() {
    this.nodes = new Map(); this.listeners = {}; this.attrs = {}; this.innerHTML = ''; this.textContent = '';
    this.style = { setProperty(k, v) { this[k] = v; } };
    const classes = new Set();
    this.classList = { toggle: (k, v) => (v ? classes.add(k) : classes.delete(k)), contains: (k) => classes.has(k) };
  }
  appendChild(el) { this.child = el; }
  querySelector(k) { if (!this.nodes.has(k)) this.nodes.set(k, new Element()); return this.nodes.get(k); }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
function phoneStatus(view, me) {
  const window = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} };
  const Ark = { escapeHtml: String, loadCss() {}, loadScript: () => new Promise(() => {}), register() {}, setup: { bind() {}, html: () => '' } };
  vm.runInNewContext(fs.readFileSync('public/games/kart-race/player.js', 'utf8'), { Ark, window, document: { createElement: () => new Element() }, localStorage: { getItem: () => null } });
  const p = window.ArkKartPhone.make({ threeD: true });
  const host = new Element();
  p.mount(host, { send() {}, vibrate() {} });
  p.update({ ...view, you: me });
  return host.child.querySelector('.status').innerHTML;
}

test('the phone: your place out of eight, then both your points', () => {
  const v = kartCupViews();
  assert.match(phoneStatus(v.race, 0), /3rd of 8/);
  const between = phoneStatus(v.standings, 0);
  assert.match(between, /You: 6 pts/);
  assert.match(between, /Alex: 4 pts/);
  assert.match(between, /3rd in the table/);
  assert.match(phoneStatus(v.over, 1), /You: 20 pts/);
});
