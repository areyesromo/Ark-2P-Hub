import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './sockets.js';
import { resolveJoinBase } from './network.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function createApp({ port = 3000, publicUrl = process.env.PUBLIC_URL } = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    // Phones on flaky Wi-Fi: keep the default reconnection, but notice dead sockets quickly.
    pingInterval: 10000,
    pingTimeout: 8000,
  });
  const rooms = new RoomManager(io);

  app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size }));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

  registerSocketHandlers(io, rooms, {
    joinBaseFor: (hostOrigin) => resolveJoinBase({ publicUrl, hostOrigin, port }),
  });

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
