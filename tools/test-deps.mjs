// test-deps.mjs: runs before `npm test` (the pretest script). A fresh clone has no node_modules,
// and then most test files fail with "Cannot find package": say what to do instead.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
// (by folder: some packages, three among them, don't let their package.json be imported)
const missing = [...Object.keys(pkg.dependencies), 'socket.io-client'].filter((name) => !fs.existsSync(path.join(ROOT, 'node_modules', name, 'package.json')));
if (missing.length) {
  console.error(`\nThe packages aren't installed (missing: ${missing.join(', ')}). Run this first:\n`);
  console.error('  npm ci\n');
  console.error('(Set ELECTRON_SKIP_BINARY_DOWNLOAD=1 to skip the desktop app\'s Electron download: the tests don\'t need it.)\n');
  process.exit(1);
}
