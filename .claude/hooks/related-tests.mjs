// related-tests.mjs: a Claude Code PostToolUse hook. After an Edit or Write, run the node:test files
// that belong to the edited file, so a broken game shows up straight away without the whole suite.
//   server/games/kart-items.js     -> test/kart-items*.test.js, else test/kart*.test.js, plus tests that import it
//   server/games/minis/sumo.js     -> test/minis*.test.js (+ importers)
//   public/games/connect-four/...  -> test/connect-four*.test.js
//   server/stats.js                -> test/stats*.test.js (+ importers)
//   test/pong.test.js              -> itself
// Silent when nothing matches or the tests pass; on a failure it exits 2 so the output goes back to Claude.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEST = path.join(ROOT, 'test');
const MAX_FILES = 8; // a shared helper used everywhere: leave it to `npm test`

let input = '';
for await (const chunk of process.stdin) input += chunk;
const file = (() => {
  try {
    const p = JSON.parse(input).tool_input?.file_path;
    return p ? path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/') : null;
  } catch {
    return null;
  }
})();
if (!file || file.startsWith('..') || !/\.(m?js|css)$/.test(file)) process.exit(0);

const tests = fs.readdirSync(TEST).filter((f) => f.endsWith('.test.js'));
const byPrefix = (id) => tests.filter((f) => f === `${id}.test.js` || f.startsWith(`${id}-`));

function related() {
  if (/^test\/[^/]+\.test\.js$/.test(file)) return [path.basename(file)];
  let m = file.match(/^(?:server|public)\/games\/([^/]+)\//); // a game's folder, or minis/ and board/
  if (m) return byPrefix(m[1]);
  m = file.match(/^server\/(?:games\/)?([^/]+)\.js$/);
  if (!m) return [];
  const id = m[1];
  let found = byPrefix(id);
  if (!found.length) found = byPrefix(id.split('-')[0]); // kart-items -> kart-race, kart-racers
  // Plus any test that imports this module directly.
  const importers = tests.filter((f) => fs.readFileSync(path.join(TEST, f), 'utf8').includes(`/${file.replace(/^server\//, '')}'`));
  return [...new Set([...found, ...importers])];
}

const files = related();
if (process.env.RELATED_TESTS_DRY) console.log(file, '->', files.join(' ') || '(none)'); // to check the mapping
if (!files.length || files.length > MAX_FILES || process.env.RELATED_TESTS_DRY) process.exit(0);

const run = spawnSync(process.execPath, ['--test', ...files.map((f) => `test/${f}`)], { cwd: ROOT, encoding: 'utf8' });
if (run.status === 0) process.exit(0);
const out = (run.stdout + run.stderr).split('\n');
process.stderr.write(`Related tests failed after editing ${file} (${files.join(', ')}):\n${out.slice(-60).join('\n')}\n`);
process.exit(2);
