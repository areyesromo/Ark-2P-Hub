import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLog } from '../desktop/applog.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-log-'));

test('writes timestamped lines to main.log', () => {
  const dir = tmp();
  const log = createLog(dir, () => new Date('2026-10-23T07:00:00Z'));
  log('started', { port: 3000 });
  assert.equal(fs.readFileSync(path.join(dir, 'main.log'), 'utf8'), '2026-10-23T07:00:00.000Z started {"port":3000}\n');
});

test('keeps the previous run as main.old.log', () => {
  const dir = tmp();
  createLog(dir)('first run');
  createLog(dir)('second run');
  assert.match(fs.readFileSync(path.join(dir, 'main.old.log'), 'utf8'), /first run/);
  assert.doesNotMatch(fs.readFileSync(path.join(dir, 'main.log'), 'utf8'), /first run/);
});

test('never throws, even when the folder cannot be written', () => {
  const file = path.join(tmp(), 'not-a-folder');
  fs.writeFileSync(file, '');
  const log = createLog(path.join(file, 'logs'));
  assert.doesNotThrow(() => log('still fine'));
});
