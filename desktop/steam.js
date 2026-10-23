// Started by Steam, every process gets Steam's overlay library (gameoverlayrenderer.so) through
// LD_PRELOAD, even with the overlay switched off. Inside Electron's sandboxed helper processes it
// hangs, so the window never loads: a black screen in Game Mode (and from Steam in Desktop Mode).
// In the AppImage, a launcher drops it before the app starts (desktop/after-pack.cjs). Started any
// other way, the app replaces itself (same process) with one without it, first thing (see main.js). Steam's own menus and controller layout
// don't need it; only the in-game overlay (pop-ups, Steam screenshots) is lost.

/**
 * The environment for that restart, or null when there's nothing to remove (double-clicked, or
 * this is already the restarted copy).
 */
export function withoutSteamOverlay(env) {
  const preload = env.LD_PRELOAD || '';
  if (!preload.includes('gameoverlayrenderer')) return null;
  const kept = preload.split(/[:\s]+/).filter((lib) => lib && !lib.includes('gameoverlayrenderer'));
  const next = { ...env, ARK_STEAM_OVERLAY_REMOVED: '1' };
  if (kept.length) next.LD_PRELOAD = kept.join(':');
  else delete next.LD_PRELOAD;
  return next;
}
