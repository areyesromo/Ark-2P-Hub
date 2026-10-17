import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Stats, MAX_MATCHES } from '../server/stats.js';
import { Room } from '../server/rooms.js';
import { createApp } from '../server/app.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-stats-'));
const win = (game, players, winner, scores = null) => ({ game, gameName: game.toUpperCase(), category: 'competitive', players, winner, draw: winner === null, scores });

test('head to head: oriented to whoever asks, case-insensitive, with draws, per-game and recent results', () => {
  const s = new Stats(null);
  s.record(win('pong', ['Abe', 'Sam'], 0, [5, 3]));
  s.record(win('pong', ['sam', 'abe'], 0, [5, 1])); // Sam won, names typed differently, seats swapped
  s.record(win('tron', ['Abe', 'Sam'], null, [2, 2]));
  s.record(win('pong', ['Abe', 'Cat'], 1)); // someone else
  s.record({ game: 'sketch-guess', gameName: 'Sketch', category: 'casual', players: ['Abe', 'Sam'], stars: 12, maxStars: 30 });

  const h = s.headToHead(' ABE ', 'Sam');
  assert.equal(h.played, 3);
  assert.deepEqual(h.wins, [1, 1]);
  assert.equal(h.draws, 1);
  assert.deepEqual(h.byGame.map((g) => [g.game, g.played, g.wins]), [['pong', 2, [1, 1]], ['tron', 1, [0, 0]]]);
  assert.equal(h.recent[0].game, 'tron', 'newest first');
  assert.deepEqual(h.recent[1].scores, [1, 5], "scores flipped to the asker's side");
  assert.equal(h.recent[1].winner, 1);
  assert.deepEqual(h.team, { played: 1, stars: 12, maxStars: 30 });

  const flipped = s.headToHead('Sam', 'Abe');
  assert.deepEqual(flipped.wins, [1, 1]);
  assert.deepEqual(flipped.recent[1].scores, [5, 1]);
  assert.equal(s.headToHead('Abe', 'abe').played, 0, 'no record against yourself');
});

test('leaderboard: players by wins, per-game champions, rivalries and recent matches', () => {
  const s = new Stats(null);
  s.record(win('pong', ['Abe', 'Sam'], 0));
  s.record(win('pong', ['Abe', 'Sam'], 0));
  s.record(win('tanks', ['Sam', 'Cat'], 0));
  s.record(win('tanks', ['Sam', 'Cat'], null));
  s.record({ game: 'sketch-guess', gameName: 'Sketch', category: 'casual', players: ['Abe', 'Cat'], stars: 20, maxStars: 30 });
  const lb = s.leaderboard();
  assert.deepEqual(lb.players.map((p) => [p.name, p.wins, p.losses, p.draws]), [
    ['Abe', 2, 0, 0],
    ['Sam', 1, 2, 1],
    ['Cat', 0, 1, 1],
  ]);
  assert.equal(lb.players[0].winPct, 100);
  assert.equal(lb.players[0].teamGames, 1);
  assert.equal(lb.players[0].stars, 20);
  const pong = lb.games.find((g) => g.game === 'pong');
  assert.deepEqual(pong.champion, { name: 'Abe', wins: 2 });
  assert.equal(lb.games.find((g) => g.game === 'sketch-guess').bestStars, 20);
  assert.equal(lb.rivalries.length, 2);
  assert.equal(lb.recent[0].game, 'sketch-guess');
  assert.equal(lb.total, 5);
});

test('history persists in the data folder, is capped, and can be reset', () => {
  const dir = tmp();
  const s = new Stats(dir);
  for (let i = 0; i < MAX_MATCHES + 5; i++) s.matches.push(win('pong', ['A', 'B'], 0));
  s.record(win('tron', ['A', 'B'], 1));
  assert.equal(s.matches.length, MAX_MATCHES);
  const again = new Stats(dir);
  assert.equal(again.matches.length, MAX_MATCHES);
  assert.equal(again.matches.at(-1).game, 'tron');
  again.reset();
  assert.equal(new Stats(dir).matches.length, 0);
  fs.writeFileSync(path.join(dir, 'stats.json'), '{ broken');
  assert.deepEqual(new Stats(dir).matches, [], 'a damaged file starts fresh instead of crashing');
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A room with two controller players and a pretend TV, wired to a stats store. */
function roomWithPlayers(stats) {
  const io = { to: () => ({ emit() {} }) };
  const room = new Room('TEST', io, { stats });
  room.hostSockets.add('tv');
  room.seatPlayer('Ana', null, { local: true });
  room.seatPlayer('Ben', null, { local: true });
  return room;
}

/** Start Rock Paper Scissors (past its setup screen, with the default settings). */
function startRps(room) {
  room.startGame('rock-paper-scissors');
  room.handleInput(0, { type: 'go' });
}

/** Finish a Rock Paper Scissors match from 2-0 with one more round. */
function finishRps(room, winner) {
  room.game.game.scores = winner === 0 ? [2, 0] : [0, 2]; // room.game is the setup screen around the game
  room.handleInput(0, { type: 'pick', choice: winner === 0 ? 'rock' : 'scissors' });
  room.handleInput(1, { type: 'pick', choice: winner === 0 ? 'scissors' : 'rock' });
  assert.equal(room.game.hostView().phase, 'over');
}

test('a room records each finished match once, including rematches, and shows the head to head', () => {
  const stats = new Stats(null);
  const room = roomWithPlayers(stats);
  assert.equal(room.publicState().h2h.played, 0);
  startRps(room);
  finishRps(room, 0);
  room.pushGameViews(); // more views of the same end screen don't count again
  assert.equal(stats.matches.length, 1);
  assert.deepEqual(
    { game: stats.matches[0].game, players: stats.matches[0].players, winner: stats.matches[0].winner, scores: stats.matches[0].scores },
    { game: 'rock-paper-scissors', players: ['Ana', 'Ben'], winner: 0, scores: [3, 0] },
  );
  room.handleInput(1, { type: 'rematch' });
  finishRps(room, 1);
  assert.equal(stats.matches.length, 2);
  room.stopGame();
  const h = room.publicState().h2h;
  assert.deepEqual(h.wins, [1, 1]);

  // Leaving mid-match records nothing.
  startRps(room);
  room.handleInput(0, { type: 'pick', choice: 'rock' });
  room.stopGame();
  assert.equal(stats.matches.length, 2);
  room.dispose();
});

test('/api/stats serves the leaderboard; the admin can wipe it', async () => {
  const dir = tmp();
  const server = createApp({ port: 0, publicUrl: '', dataDir: dir, adminPassword: 'secret' });
  const addr = await server.listen();
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    assert.equal((await (await fetch(`${base}/api/stats`)).json()).total, 0);
    server.rooms.stats.record(win('pong', ['Abe', 'Sam'], 0, [5, 2]));
    const lb = await (await fetch(`${base}/api/stats`)).json();
    assert.equal(lb.total, 1);
    assert.equal(lb.players[0].name, 'Abe');

    const denied = await fetch(`${base}/api/admin/stats/reset`, { method: 'POST' });
    assert.equal(denied.status, 401);
    const { token } = await (await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    })).json();
    const ok = await fetch(`${base}/api/admin/stats/reset`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
    assert.deepEqual(await ok.json(), { ok: true });
    assert.equal((await (await fetch(`${base}/api/stats`)).json()).total, 0);
    assert.equal(new Stats(dir).matches.length, 0, 'wiped on disk too');
  } finally {
    await server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
