// Trivia, the 1 player mode of Quiz Battle (it was 1P's Trivia): twelve of Quiz Battle's questions,
// 15 seconds each (server/games/quiz.js, soloTrivia).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx, seeded } from './helpers-solo.js';
import { QuizBattle, soloTrivia, TRIVIA, TOPICS } from '../server/games/quiz.js';
import { QUESTIONS } from '../server/games/quiz-questions.js';
import { getGame, soloGameOf, listGames } from '../server/games/index.js';

function game(settings, seed = 4) {
  const ctx = fakeCtx('Ana', settings);
  const g = new QuizBattle(ctx, seeded(seed), QUESTIONS, { solo: true });
  g.start();
  ctx.advance(TRIVIA.readyMs);
  return { ctx, g };
}
const answer = (g) => g.questions[g.index].answer;

test('twelve questions; the answer stays secret until it has been given', () => {
  const { g } = game();
  const v = g.hostView();
  assert.equal(v.solo, true);
  assert.equal(v.phase, 'ask');
  assert.equal(v.of, TRIVIA.round);
  assert.equal(v.question.options.length, 4);
  assert.equal(JSON.stringify(g.playerView(0)).includes('"answer"'), false);
});

test('a right answer scores 100 plus up to 100 for speed; wrong or too slow scores nothing', () => {
  const { ctx, g } = game();
  g.onInput(0, { type: 'answer', choice: answer(g) });
  assert.equal(g.hostView().score, TRIVIA.right + TRIVIA.speed);
  assert.equal(g.hostView().reveal.ok, true);
  ctx.advance(TRIVIA.revealMs);
  g.onInput(0, { type: 'answer', choice: (answer(g) + 1) % 4 });
  assert.equal(g.hostView().score, TRIVIA.right + TRIVIA.speed);
  ctx.advance(TRIVIA.revealMs);
  ctx.advance(TRIVIA.questionMs); // no answer
  assert.equal(g.hostView().reveal.chose, null);
  assert.equal(g.right, 1);
  assert.equal(g.wrong, 2);
});

test('the run ends after twelve; play again; bad input and the other seat are ignored', () => {
  const { ctx, g } = game();
  for (const bad of [{ type: 'answer', choice: 4 }, { type: 'answer', choice: '1' }, { type: 'zap' }]) g.onInput(0, bad);
  g.onInput(1, { type: 'answer', choice: answer(g) });
  assert.equal(g.phase, 'ask');
  for (let i = 0; i < TRIVIA.round; i++) {
    g.onInput(0, { type: 'answer', choice: answer(g) });
    ctx.advance(TRIVIA.revealMs);
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.right, TRIVIA.round);
  assert.equal(ctx.pendingTimers(), 0);
  g.onInput(0, { type: 'rematch' });
  assert.equal(g.phase, 'ready');
});

test('a topic keeps to its questions and its own scores; no question twice until the bank runs out', () => {
  const { g } = game({ topic: 1 });
  assert.ok(g.questions.every((q) => q.category === TOPICS[0]));
  assert.equal(g.hostView().variant, TOPICS[0]);
  const ctx = fakeCtx('Ana');
  const a = new QuizBattle(ctx, seeded(1), QUESTIONS, { solo: true });
  a.start();
  const first = new Set(a.questions.map((q) => q.text));
  a.start();
  assert.ok(a.questions.every((q) => !first.has(q.text)));
});

test('one game in both lobbies: Quiz Battle and Trivia, under one id', () => {
  assert.equal(getGame('quiz').name, 'Quiz Battle');
  assert.equal(soloGameOf('quiz').name, 'Trivia');
  const ctx = Object.assign(fakeCtx(), { rng: seeded(2) });
  const run = soloTrivia.create(ctx);
  run.start();
  ctx.advance(TRIVIA.readyMs);
  run.onInput({ type: 'answer', choice: 0 });
  assert.equal(run.playerView().phase, 'reveal');
  assert.ok(!listGames().some((g) => g.id === 'trivia-1p'), 'Trivia 1P is gone');
});
