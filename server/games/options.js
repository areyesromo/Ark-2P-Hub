// Match settings a game lets players pick on a setup screen before it starts
// (grid size, number of holes...). A game declares its choices as
//   OPTIONS = { key: [default, other, values...] }
// and the room remembers what was picked last time (ctx.saved), so the next
// launch starts from it. The setup screen itself is Ark.setupHtml on the
// client (public/shared/common.js).

/** The defaults: the first value of each option. */
export function defaultsOf(options) {
  const out = {};
  for (const key of Object.keys(options)) out[key] = options[key][0];
  return out;
}

/** The settings to start from: the ones the room saved, where still valid, else the defaults. */
export function loadSettings(ctx, options) {
  const saved = (ctx.saved && ctx.saved.settings) || {};
  const out = defaultsOf(options);
  for (const key of Object.keys(options)) if (options[key].includes(saved[key])) out[key] = saved[key];
  return out;
}

/**
 * Apply one { key, value } a player picked, if it's a valid choice, and
 * remember it in the room. Returns true when the settings changed.
 */
export function applySetting(ctx, options, settings, key, value) {
  if (!Object.prototype.hasOwnProperty.call(options, key) || !options[key].includes(value)) return false;
  if (settings[key] === value) return false;
  settings[key] = value;
  if (ctx.saved) ctx.saved.settings = { ...settings };
  return true;
}
