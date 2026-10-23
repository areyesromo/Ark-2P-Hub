import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutSteamOverlay } from '../desktop/steam.js';

const OVERLAY = '/home/deck/.local/share/Steam/ubuntu12_32/gameoverlayrenderer.so:/home/deck/.local/share/Steam/ubuntu12_64/gameoverlayrenderer.so';

test('drops Steam\'s overlay library from LD_PRELOAD and marks the restart', () => {
  const env = withoutSteamOverlay({ LD_PRELOAD: OVERLAY, SteamGameId: '1', HOME: '/home/deck' });
  assert.equal('LD_PRELOAD' in env, false);
  assert.equal(env.SteamGameId, '1', 'the rest is kept');
  assert.equal(env.HOME, '/home/deck');
  assert.equal(env.ARK_STEAM_OVERLAY_REMOVED, '1');
});

test('keeps any other preloaded library', () => {
  const env = withoutSteamOverlay({ LD_PRELOAD: '/usr/lib/libfoo.so:' + OVERLAY });
  assert.equal(env.LD_PRELOAD, '/usr/lib/libfoo.so');
});

test('also handles a space-separated LD_PRELOAD', () => {
  const env = withoutSteamOverlay({ LD_PRELOAD: OVERLAY.replace(':', ' ') });
  assert.equal('LD_PRELOAD' in env, false);
});

test('nothing to do without the overlay (double-clicked, or already restarted)', () => {
  assert.equal(withoutSteamOverlay({ HOME: '/home/deck' }), null);
  assert.equal(withoutSteamOverlay({ LD_PRELOAD: '' }), null);
  assert.equal(withoutSteamOverlay({ LD_PRELOAD: '/usr/lib/libfoo.so' }), null);
});

test('does not touch the environment it was given', () => {
  const given = { LD_PRELOAD: OVERLAY };
  withoutSteamOverlay(given);
  assert.equal(given.LD_PRELOAD, OVERLAY);
});
