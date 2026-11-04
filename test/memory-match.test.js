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
  assert.equal(game.phase, settings.mode === 'race' ? 'race' : 'turn');
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
  assert.deepEqual(game.settings, { mode: 'turns', cards: 16, theme: 0, turnSeconds: 20 });
  game.onInput(1, { type: 'setting', key: 'cards', value: 36 });
  game.onInput(1, { type: 'setting', key: 'cards', value: 20 });
  game.onInput(1, { type: 'flip', index: 0 }); // nothing to flip yet
  assert.deepEqual(ctx.saved.settings, { mode: 'turns', cards: 36, theme: 0, turnSeconds: 20 });
  for (const t of THEMES) assert.ok(t.faces.length >= 18 && new Set(t.faces).size === t.faces.length, `${t.name}: 18+ different faces`);
});

test('picture sets: every set can fill the biggest board; Mixed never repeats a picture', () => {
  assert.ok(THEMES.length >= 8);
  const { game } = playing({ cards: 36, theme: 0 });
  const faces = game.cards.map((c) => c.face);
  assert.equal(new Set(faces).size, 18, '18 different pictures, each twice');
  assert.deepEqual(game.hostView().themeNames, THEMES.map((t) => t.name));
  for (let t = 1; t <= THEMES.length; t++) {
    const { game: g } = playing({ cards: 36, theme: t });
    assert.equal(new Set(g.cards.map((c) => c.face)).size, 18, THEMES[t - 1].name);
  }
});

test('no timer is a choice of time per turn: a turn waits for you', () => {
  const { ctx, game } = playing({ turnSeconds: 0 });
  assert.equal(game.phase, 'turn');
  const turn = game.turn;
  ctx.advance(60000);
  assert.equal(game.phase, 'turn');
  assert.equal(game.turn, turn, 'still your turn');
  assert.equal(game.hostView().timeLeftMs, 0);
  assert.equal(game.hostView().timed, false);
  assert.equal(ctx.pendingTimers(), 0);
});

/** A Race match (two phones), past the countdown. */
function racing(extra = {}) {
  return playing({ mode: 'race', ...extra });
}

test('Race: the same cards on each phone, you both flip at once, and you only see your own board', () => {
  const { game } = racing();
  assert.equal(game.phase, 'race');
  const { a, b } = pairOf(game, game.cards[0].face);
  game.onInput(0, { type: 'flip', index: a });
  game.onInput(1, { type: 'flip', index: a }); // both at once: no turns
  assert.equal(game.playerView(0).cards[a].up, true);
  assert.equal(game.playerView(1).cards[a].up, true);
  game.onInput(0, { type: 'flip', index: b });
  assert.deepEqual(game.scores, [1, 0], 'a pair for player 1 only');
  assert.equal(game.playerView(0).cards[b].owner, 0);
  assert.equal(game.playerView(1).cards[b].up, false, 'not on the other board');
  // The TV keeps both boards face down while you race: only the counts.
  assert.ok(game.hostView().cards.every((c) => !c.up));
});

test('Race: a mismatch stays up until your next flip turns it back; first to clear every pair wins', () => {
  const { game } = racing();
  const faces = [...new Set(game.cards.map((c) => c.face))];
  const { a } = pairOf(game, faces[0]);
  const { a: c } = pairOf(game, faces[1]);
  game.onInput(1, { type: 'flip', index: a });
  game.onInput(1, { type: 'flip', index: c });
  assert.equal(game.playerView(1).cards[a].up, true, 'shown so you can remember it');
  game.onInput(1, { type: 'flip', index: pairOf(game, faces[2]).a });
  assert.equal(game.playerView(1).cards[a].up, false, 'turned back');
  // Player 2 clears the board.
  const p2 = racing();
  for (const f of [...new Set(p2.game.cards.map((x) => x.face))]) {
    const { a: x, b: y } = pairOf(p2.game, f);
    p2.game.onInput(1, { type: 'flip', index: x });
    p2.game.onInput(1, { type: 'flip', index: y });
  }
  assert.equal(p2.game.phase, 'over');
  assert.equal(p2.game.winner, 1);
  assert.equal(p2.ctx.pendingTimers(), 0);
});

test('Race needs two phones: with a controller player it\'s the usual turns', () => {
  const ctx = fakeCtx();
  ctx.players[1].local = true;
  const game = new MemoryMatch(ctx);
  game.start();
  game.onInput(0, { type: 'setting', key: 'mode', value: 'race' });
  game.onInput(0, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(game.phase, 'turn');
});

test('a card is a whole number: a card can\'t be paired with itself by sending its number as text', () => {
  for (const mode of ['turns', 'race']) {
    const { game } = playing({ mode });
    const slot = mode === 'race' ? 0 : game.turn;
    game.onInput(slot, { type: 'flip', index: 3 });
    game.onInput(slot, { type: 'flip', index: '3' });
    game.onInput(slot, { type: 'flip', index: 3.5 });
    assert.deepEqual(game.scores, [0, 0], mode);
  }
});

test('Race: tapping one of your face-up misses again starts a new pair with it', () => {
  const { game } = racing();
  const faces = [...new Set(game.cards.map((c) => c.face))];
  const { a, b } = pairOf(game, faces[0]);
  const { a: c } = pairOf(game, faces[1]);
  game.onInput(0, { type: 'flip', index: a });
  game.onInput(0, { type: 'flip', index: c }); // a miss: a and c stay up
  game.onInput(0, { type: 'flip', index: a }); // a again: the start of a new pair
  game.onInput(0, { type: 'flip', index: b });
  assert.deepEqual(game.scores, [1, 0]);
});

test('Race: the end shows every face, coloured by who paired what; a rematch starts fresh', () => {
  const p = racing();
  for (const f of [...new Set(p.game.cards.map((x) => x.face))]) {
    const { a, b } = pairOf(p.game, f);
    p.game.onInput(0, { type: 'flip', index: a });
    p.game.onInput(0, { type: 'flip', index: b });
  }
  const tv = p.game.hostView();
  assert.ok(tv.cards.every((c) => c.up && c.owner === 0));
  p.game.onInput(0, { type: 'rematch' });
  p.ctx.advance(TIMING.countdownMs + 10);
  assert.equal(p.game.phase, 'race');
  assert.deepEqual(p.game.scores, [0, 0]);
  assert.ok(p.game.playerView(0).cards.every((c) => !c.up));
});

test('Race with a controller player seated mid-game: the TV shows their board and the controller flips', () => {
  const { ctx, game } = racing();
  ctx.players[1].local = true; // a controller took the dropped phone's seat
  const { a } = pairOf(game, game.cards[0].face);
  game.onInput(1, { type: 'flip', index: a });
  assert.equal(game.hostView().cards[a].up, true, 'their flip shows on the TV');
});
