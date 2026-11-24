import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthDays, shiftMonth, weekOffset, streaks, dayNumber } from '../server/solo/calendar.js';
import { Stats } from '../server/solo/stats.js';

test('the days of a month, leap years and December included', () => {
  assert.equal(monthDays('2026-10').length, 31);
  assert.equal(monthDays('2026-02').length, 28);
  assert.equal(monthDays('2028-02').length, 29);
  assert.equal(monthDays('2026-12').at(-1), '2026-12-31');
  assert.equal(monthDays('2026-10')[0], '2026-10-01');
  for (const bad of ['2026-13', '2026-00', 'x', '', undefined, '2026-1']) assert.equal(monthDays(bad), null, String(bad));
});

test('months shift across the year, and the week starts on Monday', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-10', -12), '2025-10');
  assert.equal(weekOffset('2026-10'), 3, '1 October 2026 is a Thursday');
  assert.equal(weekOffset('2026-06'), 0, '1 June 2026 is a Monday');
});

test('streaks: gaps, month boundaries, and a today that is not played yet', () => {
  const days = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];
  assert.deepEqual(streaks(days, '2026-10-06'), { longest: 4, current: 2 });
  assert.deepEqual(streaks(days, '2026-10-07'), { longest: 4, current: 2 }, 'yesterday still counts while today is on');
  assert.deepEqual(streaks(days, '2026-10-08'), { longest: 4, current: 0 }, 'a whole day missed ends it');
  assert.deepEqual(streaks([], '2026-10-08'), { longest: 0, current: 0 });
  assert.deepEqual(streaks(['2026-10-08'], '2026-10-08'), { longest: 1, current: 1 });
  assert.equal(dayNumber('2026-10-01') - dayNumber('2026-09-30'), 1);
});

test('a player\'s daily days come from the entries and the finished runs, whichever is there', () => {
  const s = new Stats(null);
  s.setDaily('daily', '2026-10-20', 'Ana', { game: 'snake', score: null }); // started, quit
  s.setDaily('daily', '2026-10-21', 'Ana', { game: 'gems', score: 900 });
  s.setDaily('daily', '2026-10-21', 'Ben', { game: 'gems', score: 100 });
  s.runs.push({ at: 1, game: 'blocks', gameName: 'Blocks', player: 'ana', score: 500, variant: 'Daily 2026-09-01', better: 'higher', unit: 'pts' });
  s.runs.push({ at: 2, game: 'blocks', gameName: 'Blocks', player: 'Ana', score: 700, variant: '', better: 'higher', unit: 'pts' }); // not a daily
  const days = s.dailyDaysOf('ANA');
  assert.deepEqual([...days.keys()].sort(), ['2026-09-01', '2026-10-20', '2026-10-21']);
  assert.deepEqual(days.get('2026-10-20'), { game: 'snake', score: null });
  assert.deepEqual(days.get('2026-09-01'), { game: 'blocks', score: 500 });
  assert.equal(days.get('2026-10-21').score, 900);
});
