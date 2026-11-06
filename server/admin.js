import express from 'express';
import { randomBytes } from 'node:crypto';
import { normalizeJoinUrl } from './network.js';

const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

/**
 * /api/admin: password setup/login and the settings the admin page edits.
 *
 *   GET  /api/admin/status     { needsSetup, passwordFromEnv, joinUrl, envOverride, detected }
 *   POST /api/admin/setup      { password } -> { token }   (only while no password exists)
 *   POST /api/admin/login      { password } -> { token }
 *   POST /api/admin/logout
 *   PUT  /api/admin/settings   { joinUrl }  -> { joinUrl } (Bearer token)
 *   POST /api/admin/stats/reset              -> { ok }     (Bearer token) wipe match history
 *   POST /api/admin/trophies/reset           -> { ok }     (Bearer token) wipe trophies and practice records
 *   GET  /api/admin/online                   -> Online#status() (Bearer token) online play: on or off, the address, the tunnel
 *   PUT  /api/admin/online   { allowed?, tunnelUrl? } -> Online#status() (Bearer token)
 *   POST /api/admin/online/stop              -> Online#status() (Bearer token) stop the tunnel and every room's invite
 */
export function adminRouter({ settings, stats, trophies = null, practice = null, online = null, publicUrl, detectedJoin, onJoinUrlChange }) {
  const router = express.Router();
  router.use(express.json({ limit: '4kb' }));

  const sessions = new Map(); // token -> expiry
  const failures = new Map(); // ip -> { count, since }

  function newSession() {
    const token = randomBytes(24).toString('hex');
    sessions.set(token, Date.now() + SESSION_MS);
    return token;
  }

  function authed(req) {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const expiry = sessions.get(token);
    if (!expiry) return false;
    if (expiry < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function tooManyFailures(ip) {
    const f = failures.get(ip);
    if (!f) return false;
    if (Date.now() - f.since > FAILURE_WINDOW_MS) {
      failures.delete(ip);
      return false;
    }
    return f.count >= MAX_FAILURES;
  }

  function recordFailure(ip) {
    const f = failures.get(ip);
    if (!f || Date.now() - f.since > FAILURE_WINDOW_MS) failures.set(ip, { count: 1, since: Date.now() });
    else f.count++;
  }

  router.get('/status', (_req, res) => {
    res.json({
      needsSetup: !settings.hasPassword,
      passwordFromEnv: settings.passwordFromEnv,
      joinUrl: settings.joinUrl,
      envOverride: publicUrl || '',
      detected: detectedJoin(),
    });
  });

  router.post('/setup', (req, res) => {
    try {
      settings.createPassword(req.body && req.body.password);
    } catch (err) {
      return res.status(settings.hasPassword ? 409 : 400).json({ error: err.message });
    }
    res.json({ token: newSession() });
  });

  router.post('/login', (req, res) => {
    if (!settings.hasPassword) return res.status(409).json({ error: 'No password yet. Create one first.' });
    if (tooManyFailures(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    if (!settings.checkPassword(req.body && req.body.password)) {
      recordFailure(req.ip);
      return res.status(401).json({ error: 'Wrong password.' });
    }
    failures.delete(req.ip);
    res.json({ token: newSession() });
  });

  router.post('/logout', (req, res) => {
    sessions.delete((req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    res.json({ ok: true });
  });

  router.put('/settings', async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
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

  router.post('/stats/reset', (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
    if (stats) stats.reset();
    res.json({ ok: true });
  });

  // Online play (see online.js).
  router.get('/online', (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
    res.json(online ? online.status() : { allowed: false });
  });

  router.put('/online', async (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
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
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
    if (online) await online.stopAll();
    res.json(online ? online.status() : { allowed: false });
  });

  router.post('/trophies/reset', (req, res) => {
    if (!authed(req)) return res.status(401).json({ error: 'Please log in again.' });
    if (trophies) trophies.reset();
    if (practice) practice.reset();
    res.json({ ok: true });
  });

  return router;
}
