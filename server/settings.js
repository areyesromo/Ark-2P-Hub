import fs from 'node:fs';
import path from 'node:path';

/**
 * The hub's looks, picked in Settings: default (the original), neon (the two players' colours
 * facing off on a split screen) and cozy (games as boxes on a shelf). Each but default is a
 * stylesheet in public/shared/themes/, served as /theme.css (see app.js).
 */
export const THEMES = ['default', 'neon', 'cozy'];

/**
 * Small persistent settings store (a JSON file in the data folder, which is a
 * Docker volume so it survives updates): the join address for the QR code, online
 * play and the theme. Settings has no password: it opens only at home (see app.js).
 */
export class Settings {
  constructor(dataDir) {
    this.file = path.join(dataDir, 'settings.json');
    this.data = this.load();
    delete this.data.passwordHash; // (from before Settings dropped its password: gone at the next save)
  }

  load() {
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch {
      return {};
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  /** The look of the TV and phones (see THEMES): Default unless picked in Settings. */
  get theme() {
    return THEMES.includes(this.data.theme) ? this.data.theme : 'default';
  }

  setTheme(theme) {
    if (!THEMES.includes(theme)) return false;
    if (theme === 'default') delete this.data.theme;
    else this.data.theme = theme;
    this.save();
    return true;
  }

  get joinUrl() {
    return this.data.joinUrl || '';
  }

  setJoinUrl(origin) {
    if (origin) this.data.joinUrl = origin;
    else delete this.data.joinUrl;
    this.save();
  }

  /** Online play (the TV's 🌍 Invite online button): on unless turned off in Settings. */
  get onlineAllowed() {
    return this.data.onlineAllowed !== false;
  }

  /** An internet address of the owner's own (their own tunnel or domain), used instead of a quick tunnel. */
  get tunnelUrl() {
    return this.data.tunnelUrl || '';
  }

  setOnline({ allowed, tunnelUrl } = {}) {
    if (typeof allowed === 'boolean') this.data.onlineAllowed = allowed;
    if (typeof tunnelUrl === 'string') {
      if (tunnelUrl) this.data.tunnelUrl = tunnelUrl;
      else delete this.data.tunnelUrl;
    }
    this.save();
  }
}
