// public/shared/common.js in a vm: the phone's setup screen sends the value it shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function tapSetting(value) {
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/shared/common.js', 'utf8'), { window, document: {}, location: {}, navigator: {}, setTimeout, clearTimeout, console });
  let handler = null;
  const el = { addEventListener: (type, fn) => { handler = fn; } };
  const sent = [];
  window.Ark.setup.bind(el, { send: (m) => sent.push(m) });
  const btn = { getAttribute: (a) => ({ 'data-key': 'k', 'data-value': String(value) })[a] };
  handler({ target: { closest: () => btn } });
  return sent[0].value;
}

test('setup buttons send numbers as numbers and words as words', () => {
  assert.equal(tapSetting(5), 5);
  assert.equal(tapSetting('3d'), '3d');
  assert.equal(tapSetting('fast'), 'fast');
  assert.equal(tapSetting('mix'), 'mix');
});
