import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/rooms.js';
import { Stats } from '../server/stats.js';
import { listGames } from '../server/games/index.js';

const io = { to: () => ({ emit() {} }) };
const match = (game, players, at) => ({ at, game, gameName: game, category: 'competitive', players, winner: 0, draw: false, scores: [1, 0] });

/** A room with a pretend TV; seats are controllers unless phones are asked for. */
function room({ stats = new Stats(null), phones = [false, false] } = {}) {
  const r = new Room('TEST', io, { stats });
  r.hostSockets.add('tv');
  ['Ana', 'Ben'].forEach((name, i) => {
    const seat = r.seatPlayer(name, null, { local: !phones[i] });
    if (phones[i]) seat.player.connected = true;
  });
  return r;
}

test('the lobby lists recently played games first within each category', () => {
  const stats = new Stats(null);
  stats.matches.push(match('tanks', ['Ana', 'Ben'], 1000), match('pong', ['Ana', 'Ben'], 3000), match('tanks', ['Ana', 'Ben'], 2000));
  const games = room({ stats }).publicState().games;
  assert.deepEqual(games.slice(0, 2).map((g) => g.id), ['pong', 'tanks']);
  assert.equal(games[0].lastPlayed, 3000);
  assert.equal(games[1].lastPlayed, 2000);
  assert.equal(games[2].lastPlayed, null);
  const cats = games.map((g) => g.category);
  assert.equal(cats.lastIndexOf('competitive') < cats.indexOf('casual'), true, 'categories stay grouped');
  assert.equal(games.length, listGames().length);
});

test('random picks a playable game that is not the one just played', () => {
  const r = room();
  for (let i = 0; i < 50; i++) {
    const id = r.pickRandomGame();
    assert.notEqual(id, 'sketch-guess', 'two controllers never get a game that needs a phone');
  }
  r.startGame('pong');
  r.stopGame();
  for (let i = 0; i < 50; i++) assert.notEqual(r.pickRandomGame(), 'pong');
  const res = r.startGame('random');
  assert.ok(res.ok);
  assert.equal(r.gameId, res.gameId);
  assert.notEqual(res.gameId, 'pong');
  r.dispose();

  const withPhone = room({ phones: [true, false] });
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(withPhone.pickRandomGame());
  assert.ok(seen.has('sketch-guess'), 'with a phone player every game can come up');
  assert.equal(seen.size, listGames().length);
});

test('controller players can be renamed; phone players and clashing names cannot', () => {
  const r = room({ phones: [true, false] });
  assert.match(r.renameLocal(0, 'Zed').error, /controller/);
  assert.match(r.renameLocal(1, 'ana').error, /already/);
  assert.match(r.renameLocal(1, '   ').error, /name/);
  assert.deepEqual(r.renameLocal(1, '  Abe  '), { ok: true, name: 'Abe' });
  assert.equal(r.publicState().players[1].name, 'Abe');
});

test('known names come from the history, most recent first, without repeats', () => {
  const stats = new Stats(null);
  stats.matches.push(match('pong', ['Ana', 'Ben'], 1), match('pong', ['Cat', 'ana'], 2), match('pong', ['Dee', 'Ben'], 3));
  assert.deepEqual(stats.knownNames(), ['Dee', 'Ben', 'Cat', 'ana']);
  assert.deepEqual(stats.knownNames(2), ['Dee', 'Ben']);
  assert.deepEqual(room({ stats }).publicState().knownNames, ['Dee', 'Ben', 'Cat', 'ana']);
});
