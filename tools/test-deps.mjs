// test-deps.mjs: runs before `npm test` (the pretest script). A fresh clone has no node_modules,
// and then most test files fail with "Cannot find package": say what to do instead.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const missing = [...Object.keys(pkg.dependencies), 'socket.io-client'].filter((name) => {
  try {
    require.resolve(name + '/package.json');
    return false;
  } catch {
    return true;
  }
});
if (missing.length) {
  console.error(`\nThe packages aren't installed (missing: ${missing.join(', ')}). Run this first:\n`);
  console.error('  npm ci\n');
  console.error('(Set ELECTRON_SKIP_BINARY_DOWNLOAD=1 to skip the desktop app\'s Electron download: the tests don\'t need it.)\n');
  process.exit(1);
}
