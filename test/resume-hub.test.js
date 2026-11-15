// A game in progress survives a restart of the hub: the TV re-opens its room, the game is where it
// was, and the phone gets its own seat back (see saves.js, Room#saveGame and RoomManager#create).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io as connect } from 'socket.io-client';
import { createApp } from '../server/app.js';

const call = (socket, event, data) => new Promise((resolve) => socket.emit(event, data, resolve));
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
async function hub(dataDir) {
  const app = createApp({ port: 0, dataDir, https: false });
  const { port } = await app.listen();
  const sockets = [];
  const client = () => {
    const s = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'], forceNew: true });
    sockets.push(s);
    return s;
  };
  const close = async () => {
    for (const s of sockets) s.close();
    await app.close();
  };
  return { client, close };
}

test('a game in progress picks up after the hub restarts: the TV re-opens the room, the phone gets its seat back', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-resume-'));
  try {
    // Before: Ana against the computer at Connect Four, a move each made.
    const one = await hub(dataDir);
    const tv = one.client();
    const { code, hostToken } = await call(tv, 'host:create', {});
    const phone = one.client();
    const joined = await call(phone, 'player:join', { code, name: 'Ana' });
    assert.equal((await call(tv, 'bot:join', { level: 'easy' })).ok, true);
    assert.equal((await call(phone, 'lobby:start', { gameId: 'connect-four' })).ok, true);
    phone.emit('game:input', { type: 'go' });
    const mine = await next(phone, 'game:view', (m) => m.view.phase === 'play' && m.view.turn === joined.slot);
    phone.emit('game:input', { type: 'drop', col: 3 });
    // (the computer answers after its pause, and it's Ana's turn again)
    const before = await next(tv, 'game:view', (m) => m.view.phase === 'play' && m.view.turn === joined.slot && m.view.board.flat().filter(Boolean).length === 2);
    assert.ok(mine);
    await one.close();
    assert.ok(fs.existsSync(path.join(dataDir, 'games', `${code}.bin`)), 'saved when the hub closed');

    // After: a new hub on the same data; the TV re-opens its room as it does after a restart.
    const two = await hub(dataDir);
    const tv2 = two.client();
    const view = next(tv2, 'game:view');
    const resumed = await call(tv2, 'host:resume', { code, hostToken });
    assert.equal(resumed.ok, true);
    const after = await view;
    assert.equal(after.gameId, 'connect-four');
    assert.deepEqual(after.view.board, before.view.board, 'the same board');
    assert.equal(after.view.turn, before.view.turn, 'the same turn');
    // Ana's phone rejoins with its token: her own seat, and she can move.
    const phone2 = two.client();
    const back = await call(phone2, 'player:join', { code, name: 'Ana', token: joined.token });
    assert.equal(back.slot, joined.slot, 'her seat');
    const moved = next(tv2, 'game:view', (m) => m.view.board.flat().filter(Boolean).length === 3);
    phone2.emit('game:input', { type: 'drop', col: 4 });
    await moved;
    // Back to the lobby: the save goes (nothing to pick up any more).
    await call(phone2, 'lobby:return', {});
    assert.ok(!fs.existsSync(path.join(dataDir, 'games', `${code}.bin`)), 'gone once the game is left');
    await two.close();
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
