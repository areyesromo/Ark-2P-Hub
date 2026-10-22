import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './sockets.js';
import { resolveJoin, detectLanAddress } from './network.js';
import { loadOrCreateCert } from './tls.js';
import { Settings } from './settings.js';
import { adminRouter } from './admin.js';
import { Stats } from './stats.js';
import { Profiles, AVATARS, COLOURS } from './profiles.js';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const THREE_DIR = path.dirname(createRequire(import.meta.url).resolve('three')); // node_modules/three/build
// GLTFLoader and friends (the desktop app ships them elsewhere: ARK_THREE_ADDONS, see desktop/).
const THREE_ADDONS_DIR = process.env.ARK_THREE_ADDONS || path.join(THREE_DIR, '..', 'examples', 'jsm');
const VERSION = {
  version: JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')).version,
  commit: process.env.ARK_COMMIT || 'dev',
  built: process.env.ARK_BUILT || 'dev',
};

export function createApp({
  port = 3000,
  publicUrl = process.env.PUBLIC_URL,
  dataDir = process.env.DATA_DIR || path.join(ROOT_DIR, 'data'),
  adminPassword = process.env.ADMIN_PASSWORD,
  https = process.env.HTTPS !== 'off',
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const listener = https ? dualProtocol(httpServer, loadOrCreateCert(dataDir, certNames(publicUrl))) : httpServer;
  const io = new Server(httpServer, {
    // Phones on flaky Wi-Fi: keep the default reconnection, but notice dead sockets quickly.
    pingInterval: 10000,
    pingTimeout: 8000,
  });
  const settings = new Settings(dataDir, { envPassword: adminPassword });
  const stats = new Stats(dataDir);
  const profiles = new Profiles(dataDir);
  const rooms = new RoomManager(io, { stats, profiles });

  /** (Re)compute a room's join link + QR from the current settings. */
  async function refreshJoin(room) {
    const join = resolveJoin({ publicUrl, savedUrl: settings.joinUrl, hostOrigin: room.hostOrigin, port });
    room.joinGuess = join.guess;
    const joinUrl = `${join.base}/play/?room=${room.code}`;
    if (joinUrl === room.joinUrl) return;
    room.joinUrl = joinUrl;
    try {
      room.qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 480 });
    } catch (err) {
      console.error('QR generation failed:', err);
    }
  }

  app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size, playing: rooms.playing }));
  app.get('/version', (_req, res) => res.json(VERSION));
  // The tables, with each player's avatar and colour (nameKey -> profile).
  app.get('/api/stats', (_req, res) => {
    const board = stats.leaderboard();
    res.json({ ...board, profiles: profiles.forNames(board.players.map((p) => p.name)) });
  });
  // What a profile can be: the avatars and colours to pick from.
  app.get('/api/profile-choices', (_req, res) => res.json({ avatars: AVATARS, colours: COLOURS }));
  app.use(
    '/api/admin',
    adminRouter({
      settings,
      stats,
      publicUrl,
      detectedJoin: () => resolveJoin({ port }),
      // New join address: refresh every open room so TVs show the new QR right away.
      onJoinUrlChange: async () => {
        for (const room of rooms.rooms.values()) {
          await refreshJoin(room);
          room.broadcastState();
          io.to(room.hostChannel).emit('host:qr', { qr: room.qr });
        }
      },
    }),
  );
  // three.js for the 3D games, served from the hub so it works without internet.
  app.use('/vendor/three', express.static(THREE_DIR, { maxAge: '7d' }));
  // Its add-ons import the bare name 'three', which browsers can't resolve without an import map:
  // serve them with that import pointed at the copy above, so every 3D script shares one three.js.
  app.get('/vendor/three-addons/*', (req, res) => {
    const file = path.resolve(THREE_ADDONS_DIR, req.params[0]);
    if (!file.startsWith(THREE_ADDONS_DIR + path.sep) || !file.endsWith('.js') || !fs.existsSync(file)) return res.sendStatus(404);
    const src = fs.readFileSync(file, 'utf8').replace(/from 'three'/g, "from '/vendor/three/three.module.min.js'");
    res.type('text/javascript').set('Cache-Control', 'public, max-age=604800').send(src);
  });
  // no-cache: browsers check for a newer copy each time (a quick 304 when unchanged), so an
  // update's new art and code show straight away instead of an old cached copy.
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

  registerSocketHandlers(io, rooms, { refreshJoin });

  const sweeper = setInterval(() => rooms.sweep(), 60 * 1000);
  sweeper.unref();

  return {
    app,
    httpServer,
    io,
    rooms,
    https,
    // Fails (e.g. EADDRINUSE: the port is taken) instead of hanging.
    listen: () =>
      new Promise((resolve, reject) => {
        const failed = (err) => reject(err);
        listener.once('error', failed);
        listener.listen(port, () => {
          listener.off('error', failed);
          resolve(listener.address());
        });
      }),
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        for (const room of rooms.rooms.values()) room.dispose();
        if (listener !== httpServer) listener.close();
        io.close(() => resolve());
      }),
  };
}

/** Names for the https certificate: this machine and the join address, if set. */
function certNames(publicUrl) {
  const names = ['localhost', '127.0.0.1'];
  const lan = detectLanAddress();
  if (lan) names.push(lan);
  try {
    if (publicUrl) names.push(new URL(publicUrl).hostname);
  } catch {
    // not a URL: skip it
  }
  return [...new Set(names)];
}

/**
 * http and https on one port: a TLS handshake starts with byte 0x16, plain
 * http with a letter. Either way the connection ends up at the same http
 * server (and so the same Socket.IO server and rooms); https connections
 * are decrypted on the way.
 */
function dualProtocol(httpServer, { key, cert }) {
  const secure = tls.createServer({ key, cert });
  secure.on('secureConnection', (socket) => httpServer.emit('connection', socket));
  secure.on('tlsClientError', () => {}); // e.g. a phone that hasn't accepted the certificate yet
  const open = new Set();
  const server = net.createServer((socket) => {
    open.add(socket);
    socket.on('close', () => open.delete(socket));
    socket.on('error', () => {});
    socket.once('data', (first) => {
      socket.pause();
      socket.unshift(first);
      (first[0] === 0x16 ? secure : httpServer).emit('connection', socket);
      process.nextTick(() => socket.resume());
    });
  });
  // Closing drops open connections too (idle keep-alives would hold it open).
  const close = server.close.bind(server);
  server.close = (cb) => {
    close(cb);
    for (const socket of open) socket.destroy();
  };
  return server;
}
