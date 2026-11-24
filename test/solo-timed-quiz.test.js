import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { QuickMaths } from '../server/solo/games/maths.js';
import { ColourTrap, INKS } from '../server/solo/games/colours.js';
import { TIMING } from '../server/solo/games/timed-quiz.js';

/** Answer right using the game's own question (tests can see it; the screens can't). */
const right = (g) => g.onInput({ type: 'answer', choice: g.q.answer });
const wrong = (g) => g.onInput({ type: 'answer', choice: (g.q.answer + 1) % 4 });

test('Quick Maths: four different choices, one right; the answer never shows before it\'s given', () => {
  const ctx = fakeCtx();
  const g = new QuickMaths(ctx, seeded(1));
  g.start();
  ctx.advance(TIMING.readyMs);
  for (let i = 0; i < 40; i++) {
    const v = g.hostView();
    assert.equal(v.question.answer, undefined);
    assert.equal(new Set(v.question.options).size, 4);
    // The text works out to the option at q.answer.
    const expr = g.q.text.replace('×', '*').replace('÷', '/').replace('−', '-');
    assert.equal(Function('return ' + expr)(), g.q.options[g.q.answer], g.q.text);
    right(g);
  }
  assert.equal(g.hostView().question.level, 5, 'harder as you go');
  assert.equal(g.right, 40);
});

test('a wrong answer costs time and the streak; time up ends it', () => {
  const ctx = fakeCtx();
  const g = new QuickMaths(ctx, seeded(2));
  g.start();
  ctx.advance(TIMING.readyMs);
  right(g);
  right(g);
  wrong(g);
  const v = g.hostView();
  assert.equal(v.streak, 0);
  assert.equal(v.bestStreak, 2);
  assert.equal(v.last.ok, false);
  assert.ok(v.timeLeft <= 57000);
  for (const bad of [4, -1, 1.5, '0']) g.onInput({ type: 'answer', choice: bad });
  assert.equal(g.answered, 3);
  ctx.advance(60000);
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().score, 2);
  assert.equal(ctx.pendingTimers(), 0);
});

test('Colour Trap: the answer is the ink, mostly not the word', () => {
  const ctx = fakeCtx();
  const g = new ColourTrap(ctx, seeded(3));
  g.start();
  ctx.advance(TIMING.readyMs);
  let mismatched = 0;
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(g.q.options, INKS);
    assert.equal(INKS[g.q.answer], g.q.ink);
    if (g.q.word !== g.q.ink) mismatched++;
    right(g);
  }
  assert.ok(mismatched > 60 && mismatched < 100, `${mismatched} of 100 mismatched`);
  assert.equal(g.seconds, 45);
});
