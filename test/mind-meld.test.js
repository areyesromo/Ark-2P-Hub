import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MindMeld, CARDS, TIMING, CLUE_MAX, starsFor } from '../server/games/mind-meld.js';
import { fakeCtx } from './helpers.js';

function game(settings = {}, players) {
  const ctx = fakeCtx();
  if (players) players.forEach((local, i) => (ctx.players[i].local = local));
  ctx.settings = settings;
  const g = new MindMeld(ctx, () => 0.37);
  g.start();
  return { ctx, g };
}

test('the scales: plenty of them, all different', () => {
  assert.ok(CARDS.length >= 50);
  assert.equal(new Set(CARDS.map((c) => c.join('|'))).size, CARDS.length);
  assert.deepEqual([0, 4, 5, 11, 12, 18, 19, 60].map(starsFor), [3, 3, 2, 2, 1, 1, 0, 0]);
});

test('a round: only the clue-giver sees the target; the guesser turns the dial and locks in; closer is more stars', () => {
  const { g } = game();
  assert.equal(g.phase, 'clue');
  const giver = g.giver;
  const guesser = g.guesser;
  assert.equal(typeof g.playerView(giver).target, 'number');
  assert.equal(g.playerView(guesser).target, null, 'no peeking');
  assert.equal(g.hostView().target, null, 'not on the TV either');
  g.onInput(guesser, { type: 'clue', text: 'hmm' }); // only the giver gives clues
  assert.equal(g.phase, 'clue');
  g.onInput(guesser, { type: 'aim', value: 30 }); // lining up early is fine
  g.onInput(guesser, { type: 'lock' }); // but no locking in before the clue
  assert.equal(g.phase, 'clue');
  g.onInput(giver, { type: 'clue', text: '  hot\u0007 soup   ' + 'x'.repeat(60) });
  assert.equal(g.phase, 'guess');
  assert.equal(g.clue.length, CLUE_MAX);
  assert.ok(g.clue.startsWith('hot soup x'));
  g.onInput(giver, { type: 'aim', value: 0 }); // the giver can't touch the dial
  assert.equal(g.aim, 30);
  g.onInput(guesser, { type: 'aim', value: g.target + 3 });
  g.onInput(guesser, { type: 'lock' });
  assert.equal(g.phase, 'reveal');
  assert.equal(g.result.stars, 3);
  assert.equal(g.hostView().target, g.result.target, 'revealed');
});

test('roles swap every round; the match ends after the last round with stars out of 3 per round', () => {
  const { ctx, g } = game({ rounds: 4 });
  const first = g.giver;
  for (let r = 0; r < 4; r++) {
    assert.equal(g.giver, (first + r) % 2);
    g.onInput(g.giver, { type: 'clue', text: 'clue ' + r });
    g.onInput(g.guesser, { type: 'aim', value: r % 2 ? 100 - g.target : g.target });
    g.onInput(g.guesser, { type: 'lock' });
    ctx.advance(TIMING.revealMs + 1);
  }
  assert.equal(g.phase, 'over');
  const v = g.hostView();
  assert.equal(v.maxStars, 12);
  assert.equal(v.history.length, 4);
  assert.ok(v.stars >= 6);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.giver, 1 - first, 'the other one starts the rematch');
});

test('timers: no clue in time scores nothing; no lock-in in time takes the dial where it is', () => {
  const { ctx, g } = game();
  ctx.advance(TIMING.clueMs + 1);
  assert.equal(g.phase, 'reveal');
  assert.deepEqual([g.result.noClue, g.result.stars], [true, 0]);
  ctx.advance(TIMING.revealMs + 1);
  g.onInput(g.giver, { type: 'clue', text: 'ok' });
  g.onInput(g.guesser, { type: 'aim', value: g.target });
  ctx.advance(TIMING.guessMs + 1);
  assert.equal(g.result.stars, 3);
});

test('controllers: a controller player always guesses; two controllers need a phone', () => {
  const { ctx, g } = game({}, [true, false]);
  for (let r = 0; r < 3; r++) {
    assert.equal(g.giver, 1, 'the phone player gives every clue');
    g.onInput(1, { type: 'clue', text: 'x' });
    g.onInput(0, { type: 'lock' });
    ctx.advance(TIMING.revealMs + 1);
  }
  const { g: g2 } = game({}, [true, true]);
  assert.equal(g2.phase, 'needPhone');
});
