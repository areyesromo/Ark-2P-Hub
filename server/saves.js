import fs from 'node:fs';
import path from 'node:path';
import v8 from 'node:v8';

/** How long a saved game waits to be picked up after a restart. */
export const SAVE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/**
 * An unchanged game is written again this often, so its time stays close to when the hub stopped:
 * a clock picked up after a restart doesn't count the time the hub was down (see resumed), and
 * without this, time a player spent thinking before a power cut would come back to them.
 */
export const SAVE_EVERY_MS = 5000;

/**
 * Games in progress, saved so a restart (an update, a power cut) doesn't lose them: one file per
 * room in DATA_DIR/games, written while the game waits for someone to move (see Room#saveGame).
 * The TV re-opens its room after a restart (host:resume), and the room picks its game up from
 * here. Kept as v8's own format: game state holds Sets and Maps, which JSON loses.
 */
export class GameSaves {
  constructor(dataDir, now = Date.now()) {
    this.dir = dataDir ? path.join(dataDir, 'games') : null;
    this.last = new Map(); // code -> { state, at }: the bytes last written, and when
    // Games nobody came back for (the TV never re-opened the room): gone after a day.
    if (this.dir && fs.existsSync(this.dir)) {
      for (const f of fs.readdirSync(this.dir)) {
        const file = path.join(this.dir, f);
        try {
          if (now - fs.statSync(file).mtimeMs > SAVE_MAX_AGE_MS) fs.rmSync(file, { force: true });
        } catch {
          // (gone already)
        }
      }
    }
  }

  file(code) {
    return /^[A-Z]{4}$/.test(code) && this.dir ? path.join(this.dir, `${code}.bin`) : null;
  }

  save(code, data, now = Date.now()) {
    const file = this.file(code);
    if (!file) return;
    try {
      const state = v8.serialize(data);
      const last = this.last.get(code);
      if (last && last.state.equals(state) && now - last.at < SAVE_EVERY_MS) return; // (the same game, just now)
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(`${file}.tmp`, v8.serialize({ data, savedAt: now }));
      fs.renameSync(`${file}.tmp`, file);
      this.last.set(code, { state, at: now });
    } catch (err) {
      console.error(`Could not save the game in room ${code}:`, err.message);
    }
  }

  /** The saved game for `code` (with savedAt, when), or null (none, unreadable, or too old to pick up). */
  load(code, now = Date.now()) {
    const file = this.file(code);
    if (!file || !fs.existsSync(file)) return null;
    try {
      const { data, savedAt } = v8.deserialize(fs.readFileSync(file));
      if (!data || !(now - savedAt <= SAVE_MAX_AGE_MS)) {
        this.remove(code);
        return null;
      }
      return { ...data, savedAt };
    } catch {
      this.remove(code);
      return null;
    }
  }

  remove(code) {
    const file = this.file(code);
    this.last.delete(code);
    if (file) fs.rmSync(file, { force: true });
  }
}

/**
 * A game's own state, to save: its fields, less the room's ctx and anything that's code (an rng
 * function, a bound method). Restoring puts them back on a new instance made by the game's create,
 * so what the constructor sets up (ctx, rng) is the new room's.
 */
export function stateOf(game, skip = []) {
  const out = {};
  for (const [key, value] of Object.entries(game)) {
    if (key === 'ctx' || key === 'timer' || skip.includes(key) || typeof value === 'function') continue;
    out[key] = value;
  }
  return out;
}

/** Put a saved state back on a new instance (see stateOf). */
export function restoreState(game, state) {
  Object.assign(game, state);
  return game;
}
