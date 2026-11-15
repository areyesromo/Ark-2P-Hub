// test-fast.mjs: `npm run test:fast`, every test file except the slow computer-vs-computer runs
// (whole games of every game at every level). For quick checks while working on a game; run the
// full `npm test` before committing.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TEST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test');
const SLOW = [/^bots-games/, /^kart-race-cpu\./];
const files = fs
  .readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.js') && !SLOW.some((re) => re.test(f)))
  .map((f) => path.join('test', f));
const run = spawnSync(process.execPath, ['--test', ...files, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(run.status ?? 1);
