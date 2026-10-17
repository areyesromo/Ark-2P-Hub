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
