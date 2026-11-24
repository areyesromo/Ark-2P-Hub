import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { FreeCell } from '../server/solo/games/freecell.js';

function game(seed = 3) {
  const ctx = fakeCtx('Ana');
  const g = new FreeCell(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const C = (s, r) => ({ s, r });

test('the deal: 52 different cards in eight columns of 7 and 6', () => {
  const { g } = game();
  assert.deepEqual(g.tab.map((c) => c.length), [7, 7, 7, 7, 6, 6, 6, 6]);
  assert.equal(new Set(g.tab.flat().map((c) => c.s + c.r)).size, 52);
});

test('cards go down in alternating colours; a free cell holds one card; aces go home', () => {
  const { g } = game();
  g.tab = [[C('s', 9)], [C('h', 8)], [C('d', 8)], [C('h', 1)], [], [], [], []];
  assert.equal(g.move('t1', undefined, 't0'), true, 'red 8 on black 9');
  assert.equal(g.move('t2', undefined, 't0'), false, 'not on another 8');
  assert.equal(g.move('t2', undefined, 'c0'), true);
  assert.equal(g.move('t3', undefined, 'c0'), false, 'the cell is taken');
  assert.equal(g.move('t3', undefined, 'f2'), true);
  assert.equal(g.move('c0', undefined, 'f2'), false, 'the 8 of diamonds is not next');
  g.undo();
  assert.deepEqual(g.tab[3], [C('h', 1)]);
});

test('a run moves together if there is room to do it a card at a time', () => {
  const { g } = game();
  g.tab = [[C('s', 10), C('h', 9), C('c', 8), C('d', 7)], [C('h', 11)], [C('s', 5)], [C('s', 6)], [C('s', 2)], [C('s', 3)], [C('s', 4)], [C('s', 13)]];
  g.cells = [C('c', 1), C('c', 2), C('c', 3), null]; // one free cell, no empty column: 2 cards at most
  assert.equal(g.maxRun('t1'), 2);
  assert.equal(g.move('t0', 0, 't1'), false, 'four cards is too many');
  g.cells[1] = null; g.cells[2] = null; // three free cells: 4 cards
  assert.equal(g.move('t0', 0, 't1'), true);
  assert.equal(g.tab[1].length, 5);
  assert.equal(g.taking('t1', 0) === null, false);
  g.tab[1].push(C('s', 2));
  assert.equal(g.taking('t1', 3), null, 'not a run (a 2 on a 7)');
});

test('a tap sends a card home first, then onto a column, then to a free cell', () => {
  const { g } = game();
  // The ace waits in a free cell; no column is empty (or the 5 would go there before a cell).
  g.tab = [[C('c', 7)], [C('h', 8), C('c', 5)], [C('s', 9)], [C('d', 13)], [C('d', 12)], [C('d', 11)], [C('d', 10)], [C('d', 9)]];
  g.cells = [C('s', 1), null, null, null];
  assert.equal(g.smart('c0'), true);
  assert.equal(g.found[0].length + g.found[1].length + g.found[2].length + g.found[3].length, 1);
  assert.equal(g.smart('t1', 0), false, 'the 8 and 5 are not a run');
  assert.equal(g.smart('t1'), true, 'the 5 has nowhere but a free cell');
  assert.ok(g.cells.some((c) => c && c.r === 5));
  assert.equal(g.smart('t1'), true, 'the red 8 goes on the black 9');
  assert.equal(g.tab[2].length, 2);
});

test('with every column in order the rest goes home, and that wins', () => {
  const { ctx, g } = game();
  ctx.advance(90000);
  // Every card in a single ordered column per suit pair... simplest: kings at the bottom down to aces.
  const col = (s1, s2) => {
    const out = [];
    for (let r = 13; r >= 1; r--) out.push(C(r % 2 ? s1 : s2, r));
    return out;
  };
  g.tab = [col('s', 'h'), col('h', 's'), col('c', 'd'), col('d', 'c'), [], [], [], []];
  assert.equal(g.canFinish, true);
  g.onInput({ type: 'finish' });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.equal(v.score, 90000);
  assert.equal(ctx.pendingTimers(), 0);
});

test('giving up doesn\'t count; bad input is ignored and taps that can\'t move shake', () => {
  const { g } = game();
  for (const input of [{ type: 'move', from: 'x9', to: 't0' }, { type: 'smart', from: 't0', index: 'a' }, { type: 'move', from: 't0', to: 'toString' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.moves, 0);
  g.tab[0] = [C('s', 13)];
  g.tab.forEach((col, n) => { if (n) col.splice(0, col.length, C('h', 13)); });
  g.cells = [C('c', 13), C('d', 13), C('c', 12), C('d', 12)];
  g.onInput({ type: 'smart', from: 't0' });
  assert.equal(g.nope, 1);
  g.onInput({ type: 'give-up' });
  assert.equal(g.hostView().phase, 'over');
  assert.equal(g.hostView().score, null);
});
