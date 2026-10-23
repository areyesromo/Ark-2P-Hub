import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const { LAUNCHER } = createRequire(import.meta.url)('../desktop/after-pack.cjs');
// The launcher is a /bin/sh script for Linux.
const skip = process.platform === 'win32';
const OVERLAY = '/home/deck/.local/share/Steam/ubuntu12_32/gameoverlayrenderer.so:/home/deck/.local/share/Steam/ubuntu12_64/gameoverlayrenderer.so';

/** The launcher in front of a stand-in app that prints what it was started with. */
function run(env, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-launcher-'));
  fs.writeFileSync(path.join(dir, 'app.bin'), '#!/bin/sh\necho "preload=${LD_PRELOAD-unset} marker=${ARK_STEAM_OVERLAY_REMOVED-none}"\nfor a in "$@"; do echo "arg=$a"; done\n', { mode: 0o755 });
  fs.writeFileSync(path.join(dir, 'app'), LAUNCHER.replace('__BIN__', 'app.bin'), { mode: 0o755 });
  const clean = { PATH: process.env.PATH, ...env };
  return execFileSync(path.join(dir, 'app'), args, { env: clean, encoding: 'utf8' }).trim().split('\n');
}

test('drops Steam\'s overlay library before the app starts', { skip }, () => {
  assert.deepEqual(run({ LD_PRELOAD: OVERLAY }), ['preload=unset marker=launcher']);
});

test('keeps any other preloaded library', { skip }, () => {
  assert.deepEqual(run({ LD_PRELOAD: '/usr/lib/libfoo.so:' + OVERLAY }), ['preload=/usr/lib/libfoo.so marker=launcher']);
});

test('leaves a start without Steam alone', { skip }, () => {
  assert.deepEqual(run({}), ['preload=unset marker=none']);
  assert.deepEqual(run({ LD_PRELOAD: '/usr/lib/libfoo.so' }), ['preload=/usr/lib/libfoo.so marker=none']);
});

test('passes the arguments on unchanged (spaces too)', { skip }, () => {
  assert.deepEqual(run({ LD_PRELOAD: OVERLAY }, ['--no-sandbox', 'a b']).slice(1), ['arg=--no-sandbox', 'arg=a b']);
});

test('no wildcard expansion in LD_PRELOAD', { skip }, () => {
  assert.deepEqual(run({ LD_PRELOAD: '/lib/*.so:' + OVERLAY }), ['preload=/lib/*.so marker=launcher']);
});
