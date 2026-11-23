import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess, TIMING } from '../server/games/chess.js';
import { startPosition, fromFen, legalMoves, makeMove, san, square, insufficient, inCheck } from '../server/games/chess-rules.js';
import { bestMove, chessBot } from '../server/games/chess-bot.js';
import { fakeCtx } from './helpers.js';
import { play } from './helpers-bots.js';

const perft = (p, d) => (d ? legalMoves(p).reduce((n, m) => n + perft(makeMove(p, m), d - 1), 0) : 1);
const sq = (name) => 'abcdefgh'.indexOf(name[0]) + (Number(name[1]) - 1) * 8;
const find = (pos, from, to) => legalMoves(pos).find((m) => m.from === sq(from) && m.to === sq(to));

test('the rules: move counts match the known ones (start, and a busy middle game with every special move)', () => {
  assert.deepEqual([1, 2, 3].map((d) => perft(startPosition(), d)), [20, 400, 8902]);
  const kiwi = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
  assert.deepEqual([1, 2].map((d) => perft(kiwi, d)), [48, 2039]);
  const ending = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
  assert.deepEqual([1, 2, 3].map((d) => perft(ending, d)), [14, 191, 2812]);
});

test('castling, en passant and promotion; the moves written out', () => {
  const p = fromFen('r3k2r/8/8/3pP3/8/8/8/R3K2R w KQkq d6 0 1');
  assert.equal(san(p, find(p, 'e1', 'g1')), 'O-O');
  assert.equal(san(p, find(p, 'e1', 'c1')), 'O-O-O');
  const ep = find(p, 'e5', 'd6');
  assert.ok(ep.ep);
  assert.equal(makeMove(p, ep).board[sq('d5')], '', 'the pawn passed by is taken');
  const castled = makeMove(p, find(p, 'e1', 'g1'));
  assert.equal(castled.board[sq('f1')], 'R');
  assert.equal(castled.castle, 'kq');
  assert.ok(!find(fromFen('r3k2r/8/8/8/8/8/6p1/R3K2R w KQkq - 0 1'), 'e1', 'g1'), 'not through a square under attack');
  const black = fromFen('4k3/8/8/8/8/8/6p1/4K3 b - - 0 1');
  const promo = legalMoves(black).filter((m) => m.from === sq('g2') && m.to === sq('g1'));
  assert.deepEqual(promo.map((m) => m.promo).sort(), ['b', 'n', 'q', 'r']);
  assert.equal(san(startPosition(), find(startPosition(), 'g1', 'f3')), 'Nf3');
  assert.ok(insufficient(fromFen('8/8/4k3/8/8/2N5/8/4K3 w - - 0 1').board));
  assert.ok(!insufficient(fromFen('8/8/4k3/8/8/2R5/8/4K3 w - - 0 1').board));
});

function setup(settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Chess(ctx);
  game.start();
  return { ctx, game };
}
const move = (game, from, to, promo) => game.onInput(game.turnSlot, { type: 'move', from: sq(from), to: sq(to), promo });

test('a game: legal moves only, on your own turn; the clock runs while you think', () => {
  const { ctx, game } = setup();
  const white = game.whiteSlot;
  game.onInput(1 - white, { type: 'move', from: sq('e7'), to: sq('e5') }); // not their turn
  game.onInput(white, { type: 'move', from: sq('e2'), to: sq('e5') }); // not a move
  for (const bad of [{ from: 'e2', to: 'e4' }, { from: -1, to: 4 }, { from: sq('e2'), to: sq('e4'), promo: 'k' }]) game.onInput(white, { type: 'move', ...bad });
  assert.equal(game.moves.length, 0);
  ctx.advance(5000);
  move(game, 'e2', 'e4');
  assert.deepEqual(game.moves, ['e4']);
  assert.equal(game.view().banks[white], 10 * 60000 - 5000);
  assert.equal(game.view().ticking, 1 - white);
  assert.ok(!('legal' in game.hostView()) || Array.isArray(game.hostView().legal));
});

test('fool\'s mate: checkmate wins; colours swap for the next game', () => {
  const { ctx, game } = setup({ wins: 2 });
  const white = game.whiteSlot;
  move(game, 'f2', 'f3');
  move(game, 'e7', 'e5');
  move(game, 'g2', 'g4');
  move(game, 'd8', 'h4');
  assert.equal(game.phase, 'gameEnd');
  assert.deepEqual(game.result, { winner: 1 - white, how: 'mate' });
  assert.equal(game.moves[3], 'Qh4#');
  ctx.advance(TIMING.gameEndMs);
  assert.equal(game.whiteSlot, 1 - white);
  assert.equal(game.phase, 'play');
});

test('resigning loses; out of time loses; first to the games needed wins', () => {
  const { ctx, game } = setup();
  const white = game.whiteSlot;
  ctx.advance(10 * 60000);
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.result, { winner: 1 - white, how: 'time' });
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'play');
  game.onInput(game.whiteSlot, { type: 'resign' });
  assert.equal(game.result.how, 'resign');
  const off = setup({ minutes: 0 });
  off.ctx.advance(60 * 60000);
  assert.equal(off.game.phase, 'play', 'no clock: it waits');
});

test('draws: stalemate, repetition', () => {
  const { game } = setup();
  game.pos = fromFen('7k/8/6Q1/8/8/8/8/6K1 w - - 0 1');
  game.legal = legalMoves(game.pos);
  move(game, 'g6', 'f7');
  assert.deepEqual(game.result, { winner: null, how: 'stalemate' });
  const r = setup();
  for (let i = 0; i < 2; i++) for (const [a, b] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']]) move(r.game, a, b);
  assert.deepEqual(r.game.result, { winner: null, how: 'repetition' });
});

test('the computer: takes a free queen, mates in one (Normal and Hard), never moves out of turn', () => {
  const free = fromFen('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
  for (const level of ['easy', 'normal', 'hard']) {
    const m = bestMove(free, level, () => 0.5);
    assert.equal(square(m.to), 'd5', level);
  }
  const mate = fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  for (const level of ['normal', 'hard']) {
    const m = bestMove(mate, level, () => 0.5);
    assert.ok(inCheck(makeMove(mate, m)) && !legalMoves(makeMove(mate, m)).length, level);
  }
  const { game } = setup();
  assert.equal(chessBot(game.playerView(1 - game.whiteSlot), 'hard'), null);
  const m = chessBot(game.playerView(game.whiteSlot), 'hard');
  assert.ok(game.legal.some((x) => x.from === m.from && x.to === m.to));
});

test('the computer: Normal beats Easy', () => {
  for (let seed = 1; seed <= 2; seed++) {
    const flip = seed % 2;
    const { view } = play('chess', flip ? ['easy', 'normal'] : ['normal', 'easy'], { seed });
    assert.equal(view.winner, flip ? 1 : 0, 'seed ' + seed);
  }
});
