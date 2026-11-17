import express from 'express';
import { normalizeJoinUrl } from './network.js';
import { THEMES, LAYOUTS } from './settings.js';

/**
 * /api/admin: the settings the Settings page edits (on a computer, or Player 1's phone). There's no
 * password: Settings only opens at home, never over the internet (see app.js), and each change
 * must be sent as JSON, which another website can't do from your browser.
 *
 *   GET  /api/admin/status     { joinUrl, theme, themes, layout, layouts, envOverride, detected }
 *   PUT  /api/admin/settings   { joinUrl }  -> { joinUrl }
 *   POST /api/admin/stats/reset              -> { ok }     wipe match history
 *   POST /api/admin/trophies/reset           -> { ok }     wipe trophies and practice records
 *   GET  /api/admin/online                   -> Online#status() online play: on or off, the address, the tunnel
 *   PUT  /api/admin/online   { allowed?, tunnelUrl? } -> Online#status()
 *   POST /api/admin/online/stop              -> Online#status() stop the tunnel and every room's invite
 *   PUT  /api/admin/theme    { theme }       -> { theme }  the look of the TV and phones (THEMES)
 *   PUT  /api/admin/layout   { layout }      -> { layout } how the lobby is laid out (LAYOUTS)
 */
export function adminRouter({ settings, stats, trophies = null, practice = null, online = null, publicUrl, detectedJoin, onJoinUrlChange, onThemeChange = () => {} }) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  // A change only from the hub's own pages: JSON (another site's form or image can't send it without
  // asking first, and the hub never says yes) and, when the browser says where it came from, from here.
  router.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.get('origin');
    let sameHost = true;
    if (origin) {
      try {
        sameHost = new URL(origin).host === req.get('host');
      } catch {
        sameHost = false;
      }
    }
    if (!req.is('application/json') || !sameHost) return res.status(403).json({ error: 'Change settings from the hub\'s Settings page.' });
    next();
  });

  router.get('/status', (_req, res) => {
    res.json({
      joinUrl: settings.joinUrl,
      theme: settings.theme,
      themes: THEMES,
      layout: settings.layout,
      layouts: LAYOUTS,
      envOverride: publicUrl || '',
      detected: detectedJoin(),
    });
  });

  router.put('/settings', async (req, res) => {
    let joinUrl;
    try {
      joinUrl = normalizeJoinUrl(req.body && req.body.joinUrl);
    } catch {
      return res.status(400).json({ error: "That doesn't look like an address. Example: http://192.168.1.50:3000" });
    }
    settings.setJoinUrl(joinUrl);
    await onJoinUrlChange();
    res.json({ joinUrl });
  });

  router.put('/theme', (req, res) => {
    if (!settings.setTheme(req.body && req.body.theme)) return res.status(400).json({ error: 'Pick one of: ' + THEMES.join(', ') + '.' });
    onThemeChange(settings.theme);
    res.json({ theme: settings.theme });
  });

  router.put('/layout', (req, res) => {
    if (!settings.setLayout(req.body && req.body.layout)) return res.status(400).json({ error: 'Pick one of: ' + LAYOUTS.join(', ') + '.' });
    onThemeChange(settings.theme);
    res.json({ layout: settings.layout });
  });

  router.post('/stats/reset', (req, res) => {
    if (stats) stats.reset();
    res.json({ ok: true });
  });

  // Online play (see online.js).
  router.get('/online', (req, res) => {
    res.json(online ? online.status() : { allowed: false });
  });

  router.put('/online', async (req, res) => {
    if (!online) return res.status(404).json({ error: 'Online play isn\'t available here.' });
    const body = req.body || {};
    let tunnelUrl;
    if (body.tunnelUrl !== undefined) {
      try {
        tunnelUrl = normalizeJoinUrl(body.tunnelUrl);
      } catch {
        return res.status(400).json({ error: "That doesn't look like an address. Example: https://ark.example.com" });
      }
      if (tunnelUrl && !tunnelUrl.startsWith('https://')) return res.status(400).json({ error: 'Use an https:// address (phones need it for the motion games).' });
    }
    settings.setOnline({ allowed: typeof body.allowed === 'boolean' ? body.allowed : undefined, tunnelUrl });
    if (!settings.onlineAllowed) await online.stopAll();
    else await online.refresh();
    res.json(online.status());
  });

  router.post('/online/stop', async (req, res) => {
    if (online) await online.stopAll();
    res.json(online ? online.status() : { allowed: false });
  });

  router.post('/trophies/reset', (req, res) => {
    if (trophies) trophies.reset();
    if (practice) practice.reset();
    res.json({ ok: true });
  });

  return router;
}
