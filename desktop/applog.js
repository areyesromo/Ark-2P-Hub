// The desktop app's log file: how it started and what went wrong, for when the window shows
// nothing (Game Mode on the Deck). Each run starts main.log afresh and keeps the last as
// main.old.log. Logging never throws: a log that can't be written is skipped.
import fs from 'node:fs';
import path from 'node:path';

/** @returns {(msg: string, data?: unknown) => void} */
export function createLog(dir, now = () => new Date()) {
  const file = path.join(dir, 'main.log');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(file)) fs.renameSync(file, path.join(dir, 'main.old.log'));
  } catch {
    // the writes below fail quietly too
  }
  return (msg, data) => {
    const line = now().toISOString() + ' ' + msg + (data === undefined ? '' : ' ' + JSON.stringify(data)) + '\n';
    try {
      fs.appendFileSync(file, line);
    } catch {
      // nowhere to write: carry on without the log
    }
  };
}
