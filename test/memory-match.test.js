import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryMatch, THEMES, TIMING, gridOf } from '../server/games/memory-match.js';
import { fakeCtx } from './helpers.js';

/** A game past the countdown; `cards` from the setup screen. */
function playing(settings = {}) {
  const ctx = fakeCtx();
  const game = new MemoryMatch(ctx);
  game.start();
  for (const [key, value] of Object.entries(settings)) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(game.phase, 'turn');
  return { ctx, game };
}

/** Indexes of the two cards with a given face, and of a card that doesn't match it. */
function pairOf(game, face) {
  const idx = game.cards.map((c, i) => (c.face === face && c.owner === null ? i : -1)).filter((i) => i >= 0);
  const other = game.cards.findIndex((c) => c.face !== face && c.owner === null);
  return { a: idx[0], b: idx[1], other };
}

test('the board: pairs of faces from the theme, shuffled; face-down cards are secret', () => {
  for (const [cards, theme] of [[16, 1], [24, 2], [36, 0]]) {
    const { game } = playing({ cards, theme });
    assert.equal(game.cards.length, cards);
    const counts = {};
    game.cards.forEach((c) => (counts[c.face] = (counts[c.face] || 0) + 1));
    assert.ok(Object.values(counts).every((n) => n === 2), 'every face twice');
    if (theme) assert.ok(game.cards.every((c) => THEMES[theme - 1].faces.includes(c.face)));
    const [cols, rows] = gridOf(cards);
    assert.equal(cols * rows, cards);
    const v = game.playerView(0);
    assert.ok(v.cards.every((c) => !c.up && c.face === undefined), 'no peeking through the view');
  }
});

test('a pair is yours and you go again; a miss shows both, then turns them back and passes the turn', () => {
  const { ctx, game } = playing();
  const first = game.turn;
  const { a, b, other } = pairOf(game, game.cards[0].face);
  game.onInput(1 - first, { type: 'flip', index: a }); // not your turn
  assert.deepEqual(game.flipped, []);
  game.onInput(first, { type: 'flip', index: a });
  game.onInput(first, { type: 'flip', index: a }); // same card again: ignored
  assert.equal(game.hostView().cards[a].up, true);
  game.onInput(first, { type: 'flip', index: b });
  assert.equal(game.phase, 'match');
  assert.equal(game.scores[first], 1);
  ctx.advance(TIMING.matchMs + 10);
  assert.equal(game.turn, first, 'go again');
  assert.equal(game.phase, 'turn');
  // Now a miss.
  const face = game.cards[other].face;
  const miss = game.cards.findIndex((c) => c.owner === null && c.face !== face);
  game.onInput(first, { type: 'flip', index: other });
  game.onInput(first, { type: 'flip', index: miss });
  assert.equal(game.phase, 'peek');
  assert.equal(game.hostView().cards[miss].up, true, 'both shown for a moment');
  ctx.advance(TIMING.peekMs + 10);
  assert.equal(game.turn, 1 - first);
  assert.equal(game.hostView().cards[miss].up, false, 'turned back over');
  game.onInput(game.turn, { type: 'flip', index: a }); // already taken
  assert.deepEqual(game.flipped, []);
});

test('too slow: the clock flips two cards for you and the turn moves on', () => {
  const { ctx, game } = playing({ turnSeconds: 10 });
  const first = game.turn;
  ctx.advance(10000 + 10);
  assert.ok(game.phase === 'peek' || game.phase === 'match');
  ctx.advance(TIMING.peekMs + TIMING.matchMs + 20);
  assert.equal(game.phase, 'turn');
  assert.ok(game.events.flips === 2);
  if (game.scores[first] === 0) assert.equal(game.turn, 1 - first);
});

test('clearing the board: most pairs wins (or a draw); rematch swaps who starts', () => {
  const { ctx, game } = playing({ cards: 16 });
  const first = game.turn;
  // Whoever's turn it is takes every pair: 8 - 0.
  while (game.phase !== 'over') {
    const i = game.cards.findIndex((c) => c.owner === null);
    const { a, b } = pairOf(game, game.cards[i].face);
    game.onInput(game.turn, { type: 'flip', index: a });
    game.onInput(game.turn, { type: 'flip', index: b });
    ctx.advance(TIMING.matchMs + 10);
  }
  assert.equal(game.winner, first);
  assert.equal(game.scores[first], 8);
  assert.ok(game.hostView().cards.every((c) => c.up));
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(game.turn, 1 - first, 'the other player starts the rematch');
  assert.deepEqual(game.scores, [0, 0]);
});

test('setup: card count, theme and turn time are remembered; bad values ignored', () => {
  const ctx = fakeCtx();
  const game = new MemoryMatch(ctx);
  game.start();
  assert.deepEqual(game.settings, { cards: 16, theme: 0, turnSeconds: 20 });
  game.onInput(1, { type: 'setting', key: 'cards', value: 36 });
  game.onInput(1, { type: 'setting', key: 'cards', value: 20 });
  game.onInput(1, { type: 'flip', index: 0 }); // nothing to flip yet
  assert.deepEqual(ctx.saved.settings, { cards: 36, theme: 0, turnSeconds: 20 });
  for (const t of THEMES) assert.ok(t.faces.length >= 18 && new Set(t.faces).size === t.faces.length, `${t.name}: 18+ different faces`);
});
