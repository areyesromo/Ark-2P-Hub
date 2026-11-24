import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Solitaire } from '../server/solo/games/solitaire.js';

function game(draw = 1, seed = 3) {
  const ctx = fakeCtx('Ana', { draw });
  const g = new Solitaire(ctx, seeded(seed));
  g.start();
  return { ctx, g };
}
const card = (s, r, up = true) => ({ s, r, up });

test('deals 28 cards to the columns, the last of each face up, and keeps the rest secret', () => {
  const { g } = game();
  assert.deepEqual(g.tab.map((c) => c.length), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(g.stock.length, 24);
  const v = g.hostView();
  assert.ok(v.tab.every((col) => col.slice(0, -1).every((c) => c === '#') && col[col.length - 1] !== '#'));
  assert.ok(!JSON.stringify(v).includes('"stock":['), 'the stock is only a count');
});

test('drawing turns one (or three) over; an empty stock turns the waste back over', () => {
  const { g } = game(3);
  g.onInput({ type: 'draw' });
  assert.equal(g.waste.length, 3);
  for (let i = 0; i < 7; i++) g.onInput({ type: 'draw' });
  assert.equal(g.stock.length, 0);
  g.onInput({ type: 'draw' });
  assert.equal(g.stock.length, 24);
  assert.equal(g.passes, 1);
});

test('columns build down in alternating colours; only kings go into empty columns', () => {
  const { g } = game();
  g.tab = [[card('s', 10)], [card('h', 9)], [card('c', 9)], [], [card('d', 13)], [], []];
  g.onInput({ type: 'move', from: 't2', to: 't0' }); // black on black: no
  assert.equal(g.tab[0].length, 1);
  g.onInput({ type: 'move', from: 't1', to: 't0' });
  assert.equal(g.tab[0].length, 2);
  g.onInput({ type: 'move', from: 't0', index: 0, to: 't3' }); // a 10 can't go to an empty column
  assert.equal(g.tab[3].length, 0);
  g.onInput({ type: 'move', from: 't4', to: 't3' });
  assert.equal(g.tab[3].length, 1);
});

test('a run of face-up cards moves together and turns the card under it over', () => {
  const { g } = game();
  g.tab = [[card('c', 2, false), card('s', 10), card('h', 9)], [card('d', 11)], [], [], [], [], []];
  g.onInput({ type: 'move', from: 't0', index: 1, to: 't1' });
  assert.deepEqual(g.tab[1].map((c) => c.r), [11, 10, 9]);
  assert.equal(g.tab[0][0].up, true);
  g.onInput({ type: 'move', from: 't1', index: 0, to: 't0' }); // can't pick up from a face-down… or onto a black 2
  assert.equal(g.tab[1].length, 3);
});

test('a tap sends a card home first, else to a column; undo takes it back', () => {
  const { g } = game();
  g.tab = [[card('h', 1)], [card('s', 3)], [card('h', 2)], [], [], [], []];
  g.onInput({ type: 'smart', from: 't0' });
  assert.equal(g.found.flat().length, 1);
  g.onInput({ type: 'smart', from: 't2' });
  assert.equal(g.found.flat().length, 2);
  g.onInput({ type: 'undo' });
  assert.equal(g.found.flat().length, 1);
  assert.equal(g.tab[2].length, 1);
  const before = g.nope;
  g.onInput({ type: 'smart', from: 't3' });
  assert.equal(g.nope, before + 1, 'nothing to move: the screen hears about it');
});

test('finishing sends everything home and the time is the score', () => {
  const { ctx, g } = game();
  ctx.advance(90000);
  // Everything face up, nothing in the stock: lay all 52 out in four columns, kings at the bottom.
  g.stock = [];
  g.waste = [];
  g.found = [[], [], [], []];
  const col = (s1, s2) => {
    const out = [];
    for (let r = 13; r >= 1; r--) out.push(card(r % 2 ? s1 : s2, r));
    return out;
  };
  g.tab = [col('s', 'h'), col('h', 's'), col('c', 'd'), col('d', 'c'), [], [], []];
  assert.equal(g.hostView().canFinish, true);
  g.onInput({ type: 'finish' });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.equal(v.score, 90000);
  assert.equal(ctx.pendingTimers(), 0);
});

test('giving up ends it without a score; bad moves are ignored', () => {
  const { g } = game();
  for (const bad of [{ type: 'move', from: 'x', to: 't0' }, { type: 'move', from: 't0', to: 'stock' }, { type: 'smart', from: 5 }]) g.onInput(bad);
  assert.equal(g.moves, 0);
  g.onInput({ type: 'give-up' });
  assert.equal(g.hostView().score, null);
  assert.equal(g.hostView().variant, 'Draw 1');
});
