// Screens that drop out and come back mid-game. The room leaves big fields out of a view while they
// haven't changed (`kept`, Room#viewPacket) and each screen fills them in from its last whole view
// (host.js, play.js): a screen that (re)joins must get a whole view first, and one with nothing to
// fill in from asks again (game:resync). Here the screens are socket.io clients doing what the pages do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';

const call = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * A screen as host.js and play.js are: fills `kept` in from its last whole view, asks for a whole
 * one when it has none. `drop`: it loses that many views first (as ones lost mid-reconnect).
 */
function screen(socket, { drop = 0 } = {}) {
  const s = { views: [], full: null, kept: 0, resyncs: 0, missing: [] };
  socket.on('game:view', (msg) => {
    if (drop > 0) {
      drop--;
      return;
    }
    if (msg.kept) {
      s.kept++;
      if (!s.full || s.full.gameId !== msg.gameId) {
        s.resyncs++;
        socket.emit('game:resync');
        return;
      }
      const view = { ...msg.view };
      for (const key of msg.kept) view[key] = s.full.view[key];
      msg = { gameId: msg.gameId, view };
    }
    s.full = msg;
    s.views.push(msg.view);
  });
  return s;
}

async function hub() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-reconnect-'));
  const app = createApp({ port: 0, dataDir, https: false });
  const { port } = await app.listen();
  const sockets = [];
  const client = () => {
    const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return s;
  };
  return { app, client, close: async () => { for (const s of sockets) s.close(); await app.close(); } };
}

/** Wait until `check` holds (polling), or fail after `ms`. */
async function until(check, ms, what) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return;
    await sleep(25);
  }
  assert.fail('timed out waiting for ' + what);
}

test('Brick Duel against the computer: a phone and the TV drop out mid-game and come back with every field', async () => {
  const h = await hub();
  try {
    const tv = h.client();
    const tvScreen = screen(tv);
    const { code, hostToken } = await call(tv, 'host:create', {});
    const phone = h.client();
    const joined = await call(phone, 'player:join', { code, name: 'Ana' });
    const phoneScreen = screen(phone);
    assert.equal((await call(tv, 'bot:join', { level: 'normal' })).ok, true);
    assert.equal((await call(phone, 'lobby:start', { gameId: 'brick-duel' })).ok, true);
    phone.emit('game:input', { type: 'go' });
    const room = h.app.rooms.get(code);
    // Playing: both screens get packets with the walls left out, and fill them back in.
    await until(() => phoneScreen.kept > 5 && tvScreen.kept > 5, 15000, 'packets with kept fields');
    const lastPhone = phoneScreen.views[phoneScreen.views.length - 1];
    const lastTv = tvScreen.views[tvScreen.views.length - 1];
    assert.ok(Array.isArray(lastPhone.wall) && lastPhone.wall.length > 0, "the phone's wall, filled in");
    assert.ok(Array.isArray(lastTv.walls) && lastTv.walls.length === 2, "the TV's walls, filled in");
    assert.equal(phoneScreen.resyncs + tvScreen.resyncs, 0, 'no screen ever missed its whole view');

    // The phone drops out and comes back (a new socket, its seat by its token).
    phone.close();
    await sleep(200);
    const phone2 = h.client();
    const back = screen(phone2);
    const rejoined = await call(phone2, 'player:join', { code, name: 'Ana', token: joined.token });
    assert.equal(rejoined.slot, joined.slot, 'its own seat back');
    await until(() => back.views.length > 10, 10000, 'views after the phone came back');
    assert.equal(back.resyncs, 0, 'its first view was a whole one');
    const full = Object.keys(room.game.playerView(joined.slot)).sort();
    for (const v of back.views) assert.deepEqual(Object.keys(v).sort(), full, 'every field there after it came back');

    // The TV drops out and re-opens its room.
    tv.close();
    await sleep(200);
    const tv2 = h.client();
    const tvBack = screen(tv2);
    assert.equal((await call(tv2, 'host:resume', { code, hostToken })).ok, true);
    await until(() => tvBack.views.length > 10, 10000, 'views after the TV came back');
    assert.equal(tvBack.resyncs, 0);
    const tvFull = Object.keys(room.game.hostView()).sort();
    for (const v of tvBack.views) assert.deepEqual(Object.keys(v).sort(), tvFull);
  } finally {
    await h.close();
  }
});

test('a screen that missed its whole view asks for one (game:resync) and carries on', async () => {
  const h = await hub();
  try {
    const tv = h.client();
    screen(tv);
    const { code } = await call(tv, 'host:create', {});
    const phone = h.client();
    await call(phone, 'player:join', { code, name: 'Ana' });
    assert.equal((await call(tv, 'bot:join', { level: 'easy' })).ok, true);
    assert.equal((await call(phone, 'lobby:start', { gameId: 'brick-duel' })).ok, true);
    phone.emit('game:input', { type: 'go' });
    await sleep(1500);
    // A remote screen that loses the whole views it's sent on joining (its snapshot, and the next
    // broadcast, which goes whole after a join): the packets after keep fields it never had, so it
    // asks, and gets a whole one.
    const watcher = h.client();
    const late = screen(watcher, { drop: 2 });
    assert.equal((await call(watcher, 'watch:join', { code })).ok, true);
    await until(() => late.views.length > 5, 10000, 'views on the late screen');
    assert.equal(late.resyncs, 1, 'it asked once');
    const room = h.app.rooms.get(code);
    const full = Object.keys(room.game.hostView()).sort();
    for (const v of late.views) assert.deepEqual(Object.keys(v).sort(), full);
  } finally {
    await h.close();
  }
});
