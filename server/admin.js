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
 */
export function adminRouter({ settings, publicUrl, detectedJoin, onJoinUrlChange }) {
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

  return router;
}
