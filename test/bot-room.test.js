import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { Stats } from '../server/stats.js';
import { listGames } from '../server/games/index.js';

const io = { to: () => ({ emit() {} }) };

/** Move the mocked clock in small steps (a timer set while it ticks fires on a later step). */
function wait(t, ms) {
  for (let i = 0; i < ms; i += 100) t.mock.timers.tick(100);
}

/** A room with a TV and one phone (Ana), and the computer in the other seat. */
function room({ level = 'normal', stats = new Stats(null) } = {}) {
  const r = new Room('TEST', io, { stats });
  r.hostSockets.add('tv');
  r.seatPlayer('Ana', null).player.connected = true;
  const res = r.seatBot(level);
  return { r, res, stats };
}

test('the computer takes the free seat, ready to play, and only one of it', () => {
  const { r, res } = room();
  assert.equal(res.slot, 1);
  assert.ok(r.readyToPlay);
  const seat = r.publicState().players[1];
  assert.equal(seat.bot, 'normal');
  assert.equal(seat.local, true, 'it plays on the TV, like a controller');
  assert.equal(seat.profile.avatar, '🤖');
  // Again: it changes level, it doesn't take another seat.
  assert.equal(r.seatBot('hard').slot, 1);
  assert.equal(r.publicState().players[1].bot, 'hard');
  assert.match(r.seatBot('genius').error, /level/);
  // No free seat: no computer.
  const full = new Room('FULL', io, {});
  full.seatPlayer('Ana', null).player.connected = true;
  full.seatPlayer('Ben', null).player.connected = true;
  assert.match(full.seatBot('easy').error, /two players/);
  // Its seat doesn't vanish with the TV (it's there for a phone-only game too), nor keep a room alive.
  r.hostSockets.clear();
  r.syncLocalPlayers();
  assert.equal(r.players[1].connected, true);
  r.players[0].connected = false;
  assert.equal(r.isIdle(Date.now() + 24 * 3600 * 1000), true);
  r.dispose();
});

test('a person can\'t join under the computer\'s name, and it can\'t be renamed', () => {
  const { r } = room();
  assert.ok(r.seatPlayer('computer', null).error);
  assert.ok(r.renameLocal(1, 'Bob').error);
  r.dispose();
});

test('against the computer, only games it can play start (and come up at random)', () => {
  const { r } = room();
  const vs = listGames().filter((g) => g.vsComputer).map((g) => g.id);
  assert.deepEqual(vs, ['battleship']);
  assert.match(r.startGame('pong').error, /computer/);
  for (let i = 0; i < 20; i++) assert.equal(r.pickRandomGame(), 'battleship');
  assert.ok(r.startGame('battleship').ok);
  r.dispose();
});

test('the computer plays its moves, and a match against it isn\'t recorded', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { r, stats } = room({ level: 'hard' });
  r.startGame('battleship');
  r.handleInput(0, { type: 'setting', key: 'shotSeconds', value: 0 });
  r.handleInput(0, { type: 'go' });
  const g = r.game.game; // (the game inside the setup screen)
  r.handleInput(0, { type: 'ready', ships: g.fleets[0] }); // Ana keeps the random fleet
  assert.equal(g.phase, 'aim');
  // Ana fires at every square in turn; the computer answers each time.
  let k = 0;
  for (let i = 0; i < 300 && g.phase !== 'over'; i++) {
    if (g.phase === 'aim' && g.turn === 0) {
      while (g.shots[1][k] !== 0) k++;
      r.handleInput(0, { type: 'fire', x: k % 10, y: Math.floor(k / 10) });
    }
    wait(t, 2000);
  }
  assert.equal(g.phase, 'over');
  assert.ok(g.fired[1] > 0, 'it fired');
  assert.equal(stats.matches.length, 0, 'not in anyone\'s stats');
  assert.equal(r.publicState().h2h, null);
  r.dispose();
});

test('a stopped game takes the computer\'s next move with it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { r } = room();
  r.startGame('battleship');
  r.handleInput(0, { type: 'go' });
  r.handleInput(0, { type: 'ready', ships: r.game.game.fleets[0] });
  const g = r.game.game;
  if (g.turn === 0) {
    r.handleInput(0, { type: 'fire', x: 0, y: 0 });
    wait(t, 1600);
  }
  assert.equal(g.turn, 1);
  r.stopGame();
  const fired = g.fired[1];
  wait(t, 5000);
  assert.equal(g.fired[1], fired);
  r.dispose();
});
