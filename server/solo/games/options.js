// Match settings a game lets the player pick on a setup screen before it starts
// (speed, board size...). The room remembers what was picked last time
// (ctx.saved), so the next launch starts from it. The setup screen itself is
// Ark.setup on the client (public/shared/common.js).

/** The defaults: the first value of each option. */
export function defaultsOf(options) {
  const out = {};
  for (const key of Object.keys(options)) out[key] = options[key][0];
  return out;
}

/** The settings to start from: the ones the room saved, where still valid and unlocked, else the defaults. */
export function loadSettings(ctx, options, locked = {}) {
  const saved = (ctx.saved && ctx.saved.settings) || {};
  const out = defaultsOf(options);
  for (const key of Object.keys(options)) if (options[key].includes(saved[key]) && !isLocked(locked, key, saved[key])) out[key] = saved[key];
  return out;
}

const isLocked = (locked, key, value) => Boolean(locked[key] && Object.prototype.hasOwnProperty.call(locked[key], value));

/**
 * The choices this player hasn't unlocked yet: { key: { value: how to unlock it } }.
 * A spec option's lock(value, achievements, ctx) gives that line, or null when it's open;
 * achievements are the player's ({ id: when }, see ctx.achievements), and ctx.best(variant)
 * their best in this game (for levels that open one after another).
 */
export function lockedFor(ctx, spec) {
  const have = (ctx.achievements && ctx.achievements()) || {};
  const out = {};
  for (const [key, s] of Object.entries(spec)) {
    if (!s.lock) continue;
    for (const v of s.values) {
      const why = s.lock(v, have, ctx);
      if (why) (out[key] = out[key] || {})[v] = why;
    }
  }
  return out;
}

/**
 * Apply one { key, value } the player picked, if it's a valid choice they've
 * unlocked, and remember it in the room. Returns true when the settings changed.
 */
export function applySetting(ctx, options, settings, key, value, locked = {}) {
  if (!Object.prototype.hasOwnProperty.call(options, key) || !options[key].includes(value) || isLocked(locked, key, value)) return false;
  if (settings[key] === value) return false;
  settings[key] = value;
  if (ctx.saved) ctx.saved.settings = { ...settings };
  return true;
}

/** A setting a game was started with (see withSetup), or its usual value. */
export function settingOf(ctx, key, fallback) {
  return ctx.settings && ctx.settings[key] !== undefined ? ctx.settings[key] : fallback;
}

/**
 * Give a game a setup screen without touching its code: the returned game
 * opens on the hub's own setup screen (the TV and the phone draw it, see
 * `hubSetup` in public/host/host.js and public/play/play.js), then starts the
 * real game with ctx.settings. When a run is over, a { type: 'setup' } input
 * goes back to the setup screen.
 *
 *   withSetup(snake, { speed: { title: 'Speed', values: ['normal', 'fast'], label: (s) => ... } })
 *
 * The game reads its settings with settingOf(ctx, 'speed', 'normal'). An option
 * can also have lock(value, achievements) -> 'how to unlock it' or null, for
 * choices earned by playing (Helicopter Cave's maps and vehicles).
 */
export function withSetup(def, spec) {
  const options = {};
  const rows = [];
  for (const [key, s] of Object.entries(spec)) {
    options[key] = s.values;
    rows.push({ key, title: s.title, labels: Object.fromEntries(s.values.map((v) => [v, s.label(v)])) });
  }
  // base: the game without its setup screen (the daily challenge starts it with set settings).
  return { ...def, base: def, options, spec, create: (ctx) => new SetupFirst(ctx, def, options, rows, spec) };
}

class SetupFirst {
  constructor(ctx, def, options, rows, spec) {
    this.ctx = ctx;
    this.def = def;
    this.options = options;
    this.rows = rows;
    this.spec = spec;
    this.settings = loadSettings(ctx, options, this.locked());
    this.game = null;
  }

  /** Worked out afresh each time: a run can unlock something, or another player can sit down. */
  locked() {
    return lockedFor(this.ctx, this.spec);
  }

  /** Back to choices this player has (another player may have picked something they haven't). */
  unpickLocked() {
    const locked = this.locked();
    const defaults = defaultsOf(this.options);
    for (const key of Object.keys(this.settings)) if (isLocked(locked, key, this.settings[key])) this.settings[key] = defaults[key];
  }

  start() {
    this.game = null;
    this.unpickLocked();
    this.ctx.update();
  }

  begin() {
    // The game gets the room's ctx plus the settings picked.
    const ctx = Object.create(this.ctx);
    ctx.settings = { ...this.settings };
    this.game = this.def.create(ctx);
    this.game.start();
  }

  onInput(input) {
    if (!this.game) {
      if (input.type === 'setting' && applySetting(this.ctx, this.options, this.settings, input.key, input.value, this.locked())) this.ctx.update();
      if (input.type === 'go') {
        this.unpickLocked();
        this.begin();
      }
      return;
    }
    if (input.type === 'setup' && this.game.hostView().phase === 'over') return this.start();
    this.game.onInput(input);
  }

  hub() {
    return { hubSetup: { rows: this.rows, settings: this.settings, options: this.options, locked: this.locked() } };
  }

  hostView() {
    return this.game ? { ...this.game.hostView(), ...this.hub() } : { phase: 'setup', player: this.ctx.player, ...this.hub() };
  }

  playerView() {
    return this.game ? { ...this.game.playerView(), ...this.hub() } : { phase: 'setup', ...this.hub() };
  }
}
