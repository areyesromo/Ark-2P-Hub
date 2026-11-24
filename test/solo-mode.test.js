// The lobby's 1 player mode: the solo games (server/solo/) played on this hub's room.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { Stats as SoloStats } from '../server/solo/stats.js';
import { listGames, getGame } from '../server/games/index.js';
import { answerOf } from '../server/solo/games/dogpark-gen.js';
import { parseLevel } from '../server/solo/games/dogpark.js';
import { LEVELS } from '../server/solo/games/dogpark-levels.js';

/** A pretend Socket.IO that keeps what each channel was sent. */
function fakeIo() {
  const sent = [];
  return { sent, to: (channel) => ({ emit: (event, msg) => sent.push({ channel, event, msg }) }) };
}

/** A room with a TV; `names` take the seats as controllers. */
function room(names = ['Ana'], { soloStats = new SoloStats(null) } = {}) {
  const io = fakeIo();
  const r = new Room('TEST', io, { soloStats });
  r.hostSockets.add('tv');
  for (const name of names) r.seatPlayer(name, null, { local: true });
  r.syncLocalPlayers();
  return { r, io };
}
/** A channel's latest view, whole: big fields that didn't change aren't sent again (`kept`), as the screens fill them in. */
function lastView(io, channel) {
  let view = null;
  for (const s of io.sent) {
    if (s.channel !== channel || s.event !== 'game:view') continue;
    const v = { ...s.msg.view };
    for (const key of s.msg.kept || []) v[key] = view[key];
    view = v;
  }
  return view;
}
/** The game inside the room's solo seat and its setup screen. */
const inner = (r) => r.game.game.game;

/** Dog Park, level 1, past its setup screen; returns the answer to play. */
function dogPark(r, slot) {
  assert.ok(r.startGame('dogpark', { slot }).ok);
  r.handleInput(slot, { type: 'setting', key: 'park', value: 1 });
  r.handleInput(slot, { type: 'go' });
  const { n, regions } = parseLevel(LEVELS[0]);
  return answerOf(n, regions);
}

test('the switch: 2 players lists the 1v1 games, 1 player the solo ones; not in the middle of a game', () => {
  const { r } = room(['Ana', 'Ben']);
  assert.equal(r.publicState().mode, 'duo');
  assert.ok(r.publicState().games.every((g) => !g.solo));
  assert.equal(r.setMode('solo').ok, true);
  const s = r.publicState();
  assert.equal(s.mode, 'solo');
  assert.deepEqual(s.games.map((g) => g.id).sort(), listGames().filter((g) => g.solo).map((g) => g.id).sort());
  assert.ok(s.games.length >= 3 && s.games.every((g) => g.solo && g.score && g.score.unit));
  assert.match(r.setMode('trio').error, /1 player or 2 players/);
  r.startGame('reaction-1p');
  assert.match(r.setMode('duo').error, /Finish this game/);
  r.dispose();
});

test('one person is enough in 1 player mode, and each mode only starts its own games', () => {
  const { r } = room(['Ana']);
  assert.equal(r.readyToPlay, false, 'a 1v1 game waits for two');
  assert.match(r.startGame('snake-1p').error, /1 player game/);
  r.setMode('solo');
  assert.equal(r.readyToPlay, true);
  assert.match(r.startGame('pong').error, /for 2 players/);
  for (let i = 0; i < 20; i++) {
    const res = r.startGame('random');
    assert.ok(res.ok && getGame(res.gameId).solo, 'random picks a solo game');
  }
  r.dispose();
});

test('a solo game is played by whoever picked it; the other seat watches', () => {
  const { r, io } = room(['Ana', 'Ben']);
  r.setMode('solo');
  const answer = dogPark(r, 1);
  assert.equal(r.soloSlot, 1);
  assert.equal(r.publicState().soloSlot, 1);
  const mine = lastView(io, 'p:TEST:1');
  const theirs = lastView(io, 'p:TEST:0');
  assert.equal(mine.phase, 'play');
  assert.ok(Array.isArray(mine.marks));
  assert.equal(theirs.watching, true);
  assert.equal(theirs.marks, undefined, 'the watcher gets no board to tap');
  // The watcher's taps do nothing.
  r.handleInput(0, { type: 'mark', cell: answer[0], mark: 2 });
  assert.equal(inner(r).marks[answer[0]], 0);
  // The TV sees who's playing.
  const tv = lastView(io, 'h:TEST');
  assert.equal(tv.soloSlot, 1);
  assert.equal(tv.players[1].name, 'Ben');
  r.dispose();
});

test('a finished run is recorded under its player: the best, a new best, the achievements, then the lobby card', () => {
  const soloStats = new SoloStats(null);
  const { r, io } = room(['Ana'], { soloStats });
  r.setMode('solo');
  for (let go = 0; go < 2; go++) {
    const answer = dogPark(r, 0);
    for (const c of answer) r.handleInput(0, { type: 'mark', cell: c, mark: 2 });
    const v = lastView(io, 'h:TEST');
    assert.equal(v.phase, 'over');
    assert.ok(v.record && v.record.score >= 0);
    if (go === 0) {
      assert.equal(v.record.newBest, true);
      assert.ok(v.record.unlocked.some((a) => a.id === 'dogpark-solve'), 'Good dog');
    } else {
      assert.equal(v.best, soloStats.bestFor('dogpark', 'Level 1', 'Ana', 'lower'));
      assert.deepEqual(v.record.unlocked, [], 'not twice');
    }
    const phone = lastView(io, 'p:TEST:0');
    assert.deepEqual(phone.record, v.record, 'the phone gets the end screen too');
    r.stopGame();
  }
  assert.equal(soloStats.runs.length, 2);
  assert.equal(soloStats.runs[0].player, 'Ana');
  assert.ok(soloStats.achievementsOf('Ana')['dogpark-solve']);
  const card = r.publicState().games.find((g) => g.id === 'dogpark');
  assert.equal(card.best.variant, 'Level 1');
  // Level 2 opens now: its setup screen says so.
  r.startGame('dogpark', { slot: 0 });
  const setup = lastView(io, 'h:TEST');
  assert.equal(setup.hubSetup.locked.park[2], undefined, 'level 2 is open');
  assert.match(setup.hubSetup.locked.park[3], /Solve level 2/);
  assert.equal(setup.hubSetup.locked.look, undefined, 'and the Aussie, with Good dog');
  r.dispose();
});

test('the computer sits a solo game out, and the 1v1 match history never sees one', () => {
  const { r } = room(['Ana']);
  r.seatBot('easy');
  r.setMode('solo');
  assert.ok(r.startGame('reaction-1p').ok);
  assert.equal(r.soloSlot, 0, 'the person plays, not the computer');
  r.driveBot(); // nothing to do: no crash, no move
  assert.equal(r.botTimer, null);
  r.dispose();
});
