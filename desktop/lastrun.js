// The version the app ran last time, kept in the data folder (last-version.txt): the TV's What's
// new card shows the notes since then. Kept here rather than in the page's storage, which is per
// port (the hub moves to the next free port when 3000 is taken).

import fs from 'node:fs';
import path from 'node:path';

/**
 * { previous, ranBefore } for this start, and records `current` for the next one. previous is
 * null when unknown; ranBefore says the data folder was already there (an older app ran).
 */
export function lastRun(dataDir, current) {
  const file = path.join(dataDir, 'last-version.txt');
  const ranBefore = fs.existsSync(dataDir);
  let previous = null;
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    if (/^\d+\.\d+\.\d+$/.test(text)) previous = text;
  } catch {
    // first run, or an app from before this file
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, current + '\n');
  } catch {
    // can't write: next time just shows nothing new
  }
  return { previous, ranBefore };
}
