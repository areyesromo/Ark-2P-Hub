// The computer opponent in every game that has one (a game's `bot`, see server/games/index.js):
// whole games with the computer in both seats, and that the levels play differently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGame, listGames } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';

const BOT_GAMES = ['battleship', 'connect-four', 'checkers', 'dots-boxes', 'mancala', 'rock-paper-scissors', 'memory-match', 'dice-party', 'quiz', 'trivia-quest', 'reaction-duel'];
const SOON = ['pong', 'air-hockey', 'snake', 'tron', 'tanks', 'word-hunt'];

/** A seeded rng (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Play `id` with the computer in the seats given levels (null: nobody plays that seat, or `human`
 * gives its input), the way the room does: each move after its pause. Gives the game and stats.
 */
function play(id, levels, { seed = 1, human = null, settings = {}, limitMs = 30 * 60 * 1000 } = {}) {
  const def = getGame(id);
  const ctx = fakeCtx();
  ctx.players.forEach((p, slot) => {
    p.local = true;
    if (levels[slot]) p.bot = levels[slot];
  });
  const rng = seeded(seed);
  const g = def.create(ctx);
  g.start();
  const memory = [{}, {}];
  const viewOf = (slot) => (g.botView ? g.botView(slot) : g.playerView(slot));
  const pending = [null, null];
  const stats = { moves: [0, 0], refused: 0 };
  // Past a setup screen with the settings asked for.
  for (const [key, value] of Object.entries(settings)) g.onInput(0, { type: 'setting', key, value });
  if (g.hostView().phase === 'setup') g.onInput(0, { type: 'go' });
  let now = 0;
  while (g.hostView().phase !== 'over' && now < limitMs) {
    for (const slot of [0, 1]) {
      if (pending[slot]) continue;
      const move = levels[slot] ? def.bot(viewOf(slot), levels[slot], rng, 0, memory[slot]) : human ? human(g.playerView(slot), slot, rng) : null;
      if (move) pending[slot] = { at: now + (move.botDelayMs ?? 1100), move };
    }
    const next = pending.filter(Boolean).map((p) => p.at);
    const step = next.length ? Math.max(0, Math.min(...next) - now) : 500;
    ctx.advance(step);
    now += step;
    for (const slot of [0, 1]) {
      if (!pending[slot] || pending[slot].at > now) continue;
      pending[slot] = null;
      // A fresh look, as the room does when the pause is over.
      const move = levels[slot] ? def.bot(viewOf(slot), levels[slot], rng, 0, memory[slot]) : human ? human(g.playerView(slot), slot, rng) : null;
      if (!move) continue;
      const { botDelayMs, ...input } = move;
      const before = JSON.stringify(g.hostView());
      g.onInput(slot, input);
      if (JSON.stringify(g.hostView()) === before) stats.refused++;
      stats.moves[slot]++;
    }
  }
  return { g, view: g.hostView(), stats, now };
}

test('the lobby says which games the computer plays, and which are coming soon', () => {
  const games = listGames();
  assert.deepEqual(games.filter((g) => g.vsComputer).map((g) => g.id).sort(), BOT_GAMES.slice().sort());
  assert.deepEqual(games.filter((g) => g.botSoon).map((g) => g.id).sort(), SOON.slice().sort());
  for (const g of games) assert.ok(!(g.vsComputer && g.botSoon), g.id);
});

for (const id of BOT_GAMES.filter((x) => x !== 'battleship')) {
  test(id + ': the computer plays a whole game against itself, every level', () => {
    for (const level of ['easy', 'normal', 'hard']) {
      const { view, stats } = play(id, [level, level === 'easy' ? 'hard' : 'easy'], { seed: level.length });
      assert.equal(view.phase, 'over', id + ' ' + level);
      // (both move, but in Reaction Duel the quicker one may win every round before the other taps)
      assert.ok(id === 'reaction-duel' ? stats.moves[0] + stats.moves[1] > 0 : stats.moves[0] > 0 && stats.moves[1] > 0, id + ' both moved');
      assert.equal(stats.refused, 0, id + ' every move taken');
    }
  });
}

/** Hard beats Easy in most of `n` games (it starts half of them). */
function hardBeatsEasy(id, n, atLeast, settings) {
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const flip = seed % 2;
    const { view } = play(id, flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed, settings });
    if (view.winner === (flip ? 1 : 0)) wins++;
  }
  assert.ok(wins >= atLeast, id + ': Hard won ' + wins + ' of ' + n);
}

test('board games: Hard beats Easy', () => {
  hardBeatsEasy('connect-four', 6, 5);
  hardBeatsEasy('checkers', 6, 5);
  hardBeatsEasy('mancala', 6, 5);
  hardBeatsEasy('dots-boxes', 6, 4);
  hardBeatsEasy('dice-party', 10, 7);
});

test('Connect Four: the computer takes a win, and blocks yours', () => {
  const def = getGame('connect-four');
  const board = Array.from({ length: 6 }, () => new Array(7).fill(0));
  board[0][0] = board[0][1] = board[0][2] = 2; // the computer (slot 1) has three in a row
  board[1][0] = board[1][1] = board[1][2] = 1;
  const view = { phase: 'play', turn: 1, you: 1, board, cols: 7, rows: 6 };
  for (const level of ['normal', 'hard']) assert.equal(def.bot(view, level, Math.random).col, 3, level + ' wins');
  // Yours to block: three of yours along the bottom.
  const block = Array.from({ length: 6 }, () => new Array(7).fill(0));
  block[0][2] = block[0][3] = block[0][4] = 1;
  block[0][5] = 2; // one end closed: only column 1 stops it
  block[1][3] = 2;
  for (const level of ['normal', 'hard']) {
    const m = def.bot({ phase: 'play', turn: 1, you: 1, board: block, cols: 7, rows: 6 }, level, Math.random);
    assert.equal(m.col, 1, level + ' blocks');
  }
});

test('Rock Paper Scissors: Hard picks up on a player who always throws rock', () => {
  let bot = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const { view } = play('rock-paper-scissors', [null, 'hard'], { seed, human: (v) => (v.phase === 'choose' && !v.yourPick ? { type: 'pick', choice: 'rock' } : null) });
    if (view.winner === 1) bot++;
  }
  assert.ok(bot >= 5, 'the computer won ' + bot + ' of 6');
});

test('Memory Match: Hard remembers every card it has seen, Easy forgets', () => {
  let hard = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const { view } = play('memory-match', seed % 2 ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (seed % 2 ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 5, 'Hard won ' + hard + ' of 6');
});

test('quizzes: Hard is right more often than Easy, and never sees an answer it isn\'t meant to on a player\'s screen', () => {
  const def = getGame('quiz');
  const right = (level) => {
    let n = 0;
    for (let i = 0; i < 400; i++) {
      const m = def.bot({ phase: 'question', yourPick: null, question: { options: ['a', 'b', 'c', 'd'] }, botAnswer: 2, timeLeftMs: 15000 }, level, Math.random);
      if (m.choice === 2) n++;
    }
    return n / 400;
  };
  assert.ok(right('hard') > right('normal') + 0.08 && right('normal') > right('easy') + 0.08);
  for (const id of ['quiz', 'trivia-quest']) {
    // The answer is only in the computer's own view.
    const ctx = fakeCtx();
    ctx.players.forEach((p) => (p.local = true));
    ctx.players[1].bot = 'hard';
    const g = getGame(id).create(ctx);
    g.start();
    if (g.hostView().phase === 'setup') g.onInput(0, { type: 'go' });
    for (let i = 0; i < 60 && g.hostView().phase !== 'question'; i++) ctx.advance(500);
    assert.equal(g.hostView().phase, 'question');
    assert.equal(g.playerView(0).correct, null);
    assert.equal(g.playerView(1).correct, null);
    assert.equal(g.hostView().correct, null);
    assert.ok(Number.isInteger(g.botView(1).botAnswer));
    assert.equal(g.botView(0).botAnswer, undefined, 'only for the computer\'s seat');
  }
});

test('Reaction Duel: the computer never jumps the gun, and Hard is quicker than Easy', () => {
  const { view } = play('reaction-duel', ['hard', 'easy'], { seed: 3 });
  assert.equal(view.phase, 'over');
  assert.equal(view.winner, 0);
  assert.ok(view.bestMs[0] >= 150, 'a human-ish time: ' + view.bestMs[0]);
  const def = getGame('reaction-duel');
  assert.equal(def.bot({ phase: 'wait', you: 1 }, 'hard', Math.random), null);
});
