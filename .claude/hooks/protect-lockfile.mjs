// protect-lockfile.mjs: a Claude Code PreToolUse hook. Refuses hand edits to package-lock.json, which CI
// installs with `npm ci`: a lockfile out of step with package.json breaks the build. Change dependencies
// with `npm install <pkg>` (or `npm uninstall`) and let npm rewrite the lockfile.
import path from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let file = '';
try {
  file = JSON.parse(input).tool_input?.file_path || '';
} catch {
  process.exit(0);
}
if (path.basename(file) !== 'package-lock.json') process.exit(0);
process.stderr.write('package-lock.json is written by npm, not by hand: use `npm install <pkg>` / `npm uninstall <pkg>` instead (CI runs `npm ci`).\n');
process.exit(2);
