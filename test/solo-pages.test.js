// The solo pages' data (collection, calendar, my stats), over HTTP.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { dayOf } from '../server/solo/daily.js';
import { shiftMonth } from '../server/solo/calendar.js';

let server;
let url;
let dataDir;
const today = dayOf(Date.now());
const day = (back) => dayOf(Date.now() - back * 86400000);

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark1p-pages-'));
  // Ana: the daily played the last three days (the oldest quit, no score), and 100 m in Helicopter Cave.
  fs.writeFileSync(path.join(dataDir, 'solo-stats.json'), JSON.stringify({
    runs: [[10, 3], [14, 2], [8, 2]].map(([score, back]) => ({ at: Date.now() - back * 86400000, game: 'snake', player: 'Ana', score, better: 'higher', unit: 'pts', variant: 'Normal' })).concat([{ at: Date.now(), game: 'snake', player: 'Bo', score: 99, better: 'higher', unit: 'pts', variant: 'Normal' }]),
    dailies: {
      [`daily|${day(0)}|ana`]: { game: 'snake', score: 12 },
      [`daily|${day(1)}|ana`]: { game: 'gems', score: 900 },
      [`daily|${day(2)}|ana`]: { game: 'blocks-1p', score: null },
    },
    achievements: { ana: { 'cave-100': 1 } },
  }));
  server = createApp({ port: 0, publicUrl: 'http://tv.local:3000', dataDir, https: false });
  url = `http://127.0.0.1:${(await server.listen()).port}`;
});

after(async () => {
  await server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const get = async (p) => (await fetch(url + p)).json();

test('the collection says what a player has opened and what opens the rest', async () => {
  const d = await get('/api/solo/collection?name=Ana');
  const map = d.groups.find((g) => g.game === 'cave').rows.find((r) => r.key === 'map');
  assert.deepEqual(map.items.map((i) => i.open), [true, true, false, false]);
  assert.match(map.items[2].how, /Old Mine/);
  assert.ok(d.got >= 1 && d.total > d.got);
  assert.equal(d.name, 'Ana');
  const nobody = await get('/api/solo/collection');
  assert.equal(nobody.got, nobody.groups.reduce((n, g) => n + g.rows.length, 0), 'just the first of each row');
});

test('the calendar marks played, started and missed days, with streaks, in UTC', async () => {
  const d = await get('/api/solo/calendar?name=ana');
  assert.equal(d.today, today);
  assert.equal(d.month, today.slice(0, 7));
  const by = Object.fromEntries(d.days.map((x) => [x.day, x]));
  assert.equal(by[today].status, 'done');
  assert.equal(by[today].today, true, 'today stays marked once it is played');
  assert.equal(by[day(1)].today, false);
  assert.equal(by[today].gameName, 'Snake');
  assert.equal(by[day(2)].status, 'started');
  assert.equal(d.total, 3);
  assert.equal(d.current, 3);
  assert.equal(d.longest, 3);
  assert.equal(d.next, null, 'nothing beyond this month');
  assert.equal(d.prev, shiftMonth(d.month, -1));
  assert.ok(d.offset >= 0 && d.offset <= 6);
  // Days that are still to come show what game they'll be.
  assert.ok(d.days.filter((x) => x.day > today).every((x) => x.status === 'future' && x.gameName));
});

test('the calendar copes with a bad month, a far month, and a player who hasn\'t played', async () => {
  assert.equal((await get('/api/solo/calendar?name=ana&month=nonsense')).month, today.slice(0, 7));
  assert.equal((await get('/api/solo/calendar?name=ana&month=2999-01')).month, today.slice(0, 7), 'no future months');
  const old = await get('/api/solo/calendar?name=ana&month=' + shiftMonth(today.slice(0, 7), -3));
  assert.ok(old.days.every((x) => x.status === 'missed' || x.status === 'done' || x.status === 'started'));
  assert.ok(old.days.filter((x) => x.status === 'missed').every((x) => x.gameName === null), 'a missed day\'s game isn\'t known any more');
  const none = await get('/api/solo/calendar?name=nobody');
  assert.deepEqual([none.total, none.current, none.longest], [0, 0, 0]);
});

test('a player\'s stats: their runs, favourites, records and the daily streak, and nothing for a stranger', async () => {
  const d = await get('/api/solo/me?name=Ana');
  assert.equal(d.runs, 3, 'only her own');
  assert.equal(d.games, 1);
  assert.equal(d.recordCount, 1);
  assert.equal(d.favourites[0].gameName, 'Snake');
  assert.equal(d.favourites[0].board.best, 14);
  assert.equal(d.activity.length, 14);
  assert.equal(d.achievements.got, 1);
  assert.equal(d.daily.current, 3, 'same days as the calendar counts, a go that was started included');
  assert.equal(d.trimmed, false);
  const nobody = await get('/api/solo/me?name=Zed');
  assert.equal(nobody.runs, 0);
  assert.equal((await get('/api/solo/me')).runs, 0, 'no name, no stats');
});

test('the solo players and achievements, for the pickers and the trophies page', async () => {
  const p = await get('/api/solo/players');
  assert.deepEqual(p.players.map((x) => x.name).sort(), ['Ana', 'Bo']);
  const a = await get('/api/solo/achievements?name=Ana');
  assert.equal(a.got, 1);
  assert.ok(a.list.find((x) => x.id === 'cave-100').at);
  assert.equal(a.list.find((x) => x.id === 'cave-100').gameName, 'Helicopter Cave');
  assert.equal((await get('/api/solo/achievements')).got, 0);
});
