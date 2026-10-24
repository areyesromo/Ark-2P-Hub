import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lastRun } from '../desktop/lastrun.js';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ark-run-')), 'data');

test('a brand new install: nothing ran before', () => {
  const dir = tmp();
  assert.deepEqual(lastRun(dir, '0.1.7'), { previous: null, ranBefore: false });
});

test('the next start knows the version that ran before', () => {
  const dir = tmp();
  lastRun(dir, '0.1.7');
  assert.deepEqual(lastRun(dir, '0.1.8'), { previous: '0.1.7', ranBefore: true });
  assert.deepEqual(lastRun(dir, '0.1.8'), { previous: '0.1.8', ranBefore: true });
});

test('an app from before this file existed (data folder already there) ran before', () => {
  const dir = tmp();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'settings.json'), '{}');
  assert.deepEqual(lastRun(dir, '0.1.7'), { previous: null, ranBefore: true });
});

test('a damaged file counts as unknown, not as a version', () => {
  const dir = tmp();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'last-version.txt'), 'garbage');
  assert.deepEqual(lastRun(dir, '0.1.7'), { previous: null, ranBefore: true });
});
