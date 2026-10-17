// HTTPS for phones that need a secure page (the motion sensor for tilt
// steering only works on https://). The hub makes its own self-signed
// certificate the first time and keeps it in the data folder, so each phone
// only has to accept the browser's warning once. Plain http keeps working on
// the same port: see dualProtocol() in app.js.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ---- a tiny DER (ASN.1) writer: just enough for one X.509 certificate ----

function der(tag, body) {
  const n = body.length;
  const len = n < 0x80 ? [n] : n < 0x100 ? [0x81, n] : [0x82, n >> 8, n & 0xff];
  return Buffer.concat([Buffer.from([tag, ...len]), body]);
}
const seq = (...parts) => der(0x30, Buffer.concat(parts));
const set = (...parts) => der(0x31, Buffer.concat(parts));
const int = (buf) => der(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const octets = (buf) => der(0x04, buf);
const bits = (buf) => der(0x03, Buffer.concat([Buffer.from([0]), buf]));
const utf8 = (s) => der(0x0c, Buffer.from(s, 'utf8'));

function oid(dotted) {
  const [a, b, ...rest] = dotted.split('.').map(Number);
  const out = [40 * a + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let v = n >> 7; v > 0; v >>= 7) chunk.unshift((v & 0x7f) | 0x80);
    out.push(...chunk);
  }
  return der(0x06, Buffer.from(out));
}

/** UTCTime before 2050, GeneralizedTime after (as X.509 asks). */
function time(date) {
  const iso = date.toISOString().replace(/[-:T]/g, '').slice(0, 14) + 'Z'; // YYYYMMDDHHMMSSZ
  return date.getUTCFullYear() < 2050 ? der(0x17, Buffer.from(iso.slice(2))) : der(0x18, Buffer.from(iso));
}

function ipBytes(ip) {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every((n) => n >= 0 && n <= 255) ? Buffer.from(parts) : null;
}

/**
 * A self-signed certificate (ECDSA P-256, SHA-256) for `names`: host names
 * and IPv4 addresses the hub may be reached at. Returns PEM strings.
 */
export function makeSelfSigned({ names = ['localhost'], days = 3650, now = new Date() } = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const sigAlg = seq(oid('1.2.840.10045.4.3.2')); // ecdsa-with-SHA256
  const name = seq(set(seq(oid('2.5.4.3'), utf8('Ark 2P Hub'))));
  const alt = names.map((n) => {
    const ip = ipBytes(n);
    return ip ? der(0x87, ip) : der(0x82, Buffer.from(n, 'ascii')); // iPAddress / dNSName
  });
  const extensions = der(0xa3, seq(
    seq(oid('2.5.29.19'), octets(seq())), // basicConstraints: not a CA
    seq(oid('2.5.29.17'), octets(seq(...alt))), // subjectAltName
  ));
  const tbs = seq(
    der(0xa0, int(Buffer.from([2]))), // version 3
    int(crypto.randomBytes(16).map((b, i) => (i === 0 ? b & 0x7f : b))), // positive serial
    sigAlg,
    name,
    seq(time(new Date(now.getTime() - 86400000)), time(new Date(now.getTime() + days * 86400000))),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
    extensions,
  );
  const signature = crypto.sign('sha256', tbs, privateKey); // DER-encoded ECDSA signature
  const cert = seq(tbs, sigAlg, bits(signature));
  const pem = (label, buf) => `-----BEGIN ${label}-----\n${buf.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
  return { key: privateKey.export({ type: 'pkcs8', format: 'pem' }), cert: pem('CERTIFICATE', cert) };
}

/**
 * The hub's certificate: loaded from the data folder, or made (and saved)
 * the first time. If the folder can't be written, a fresh one is used for
 * this run only.
 */
export function loadOrCreateCert(dataDir, names) {
  const keyFile = dataDir ? path.join(dataDir, 'tls-key.pem') : null;
  const certFile = dataDir ? path.join(dataDir, 'tls-cert.pem') : null;
  if (keyFile) {
    try {
      const pair = { key: fs.readFileSync(keyFile, 'utf8'), cert: fs.readFileSync(certFile, 'utf8') };
      if (new crypto.X509Certificate(pair.cert).validToDate > new Date()) return pair;
    } catch {
      // none yet (or unreadable): make one
    }
  }
  const pair = makeSelfSigned({ names });
  if (keyFile) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(keyFile, pair.key, { mode: 0o600 });
      fs.writeFileSync(certFile, pair.cert);
    } catch (err) {
      console.error('Could not save the https certificate (using a temporary one):', err.message);
    }
  }
  return pair;
}
