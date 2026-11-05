// The computer opponent in every game that has one (a game's `bot`, see server/games/index.js):
// whole games with the computer in both seats, and that the levels play differently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGame, listGames } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';

const REALTIME = ['pong', 'air-hockey', 'snake', 'tron', 'tanks', 'word-hunt', 'volley-blobs', 'brick-duel', 'asteroid-duel', 'rally-tennis', 'sumo', 'mini-golf', 'block-battle', 'bomb-duel', 'kart-race', 'kart-race-3d', 'tower-duel'];
const BOT_GAMES = ['battleship', 'connect-four', 'checkers', 'dots-boxes', 'mancala', 'rock-paper-scissors', 'memory-match', 'dice-party', 'quiz', 'trivia-quest', 'reaction-duel', ...REALTIME];
const SOON = [ 'crazy-eights', 'liars-dice', 'anagram-duel', 'word-race', 'party-board', 'party-minis', 'micro-mayhem', 'kitchen-rush', 'dungeon-duo', 'marble-maze'];

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
function play(id, levels, opts = {}) {
  // The games roll their own dice too (Math.random): seed those as well, so a test plays out the
  // same every run.
  const random = Math.random;
  Math.random = seeded((opts.seed || 1) * 7919 + 1);
  try {
    return playSeeded(id, levels, opts);
  } finally {
    Math.random = random;
  }
}

function playSeeded(id, levels, { seed = 1, human = null, settings = {}, limitMs = 30 * 60 * 1000 } = {}) {
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
  const ask = (slot) => (levels[slot] ? def.bot(viewOf(slot), levels[slot], rng, 0, memory[slot]) : human ? human(g.playerView(slot), slot, rng) : null);
  while (g.hostView().phase !== 'over' && now < limitMs) {
    // As the room does: a look on every update; a waiting move it no longer wants is dropped.
    for (const slot of [0, 1]) {
      const move = ask(slot);
      if (!move) pending[slot] = null;
      else if (!pending[slot]) pending[slot] = { at: now + (move.botDelayMs ?? 1100), move };
    }
    const next = pending.filter(Boolean).map((p) => p.at);
    // (the room asks on every update: in an action game, never let more than a frame go by unasked)
    const most = REALTIME.includes(id) ? 16 : 500;
    const step = next.length ? Math.min(most, Math.max(0, Math.min(...next) - now)) : most;
    ctx.advance(step);
    now += step;
    for (const slot of [0, 1]) {
      if (!pending[slot] || pending[slot].at > now) continue;
      const { move: decided } = pending[slot];
      pending[slot] = null;
      // As the room does: it plays what it decided when it looked, if it still wants to move (a
      // move it timed, botAnticipate, it judges afresh).
      const fresh = ask(slot);
      if (!fresh) continue;
      if (decided.botFor !== undefined && fresh.botFor !== decided.botFor) continue;
      const { botDelayMs, botAnticipate, botFor, ...input } = decided.botAnticipate ? fresh : decided;
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
      // (both move in a turn-based game; in an action game one can win without having to: the
      // quicker tap in Reaction Duel, a blob whose spot the ball keeps landing on in Volley Blobs)
      assert.ok(id === 'reaction-duel' || REALTIME.includes(id) ? stats.moves[0] + stats.moves[1] > 0 : stats.moves[0] > 0 && stats.moves[1] > 0, id + ' ' + level + ' both moved: ' + JSON.stringify(stats) + ' ' + JSON.stringify(view.scores));
      if (!REALTIME.includes(id)) assert.equal(stats.refused, 0, id + ' every move taken'); // (a steer shows a tick later)
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

test('Dice Party: the computer decides what to hold once a roll, and doesn\'t flip-flop', () => {
  const def = getGame('dice-party');
  for (const level of ['normal', 'hard']) {
    let undone = 0;
    let holds = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const ctx = fakeCtx();
      ctx.players.forEach((p) => { p.local = true; p.bot = level; });
      const g = def.create(ctx);
      g.start();
      if (g.hostView().phase === 'setup') g.onInput(0, { type: 'go' });
      const rng = seeded(seed);
      const memory = [{}, {}];
      const toggled = { key: null, dice: new Set() };
      for (let i = 0; i < 3000 && g.hostView().phase !== 'over'; i++) {
        const slot = g.hostView().turn;
        // The room asks again after every move (and on every update): ask twice here.
        def.bot(g.botView ? g.botView(slot) : g.playerView(slot), level, rng, 0, memory[slot]);
        const m = def.bot(g.botView ? g.botView(slot) : g.playerView(slot), level, rng, 0, memory[slot]);
        if (!m) break;
        if (m.type === 'hold') {
          // A die toggled twice in the same roll is a flip-flop (letting go of last roll's hold isn't).
          holds++;
          const v = g.hostView();
          const key = v.turn + ':' + v.round + ':' + v.rollsLeft;
          if (toggled.key !== key) { toggled.key = key; toggled.dice = new Set(); }
          if (toggled.dice.has(m.die)) undone++;
          toggled.dice.add(m.die);
        }
        const { botDelayMs, ...input } = m;
        g.onInput(slot, input);
      }
      assert.equal(g.hostView().phase, 'over');
    }
    assert.equal(undone, 0, level + ': ' + undone + ' of ' + holds + ' holds undone');
  }
});

test('action games and Word Hunt: Hard beats Easy, and every game ends', () => {
  for (const id of REALTIME) hardBeatsEasy(id, 6, 4); // (the games roll their own dice: a few to be sure)
});

test('Pong: the computer still misses its share at full speed (a new roll each time the ball comes)', () => {
  const def = getGame('pong');
  for (const [level, lo, hi] of [['normal', 0.05, 0.25], ['hard', 0.005, 0.1]]) {
    const memory = {};
    let misses = 0;
    const N = 600;
    for (let i = 0; i < N; i++) {
      // The same full-speed return every time, coming at the computer (slot 1), then going away.
      const coming = { phase: 'play', you: 1, ball: { x: 8, y: 4.5, vx: 20, vy: 0 }, paddles: [4.5, 4.5] };
      const m = def.bot(coming, level, Math.random, 0, memory);
      if (Math.abs(m.y * 9 - 4.5) > 1.1 + 0.22) misses++;
      def.bot({ ...coming, ball: { x: 8, y: 4.5, vx: -20, vy: 0 } }, level, Math.random, 0, memory);
    }
    assert.ok(misses / N > lo && misses / N < hi, level + ' missed ' + misses + ' of ' + N);
  }
});

test('Snake Battle: Hard beats Normal', () => {
  let wins = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const flip = seed % 2;
    const { view } = play('snake', flip ? ['normal', 'hard'] : ['hard', 'normal'], { seed });
    if (view.winner === (flip ? 1 : 0)) wins++;
  }
  assert.ok(wins >= 7, 'Hard won ' + wins + ' of 12');
});

test('Air Hockey: the computer never knocks a still puck in its own goal mouth into its own goal', () => {
  const def = getGame('air-hockey');
  for (const level of ['easy', 'normal', 'hard']) {
    for (const [x, y] of [[0.5, 4.5], [0.3, 4.0], [0.6, 3.5]]) {
      const m = def.bot({ phase: 'play', you: 0, puck: { x, y, vx: 0, vy: 0 }, mallets: [{ x: 2, y: 4.5 }, { x: 14, y: 4.5 }] }, level, Math.random);
      assert.ok(Math.hypot(m.x - x, m.y - y) > 1.5, level + ' keeps off it: ' + m.x.toFixed(2) + ', ' + m.y.toFixed(2));
    }
  }
});

test('Word Hunt: a word that also reads somewhere else on the grid is still found', () => {
  const def = getGame('word-hunt');
  // CAT reads across at the top (a chance spelling) and down the left (where it's hidden).
  const grid = 'CAT' + 'AXX' + 'TXX';
  const tried = new Set();
  for (let i = 0; i < 40; i++) {
    const m = def.bot({ phase: 'play', mode: 'shared', n: 3, grid, words: [{ word: 'CAT', by: null }] }, 'hard', Math.random, i);
    tried.add(m.a + '-' + m.b);
  }
  assert.ok(tried.has('0-6') && tried.has('0-2'), [...tried].join(' '));
});

test('the computer never reacts faster than a person could (Pong, Air Hockey, Tank Duel, Reaction Duel)', async () => {
  const { REACTION } = await import('../server/games/bot-human.js');
  const views = {
    pong: { phase: 'play', you: 1, ball: { x: 8, y: 4.5, vx: 10, vy: 2 }, paddles: [4.5, 4.5] },
    'air-hockey': { phase: 'play', you: 0, puck: { x: 5, y: 4, vx: -3, vy: 0 }, mallets: [{ x: 2, y: 4.5 }, { x: 14, y: 4.5 }] },
    'reaction-duel': { phase: 'go', you: 0 },
    tanks: { phase: 'play', you: 0, ready: true, field: { w: 16, h: 9 }, obstacles: [], shells: [], tanks: [{ x: 2, y: 4.5, angle: 0, alive: true }, { x: 14, y: 4.5, angle: Math.PI, alive: true }] },
  };
  for (const [id, view] of Object.entries(views)) {
    for (const level of ['easy', 'normal', 'hard']) {
      for (let i = 0; i < 200; i++) {
        const m = getGame(id).bot(view, level, Math.random, 0, {});
        assert.ok(m.botDelayMs >= REACTION[level].floor, id + ' ' + level + ' ' + m.botDelayMs);
      }
    }
  }
});

test('Snake Battle: the computer really does take in your snake late (from the game\'s live views)', async () => {
  const { laggedSight } = await import('../server/games/snake-bot.js');
  const ctx = fakeCtx();
  ctx.players.forEach((p) => (p.local = true));
  const g = getGame('snake').create(ctx);
  g.start();
  g.onInput(0, { type: 'go' });
  const memory = {};
  let lagged = 0;
  let looks = 0;
  for (let i = 0; i < 400; i++) {
    ctx.advance(16);
    const v = g.playerView(0);
    if (v.phase !== 'play') continue;
    const them = v.snakes[1];
    const snap = { body: them.body.map((c) => c.slice()), crashed: them.crashed };
    const seen = laggedSight(memory, 'snake', v.round, v.snakes[0].body[0].join(), snap, 270, v.tickMs);
    looks++;
    if (seen.body[0].join() !== them.body[0].join()) lagged++;
  }
  assert.ok(looks > 50 && lagged / looks > 0.6, lagged + ' of ' + looks + ' looks were behind');
});

test('Kart Race: the computer fights a balloon battle too, and readies up after you on the menus', () => {
  // You (sitting still) say go on the standings; it readies after you.
  const human = (v, slot) => ((v.phase === 'standings' || v.phase === 'setup') && !(v.ready || [])[slot] ? { type: 'go', botDelayMs: 500 } : null);
  const { view, stats } = play('kart-race', ['hard', null], { seed: 2, human, settings: { mode: 1 } });
  assert.ok(stats.moves[0] > 0);
  assert.equal(view.phase, 'over');
  assert.ok(view.battle, 'a battle');
});

test('Bomb Duel: against someone standing still, the computer wins its rounds (it doesn\'t blow itself up)', () => {
  for (const level of ['normal', 'hard']) {
    let wins = 0;
    for (let seed = 1; seed <= 3; seed++) {
      const { view } = play('bomb-duel', [level, null], { seed, limitMs: 12 * 60 * 1000 });
      if (view.winner === 0) wins++;
    }
    assert.ok(wins >= 2, level + ' won ' + wins + ' of 3');
  }
});

test('Falling Blocks: the computer (even Easy) outlasts someone who never touches the controls', () => {
  for (const level of ['easy', 'normal']) {
    const { view } = play('block-battle', [level, null], { seed: 4 });
    assert.equal(view.winner, 0, level);
  }
});

test('Kart Race: in a balloon battle the computer beats someone sitting still, without getting stuck on the walls', () => {
  for (let seed = 1; seed <= 3; seed++) {
    const human = (v, slot) => ((v.phase === 'standings' || v.phase === 'setup') && !(v.ready || [])[slot] ? { type: 'go', botDelayMs: 500 } : null);
    const { view } = play('kart-race', ['normal', null], { seed, human, settings: { mode: 1 } });
    assert.equal(view.winner, 0, 'seed ' + seed);
  }
});
