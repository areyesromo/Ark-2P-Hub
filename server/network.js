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

/**
 * Work out the base URL phones should open (used for the QR code).
 *
 * Order of preference:
 *   1. PUBLIC_URL env var (explicit always wins)
 *   2. The origin the TV opened, unless it is localhost (e.g. a Pi kiosk)
 *   3. The detected LAN address of this machine
 */
export function resolveJoinBase({ publicUrl, hostOrigin, port }) {
  if (publicUrl) return publicUrl.replace(/\/+$/, '');
  if (hostOrigin) {
    try {
      const u = new URL(hostOrigin);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && !isLoopbackHost(u.hostname)) {
        return u.origin;
      }
    } catch {
      // ignore malformed origins and fall through
    }
  }
  const ip = detectLanAddress();
  return ip ? `http://${ip}:${port}` : `http://localhost:${port}`;
}
