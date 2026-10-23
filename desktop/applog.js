// The desktop app's log file: how it started and what went wrong, for when the window shows
// nothing (Game Mode on the Deck). Lines wait in memory until open(): the app opens the log only
// once it knows it's the one copy running, so a second launch can't rotate a running copy's log
// away. Each run starts main.log afresh and keeps the run before as main.old.log. Logging never
// throws: a log that can't be written is skipped.
import fs from 'node:fs';
import path from 'node:path';

const MAX_BYTES = 1024 * 1024; // a run's log stops here (repeating errors can't fill the disk)

/**
 * @returns {((msg: string, data?: unknown) => void) & { open(opts?: { rotate?: boolean }): void }}
 */
export function createLog(dir, { now = () => new Date(), maxBytes = MAX_BYTES } = {}) {
  const file = path.join(dir, 'main.log');
  let pending = []; // lines before open()
  let written = 0;
  let full = false;
  const write = (line) => {
    if (full) return;
    if (written + line.length > maxBytes) {
      full = true;
      line = now().toISOString() + ' (the log is full: nothing more this run)\n';
    }
    written += line.length;
    try {
      fs.appendFileSync(file, line);
    } catch {
      // nowhere to write: carry on without the log
    }
  };
  const log = (msg, data) => {
    const line = now().toISOString() + ' ' + msg + (data === undefined ? '' : ' ' + JSON.stringify(data)) + '\n';
    if (pending) pending.push(line);
    else write(line);
  };
  /** Start writing. rotate: false adds to the existing main.log (a second copy saying so). */
  log.open = ({ rotate = true } = {}) => {
    if (!pending) return;
    try {
      fs.mkdirSync(dir, { recursive: true });
      if (rotate && fs.existsSync(file)) fs.renameSync(file, path.join(dir, 'main.old.log'));
    } catch {
      // the writes fail quietly too
    }
    const lines = pending;
    pending = null;
    lines.forEach(write);
  };
  return log;
}
