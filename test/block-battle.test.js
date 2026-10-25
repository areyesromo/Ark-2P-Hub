import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlockBattle, WELL, KINDS, TIMING, GARBAGE, WIN_SCORE } from '../server/games/block-battle.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.42, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  let game = null;
  // As the room does: every update builds every view.
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (game) [game.hostView(), game.playerView(0), game.playerView(1)];
    update();
  };
  game = new BlockBattle(ctx, rng);
  game.start();
  return { ctx, game };
}

const play = (ctx) => ctx.advance(TIMING.countdownMs + 20);
const cells = (game, slot) => game.cellsOf(game.wells[slot].piece);
/** A row of the well, filled but for the given columns. */
const rowBut = (...gaps) => [...Array(WELL.w)].map((_, x) => (gaps.includes(x) ? '.' : 'g')).join('');

test('both players get the same pieces in the same order, a full set of seven at a time', () => {
  const { ctx, game } = setup();
  play(ctx);
  const seq = (slot, n) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(game.wells[slot].piece.kind);
      game.onInput(slot, { type: 'drop' });
      game.wells[slot].rows = game.emptyRows(); // keep room
    }
    return out;
  };
  const a = seq(0, 14);
  const b = seq(1, 14);
  assert.deepEqual(a, b);
  assert.deepEqual([...a.slice(0, 7)].sort(), [...KINDS].sort());
  assert.deepEqual([...a.slice(7, 14)].sort(), [...KINDS].sort());
});

test('pieces fall by themselves; ◀ ▶ move one step and the walls stop them', () => {
  const { ctx, game } = setup();
  play(ctx);
  const y0 = Math.min(...cells(game, 0).map((c) => c[1]));
  ctx.advance(TIMING.fallMs + 30);
  assert.equal(Math.min(...cells(game, 0).map((c) => c[1])), y0 + 1);
  const x0 = Math.min(...cells(game, 0).map((c) => c[0]));
  game.onInput(0, { type: 'shift', dir: -1 });
  game.onInput(0, { type: 'shift', dir: 0 });
  assert.equal(Math.min(...cells(game, 0).map((c) => c[0])), x0 - 1);
  for (let i = 0; i < 12; i++) { game.onInput(0, { type: 'shift', dir: -1 }); game.onInput(0, { type: 'shift', dir: 0 }); }
  assert.equal(Math.min(...cells(game, 0).map((c) => c[0])), 0);
});

test('holding a direction repeats after a short delay, on the hub (same for phones and controllers)', () => {
  const { ctx, game } = setup();
  play(ctx);
  const x = () => Math.min(...cells(game, 0).map((c) => c[0]));
  const x0 = x();
  game.onInput(0, { type: 'shift', dir: 1 });
  assert.equal(x(), x0 + 1);
  ctx.advance(TIMING.repeatDelayMs - 20);
  assert.equal(x(), x0 + 1, 'not yet');
  ctx.advance(20 + TIMING.repeatMs + 5);
  assert.ok(x() >= x0 + 2, 'repeating');
  game.onInput(0, { type: 'shift', dir: 0 });
  const held = x();
  ctx.advance(300);
  assert.equal(x(), held);
});

test('a controller holds ◀ ▶ and soft drop together', () => {
  const { ctx, game } = setup();
  play(ctx);
  const at = () => [Math.min(...cells(game, 0).map((c) => c[0])), Math.min(...cells(game, 0).map((c) => c[1]))];
  const [x0, y0] = at();
  game.onInput(0, { type: 'hold', dir: -1, soft: true });
  ctx.advance(250);
  const [x1, y1] = at();
  assert.ok(x1 < x0 - 1 && y1 > y0 + 3, `${x0},${y0} → ${x1},${y1}`);
  game.onInput(0, { type: 'hold', dir: 0, soft: false });
  assert.deepEqual(game.held[0], { shift: 0, soft: false });
});

test('rotate turns the piece, nudging it off a wall if it must', () => {
  const { ctx, game } = setup();
  play(ctx);
  const before = JSON.stringify(cells(game, 0));
  game.onInput(0, { type: 'rotate', dir: 1 });
  const k = game.wells[0].piece.kind;
  if (k !== 'O') assert.notEqual(JSON.stringify(cells(game, 0)), before);
  for (let i = 0; i < 10; i++) { game.onInput(0, { type: 'shift', dir: 1 }); game.onInput(0, { type: 'shift', dir: 0 }); }
  game.onInput(0, { type: 'rotate', dir: -1 });
  for (const [cx] of cells(game, 0)) assert.ok(cx >= 0 && cx < WELL.w);
});

test('soft drop falls faster; hard drop lands it at once and the next piece comes', () => {
  const { ctx, game } = setup();
  play(ctx);
  const y = () => Math.min(...cells(game, 0).map((c) => c[1]));
  const y0 = y();
  game.onInput(0, { type: 'soft', on: true });
  ctx.advance(300);
  assert.ok(y() >= y0 + 4, String(y() - y0));
  game.onInput(0, { type: 'soft', on: false });
  const kind = game.wells[0].piece.kind;
  game.onInput(0, { type: 'drop' });
  assert.ok(game.wells[0].rows.slice(-2).some((r) => r !== '.'.repeat(WELL.w)), 'landed at the bottom');
  assert.notEqual(game.wells[0].piece, null);
  assert.equal(game.wells[0].used, 2);
  assert.ok(kind);
});

test('a resting piece locks after a moment', () => {
  const { ctx, game } = setup();
  play(ctx);
  game.onInput(0, { type: 'soft', on: true });
  ctx.advance(3000);
  assert.ok(game.wells[0].used >= 2, 'locked and moved on');
});

/** Fills the bottom rows of slot's well but for column `gap`, and lines an I piece up over the gap. */
function lineUp(game, slot, rows, gap) {
  const w = game.wells[slot];
  w.rows = game.emptyRows();
  for (let i = 0; i < rows; i++) w.rows[WELL.h - 1 - i] = rowBut(gap);
  w.piece = { kind: 'I', x: gap - 1, y: 0, cells: [[1, 0], [1, 1], [1, 2], [1, 3]] }; // standing up
}

test('clearing lines sends junk rows to your rival (2 → 1, 3 → 2, 4 → 4), landing with their next piece', () => {
  for (const [lines, sent] of [[1, 0], [2, 1], [3, 2], [4, 4]]) {
    const { ctx, game } = setup();
    play(ctx);
    lineUp(game, 0, lines, 4);
    game.onInput(0, { type: 'drop' });
    assert.equal(game.wells[0].lines, lines);
    assert.equal(GARBAGE[lines] || 0, sent);
    assert.equal(game.wells[1].pending, sent, `${lines} lines`);
    game.onInput(1, { type: 'drop' });
    const junk = game.wells[1].rows.filter((r) => r.includes('g'));
    assert.equal(junk.length, sent);
    for (const r of junk) assert.equal([...r].filter((c) => c === '.').length, 1, 'one gap a row');
  }
});

test('your clears cancel junk on its way to you first', () => {
  const { ctx, game } = setup();
  play(ctx);
  game.wells[0].pending = 3;
  lineUp(game, 0, 4, 2);
  game.onInput(0, { type: 'drop' });
  assert.equal(game.wells[0].pending, 0);
  assert.equal(game.wells[1].pending, 1);
});

test('fill up to the top and the round goes to your rival; first to the setting wins', () => {
  const { ctx, game } = setup(() => 0.42, { wins: 2 });
  for (let round = 0; round < 2; round++) {
    play(ctx);
    game.wells[1].rows = game.emptyRows().map((r, y) => (y < 2 ? r : rowBut(y % WELL.w)));
    game.onInput(1, { type: 'drop' });
    if (round === 0) {
      assert.equal(game.phase, 'roundEnd');
      assert.deepEqual(game.scores, [1, 0]);
      ctx.advance(TIMING.roundEndMs + 20);
      assert.equal(game.phase, 'countdown');
      assert.equal(game.wells[1].rows.join('').includes('g'), false, 'a clean well for the new round');
    }
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 0);
  assert.deepEqual(game.hostView().scores, [2, 0]);
  const updates = ctx.updates;
  ctx.advance(3000);
  assert.equal(ctx.updates, updates);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(1, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
});

test('both topping out at the same moment is a drawn round', () => {
  const { ctx, game } = setup();
  play(ctx);
  for (const w of game.wells) w.rows = game.emptyRows().map((r, y) => (y < 1 ? r : rowBut(y % WELL.w)));
  ctx.advance(TIMING.fallMs * 3 + TIMING.lockMs + 100);
  assert.equal(game.phase, 'roundEnd');
  assert.deepEqual(game.scores, [0, 0]);
  assert.equal(game.hostView().result.draw, true);
});

test('pieces fall faster as the round goes on', () => {
  const { ctx, game } = setup();
  play(ctx);
  const start = game.fallInterval();
  ctx.advance(TIMING.speedUpMs * 3);
  assert.ok(game.fallInterval() < start);
});

test('bad input is ignored; the default is first to ' + WIN_SCORE, () => {
  const { ctx, game } = setup();
  assert.equal(game.winScore, WIN_SCORE);
  play(ctx);
  const before = JSON.stringify(cells(game, 0));
  for (const bad of [{ type: 'shift', dir: 2 }, { type: 'shift', dir: '1' }, { type: 'rotate', dir: 0 }, { type: 'soft', on: 'yes' }, { type: 'warp' }]) game.onInput(0, bad);
  game.onInput(2, { type: 'drop' });
  assert.equal(JSON.stringify(cells(game, 0)), before);
  assert.equal(game.held[0].shift, 0);
  game.onInput(0, { type: 'hold', dir: 1, soft: 'no' });
  assert.equal(game.held[0].shift, 0);
});

test('the phone view has the next piece and incoming junk, not the wells', () => {
  const { ctx, game } = setup();
  play(ctx);
  game.wells[1].pending = 2;
  const v = game.playerView(1);
  assert.ok(KINDS.includes(v.next));
  assert.equal(v.pending, 2);
  assert.equal(v.wells, undefined);
});
