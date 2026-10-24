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

  // One phone, one controller: games one phone is enough for, but never a phone-only one.
  const withPhone = room({ phones: [true, false] });
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(withPhone.pickRandomGame());
  assert.ok(seen.has('mind-meld'), 'the phone player can give the clues');
  for (const g of listGames().filter((x) => x.phoneOnly)) assert.ok(!seen.has(g.id), g.id);
  // Two phones: every game can come up.
  const phones = room({ phones: [true, true] });
  const all = new Set();
  for (let i = 0; i < 600; i++) all.add(phones.pickRandomGame());
  assert.equal(all.size, listGames().length);
});

test('a phone-only game will not start while a controller holds a seat', () => {
  const phoneOnly = listGames().filter((g) => g.phoneOnly).map((g) => g.id).sort();
  assert.deepEqual(phoneOnly, ['anagram-duel', 'bomb-squad', 'draw-duel', 'liars-dice', 'sketch-guess', 'word-race']);
  const r = room({ phones: [true, false] });
  assert.match(r.startGame('word-race').error, /two phones/);
  assert.equal(r.game, null);
  assert.ok(room({ phones: [true, true] }).startGame('word-race').ok);
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

test("a game's saved settings survive going back to the lobby, per room and per game", () => {
  const r = room({ phones: [true, true] });
  r.startGame('word-race');
  r.handleInput(0, { type: 'setting', key: 'size', value: 6 });
  r.handleInput(1, { type: 'setting', key: 'time', value: 180 });
  r.stopGame();
  r.startGame('pong');
  r.stopGame();
  r.startGame('word-race');
  assert.deepEqual(r.game.hostView().settings, { size: 6, time: 180, rounds: 3 });
  r.stopGame();
  const other = room({ phones: [true, true] });
  other.startGame('word-race');
  assert.deepEqual(other.game.hostView().settings.size, 4, 'another room starts from the defaults');
  other.stopGame();
});

test('a phone that comes back without its token (other browser, cleared storage) gets its own seat back, not a second one', () => {
  const r = new Room('TEST', io, { stats: new Stats(null) });
  r.hostSockets.add('tv');
  const first = r.seatPlayer('Test3', null);
  const oldToken = first.player.token;
  first.player.connected = false; // the phone went away
  const again = r.seatPlayer(' test3 ', null); // same person, no token
  assert.equal(again.slot, first.slot);
  assert.equal(again.rejoined, true);
  assert.equal(r.players.filter(Boolean).length, 1, 'no second seat');
  assert.notEqual(again.player.token, oldToken, 'a fresh token: the old device can\'t take the seat back');
  assert.equal(r.seatPlayer('Test3', oldToken).rejoined, true, 'while the seat is free, the name still gets it');
});

test('two people with the same name: the second has to pick another while the first is here', () => {
  const r = new Room('TEST', io, { stats: new Stats(null) });
  const a = r.seatPlayer('Sam', null);
  a.player.connected = true;
  assert.match(r.seatPlayer('SAM', null).error, /already called Sam/);
  assert.equal(r.players.filter(Boolean).length, 1);
});

test('a controller cannot take a seat while a phone-only game is running', () => {
  const r = room({ phones: [true, true] });
  r.startGame('word-race');
  r.players[1].connected = false; // a phone dropped out
  assert.match(r.seatPlayer('Pad', null, { local: true }).error, /two phones/);
  r.stopGame();
  assert.ok(!r.seatPlayer('Pad', null, { local: true }).error, 'from the lobby it can');
});
