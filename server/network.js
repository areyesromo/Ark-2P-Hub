import fs from 'node:fs';
import os from 'node:os';

// Interfaces that are never the address a phone on the LAN should use.
const VIRTUAL_IFACE = /^(docker|br-|veth|cni|flannel|virbr|lo)/;

/** Best guess at this machine's LAN IPv4 address, or null. */
export function detectLanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) candidates.push({ name, address: a.address });
    }
  }
  const preferred = candidates.find((c) => !VIRTUAL_IFACE.test(c.name));
  return (preferred || candidates[0] || {}).address || null;
}

export function isLoopbackHost(hostname) {
  return /^(localhost|127\.|0\.0\.0\.0$|\[?::1\]?$)/.test(hostname);
}

export const inDocker = () => fs.existsSync('/.dockerenv');

/** Turn what a person typed ("192.168.1.50:3000", "http://ark.lan/") into an origin, or throw. */
export function normalizeJoinUrl(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Use an http:// or https:// address.');
  return u.origin;
}

/**
 * Work out the base URL phones should open (used for the QR code), and where it came from.
 *
 * Order of preference:
 *   1. PUBLIC_URL env var                               source: 'env'
 *   2. The join address saved in Settings (/admin/)     source: 'settings'
 *   3. The origin the TV opened, unless it's localhost  source: 'origin'
 *   4. The detected LAN address of this machine         source: 'detected'
 *
 * `guess` is true when the result is likely wrong: inside Docker the detected
 * address is the container's own IP, which phones can't reach.
 */
export function resolveJoin({ publicUrl, savedUrl, hostOrigin, port }) {
  if (publicUrl) return { base: publicUrl.replace(/\/+$/, ''), source: 'env', guess: false };
  if (savedUrl) return { base: savedUrl, source: 'settings', guess: false };
  if (hostOrigin) {
    try {
      const u = new URL(hostOrigin);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && !isLoopbackHost(u.hostname)) {
        return { base: u.origin, source: 'origin', guess: false };
      }
    } catch {
      // ignore malformed origins and fall through
    }
  }
  const ip = detectLanAddress();
  if (!ip) return { base: `http://localhost:${port}`, source: 'detected', guess: true };
  return { base: `http://${ip}:${port}`, source: 'detected', guess: inDocker() };
}

export function resolveJoinBase(opts) {
  return resolveJoin(opts).base;
}
