// The computer opponent's test harness, shared by test/bots*.test.js: whole games with the
// computer in the seats, played the way the room plays them. The per-game runs are spread over a
// few files because node runs test files in parallel (a test file's own tests run one by one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGame } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';
import { Sight } from '../server/games/bot-human.js';


export const REALTIME = ['pong', 'air-hockey', 'snake', 'tron', 'tanks', 'word-hunt', 'volley-blobs', 'brick-duel', 'asteroid-duel', 'rally-tennis', 'sumo', 'mini-golf', 'block-battle', 'bomb-duel', 'kart-race', 'kart-race-3d', 'tower-duel', 'party-board', 'party-minis', 'micro-mayhem', 'kitchen-rush', 'dungeon-duo', 'marble-maze'];
export const BOT_GAMES = ['battleship', 'connect-four', 'checkers', 'dots-boxes', 'mancala', 'rock-paper-scissors', 'memory-match', 'dice-party', 'crazy-eights', 'liars-dice', 'anagram-duel', 'word-race', 'ten-pin', 'reversi', 'blackjack', 'five-letters', 'make-24', ...REALTIME];
export const SOON = [];
export const COOP = ['kitchen-rush', 'dungeon-duo', 'marble-maze']; // (the computer as your teammate: nobody to beat)

/** A seeded rng (mulberry32). */
export function seeded(seed) {
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
export function play(id, levels, opts = {}) {
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
  if (def.steers) return steer(def, g, ctx, levels, rng, memory, stats, human, limitMs);
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

/**
 * A game played by steering (a game's `steers`), as Room#steerBot drives it: each update the
 * computer takes in the view and acts at once on the one from a reaction ago (Sight).
 */
function steer(def, g, ctx, levels, rng, memory, stats, human, limitMs) {
  const viewOf = (slot) => (g.botView ? g.botView(slot) : g.playerView(slot));
  const sights = levels.map((level) => level && new Sight(level, rng));
  const last = [null, null];
  let now = 0;
  let seen = -1;
  while (g.hostView().phase !== 'over' && now < limitMs) {
    if (ctx.updates !== seen) {
      seen = ctx.updates;
      for (const slot of [0, 1]) {
        if (!levels[slot]) {
          const move = human ? human(g.playerView(slot), slot, rng) : null;
          if (move) g.onInput(slot, move);
          continue;
        }
        sights[slot].see(viewOf(slot), now);
        const view = sights[slot].seen(now);
        const move = view && def.bot(view, levels[slot], rng, 0, memory[slot]);
        if (!move) continue;
        const { botDelayMs, botAnticipate, botFor, ...input } = move;
        const key = JSON.stringify(input);
        if (input.type === 'move' && key === last[slot]) continue;
        last[slot] = key;
        g.onInput(slot, input);
        stats.moves[slot]++;
      }
    }
    ctx.advance(16);
    now += 16;
  }
  return { g, view: g.hostView(), stats, now };
}

/** Hard beats Easy in most of `n` games (it starts half of them). */
export function hardBeatsEasy(id, n, atLeast, settings) {
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    const flip = seed % 2;
    const { view } = play(id, flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed, settings });
    if (view.winner === (flip ? 1 : 0)) wins++;
  }
  assert.ok(wins >= atLeast, id + ': Hard won ' + wins + ' of ' + n);
}

/**
 * The slow games, each group in its own test file (bots-games-*.test.js); bots-games.test.js
 * takes every other game. Their games take minutes of game time each.
 */
export const HEAVY = {
  'tower-duel': ['tower-duel'],
  'karts-golf': ['kart-race-3d', 'mini-golf'],
  action: ['tron', 'dungeon-duo', 'kitchen-rush', 'block-battle', 'bomb-duel', 'party-board', 'kart-race'],
};

/** For each game: the computer plays a whole game against itself at every level, and (an action game) Hard beats Easy. */
export function gameTests(ids) {
  for (const id of ids) {
    if (id !== 'battleship') {
      test(id + ': the computer plays a whole game against itself, every level', () => {
        for (const level of ['easy', 'normal', 'hard']) {
          const { view, stats } = play(id, [level, level === 'easy' ? 'hard' : 'easy'], { seed: level.length });
          assert.equal(view.phase, 'over', id + ' ' + level);
          // (both move in a turn-based game; in an action game one can win without having to: the
          // quicker tap in Reaction Duel, a blob whose spot the ball keeps landing on in Volley Blobs)
          assert.ok(REALTIME.includes(id) ? stats.moves[0] + stats.moves[1] > 0 : stats.moves[0] > 0 && stats.moves[1] > 0, id + ' ' + level + ' both moved: ' + JSON.stringify(stats) + ' ' + JSON.stringify(view.scores));
          if (!REALTIME.includes(id)) assert.equal(stats.refused, 0, id + ' every move taken'); // (a steer shows a tick later)
        }
      });
    }
    // (the games roll their own dice: a few to be sure)
    if (REALTIME.includes(id) && !COOP.includes(id)) test(id + ': Hard beats Easy, and the game ends', () => hardBeatsEasy(id, 6, 4));
  }
}
