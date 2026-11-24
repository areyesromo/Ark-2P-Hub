import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileFor } from '../server/solo/profile.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 24, 15); // 24 October 2026
const names = { snake: 'Snake', slide: 'Sliding Puzzle' };
const run = (game, score, backDays, extra = {}) => ({ at: NOW - backDays * DAY, game, score, variant: '', better: 'higher', unit: 'pts', ...extra });

test('counts, favourite games and the board played most', () => {
  const runs = [run('snake', 5, 5), run('snake', 9, 4), run('snake', 7, 3, { variant: 'Fast' }), run('slide', 90, 2, { better: 'lower', unit: 'time', variant: '4 × 4' })];
  const p = profileFor({ runs, names, now: NOW });
  assert.equal(p.runs, 4);
  assert.equal(p.games, 2);
  assert.deepEqual(p.favourites.map((f) => [f.gameName, f.plays]), [['Snake', 3], ['Sliding Puzzle', 1]]);
  assert.equal(p.favourites[0].board.best, 9, 'Snake\'s best on its most played board');
  assert.equal(p.favourites[1].board.best, 90);
});

test('records: a first run is a start, a better one is a record, and lower-is-better works', () => {
  const runs = [run('snake', 5, 6), run('snake', 3, 5), run('snake', 9, 4), run('slide', 100, 3, { better: 'lower', variant: 'a' }), run('slide', 80, 2, { better: 'lower', variant: 'a' }), run('slide', 90, 1, { better: 'lower', variant: 'a' })];
  const p = profileFor({ runs, names, now: NOW });
  assert.equal(p.recordCount, 2);
  assert.deepEqual(p.records.map((r) => [r.game, r.score, r.was]), [['slide', 80, 100], ['snake', 9, 5]], 'newest first');
});

test('daily challenges count as plays but never as bests or records', () => {
  const runs = [run('snake', 5, 3, { variant: 'Daily 2026-10-21' }), run('snake', 8, 2, { variant: 'Daily 2026-10-22' })];
  const p = profileFor({ runs, names, now: NOW });
  assert.equal(p.runs, 2);
  assert.equal(p.recordCount, 0);
  assert.equal(p.favourites[0].board, null);
});

test('the activity chart is the last days in order, counted by UTC day', () => {
  const runs = [run('snake', 1, 0), run('snake', 2, 0), run('snake', 3, 2), run('snake', 4, 40)];
  const p = profileFor({ runs, names, now: NOW, days: 7 });
  assert.equal(p.activity.length, 7);
  assert.equal(p.activity.at(-1).day, '2026-10-24');
  assert.deepEqual(p.activity.map((d) => d.runs), [0, 0, 0, 0, 1, 0, 2]);
  assert.equal(p.activeDays, 3, 'the old day still counts as a day played');
});

test('nobody yet: all zero', () => {
  const p = profileFor({ runs: [], names, now: NOW });
  assert.deepEqual([p.runs, p.games, p.activeDays, p.recordCount, p.favourites.length], [0, 0, 0, 0, 0]);
});
