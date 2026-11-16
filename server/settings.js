import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const MIN_PASSWORD = 4;

/**
 * The hub's looks, picked in Settings: default (the original), neon (the two players' colours
 * facing off on a split screen) and cozy (games as boxes on a shelf). Each but default is a
 * stylesheet in public/shared/themes/, served as /theme.css (see app.js).
 */
export const THEMES = ['default', 'neon', 'cozy'];

/**
 * Small persistent settings store (a JSON file in the data folder, which is a
 * Docker volume so it survives updates). Holds the admin password hash and the
 * join address used for the QR code.
 *
 * The admin password comes from ADMIN_PASSWORD when set; otherwise the first
 * visit to /admin/ creates one.
 */
export class Settings {
  constructor(dataDir, { envPassword = process.env.ADMIN_PASSWORD } = {}) {
    this.file = path.join(dataDir, 'settings.json');
    this.envPassword = envPassword || '';
    this.data = this.load();
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

  get passwordFromEnv() {
    return Boolean(this.envPassword);
  }

  get hasPassword() {
    return this.passwordFromEnv || Boolean(this.data.passwordHash);
  }

  /** First-run setup only: refuses once a password exists. */
  createPassword(password) {
    if (this.hasPassword) throw new Error('A password is already set.');
    if (String(password || '').length < MIN_PASSWORD) {
      throw new Error(`Use at least ${MIN_PASSWORD} characters.`);
    }
    const salt = randomBytes(16);
    const hash = scryptSync(String(password), salt, 32);
    this.data.passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
    this.save();
  }

  checkPassword(password) {
    const given = String(password || '');
    if (this.passwordFromEnv) {
      const a = createHash('sha256').update(given).digest();
      const b = createHash('sha256').update(this.envPassword).digest();
      return timingSafeEqual(a, b);
    }
    const [scheme, saltHex, hashHex] = String(this.data.passwordHash || '').split('$');
    if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = scryptSync(given, Buffer.from(saltHex, 'hex'), expected.length);
    return timingSafeEqual(actual, expected);
  }
}
