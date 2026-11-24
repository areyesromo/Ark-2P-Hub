import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Stats } from '../server/solo/stats.js';

const run = (player, score, extra = {}) => ({ game: 'snake', gameName: 'Snake', player, score, variant: '', better: 'higher', unit: 'pts', ...extra });

test('records runs, tells you about a new best and your rank', () => {
  const s = new Stats(null);
  assert.deepEqual(s.record(run('Ana', 10)), { score: 10, best: null, newBest: true, rank: 1 });
  assert.deepEqual(s.record(run('ana ', 7)), { score: 7, best: 10, newBest: false, rank: 2 });
  assert.deepEqual(s.record(run('Ben', 12)), { score: 12, best: null, newBest: true, rank: 1 });
  assert.equal(s.bestFor('snake', '', 'ANA'), 10);
});

test('lower is better for times; variants keep their own bests', () => {
  const s = new Stats(null);
  const mine = (score, variant) => run('Ana', score, { game: 'minesweeper', gameName: 'Minesweeper', variant, better: 'lower', unit: 'time' });
  s.record(mine(60000, 'Easy'));
  assert.equal(s.record(mine(50000, 'Easy')).newBest, true);
  assert.equal(s.record(mine(90000, 'Hard')).newBest, true);
  assert.equal(s.bestFor('minesweeper', 'Easy', 'Ana', 'lower'), 50000);
  // The lobby shows the variant played last.
  assert.deepEqual(s.bestsOf('Ana').minesweeper, { score: 90000, variant: 'Hard', unit: 'time', better: 'lower' });
});

test('the leaderboard has one row per player, best first', () => {
  const s = new Stats(null);
  s.record(run('Ana', 10));
  s.record(run('Ana', 30));
  s.record(run('Ben', 20));
  const lb = s.leaderboard();
  assert.equal(lb.total, 3);
  assert.deepEqual(lb.games[0].top.map((r) => [r.name, r.score]), [['Ana', 30], ['Ben', 20]]);
  assert.equal(lb.recent[0].player, 'Ben');
  assert.deepEqual(s.knownNames(), ['Ben', 'Ana']);
});

test('survives a restart, and reset clears it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark1p-stats-'));
  try {
    new Stats(dir).record(run('Ana', 5));
    const again = new Stats(dir);
    assert.equal(again.bestFor('snake', '', 'Ana'), 5);
    again.reset();
    assert.equal(new Stats(dir).runs.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
