import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { detectLanAddress, resolveJoinBase } from '../server/network.js';

let server;
let url;
const sockets = [];

before(async () => {
  server = createApp({ port: 0, publicUrl: 'http://tv.local:3000' });
  const addr = await server.listen();
  url = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  for (const s of sockets) s.close();
  await server.close();
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
  assert.deepEqual(await call(p1, 'lobby:start', { gameId: 'rock-paper-scissors' }), { ok: true });
  assert.equal((await hostView).view.phase, 'choose');
  assert.equal((await p2View).view.you, 1);

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
