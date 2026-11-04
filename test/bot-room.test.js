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
  assert.ok(vs.includes('battleship') && vs.includes('connect-four'));
  assert.match(r.startGame('pong').error, /computer/);
  for (let i = 0; i < 40; i++) assert.ok(vs.includes(r.pickRandomGame()));
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

test('a tournament against the computer isn\'t recorded either, and a new level starts a new series', () => {
  const { r, stats } = room();
  r.setTournament({ bestOf: 3 });
  r.startGame('battleship');
  for (let i = 0; i < 2; i++) {
    r.gameId = 'battleship';
    r.recordResult({ phase: 'over', winner: 0 });
  }
  assert.equal(r.tournament.champion, 0, 'the series still plays out');
  assert.equal(stats.tournaments.length, 0, 'not in the leaderboard');
  r.stopGame();
  r.setTournament({ bestOf: 3 });
  r.gameId = 'battleship';
  r.recordResult({ phase: 'over', winner: 0 });
  r.gameId = null;
  r.seatBot('hard');
  assert.deepEqual(r.tournament.wins, [0, 0]);
  r.dispose();
});

test('someone joining in the lobby takes the computer\'s seat (a phone or a controller)', () => {
  const { r } = room();
  const ben = r.seatPlayer('Ben', null);
  assert.equal(ben.slot, 1);
  assert.equal(r.botSlot, -1);
  r.removePlayer(1);
  r.seatBot('easy');
  assert.equal(r.seatPlayer('Pad', null, { local: true }).slot, 1);
  assert.equal(r.botSlot, -1);
  // Mid-game it keeps its seat.
  r.removePlayer(1);
  r.seatBot('easy');
  r.startGame('battleship');
  assert.ok(r.seatPlayer('Cy', null).error);
  r.dispose();
});

test('the computer\'s seat isn\'t the TV\'s to play or restyle', () => {
  const { r } = room();
  r.profiles = { set: () => ({ avatar: '🦊' }), get: () => ({ avatar: '🦊', colour: 'x' }) };
  assert.ok(r.setProfile(1, { avatar: '🦊' }).error);
  r.dispose();
});

test('a broken move doesn\'t take the room down, and a refused one isn\'t retried forever', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { r } = room();
  r.startGame('battleship');
  const def = { bot: () => { throw new Error('oops'); } };
  r.botDef = () => def;
  assert.doesNotThrow(() => r.driveBot());
  // A move the game refuses: after a few tries the bot is told (retries) and can play something else.
  const seen = [];
  def.bot = (view, level, rng, retries) => { seen.push(retries); return { type: 'nonsense' }; };
  r.driveBot();
  wait(t, 6000);
  assert.ok(seen.includes(2), JSON.stringify(seen));
  r.dispose();
});

test('the computer waits its own pause, works out a move once per position, and forgets on a rematch', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const { r } = room();
  r.startGame('rock-paper-scissors');
  r.handleInput(0, { type: 'go' });
  const calls = [];
  const def = { bot: (view, level, rng, retries, memory) => { calls.push(view.phase); memory.seen = (memory.seen || 0) + 1; return view.phase === 'choose' && !view.yourPick ? { type: 'pick', choice: 'rock', botDelayMs: 300 } : null; } };
  r.botDef = () => def;
  r.botTimer = null;
  r.driveBot();
  r.pushGameViews();
  r.pushGameViews(); // the same position again: no new thinking
  assert.equal(calls.length, 1, 'once per position: ' + calls.length);
  wait(t, 200);
  assert.equal(r.game.game.picks[1], null, 'not before its pause');
  wait(t, 200);
  assert.equal(r.game.game.picks[1], 'rock', 'after its 300 ms');
  // Ana wins three; then a rematch: a fresh memory.
  const g = r.game.game;
  g.scores = [g.winScore - 1, 0];
  r.handleInput(0, { type: 'pick', choice: 'paper' });
  assert.equal(g.phase, 'over');
  assert.ok(r.botMemory.seen > 0);
  r.handleInput(0, { type: 'rematch' });
  assert.equal(r.botMemory.seen || 0, 1, 'forgotten (one look since)');
  r.dispose();
});
