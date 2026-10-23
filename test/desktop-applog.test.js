import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLog } from '../desktop/applog.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-log-'));
const read = (dir, f = 'main.log') => fs.readFileSync(path.join(dir, f), 'utf8');

test('writes timestamped lines to main.log once opened', () => {
  const dir = tmp();
  const log = createLog(dir, { now: () => new Date('2026-10-23T07:00:00Z') });
  log.open();
  log('started', { port: 3000 });
  assert.equal(read(dir), '2026-10-23T07:00:00.000Z started {"port":3000}\n');
});

test('lines from before open() are kept and written first', () => {
  const dir = tmp();
  const log = createLog(dir);
  log('early');
  assert.equal(fs.existsSync(path.join(dir, 'main.log')), false, 'nothing on disk before open()');
  log.open();
  log('late');
  assert.match(read(dir), /early\n.*late\n$/);
});

test('each run keeps the one before as main.old.log (replacing an older one)', () => {
  const dir = tmp();
  for (const run of ['first', 'second', 'third']) {
    const log = createLog(dir);
    log.open();
    log(run + ' run');
  }
  assert.match(read(dir, 'main.old.log'), /second run/);
  assert.match(read(dir), /third run/);
  assert.doesNotMatch(read(dir) + read(dir, 'main.old.log'), /first run/);
});

test('a second copy adds to the running copy\'s log instead of rotating it', () => {
  const dir = tmp();
  const running = createLog(dir);
  running.open();
  running('first copy started');
  const second = createLog(dir);
  second.open({ rotate: false });
  second('another copy is already running');
  running('first copy still going');
  assert.match(read(dir), /first copy started\n.*another copy.*\n.*first copy still going\n$/);
});

test('stops writing past the size cap, saying so once', () => {
  const dir = tmp();
  const log = createLog(dir, { maxBytes: 200 });
  log.open();
  for (let i = 0; i < 50; i++) log('line ' + i + ' with some padding to fill it up');
  const text = read(dir);
  assert.ok(text.length < 400, 'capped');
  assert.equal(text.match(/log is full/g).length, 1);
});

test('never throws, even when the folder cannot be written', () => {
  const file = path.join(tmp(), 'not-a-folder');
  fs.writeFileSync(file, '');
  const log = createLog(path.join(file, 'logs'));
  assert.doesNotThrow(() => {
    log.open();
    log('still fine');
  });
});
