import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Lines, N, DROP, linesThrough, reachable, pointsFor } from '../server/solo/games/lines.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

function game(seed = 3) {
  const g = new Lines(fakeCtx(), seeded(seed));
  g.start();
  return g;
}
const empty = () => Array(N * N).fill(null);
const at = (x, y) => y * N + x;

test('five in a row clears, in all four directions, and four does not', () => {
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const b = empty();
    const cells = [0, 1, 2, 3, 4].map((k) => at(2 + dx * k, 2 + dy * k + (dy < 0 ? 4 : 0)));
    cells.forEach((i) => (b[i] = 1));
    assert.deepEqual([...linesThrough(b, [cells[2]])].sort(), [...cells].sort(), `${dx},${dy}`);
    b[cells[4]] = 2;
    assert.equal(linesThrough(b, [cells[2]]).size, 0);
  }
});

test('a cross of two lines clears every ball in both; longer lines score more', () => {
  const b = empty();
  for (let k = 0; k < 5; k++) { b[at(k, 4)] = 3; if (k !== 2) b[at(2, 2 + k)] = 3; }
  b[at(2, 4)] = 3;
  assert.equal(linesThrough(b, [at(2, 4)]).size, 9);
  assert.ok(pointsFor(6) > pointsFor(5));
});

test('balls walk only over empty squares, not through other balls', () => {
  const b = empty();
  b[0] = 1;
  assert.equal(reachable(b, 0, at(8, 8)), true);
  b[1] = 2;
  b[N] = 2;
  assert.equal(reachable(b, 0, at(8, 8)), false, 'walled in');
  assert.equal(reachable(b, at(5, 5), 1), false, 'a full square');
});

test('the colours shown ahead are the ones that drop, and balls arrive each turn', () => {
  const g = game();
  assert.equal(g.next.length, DROP);
  const before = g.board.filter((c) => c !== null).length;
  const shown = g.next.slice();
  const from = g.board.findIndex((c) => c !== null);
  const to = g.board.findIndex((c, i) => c === null && reachable(g.board, from, i) && !linesThrough(Object.assign(g.board.slice(), { [i]: g.board[from], [from]: null }), [i]).size);
  const colourBefore = g.board.map((c) => c);
  g.onInput({ type: 'move', from, to });
  const arrived = g.board.map((c, i) => (c !== null && colourBefore[i] === null && i !== to ? c : null)).filter((c) => c !== null);
  assert.ok(arrived.length <= DROP && arrived.length >= 1);
  const rest = shown.slice();
  for (const c of arrived) { const k = rest.indexOf(c); assert.ok(k >= 0, 'an unannounced colour'); rest.splice(k, 1); }
  assert.ok(g.board.filter((c) => c !== null).length >= before);
});

test('a move that clears a line gets no new balls; the board filling ends the run', () => {
  const g = game();
  g.board = empty();
  [0, 1, 2, 3].forEach((x) => (g.board[at(x, 0)] = 4));
  g.board[at(8, 0)] = 4;
  g.board[at(8, 4)] = 5; // a bystander to count
  g.onInput({ type: 'move', from: at(8, 0), to: at(4, 0) });
  assert.equal(g.board.filter((c) => c !== null).length, 1);
  assert.equal(g.score, pointsFor(5));
  // Fill all but one square with no line, leave one move that can't clear anything.
  g.board = empty().map((_, i) => (i % 2) + ((Math.floor(i / N) % 2) * 2) + 0);
  g.board[0] = null;
  g.board[1] = 6;
  g.next = [6, 6, 6];
  g.onInput({ type: 'move', from: 1, to: 0 });
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, g.score);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.score, 0);
});

test('bad input is ignored', () => {
  const g = game();
  const snap = JSON.stringify(g.board);
  const from = g.board.findIndex((c) => c !== null);
  for (const input of [{ type: 'move', from, to: from }, { type: 'move', from: -1, to: 3 }, { type: 'move', from: '1', to: 2 }, { type: 'move', from: 0.5, to: 2 }, { type: 'move', from: N * N, to: 0 }, { type: 'move' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(JSON.stringify(g.board), snap);
  assert.ok(getGame('lines'));
});
