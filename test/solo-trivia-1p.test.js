import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { Trivia, ROUND, TIMING, POINTS } from '../server/solo/games/trivia-1p.js';
import { QUESTIONS, CATEGORIES } from '../server/solo/games/trivia-questions.js';

function game(settings = {}, seed = 4, ctx = fakeCtx('Ana', settings)) {
  const g = new Trivia(ctx, seeded(seed));
  g.start();
  ctx.advance(TIMING.readyMs);
  return { ctx, g };
}

const rightChoice = (g) => g.questions[g.index].answer;

test('every question has a known category, three wrong answers and no repeats among its four', () => {
  for (const q of QUESTIONS) {
    assert.ok(CATEGORIES[q.c], q.q);
    assert.equal(q.w.length, 3, q.q);
    assert.equal(new Set([q.a, ...q.w]).size, 4, q.q);
  }
  assert.equal(new Set(QUESTIONS.map((q) => q.q)).size, QUESTIONS.length);
  for (const c of Object.keys(CATEGORIES)) assert.ok(QUESTIONS.filter((q) => q.c === c).length >= ROUND, c);
});

test('the answer never shows before it has been given', () => {
  const { g } = game();
  const v = g.hostView();
  assert.equal(v.phase, 'ask');
  assert.equal(v.question.options.length, 4);
  assert.equal(v.reveal, null);
  assert.equal('answer' in v.question, false);
  g.onInput({ type: 'answer', choice: rightChoice(g) });
  assert.equal(g.hostView().reveal.ok, true);
  assert.equal(typeof g.hostView().reveal.answer, 'number');
});

test('quick right answers score more; wrong ones and timeouts score nothing', () => {
  const { ctx, g } = game();
  g.onInput({ type: 'answer', choice: rightChoice(g) }); // straight away: full speed bonus
  assert.equal(g.points, POINTS.right + POINTS.speed);
  ctx.advance(TIMING.revealMs);
  ctx.advance(TIMING.questionMs / 2);
  g.onInput({ type: 'answer', choice: rightChoice(g) }); // half way: half the bonus
  assert.equal(g.points, 2 * POINTS.right + POINTS.speed + POINTS.speed / 2);
  ctx.advance(TIMING.revealMs);
  g.onInput({ type: 'answer', choice: (rightChoice(g) + 1) % 4 });
  assert.equal(g.last.ok, false);
  assert.equal(g.streak, 0);
  ctx.advance(TIMING.revealMs);
  const before = g.points;
  ctx.advance(TIMING.questionMs); // no answer
  assert.equal(g.phase, 'reveal');
  assert.equal(g.last.chose, null);
  assert.equal(g.points, before);
  assert.equal(g.wrong, 2);
});

test('the run ends after twelve questions, with the points as the score', () => {
  const { ctx, g } = game();
  for (let i = 0; i < ROUND; i++) {
    g.onInput({ type: 'answer', choice: rightChoice(g) });
    ctx.advance(TIMING.revealMs);
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.right, ROUND);
  assert.equal(v.score, ROUND * (POINTS.right + POINTS.speed));
  assert.equal(v.bestStreak, ROUND);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('a room sees new questions until it has seen them all', () => {
  const ctx = fakeCtx('Ana', { category: 'food' });
  const seen = new Set();
  const total = QUESTIONS.filter((q) => q.c === 'food').length;
  for (let run = 0; run < Math.floor(total / ROUND); run++) {
    const g = new Trivia(ctx, seeded(run + 1));
    g.start();
    for (const q of g.questions) {
      assert.equal(seen.has(q.text), false, 'repeated: ' + q.text);
      seen.add(q.text);
    }
  }
  // The next run starts a new lap and still has a full set.
  const g = new Trivia(ctx, seeded(99));
  g.start();
  assert.equal(g.questions.length, ROUND);
});

test('the daily challenge always gets the same questions for the same seed', () => {
  const a = fakeCtx('Ana');
  a.challenge = true;
  const b = fakeCtx('Bo');
  b.challenge = true;
  b.saved.seen = [0, 1, 2, 3, 4, 5];
  const ga = new Trivia(a, seeded(7));
  const gb = new Trivia(b, seeded(7));
  ga.start();
  gb.start();
  assert.deepEqual(ga.questions, gb.questions);
});

test('a category keeps its own scores; bad input is ignored', () => {
  const { g } = game({ category: 'sport' });
  assert.equal(g.hostView().variant, CATEGORIES.sport);
  assert.ok(g.questions.every((q) => q.category === CATEGORIES.sport));
  for (const input of [{ type: 'answer', choice: 4 }, { type: 'answer', choice: '1' }, { type: 'answer' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.phase, 'ask');
  assert.equal(new Trivia(fakeCtx('Ana', { category: 'toString' })).category, 'mix');
});
