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
import { parseChangelog, notesSince } from './changelog.js';
import { RoomManager } from './rooms.js';
import { registerSocketHandlers } from './sockets.js';
import { resolveJoin, detectLanAddress } from './network.js';
import { loadOrCreateCert } from './tls.js';
import { Settings } from './settings.js';
import { adminRouter } from './admin.js';
import { Stats } from './stats.js';
import { Stats as SoloStats, MAX_RUNS as SOLO_MAX_RUNS, nameKey } from './solo/stats.js';
import { ACHIEVEMENTS as SOLO_ACHIEVEMENTS, describe as describeAchievement } from './solo/achievements.js';
import { collectionFor, countOpen } from './solo/collection.js';
import { monthDays, shiftMonth, weekOffset, streaks } from './solo/calendar.js';
import { challengeFor, dayOf } from './solo/daily.js';
import { profileFor } from './solo/profile.js';
import { listGames, soloGameOf } from './games/index.js';
import { Profiles, AVATARS, COLOURS } from './profiles.js';
import { Practice } from './practice.js';
import { Trophies, TROPHIES } from './trophies.js';
import { GameSaves } from './saves.js';
import { Tunnel } from './tunnel.js';
import { Online, overInternet } from './online.js';

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const THREE_DIR = path.dirname(createRequire(import.meta.url).resolve('three')); // node_modules/three/build
// GLTFLoader and friends (the desktop app ships them elsewhere: ARK_THREE_ADDONS, see desktop/).
const THREE_ADDONS_DIR = process.env.ARK_THREE_ADDONS || path.join(THREE_DIR, '..', 'examples', 'jsm');
const VERSION = versionOf(process.env, JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')).version);
// What's new (CHANGELOG.md): the desktop app's TV shows the notes since the version it last ran.
// Not in the Docker image (it has no release versions), which serves an empty list.
const CHANGES = (() => {
  try {
    return parseChangelog(fs.readFileSync(path.join(ROOT_DIR, 'CHANGELOG.md'), 'utf8'));
  } catch {
    return [];
  }
})();

/**
 * What /version reports. The desktop app's package.json carries its release; a Docker build gets
 * the latest release tag stamped in (ARK_VERSION: update.sh / update.ps1 and CI), as package.json
 * stays at 0.1.0 there. Only a plain x.y.z is taken (the What's new card compares them).
 */
export function versionOf(env, packageVersion) {
  const stamped = /^\d+\.\d+\.\d+$/.test(String(env.ARK_VERSION || '')) ? env.ARK_VERSION : null;
  return { version: stamped || packageVersion, commit: env.ARK_COMMIT || 'dev', built: env.ARK_BUILT || 'dev' };
}

export function createApp({
  port = 3000,
  publicUrl = process.env.PUBLIC_URL,
  dataDir = process.env.DATA_DIR || path.join(ROOT_DIR, 'data'),
  https = process.env.HTTPS !== 'off',
} = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const listener = https ? dualProtocol(httpServer, loadOrCreateCert(dataDir, certNames(publicUrl))) : httpServer;
  const io = new Server(httpServer, {
    // Phones on flaky Wi-Fi: keep the default reconnection, but notice dead sockets quickly.
    pingInterval: 10000,
    pingTimeout: 8000,
    // Views are repetitive JSON: compressed they're several times smaller, which matters over the
    // online tunnel (at home it hardly shows). Small messages (inputs, pings) go as they are.
    perMessageDeflate: { threshold: 1024 },
  });
  const settings = new Settings(dataDir);
  const stats = new Stats(dataDir);
  const profiles = new Profiles(dataDir);
  const practice = new Practice(dataDir);
  const trophies = new Trophies(dataDir);
  const soloStats = new SoloStats(dataDir);
  const rooms = new RoomManager(io, { stats, profiles, practice, trophies, saves: new GameSaves(dataDir), soloStats });
  // Online play: a quick tunnel (or the owner's own address) for a friend somewhere else.
  let online = null;
  const tunnel = new Tunnel({ port: () => (listener.address() && listener.address().port) || port, onChange: () => online && online.refresh() });
  online = new Online({ settings, tunnel, rooms, qr: (url) => QRCode.toDataURL(url, { margin: 1, width: 480 }).catch(() => null) });

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

  // Over the internet (through a tunnel): Settings stays at home, and the TV page only opens as a
  // friend's remote screen (?watch=CODE), so nobody outside makes rooms on your hub.
  // (the path as Express routes it: any case, %-encoding or doubled slashes)
  const routed = (req) => {
    let p = req.path;
    try {
      p = decodeURIComponent(p);
    } catch {
      // (not valid %-encoding: judged as it is)
    }
    return path.posix.normalize(p.toLowerCase().replace(/\/{2,}/g, '/')); // (and "." / ".." resolved, as the static files are)
  };
  const fromOutside = (req) => overInternet(req.headers, settings.tunnelUrl);
  const homeOnly = (req, res, next) => (fromOutside(req) ? res.status(403).send('Settings can only be opened at home, not over the internet.') : next());
  app.use((req, res, next) => {
    if (!fromOutside(req)) return next();
    const p = routed(req);
    if (/^\/(api\/)?admin(\/|$)/.test(p)) return homeOnly(req, res, next);
    // The household's names and results (leaderboard, trophies) stay at home too.
    if (/^\/(api\/)?(stats|trophies)(\/|$)/.test(p)) return res.status(403).send('The leaderboard and trophies are for the hub\'s home screens.');
    if (/^\/host(\/|\/index(\.html)?)?$/.test(p) && !req.query.watch) return res.redirect(302, '/play/');
    if (/^\/healthz\/?$/.test(p)) return res.json({ ok: true }); // (how many rooms there are stays at home)
    next();
  });
  // Settings has no password, so no other website may show it in a frame (to trick a tap): only the
  // hub's own pages (Player 1's phone opens it inside the phone page).
  app.use((req, res, next) => {
    if (/^\/(api\/)?admin(\/|$)/.test(routed(req))) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    }
    next();
  });
  app.get('/healthz', (_req, res) => res.json({ ok: true, rooms: rooms.rooms.size, playing: rooms.playing }));
  app.get('/version', (_req, res) => res.json(VERSION));
  // The look picked in Settings: its stylesheet, or nothing for the default. Every page links it.
  // The layout comes after the theme: it moves things about, the theme colours them.
  app.get('/theme.css', async (_req, res) => {
    const { theme, layout } = settings;
    const read = (dir, name) => fs.promises.readFile(path.join(PUBLIC_DIR, 'shared', dir, `${name}.css`), 'utf8');
    try {
      const parts = [theme === 'default' ? '/* default theme */\n' : await read('themes', theme), layout === 'classic' ? '/* classic layout */\n' : await read('layouts', layout)];
      res.type('text/css').set('Cache-Control', 'no-cache').send(parts.join('\n'));
    } catch {
      res.type('text/css').send('/* the look could not be read */\n');
    }
  });
  app.get('/whats-new.json', (req, res) => {
    const since = /^\d+\.\d+\.\d+$/.test(String(req.query.since)) ? String(req.query.since) : null;
    res.json({ version: VERSION.version, entries: notesSince(CHANGES, since, VERSION.version) });
  });
  // The tables, with each player's avatar and colour (nameKey -> profile).
  app.get('/api/stats', (_req, res) => {
    const board = stats.leaderboard();
    res.json({ ...board, profiles: profiles.forNames(board.players.map((p) => p.name)) });
  });
  // Trophies: who has how many (the stats page), and one player's whole set (their trophies page).
  app.get('/api/trophies', (_req, res) => {
    const players = trophies.summary();
    res.json({ players, total: TROPHIES.length, profiles: profiles.forNames(players.map((p) => p.name)) });
  });
  app.get('/api/trophies/:name', (req, res) => {
    const name = String(req.params.name || '').slice(0, 40);
    res.json({ ...trophies.forName(name), profile: profiles.get(name) });
  });
  // ---- the solo games' pages (the 1 player mode: server/solo/, public/solo/) ----
  const soloGames = () => listGames().filter((g) => g.solo);
  const soloName = (req) => String(req.query.name || '').slice(0, 32);
  // Who has played solo games: the pages' "whose?" pickers.
  app.get('/api/solo/players', (_req, res) => {
    const { players } = soloStats.leaderboard();
    res.json({ players, profiles: profiles.forNames(players.map((p) => p.name)) });
  });
  // Every solo achievement, and which ones a player has (?name=): their trophies page's Solo section.
  app.get('/api/solo/achievements', (req, res) => {
    const name = soloName(req);
    const have = name ? soloStats.achievementsOf(name) : {};
    const games = Object.fromEntries(soloGames().map((g) => [g.id, g.name]));
    const list = SOLO_ACHIEVEMENTS.map((a) => ({ ...describeAchievement(a, have[a.id] || null), gameName: a.game ? games[a.game] : null }));
    res.json({ name, profile: name ? profiles.get(name) : null, got: list.filter((a) => a.at).length, total: list.length, list });
  });
  // What a player has unlocked in each solo game (looks, levels), and what's still locked (?name=).
  app.get('/api/solo/collection', (req, res) => {
    const name = soloName(req);
    const groups = collectionFor({ have: name ? soloStats.achievementsOf(name) : {}, bestOf: (game, variant, better) => (name ? soloStats.bestFor(game, variant, name, better) : null) });
    res.json({ name, profile: name ? profiles.get(name) : null, ...countOpen(groups), groups });
  });
  // A player's own solo numbers (?name=): runs, favourite games, new records, the last two weeks. Only the
  // latest runs are kept, so `trimmed` says when it's not the whole story.
  app.get('/api/solo/me', (req, res) => {
    const name = soloName(req);
    const key = nameKey(name);
    const names = Object.fromEntries(soloGames().map((g) => [g.id, g.name]));
    const mine = name ? soloStats.runs.filter((r) => nameKey(r.player) === key) : [];
    const have = name ? soloStats.achievementsOf(name) : {};
    res.json({
      name,
      profile: name ? profiles.get(name) : null,
      ...profileFor({ runs: mine, names, now: Date.now() }),
      since: mine.length ? mine[0].at : null,
      trimmed: soloStats.runs.length >= SOLO_MAX_RUNS,
      achievements: { got: Object.keys(have).length, total: SOLO_ACHIEVEMENTS.length },
      daily: { ...streaks((name ? soloStats.dailyDaysOf(name) : new Map()).keys(), dayOf(Date.now())) },
      gamesInHub: soloGames().length,
    });
  });
  // A month of the daily challenge for a player (?name=&month=YYYY-MM): each day's game, whether they
  // took part, and their streaks.
  app.get('/api/solo/calendar', (req, res) => {
    const name = soloName(req);
    const today = dayOf(Date.now());
    const thisMonth = today.slice(0, 7);
    let month = monthDays(String(req.query.month || '')) ? String(req.query.month) : thisMonth;
    if (month > thisMonth) month = thisMonth; // nothing to show beyond the current month
    const played = name ? soloStats.dailyDaysOf(name) : new Map();
    const days = monthDays(month).map((day) => {
      const p = played.get(day);
      const game = p ? soloGameOf(p.game) : day >= today ? soloGameOf(challengeFor(day).game) : null; // a missed day's game isn't known any more
      let status = day > today ? 'future' : day === today ? 'today' : 'missed';
      if (p) status = p.score === null ? 'started' : 'done';
      return { day, today: day === today, status, game: game ? game.id : null, gameName: game ? game.name : null, unit: game && game.score ? game.score.unit : null, score: p ? p.score : null };
    });
    const oldest = shiftMonth(thisMonth, -12);
    res.json({
      name,
      profile: name ? profiles.get(name) : null,
      today,
      month,
      offset: weekOffset(month),
      prev: month > oldest ? shiftMonth(month, -1) : null,
      next: month < thisMonth ? shiftMonth(month, 1) : null,
      ...streaks(played.keys(), today),
      total: played.size,
      days,
    });
  });
  // What a profile can be: the avatars and colours to pick from.
  app.get('/api/profile-choices', (_req, res) => res.json({ avatars: AVATARS, colours: COLOURS }));
  app.use(
    '/api/admin',
    homeOnly, // (and again here, exactly where Express routes it)
    adminRouter({
      settings,
      stats,
      trophies,
      practice,
      online,
      publicUrl,
      detectedJoin: () => resolveJoin({ port }),
      // A new look: every TV and phone swaps its theme stylesheet (see watchVersion in common.js).
      onThemeChange: () => io.emit('hub:theme', { theme: settings.theme, layout: settings.layout }),
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
  // Phone only: the phone page, playing the solo games on its own with no TV (see public/play/play.js).
  app.get(['/phone', '/phone/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'play', 'index.html'));
  });
  // no-cache: browsers check for a newer copy each time (a quick 304 when unchanged), so an
  // update's new art and code show straight away instead of an old cached copy.
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));

  // A new look (Settings, or Player 1's controller on the TV): every screen swaps its stylesheet.
  const changeLook = ({ theme, layout }) => {
    if (theme !== undefined && !settings.setTheme(theme)) return false;
    if (layout !== undefined && !settings.setLayout(layout)) return false;
    io.emit('hub:theme', { theme: settings.theme, layout: settings.layout });
    return true;
  };
  registerSocketHandlers(io, rooms, { refreshJoin, online, setLook: changeLook, fromInternet: (socket) => overInternet(socket.handshake.headers, settings.tunnelUrl) });

  const sweeper = setInterval(() => rooms.sweep(), 60 * 1000);
  sweeper.unref();

  return {
    app,
    httpServer,
    io,
    rooms,
    online,
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
        online.shutdown();
        for (const room of rooms.rooms.values()) room.dispose({ keepSave: true }); // (games in progress are picked up after a restart)
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
