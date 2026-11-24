// game-previews.mjs: take a picture of every game on the TV for its setup screen's preview
// (public/games/<id>/preview.jpg). It starts a hub on a spare port, seats two players, starts each
// game in turn past its setup screen and photographs the TV a few seconds in.
//   node tools/game-previews.mjs            every game
//   node tools/game-previews.mjs pong tron  just these
// Needs Playwright with Chromium (npm i --no-save playwright && npx playwright install chromium);
// the pictures are committed, so the hub itself never needs it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { listGames } from '../server/games/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, data) => new Promise((resolve) => s.emit(ev, data, resolve));
// The 3D games take a moment longer to build their scene.
const WAIT = { 'kart-race-3d': 9000, 'ten-pin': 7000, 'tower-stack': 7000, 'dungeon-duo': 8000, 'marble-maze': 7000, 'party-board': 8000 };

// A few games need more than "go" to show something worth seeing: both ready up, a word picked
// and drawn, the gas held.
const both = (players, input) => players.forEach((p) => p.emit('game:input', input));
const race = async (players) => {
  players[1].emit('game:input', { type: 'go' }); // (the other racer readies up too: Ana did with "go")
  await sleep(5000);
  for (let i = 0; i < 12; i++) { both(players, { type: 'drive', gas: true, steer: i % 4 === 0 ? 0.3 : 0 }); await sleep(250); }
};
const HOUSE = [[0.25, 0.85, 0.25, 0.45, 0.75, 0.45, 0.75, 0.85, 0.25, 0.85], [0.2, 0.47, 0.5, 0.15, 0.8, 0.47], [0.44, 0.85, 0.44, 0.65, 0.56, 0.65, 0.56, 0.85]];
const NUDGE = {
  // A solo game a little way in: Dog Park with a few balls and a dog down.
  dogpark: async (players) => {
    for (const cell of [0, 1, 5, 6]) { players[0].emit('game:input', { type: 'mark', cell, mark: 1 }); await sleep(120); }
    players[0].emit('game:input', { type: 'mark', cell: 4, mark: 2 });
  },
  // Mid-game boards: some squares dug, a hand dealt, a few guesses in.
  'mine-duel': async (players) => {
    for (const cell of [65, 30, 101, 77, 12, 118]) { both(players, { type: 'dig', cell }); await sleep(250); }
  },
  blackjack: async (players) => {
    both(players, { type: 'bet', amount: 100 });
    await sleep(2200);
    players[0].emit('game:input', { type: 'hit' });
  },
  // (each tries every tile: only the one whose turn it is, holding a tile that fits, gets one down)
  dominoes: async (players) => {
    const tiles = [];
    for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) tiles.push(a + '-' + b);
    for (let round = 0; round < 4; round++) {
      for (const p of players) for (const tile of tiles) for (const end of ['L', 'R']) p.emit('game:input', { type: 'play', tile, end });
      await sleep(300);
    }
  },
  'five-letters': async (players) => {
    for (const word of ['slate', 'crown']) { players[0].emit('game:input', { type: 'guess', word }); await sleep(300); }
    players[1].emit('game:input', { type: 'guess', word: 'pious' });
  },
  // (moves sent by both: only the one whose turn it is counts)
  'five-in-a-row': async (players) => {
    for (const [x, y] of [[7, 7], [8, 8], [8, 7], [9, 7], [6, 7], [5, 7], [7, 8], [7, 6], [9, 9]]) { both(players, { type: 'place', cell: y * 15 + x }); await sleep(200); }
  },
  morris: async (players) => {
    for (const at of [0, 9, 2, 17, 19, 12, 22, 6, 14]) { both(players, { type: 'place', at }); await sleep(200); }
  },
  'code-breaker': async (players) => {
    players[0].emit('game:input', { type: 'code', code: '4071' });
    players[1].emit('game:input', { type: 'code', code: '9265' });
    await sleep(400);
    for (const guess of ['1234', '5678', '2591', '4017']) { both(players, { type: 'guess', guess }); await sleep(300); }
  },
  hangman: async (players) => {
    players[0].emit('game:input', { type: 'word', word: 'garden' });
    players[1].emit('game:input', { type: 'word', word: 'puzzle' });
    await sleep(400);
    for (const letter of 'eatsr') { players[0].emit('game:input', { type: 'letter', letter }); await sleep(150); }
    for (const letter of 'eaorn') { players[1].emit('game:input', { type: 'letter', letter }); await sleep(150); }
  },
  'kart-race': race,
  'kart-race-3d': race,
  'sketch-guess': async (players) => {
    both(players, { type: 'choose', index: 0 }); // (only the drawer's counts)
    await sleep(800);
    HOUSE.forEach((pts) => both(players, { type: 'draw', newStroke: true, color: 0, pts }));
  },
};

const only = process.argv.slice(2);
const games = listGames().filter((g) => !only.length || only.includes(g.solo && g.bothModes ? 'solo:' + g.id : g.id)); // ('solo:snake': just a game's 1 player picture)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-previews-'));
const hub = createApp({ port: 0, dataDir: dir, https: false });
const { port } = await hub.listen();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
// A smaller picture than the TV (a preview, not a wallpaper): 1280 x 800 drawn at 0.6.
const tv = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 0.6 });
await tv.goto(base + '/host/');
await tv.waitForFunction("/^[A-Z]{4}$/.test(document.getElementById('room-code').textContent)"); // (runs in the page)
const code = await tv.textContent('#room-code');
const players = [];
for (const name of ['Ana', 'Ben']) {
  const s = connect(base, { transports: ['websocket'], forceNew: true });
  await emit(s, 'player:join', { code, name });
  players.push(s);
}
for (const g of games) {
  await emit(players[0], 'lobby:mode', { mode: g.solo ? 'solo' : 'duo' }); // (the solo games are the 1 player lobby's)
  const res = await emit(players[0], 'lobby:start', { gameId: g.id });
  if (!res || !res.ok) { console.log(g.id, 'did not start:', res && res.error); continue; }
  await sleep(800);
  players[0].emit('game:input', { type: 'go' }); // (past the setup screen, on its usual settings)
  if (NUDGE[g.id]) await NUDGE[g.id](players);
  await sleep(WAIT[g.id] || 4500);
  // (a game for both modes: its 1 player picture is preview-solo.jpg)
  const out = path.join(ROOT, 'public', 'games', g.id, g.solo && g.bothModes ? 'preview-solo.jpg' : 'preview.jpg');
  await tv.locator('#stage').screenshot({ path: out, type: 'jpeg', quality: 72 });
  console.log(g.id, Math.round(fs.statSync(out).size / 1024) + ' KB');
  players[0].emit('lobby:return');
  await sleep(700);
}
players.forEach((s) => s.close());
await browser.close();
await hub.close();
fs.rmSync(dir, { recursive: true, force: true });
