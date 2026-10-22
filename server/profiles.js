import fs from 'node:fs';
import path from 'node:path';

// Player profiles: an avatar and a colour for each name, picked on the phone
// or on the TV. Kept in profiles.json in the data folder (next to the scores,
// so they survive updates). A name nobody has picked for yet gets a default
// worked out from the name, so it looks the same everywhere and every time.

export const AVATARS = [
  '🦊', '🐼', '🐸', '🐙', '🦄', '🐯', '🐧', '🐨', '🦁', '🐵', '🐶', '🐱',
  '🐰', '🐲', '🦉', '🐢', '👾', '🤖', '👻', '🌵', '🍄', '⭐', '🚀', '⚡',
  '🔥', '🌈', '🍕', '🎸', '⚽', '👑',
];
export const COLOURS = ['#22d3ee', '#f472b6', '#a78bfa', '#4ade80', '#facc15', '#fb923c', '#f87171', '#60a5fa', '#2dd4bf', '#e879f9'];

/** Players are matched by name, ignoring case and surrounding spaces. */
const nameKey = (name) => String(name || '').trim().toLowerCase();

function hash(text) {
  let h = 0x811c9dc5;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

/** The profile a name has before anyone picks: the same name always gets the same one. */
export function defaultProfile(name) {
  const h = hash(nameKey(name));
  return { avatar: AVATARS[h % AVATARS.length], colour: COLOURS[(h >>> 8) % COLOURS.length] };
}

export class Profiles {
  constructor(dataDir) {
    this.file = dataDir ? path.join(dataDir, 'profiles.json') : null;
    this.byName = this.load();
  }

  load() {
    if (!this.file) return {};
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch {
      return {};
    }
  }

  save() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.byName));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save the profiles:', err.message);
    }
  }

  /** A name's profile: { avatar, colour }, its own or the default. */
  get(name) {
    const mine = this.byName[nameKey(name)];
    const base = defaultProfile(name);
    if (!mine) return base;
    return {
      avatar: AVATARS.includes(mine.avatar) ? mine.avatar : base.avatar,
      colour: COLOURS.includes(mine.colour) ? mine.colour : base.colour,
    };
  }

  /** Profiles for several names (the high scores): nameKey -> profile. */
  forNames(names) {
    const out = {};
    for (const n of names) out[nameKey(n)] = this.get(n);
    return out;
  }

  /**
   * Change a name's avatar and/or colour; only choices from the lists count.
   * Returns the profile, or null when there was nothing valid to change.
   */
  set(name, { avatar, colour } = {}) {
    const key = nameKey(name);
    if (!key || !(AVATARS.includes(avatar) || COLOURS.includes(colour))) return null;
    const next = { ...this.get(name) };
    if (AVATARS.includes(avatar)) next.avatar = avatar;
    if (COLOURS.includes(colour)) next.colour = colour;
    this.byName[key] = next;
    this.save();
    return next;
  }
}
