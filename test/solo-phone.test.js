// Phone only (/phone): a phone opens a room of its own with no TV and plays the solo games
// whose phone screen shows the whole game (`phone` on the game; 'split' sends the TV's view too).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';
import { Room } from '../server/rooms.js';
import { Stats as SoloStats } from '../server/solo/stats.js';
import { listGames, getGame } from '../server/games/index.js';
import { challengeFor, dayOf } from '../server/solo/daily.js';

function fakeIo() {
  const sent = [];
  return { sent, to: (channel) => ({ emit: (event, msg) => sent.push({ channel, event, msg }) }) };
}

/** A phone-only room with Ana in it (as phone:create makes it). */
function phoneRoom() {
  const io = fakeIo();
  const r = new Room('TEST', io, { soloStats: new SoloStats(null), noTv: true });
  const seat = r.seatPlayer('Ana', null);
  r.players[seat.slot].connected = true;
  return { r, io };
}

const call = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

test('every solo game says whether it plays on the phone alone, and most do', () => {
  const solo = listGames().filter((g) => g.solo);
  for (const g of solo) assert.ok([true, 'split', false].includes(g.phone), g.id);
  assert.ok(solo.filter((g) => g.phone).length >= 30);
  assert.ok(listGames().filter((g) => !g.solo).every((g) => g.phone === undefined), 'the 1v1 games need the TV');
});

test('a phone-only room: the 1 player games marked phone, no switch to 2 players, no computer', () => {
  const { r } = phoneRoom();
  const s = r.publicState();
  assert.equal(s.mode, 'solo');
  assert.equal(s.noTv, true);
  assert.equal(r.readyToPlay, true);
  assert.deepEqual(s.games.map((g) => g.id).sort(), listGames().filter((g) => g.solo && g.phone).map((g) => g.id).sort());
  assert.match(r.setMode('duo').error, /need the TV/);
  assert.match(r.seatBot('easy').error, /TV/);
  assert.match(r.startGame('pong').error, /needs the TV/);
  for (let i = 0; i < 20; i++) assert.ok(getGame(r.startGame('random', { slot: 0 }).gameId).phone);
  // A TV room still offers them all.
  const tv = new Room('TV00', fakeIo(), { soloStats: new SoloStats(null) });
  tv.setMode('solo');
  assert.equal(tv.publicState().games.length, listGames().filter((g) => g.solo).length);
  assert.equal(tv.publicState().noTv, false);
  r.dispose();
  tv.dispose();
});

test('a phone-only room\'s daily challenge: playable only when the day\'s game is a phone one', () => {
  const { r } = phoneRoom();
  const c = challengeFor(dayOf(Date.now()));
  const phone = Boolean(getGame(c.game).phone);
  assert.equal(r.publicState().daily.playable, phone);
  const res = r.startGame('daily', { slot: 0 });
  if (phone) assert.ok(res.ok);
  else assert.match(res.error, /needs the TV/);
  r.dispose();
});

test('a split game sends the phone the TV\'s view too; a phone one doesn\'t, and nothing goes to the TV channel', () => {
  const { r, io } = phoneRoom();
  r.startGame('snake-1p', { slot: 0 });
  r.handleInput(0, { type: 'go' });
  const mine = io.sent.filter((s) => s.channel === 'p:TEST:0' && s.event === 'game:view').at(-1).msg;
  assert.equal(mine.gameId, 'snake-1p');
  assert.ok(mine.tv && Array.isArray(mine.tv.body) && mine.tv.grid, 'the TV\'s picture of the board');
  assert.equal(io.sent.filter((s) => s.channel === 'h:TEST' && s.event === 'game:view').length, 0);
  r.startGame('dogpark', { slot: 0 });
  r.handleInput(0, { type: 'go' });
  const park = io.sent.filter((s) => s.channel === 'p:TEST:0' && s.event === 'game:view').at(-1).msg;
  assert.equal(park.gameId, 'dogpark');
  assert.equal(park.tv, undefined);
  r.dispose();
});

test('over sockets: /phone opens a room of its own; only its token gets back in; not from a code alone', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-phone-'));
  const app = createApp({ port: 0, dataDir, https: false });
  const { port } = await app.listen();
  const sockets = [];
  const client = () => {
    const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return s;
  };
  try {
    const page = await fetch(`http://127.0.0.1:${port}/phone`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /join-form/);

    const phone = client();
    const states = [];
    phone.on('room:state', (s) => states.push(s));
    const made = await call(phone, 'phone:create', { name: 'Ana' });
    assert.equal(made.ok, true);
    assert.equal(made.slot, 0);
    await sleep(50);
    assert.equal(states.at(-1).noTv, true);
    assert.equal(states.at(-1).mode, 'solo');
    assert.equal((await call(phone, 'lobby:mode', { mode: 'duo' })).error !== undefined, true);

    // Someone else with the code: no way in.
    const other = client();
    assert.match((await call(other, 'player:join', { code: made.code, name: 'Ben' })).error, /No room/);
    // The same phone after a reload: back in with its token.
    const again = client();
    const back = await call(again, 'player:join', { code: made.code, name: 'Ana', token: made.token });
    assert.equal(back.ok, true);
    assert.equal(back.slot, 0);
    // A bad name makes no room.
    const before = app.rooms.rooms.size;
    assert.ok((await call(client(), 'phone:create', { name: '   ' })).error);
    assert.equal(app.rooms.rooms.size, before);
  } finally {
    for (const s of sockets) s.close();
    await app.close();
  }
});
