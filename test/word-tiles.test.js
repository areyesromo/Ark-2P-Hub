import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WordTiles, TIMING, SCORELESS_END } from '../server/games/word-tiles.js';
import { N, CENTRE, BONUS, POINTS, COUNTS, checkPlay, findPlays, isWord } from '../server/games/word-tiles-rules.js';
import { wordTilesBot } from '../server/games/word-tiles-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new WordTiles(ctx, seeded(5));
  g.start();
  return { ctx, g };
}

const row = (r, c0, word) => word.split('').map((letter, k) => ({ cell: r * N + c0 + k, letter }));

test('the tiles, the dictionary, and the board\'s bonus squares', () => {
  assert.equal(Object.values(COUNTS).reduce((a, b) => a + b, 0), 84);
  assert.ok(isWord('at') && isWord('qi') && isWord('stone'));
  assert.ok(!isWord('qzx'));
  assert.equal(BONUS[CENTRE], 'W2');
  assert.equal(BONUS[0], 'W3');
  assert.equal(BONUS[N * N - 1], 'W3');
});

test('checking and scoring a play', () => {
  const board = new Array(N * N).fill(null);
  assert.match(checkPlay(board, row(0, 0, 'cat')).error, /middle/);
  const first = checkPlay(board, row(5, 3, 'cat'));
  assert.equal(first.score, (POINTS.c + POINTS.a + POINTS.t) * 2, 'the middle square doubles the word');
  for (const t of row(5, 3, 'cat')) board[t.cell] = t.letter;
  assert.match(checkPlay(board, row(7, 3, 'dog')).error, /Join/);
  assert.match(checkPlay(board, [{ cell: 4 * N + 3, letter: 'q' }, { cell: 6 * N + 3, letter: 'z' }]).error, /Not a word|gaps/);
  // "cats": one S on the end.
  const s = checkPlay(board, [{ cell: 5 * N + 6, letter: 's' }]);
  assert.deepEqual(s.words.map((w) => w.word), ['cats']);
  assert.match(checkPlay(board, [{ cell: 5 * N + 7, letter: 's' }]).error, /Join|gaps|two letters/);
  assert.match(checkPlay(board, row(4, 3, 'xq')).error, /Not a word/);
});

test('a turn: a play scores and refills the rack; a bad play is turned down (to you alone)', () => {
  const { ctx, g } = setup();
  const s = g.turn;
  g.racks[s] = ['c', 'a', 't', 'e', 'r', 's', 'o'];
  g.onInput(s, { type: 'play', tiles: row(5, 4, 'zoo') }); // not on the rack
  assert.equal(g.n, 0);
  g.onInput(s, { type: 'play', tiles: row(0, 0, 'cat') });
  assert.match(g.playerView(s).rejected.reason, /middle/);
  assert.equal(g.playerView(1 - s).rejected, null);
  g.onInput(s, { type: 'play', tiles: row(5, 4, 'cat') });
  assert.ok(g.points[s] > 0);
  assert.equal(g.racks[s].length, 7);
  assert.equal(g.playerView(1 - s).rack.length, 7);
  assert.equal(g.hostView().rack, null);
  ctx.advance(TIMING.playedMs);
  ctx.advance(TIMING.turnMs);
  assert.equal(g.lastPlay.kind, 'pass');
});

test('six scoreless turns end it; the computer finds plays; Easy beats a player who leaves it to the clock', () => {
  const { ctx, g } = setup();
  for (let k = 0; k < SCORELESS_END; k++) {
    g.onInput(g.turn, { type: 'pass' });
    if (g.phase === 'played') ctx.advance(TIMING.playedMs);
  }
  assert.ok(g.phase === 'over' || g.phase === 'roundEnd');
  const board = new Array(N * N).fill(null);
  assert.ok(findPlays(board, ['s', 't', 'o', 'n', 'e', 'a', 'r'], ['stone', 'tone', 'aster']).length > 0);
  const v = { phase: 'play', turn: 0, you: 0, rack: ['s', 't', 'o', 'n', 'e', 'a', 'r'], board, bag: 60, round: 1, n: 0 };
  const m = wordTilesBot(v, 'normal', seeded(1));
  assert.equal(m.type, 'play');
  assert.ok(!checkPlay(board, m.tiles).error);
  for (const seed of [1, 2]) {
    const cpu = seed % 2;
    assert.equal(play('word-tiles', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 6 * 3600 * 1000 }).view.winner, cpu);
  }
});
