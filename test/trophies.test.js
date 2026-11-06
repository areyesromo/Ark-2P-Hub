// Trophies (each player's achievements) and practice records against the computer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trophies, TROPHIES, contextFor } from '../server/trophies.js';
import { Practice } from '../server/practice.js';
import { Stats } from '../server/stats.js';
import { Room } from '../server/rooms.js';

const io = { to: () => ({ emit() {} }) };
const base = { game: 'connect-four', category: 'competitive', view: {}, slot: 0, won: false, draw: false, bot: null, title: null, played: new Set(['connect-four']), wonVsPeople: new Set(), winsVsPeople: 0, bestRivalWins: 0, hardWins: new Set(), allGames: 50, botGames: ['connect-four', 'pong'] };

test('a trophy is earned once, by that player, and every one has an icon, a name and how to get it', () => {
  const t = new Trophies(null);
  const got = t.check('Ana', { ...base, won: true }).map((x) => x.id);
  assert.ok(got.includes('first-game') && got.includes('first-win'));
  assert.deepEqual(t.check('ana', { ...base, won: true }), [], 'not twice (names match whatever the case)');
  assert.equal(t.forName('Ben').count, 0, 'Ben has none of Ana\'s');
  const me = t.forName('Ana');
  assert.equal(me.total, TROPHIES.length);
  assert.ok(me.trophies.find((x) => x.id === 'first-win').at);
  assert.equal(me.trophies.find((x) => x.id === 'champion').at, null);
  for (const x of TROPHIES) assert.ok(x.icon && x.name && x.how && typeof x.test === 'function', x.id);
  assert.equal(new Set(TROPHIES.map((x) => x.id)).size, TROPHIES.length, 'ids are unique');
});

test('feats come from the game\'s result: the Warden, a clean sweep, Untouchable, a best-of-7 title', () => {
  const t = new Trophies(null);
  const ids = (name, e) => t.check(name, { ...base, ...e }).map((x) => x.id);
  assert.ok(ids('A', { game: 'dungeon-duo', category: 'casual', view: { won: true, stars: 3, maxStars: 3 } }).includes('flawless-quest'));
  assert.ok(ids('B', { won: true, view: { scores: [3, 0] } }).includes('clean-sweep'));
  assert.ok(!ids('C', { won: true, slot: 1, view: { scores: [0, 3] } }).includes('clean-sweep') === false);
  assert.ok(ids('D', { game: 'micro-mayhem', won: true, view: { lives: [3, 0], startLives: 3 } }).includes('untouchable'));
  assert.ok(!ids('E', { game: 'micro-mayhem', won: true, view: { lives: [2, 0], startLives: 3 } }).includes('untouchable'));
  assert.ok(ids('F', { won: true, title: { bestOf: 7 } }).includes('champion'));
  assert.ok(!ids('G', { won: true, title: { bestOf: 3 } }).includes('champion'));
  // A check that trips over an odd view just isn't earned.
  assert.doesNotThrow(() => t.check('H', { ...base, game: 'micro-mayhem', won: true, view: null }));
});

test('the counting trophies come from the history and the practice records', () => {
  const stats = new Stats(null);
  for (let i = 0; i < 10; i++) stats.record({ game: 'g' + i, gameName: 'G', category: 'competitive', players: ['Ana', 'Ben'], winner: 0 });
  stats.record({ game: 'coop', gameName: 'C', category: 'casual', players: ['Ana', 'Ben'], stars: 2, maxStars: 3 });
  const practice = new Practice(null);
  practice.record({ name: 'Ana', game: 'pong', level: 'hard', result: 'win' });
  practice.record({ name: 'Ana', game: 'connect-four', level: 'easy', result: 'loss' });
  const c = contextFor('ana', { stats, practice });
  assert.equal(c.played.size, 13);
  assert.equal(c.winsVsPeople, 10);
  assert.equal(c.wonVsPeople.size, 10);
  assert.equal(c.bestRivalWins, 10);
  assert.deepEqual([...c.hardWins], ['pong']);
  const ids = new Trophies(null).check('Ana', { ...base, ...c, won: true }).map((x) => x.id);
  assert.ok(ids.includes('explorer') && ids.includes('all-rounder') && ids.includes('nemesis'));
  assert.ok(!ids.includes('unbeatable'), 'Connect Four not beaten on Hard yet');
});

test('practice records: played, won and drawn per game and level, best stars in the co-op games; a bad level isn\'t kept', () => {
  const p = new Practice(null);
  p.record({ name: 'Ana', game: 'pong', level: 'normal', result: 'win' });
  p.record({ name: 'ana', game: 'pong', level: 'normal', result: 'draw' });
  p.record({ name: 'Ana', game: 'marble-maze', level: 'hard', stars: 7, maxStars: 9 });
  p.record({ name: 'Ana', game: 'marble-maze', level: 'hard', stars: 4, maxStars: 9 });
  p.record({ name: 'Ana', game: 'pong', level: 'genius', result: 'win' });
  assert.deepEqual({ ...p.recordsFor('ANA').pong }, { normal: { played: 2, wins: 1, draws: 1 } });
  assert.equal(p.recordsFor('Ana')['marble-maze'].hard.bestStars, 7);
  assert.equal(Object.keys(p.recordsFor('Ben')).length, 0);
});

test('the room: a game against the computer goes to practice (not the history) and earns trophies, shown on the screens', () => {
  const stats = new Stats(null);
  const practice = new Practice(null);
  const trophies = new Trophies(null);
  const r = new Room('TROP', io, { stats, practice, trophies });
  r.hostSockets.add('tv');
  r.seatPlayer('Ana', null).player.connected = true;
  r.seatBot('hard');
  r.gameId = 'connect-four';
  r.recordResult({ phase: 'over', winner: 0, scores: [1, 0] });
  assert.equal(stats.matches.length, 0, 'not in the history');
  assert.deepEqual(practice.recordsFor('Ana')['connect-four'].hard, { played: 1, wins: 1, draws: 0 });
  const s = r.publicState();
  const ids = s.trophies.list.map((x) => x.id);
  assert.ok(ids.includes('sparring') && ids.includes('machine-breaker') && !ids.includes('first-win'), ids.join());
  assert.equal(s.trophies.list[0].slot, 0);
  assert.equal(s.trophies.list[0].player, 'Ana');
  assert.equal(s.practice['connect-four'].hard.wins, 1, 'the game cards show it');
  // A new game: the news is cleared.
  r.startGame('pong');
  assert.equal(r.publicState().trophies, null);
  r.dispose();
});

test('the room: two people both get theirs (a co-op game for both, a win for the winner)', () => {
  const stats = new Stats(null);
  const trophies = new Trophies(null);
  const r = new Room('TRO2', io, { stats, practice: new Practice(null), trophies });
  r.hostSockets.add('tv');
  r.seatPlayer('Ana', null).player.connected = true;
  r.seatPlayer('Ben', null).player.connected = true;
  r.gameId = 'connect-four';
  r.recordResult({ phase: 'over', winner: 1, scores: [0, 4] });
  const list = r.publicState().trophies.list;
  assert.ok(list.some((x) => x.player === 'Ben' && x.id === 'first-win'));
  assert.ok(list.some((x) => x.player === 'Ana' && x.id === 'first-game'));
  assert.ok(!list.some((x) => x.player === 'Ana' && x.id === 'first-win'));
  assert.equal(r.publicState().practice, null, 'no practice cards without the computer');
  r.dispose();
});

test('names that are words in JavaScript (constructor, __proto__, toString) are just names', () => {
  const t = new Trophies(null);
  const p = new Practice(null);
  for (const name of ['Constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    assert.doesNotThrow(() => t.check(name, { ...base, won: true }), name);
    assert.equal(t.forName(name).count >= 1, true, name);
    assert.doesNotThrow(() => p.record({ name, game: 'pong', level: 'easy', result: 'win' }), name);
    assert.equal(p.recordsFor(name).pong.easy.wins, 1, name);
  }
  assert.equal(({}).name, undefined, 'nothing leaked onto every object');
  assert.equal(new Trophies(null).forName('valueOf').count, 0);
});

test('Clean sweep: not in the games whose score is what you have left (lives, dice)', () => {
  const t = new Trophies(null);
  for (const game of ['micro-mayhem', 'liars-dice', 'tower-duel']) {
    const ids = t.check('P-' + game, { ...base, game, won: true, view: { scores: [3, 0], lives: [2, 0], startLives: 3 } }).map((x) => x.id);
    assert.ok(!ids.includes('clean-sweep'), game);
  }
});

test('the counting trophies keep their own tally (not just the match history\'s last 2000)', () => {
  const t = new Trophies(null);
  const stats = new Stats(null);
  for (let i = 0; i < 10; i++) {
    t.note('Ana', { game: 'g' + i, won: true, rival: 'Ben' });
    stats.matches.length = 0; // (the history forgot them)
  }
  const c = contextFor('Ana', { stats, practice: new Practice(null), trophies: t });
  assert.equal(c.played.size, 10);
  assert.equal(c.winsVsPeople, 10);
  assert.equal(c.bestRivalWins, 10);
});

test('a trophy card is news once: each batch a new number (a new game too), gone when a seat changes hands, and stale after a while', () => {
  const r = new Room('TRO3', io, { stats: new Stats(null), practice: new Practice(null), trophies: new Trophies(null) });
  r.hostSockets.add('tv');
  r.seatPlayer('Ana', null).player.connected = true;
  r.seatPlayer('Ben', null).player.connected = true;
  r.gameId = 'connect-four';
  r.recordResult({ phase: 'over', winner: 0, scores: [1, 0] });
  const first = r.publicState().trophies.n;
  r.startGame('pong');
  r.stopGame();
  r.gameId = 'connect-four';
  r.recordResult({ phase: 'over', winner: 1, scores: [0, 1] });
  assert.ok(r.publicState().trophies.n > first, 'a new number after a new game');
  assert.ok(r.publicState().trophies.ageMs >= 0);
  r.removePlayer(1);
  assert.equal(r.publicState().trophies, null, 'Ben left: not for whoever sits down next');
  r.dispose();
});
