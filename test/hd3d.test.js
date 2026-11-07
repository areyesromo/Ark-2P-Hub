// public/shared/hd3d.js in a vm: the TV's HD setting and what glows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(stored = {}) {
  const window = {};
  const localStorage = { getItem: (k) => (k in stored ? stored[k] : null), setItem: (k, v) => { stored[k] = String(v); } };
  vm.runInNewContext(fs.readFileSync('public/shared/hd3d.js', 'utf8'), { window, localStorage });
  return { ArkHD: window.ArkHD, stored };
}

test('HD is on unless this TV picked standard; the pick is kept on the TV', () => {
  assert.equal(load().ArkHD.level(), 'hd');
  const { ArkHD, stored } = load();
  ArkHD.set('standard');
  assert.equal(stored['ark.graphics'], 'standard');
  assert.equal(load(stored).ArkHD.level(), 'standard');
  ArkHD.set('anything else');
  assert.equal(ArkHD.level(), 'hd');
});

test('standard draws as it always has: the renderer straight to the screen, nothing changed', () => {
  const { ArkHD } = load({ 'ark.graphics': 'standard' });
  let drawn = 0;
  const renderer = { render: () => drawn++, toneMapping: 0 };
  const hd = ArkHD.create({}, renderer, {}, {});
  assert.equal(hd.hd, false);
  hd.render();
  hd.setSize(100, 100);
  hd.dispose();
  assert.equal(drawn, 1);
  assert.equal(renderer.toneMapping, 0);
});

test('only what is meant to glow glows: strong emissive colours and bright unlit ones, not a faint face light', () => {
  const { ArkHD } = load();
  const c = (r, g, b) => ({ r, g, b });
  const glows = ArkHD.glows;
  assert.equal(glows({ emissive: c(0.76, 0.25, 0.05), emissiveIntensity: 0.9 }), true, 'lava');
  assert.equal(glows({ emissive: c(1, 1, 1), emissiveIntensity: 0.35 }), false, 'a tile face');
  assert.equal(glows({ emissive: c(1, 1, 1), emissiveIntensity: 1, emissiveMap: {} }), false, 'a texture lit by itself');
  assert.equal(glows({ emissive: c(0, 0, 0), emissiveIntensity: 1 }), false, 'no emissive');
  assert.equal(glows({ isMeshBasicMaterial: true, color: c(1, 0.6, 0.2), opacity: 0.8 }), true, 'a spark');
  assert.equal(glows({ isMeshBasicMaterial: true, color: c(0.03, 0.03, 0.03) }), false, 'a black hole');
  assert.equal(glows({ emissive: c(1, 1, 1), emissiveIntensity: 3, userData: { glow: false } }), false, 'told not to');
  assert.equal(glows({ color: c(0.2, 0.2, 0.2), userData: { glow: true } }), true, 'told to');
  assert.equal(glows(null), false);
});
