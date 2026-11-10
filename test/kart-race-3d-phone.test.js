import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { kartViews } from './fixtures/kart-race-3d-views.js';

class Element {
  constructor() {
    this.nodes = new Map(); this.listeners = {}; this.attrs = {}; this.innerHTML = ''; this.textContent = '';
    this.style = { setProperty(k, v) { this[k] = v; } };
    const classes = new Set();
    this.classList = { toggle: (k, v) => v ? classes.add(k) : classes.delete(k), contains: k => classes.has(k) };
  }
  appendChild(el) { this.child = el; }
  querySelector(k) { if (!this.nodes.has(k)) this.nodes.set(k, new Element()); return this.nodes.get(k); }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  setAttribute(k, v) { this.attrs[k] = v; }
}
function phone() {
  const registered = {};
  const window = { innerWidth: 390, innerHeight: 844, addEventListener() {}, removeEventListener() {} };
  const Ark = { escapeHtml: String, loadCss() {}, loadScript: () => new Promise(() => {}), register: (_kind, id, r) => { registered[id] = r; }, setup: { bind() {}, html: () => '' } };
  vm.runInNewContext(fs.readFileSync('public/games/kart-race/player.js', 'utf8'), { Ark, window, document: { createElement: () => new Element() }, localStorage: { getItem: () => null } });
  return { factory: window.ArkKartPhone, original: registered['kart-race'] };
}
test('3D phone labels charge and items, releases a cancelled hold and ignores an empty item slot', () => {
  const { factory } = phone();
  const sent = [];
  const host = new Element();
  const p = factory.make({ threeD: true });
  p.mount(host, { send: input => sent.push(input), vibrate() {} });
  const root = host.child;
  const v = { ...kartViews().race, you: 0 };
  p.update(v);
  const drift = root.querySelector('.drift');
  assert.match(root.className, /kr3d-phone/);
  assert.equal(drift.querySelector('small').textContent, 'Release for boost');
  assert.equal(drift.style['--charge'], '100%');
  const e = { pointerId: 1, preventDefault() {} };
  drift.listeners.pointerdown(e);
  assert.equal(sent.at(-1).drift, true);
  drift.listeners.pointercancel(e);
  assert.equal(sent.at(-1).drift, false);
  root.querySelector('.item').listeners.pointerdown(e);
  assert.equal(sent.at(-1).type, 'item');
  v.karts[0].items = [];
  v.karts[0].driftCharge = 0;
  p.update(v);
  assert.equal(drift.querySelector('small').textContent, 'Charging boost');
  assert.match(root.querySelector('.item').innerHTML, /Collect a \? box/);
  const count = sent.length;
  root.querySelector('.item').listeners.pointerdown(e);
  assert.equal(sent.length, count);
  p.unmount();
});

test('switching from the 3D phone back to the original keeps the 2D presentation', () => {
  const { factory, original } = phone();
  const api = { send() {}, vibrate() {} };
  const three = factory.make({ threeD: true });
  three.mount(new Element(), api);
  three.update({ ...kartViews().race, you: 0 });
  three.unmount();
  const host = new Element();
  original.mount(host, api);
  original.update({ ...kartViews().setup, you: 0 });
  assert.equal(host.child.className, 'kr-phone');
  assert.match(host.child.querySelector('.status').innerHTML, /Kart Race<\/span>/);
  assert.ok(!host.child.querySelector('.status').innerHTML.includes('Kart Race 3D'));
  assert.ok(!host.child.querySelector('.item').innerHTML.includes('Collect a'));
  original.unmount();
});

/** A 3D (or 2D) phone mid-race, and what it sends. */
function racingPhone(threeD) {
  const { factory } = phone();
  const sent = [];
  const host = new Element();
  const p = factory.make(threeD ? { threeD: true } : {});
  p.mount(host, { send: (input) => sent.push(input), vibrate() {} });
  p.update({ ...kartViews().race, you: 0 });
  return { root: host.child, sent, drives: () => sent.filter((s) => s.type === 'drive') };
}

test("the 3D phone's Look back button sends back while held", () => {
  const { root, drives } = racingPhone(true);
  const e = { pointerId: 3, preventDefault() {} };
  root.querySelector('.lookback').listeners.pointerdown(e);
  assert.equal(drives().at(-1).back, true);
  root.querySelector('.lookback').listeners.pointerup(e);
  assert.equal(drives().at(-1).back, false);
});

test('the look strip sends where the finger is, and 0 when it lifts', () => {
  const { root, drives } = racingPhone(true);
  const strip = root.querySelector('.kr-lookstrip');
  strip.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40 });
  strip.listeners.pointerdown({ pointerId: 4, clientX: 150, clientY: 20, preventDefault() {} });
  assert.equal(drives().at(-1).look, 0.5);
  strip.listeners.pointermove({ pointerId: 4, clientX: 0, clientY: 20 });
  assert.equal(drives().at(-1).look, -1);
  strip.listeners.pointercancel({ pointerId: 4 });
  assert.equal(drives().at(-1).look, 0);
});

test('the 2D phone sends no look', () => {
  const { root, drives } = racingPhone(false);
  assert.doesNotMatch(root.innerHTML, /kr-look/);
  const e = { pointerId: 1, preventDefault() {} };
  root.querySelector('.gas').listeners.pointerdown(e);
  const last = drives().at(-1);
  assert.ok(last && !('look' in last) && !('back' in last), JSON.stringify(last));
});
