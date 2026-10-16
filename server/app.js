import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import QRCode from 'qrcode';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './sockets.js';
import { resolveJoin } from './network.js';
import { Settings } from './settings.js';
import { adminRouter } from './admin.js';
import { Stats } from './stats.js';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
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
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    // Phones on flaky Wi-Fi: keep the default reconnection, but notice dead sockets quickly.
    pingInterval: 10000,
    pingTimeout: 8000,
  });
  const settings = new Settings(dataDir, { envPassword: adminPassword });
  const stats = new Stats(dataDir);
  const rooms = new RoomManager(io, { stats });

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

  app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));
  app.get('/version', (_req, res) => res.json(VERSION));
  app.get('/api/stats', (_req, res) => res.json(stats.leaderboard()));
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
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  registerSocketHandlers(io, rooms, { refreshJoin });

  const sweeper = setInterval(() => rooms.sweep(), 60 * 1000);
  sweeper.unref();

  return {
    app,
    httpServer,
    io,
    rooms,
    listen: () => new Promise((resolve) => httpServer.listen(port, () => resolve(httpServer.address()))),
    close: () =>
      new Promise((resolve) => {
        clearInterval(sweeper);
        for (const room of rooms.rooms.values()) room.dispose();
        io.close(() => resolve());
      }),
  };
}
