// Minesweeper, the 1 player mode of Mine Duel (it was 1P's Minesweeper): server/games/mine-duel.js, soloMinesweeper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Minesweeper, SIZES, soloMinesweeper } from '../server/games/mine-duel.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(size = 'easy') {
  const ctx = fakeCtx('Ana', { size });
  const g = new Minesweeper(ctx, seeded(7));
  g.start();
  return { ctx, g };
}

test('no mines are laid, or shown, before the first open', () => {
  const { g } = game();
  assert.equal(g.mines, null);
  const v = g.hostView();
  assert.equal(v.board, '#'.repeat(81));
  assert.equal(v.variant, 'Easy');
  assert.equal(v.score, null);
});

test('the first open is always safe, and so are its neighbours', () => {
  for (let seed = 1; seed < 30; seed++) {
    const ctx = fakeCtx('Ana', { size: 'hard' });
    const g = new Minesweeper(ctx, seeded(seed));
    g.start();
    g.onInput({ type: 'open', cell: 100 });
    assert.equal(g.phase, 'play');
    assert.equal(g.mines.size, SIZES.hard.mines);
    for (const j of [100, ...g.neighbours(100)]) assert.ok(!g.mines.has(j));
    assert.equal(g.hostView().board[100], '0'); // so it opens an area
  }
});

test('mines stay hidden while playing; flags toggle', () => {
  const { g } = game();
  g.onInput({ type: 'open', cell: 40 });
  const mine = [...g.mines][0];
  g.onInput({ type: 'flag', cell: mine });
  assert.equal(g.playerView().board[mine], 'F');
  assert.ok(!g.hostView().board.includes('*'));
  g.onInput({ type: 'flag', cell: mine });
  assert.equal(g.playerView().board[mine], '#');
});

test('opening a mine ends the run, and a loss has no score', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'open', cell: 40 });
  const mine = [...g.mines][0];
  g.onInput({ type: 'open', cell: mine });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.board[mine], 'X');
  assert.ok(v.board.includes('*') || SIZES.easy.mines === 1);
  assert.equal(v.score, null);
  assert.equal(ctx.pendingTimers(), 0);
});

test('clearing every safe cell wins; the time is the score', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'open', cell: 40 });
  ctx.advance(12345);
  for (let i = 0; i < 81; i++) if (!g.mines.has(i)) g.onInput({ type: 'open', cell: i });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.equal(v.score, 12345);
  assert.equal(v.board.replace(/[0-8]/g, '').length, SIZES.easy.mines); // the rest are flagged mines
});

test('chording opens the neighbours of a satisfied number', () => {
  const { g } = game();
  g.onInput({ type: 'open', cell: 40 });
  // Find an open number with a covered neighbour, flag its mines, then open it again.
  const num = [...g.open].find((i) => g.count(i) > 0 && g.neighbours(i).some((j) => !g.open.has(j) && !g.mines.has(j)));
  if (num === undefined) return; // this seed opened it all: nothing to chord
  for (const j of g.neighbours(num)) if (g.mines.has(j)) g.flags.add(j);
  g.onInput({ type: 'open', cell: num });
  for (const j of g.neighbours(num)) if (!g.mines.has(j)) assert.ok(g.open.has(j));
});

test('bad cells are ignored', () => {
  const { g } = game();
  for (const cell of [-1, 81, 1.5, '3', null]) g.onInput({ type: 'open', cell });
  assert.equal(g.mines, null);
});

test('one game in both lobbies: Mine Duel and Minesweeper, under one id', () => {
  assert.equal(getGame('mine-duel').name, 'Mine Duel');
  assert.equal(soloGameOf('mine-duel').name, 'Minesweeper');
  const run = soloMinesweeper.create(fakeCtx('Ana', { size: 'hard' }));
  assert.equal(run.cfg.w, 30);
  run.start();
  assert.equal(run.hostView().solo, true, 'its screens are Minesweeper\'s');
  assert.equal(run.playerView().solo, true);
  assert.ok(!listGames().some((g) => g.id === 'minesweeper-1p'), 'Minesweeper 1P is gone');
});
