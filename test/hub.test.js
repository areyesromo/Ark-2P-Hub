import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { detectLanAddress, resolveJoinBase } from '../server/network.js';

let server;
let url;
let dataDir;
const sockets = [];

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-hub-'));
  server = createApp({ port: 0, publicUrl: 'http://tv.local:3000', dataDir });
  const addr = await server.listen();
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  for (const s of sockets) s.close();
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function client() {
  const s = connect(url, { transports: ['websocket'], forceNew: true });
  sockets.push(s);
  return s;
}

const call = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));

/** Resolve with the next `event` payload that satisfies `pred`. */
function next(socket, event, pred = () => true) {
  return new Promise((resolve) => {
    const handler = (msg) => {
      if (pred(msg)) {
        socket.off(event, handler);
        resolve(msg);
      }
    };
    socket.on(event, handler);
  });
}

test('host creates a room with a QR join link', async () => {
  const host = client();
  const res = await call(host, 'host:create', { origin: 'http://localhost:3000' });
  assert.ok(res.ok);
  assert.match(res.code, /^[A-Z]{4}$/);
  assert.match(res.qr, /^data:image\/png;base64,/);
  const state = server.rooms.get(res.code).publicState();
  assert.equal(state.joinUrl, `http://tv.local:3000/play/?room=${res.code}`);
});

test('full flow: two phones join, play, reconnect, and return to lobby', async () => {
  const host = client();
  const { code, hostToken } = await call(host, 'host:create', {});

  const p1 = client();
  const p2 = client();
  const j1 = await call(p1, 'player:join', { code: code.toLowerCase(), name: '  Ana ' });
  assert.equal(j1.slot, 0);
  assert.equal(j1.name, 'Ana');

  const readyState = next(host, 'room:state', (s) => s.readyToPlay);
  const j2 = await call(p2, 'player:join', { code, name: 'Ben' });
  assert.equal(j2.slot, 1);
  await readyState;

  // A third phone can't join a full room.
  const p3 = client();
  const j3 = await call(p3, 'player:join', { code, name: 'Cat' });
  assert.match(j3.error, /two players/);

  // A phone picks Rock Paper Scissors; everyone gets their own view.
  const hostView = next(host, 'game:view', (m) => m.gameId === 'rock-paper-scissors');
  const p2View = next(p2, 'game:view', (m) => m.gameId === 'rock-paper-scissors');
  assert.deepEqual(await call(p1, 'lobby:start', { gameId: 'rock-paper-scissors' }), { ok: true, gameId: 'rock-paper-scissors' });
  assert.equal((await hostView).view.phase, 'setup', 'it opens on its setup screen');
  assert.equal((await p2View).view.you, 1);
  const choosing = next(host, 'game:view', (m) => m.view.phase === 'choose');
  p2.emit('game:input', { type: 'go' });
  assert.equal((await choosing).view.winScore, 3);

  // P1 locks in: P2 learns that, but not what.
  const p2Sees = next(p2, 'game:view', (m) => m.view.opponentLocked);
  p1.emit('game:input', { type: 'pick', choice: 'rock' });
  const seen = await p2Sees;
  assert.equal(seen.view.opponentPick, null);

  // P2 drops (phone sleeps) and comes back with its token on a new socket.
  const away = next(host, 'room:state', (s) => s.players[1] && !s.players[1].connected);
  p2.close();
  await away;
  const p2b = client();
  const rejoin = await call(p2b, 'player:join', { code, name: 'Ben', token: j2.token });
  assert.equal(rejoin.slot, 1);

  // ...and finishes the round.
  const reveal = next(host, 'game:view', (m) => m.view.phase === 'reveal');
  p2b.emit('game:input', { type: 'pick', choice: 'paper' });
  const revealed = await reveal;
  assert.deepEqual(revealed.view.picks, ['rock', 'paper']);
  assert.deepEqual(revealed.view.scores, [0, 1]);

  // The TV refreshes and resumes the same room.
  host.close();
  const host2 = client();
  const resumed = await call(host2, 'host:resume', { code, hostToken });
  assert.ok(resumed.ok);

  // Back to the lobby.
  const lobby = next(host2, 'room:state', (s) => s.phase === 'lobby');
  await call(p1, 'lobby:return');
  await lobby;
});

test('cannot start a game without two connected players', async () => {
  const host = client();
  const { code } = await call(host, 'host:create', {});
  const p1 = client();
  await call(p1, 'player:join', { code, name: 'Solo' });
  const res = await call(p1, 'lobby:start', { gameId: 'reaction-duel' });
  assert.match(res.error, /two players/);
});

test('bad input is rejected politely', async () => {
  const s = client();
  assert.match((await call(s, 'player:join', { code: 'ZZZZ', name: 'x' })).error, /No room/);
  assert.match((await call(s, 'player:join', null)).error, /No room/);
  assert.match((await call(s, 'host:resume', { code: 'ZZZZ', hostToken: 'nope' })).error, /not found/);
});

test('join URL prefers PUBLIC_URL, then a non-loopback origin', () => {
  assert.equal(resolveJoinBase({ publicUrl: 'http://pi.lan:3000/', port: 3000 }), 'http://pi.lan:3000');
  assert.equal(resolveJoinBase({ hostOrigin: 'http://192.168.1.20:3000', port: 3000 }), 'http://192.168.1.20:3000');
  // A TV on localhost (Pi kiosk) must not put "localhost" in the QR code when a LAN address exists.
  const lan = detectLanAddress();
  const expected = lan ? `http://${lan}:3000` : 'http://localhost:3000';
  assert.equal(resolveJoinBase({ hostOrigin: 'http://localhost:3000', port: 3000 }), expected);
  assert.equal(resolveJoinBase({ hostOrigin: 'javascript:alert(1)', port: 3000 }), expected);
});

test('/version reports the package version and build stamp', async () => {
  const res = await fetch(`${url}/version`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.match(body.version, /^\d+\.\d+\.\d+$/);
  assert.ok(body.commit);
});

test('controller players: seated by the TV, present with the TV, driven only by the TV', async () => {
  const host = client();
  const { code, hostToken } = await call(host, 'host:create', {});

  // Only the TV can add a controller player.
  const phone = client();
  await call(phone, 'player:join', { code, name: 'Ana' });
  assert.match((await call(phone, 'pad:join', { name: 'Sneaky' })).error, /Only the TV/);

  const ready = next(host, 'room:state', (s) => s.readyToPlay);
  const pad = await call(host, 'pad:join', { name: 'Controller 1' });
  assert.equal(pad.slot, 1);
  const state = await ready;
  assert.deepEqual(state.players[1], { slot: 1, name: 'Controller 1', connected: true, local: true });
  assert.equal(state.players[0].local, false);

  // The controller plays through the TV; a phone can't send input for it.
  await call(host, 'lobby:start', { gameId: 'rock-paper-scissors' });
  host.emit('pad:input', { slot: 1, input: { type: 'go' } }); // past the setup screen
  const locked = next(host, 'game:view', (m) => m.view.locked && m.view.locked[1]);
  phone.emit('pad:input', { slot: 1, input: { type: 'pick', choice: 'rock' } });
  host.emit('pad:input', { slot: 0, input: { type: 'pick', choice: 'rock' } }); // slot 0 is a phone: ignored
  host.emit('pad:input', { slot: 1, input: { type: 'pick', choice: 'paper' } });
  const view = (await locked).view;
  assert.deepEqual(view.locked, [false, true]);

  // TV goes away -> controller player is away too; TV resumes -> back, same seat.
  const away = next(phone, 'room:state', (s) => s.players[1] && !s.players[1].connected);
  host.close();
  await away;
  const host2 = client();
  const back = next(phone, 'room:state', (s) => s.players[1] && s.players[1].connected);
  await call(host2, 'host:resume', { code, hostToken });
  await back;
  const again = await call(host2, 'pad:join', { name: 'Controller 1', token: pad.token });
  assert.equal(again.slot, 1);

  // Leaving frees the seat (and ends the game).
  const freed = next(phone, 'room:state', (s) => s.players[1] === null && s.phase === 'lobby');
  await call(host2, 'pad:leave', { slot: 1 });
  await freed;
});

test('after a server restart the TV reopens the same room, and phones can rejoin it', async () => {
  const host = client();
  const { code, hostToken } = await call(host, 'host:create', {});
  host.close();
  server.rooms.rooms.get(code).dispose();
  server.rooms.rooms.delete(code); // what a restart looks like: the room is gone

  const host2 = client();
  const resumed = await call(host2, 'host:resume', { code, hostToken, origin: 'http://192.168.1.20:3000' });
  assert.equal(resumed.ok, true);
  assert.equal(resumed.code, code, 'same code, so phones find it again');
  assert.equal(resumed.hostToken, hostToken);
  const phone = client();
  const joined = await call(phone, 'player:join', { code, name: 'Ana', token: 'old-token-from-before' });
  assert.equal(joined.ok, true);

  // Junk can't claim rooms: a bad token or a code that's taken.
  const bad = await call(client(), 'host:resume', { code: 'ZZZZ', hostToken: 'not-a-token' });
  assert.ok(bad.error);
  assert.equal(server.rooms.get('ZZZZ'), null);
  const stolen = await call(client(), 'host:resume', { code, hostToken: 'f'.repeat(32) });
  assert.ok(stolen.error);
});

test('/healthz counts games in progress (the Pi updater waits for 0)', async () => {
  const before = await (await fetch(`${url}/healthz`)).json();
  const host = client();
  const { code } = await call(host, 'host:create', {});
  await call(host, 'pad:join', { name: 'P1' });
  await call(host, 'pad:join', { name: 'P2' });
  assert.deepEqual(await call(host, 'lobby:start', { gameId: 'quiz' }), { ok: true, gameId: 'quiz' });
  const during = await (await fetch(`${url}/healthz`)).json();
  assert.equal(during.playing, before.playing + 1);
  await call(host, 'lobby:return');
  const after = await (await fetch(`${url}/healthz`)).json();
  assert.equal(after.playing, before.playing);
  assert.ok(server.rooms.get(code));
});
