import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuizBattle, PER_MATCH, BASE, SPEED_BONUS, TIMING } from '../server/games/quiz.js';
import { QUESTIONS } from '../server/games/quiz-questions.js';
import { fakeCtx } from './helpers.js';

function setup(rng = Math.random) {
  const ctx = fakeCtx();
  const game = new QuizBattle(ctx, rng);
  game.start();
  return { ctx, game };
}

const toQuestion = (ctx) => ctx.advance(TIMING.countdownMs);
const correctOf = (game) => game.questions[game.index].correct;
const wrongOf = (game) => (correctOf(game) + 1) % 4;

test('every question in the bank is well formed and unique', () => {
  assert.ok(QUESTIONS.length >= 100, `only ${QUESTIONS.length} questions`);
  const texts = new Set();
  for (const q of QUESTIONS) {
    assert.ok(q.cat && q.q, JSON.stringify(q));
    assert.equal(q.a.length, 4, q.q);
    assert.equal(new Set(q.a).size, 4, `duplicate answers: ${q.q}`);
    assert.ok(!texts.has(q.q), `duplicate question: ${q.q}`);
    texts.add(q.q);
  }
});

test('a match picks PER_MATCH different questions with shuffled answers', () => {
  const { game } = setup();
  assert.equal(game.questions.length, PER_MATCH);
  assert.equal(new Set(game.questions.map((q) => q.text)).size, PER_MATCH);
  for (const q of game.questions) {
    const src = QUESTIONS.find((s) => s.q === q.text);
    assert.equal(q.options[q.correct], src.a[0], 'the correct index points at the right answer');
    assert.deepEqual([...q.options].sort(), [...src.a].sort());
  }
});

test('counts down (pushed every second), then asks question 1 with a ticking clock', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().question, null, 'no peeking during the countdown');
  const before = ctx.updates;
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2);
  assert.ok(ctx.updates > before);
  ctx.advance(TIMING.countdownMs - 1000);
  assert.equal(game.phase, 'question');
  assert.equal(game.hostView().number, 1);
  assert.equal(game.hostView().timeLeftMs, TIMING.questionMs);
  ctx.advance(1000);
  assert.equal(game.hostView().timeLeftMs, TIMING.questionMs - 1000);
});

test('answers are secret until the reveal; one answer each, locked', () => {
  const { ctx, game } = setup();
  toQuestion(ctx);
  game.onInput(0, { type: 'answer', choice: 2 });
  game.onInput(0, { type: 'answer', choice: 3 }); // can't change it
  assert.equal(game.picks[0], 2);
  const host = game.hostView();
  assert.deepEqual(host.answered, [true, false]);
  assert.deepEqual(host.picks, [null, null]);
  assert.equal(host.correct, null);
  const other = game.playerView(1);
  assert.equal(other.opponentAnswered, true);
  assert.equal(other.opponentPick, null);
  assert.equal(game.playerView(0).yourPick, 2);
});

test('the reveal comes as soon as both have answered; right and fast scores more', () => {
  const { ctx, game } = setup();
  toQuestion(ctx);
  game.onInput(0, { type: 'answer', choice: correctOf(game) }); // instantly: full bonus
  ctx.advance(TIMING.questionMs / 2);
  game.onInput(1, { type: 'answer', choice: correctOf(game) }); // halfway: half the bonus
  assert.equal(game.phase, 'reveal');
  assert.deepEqual(game.gained, [BASE + SPEED_BONUS, BASE + SPEED_BONUS / 2]);
  assert.deepEqual(game.scores, game.gained);
  const v = game.hostView();
  assert.equal(v.correct, correctOf(game));
  assert.deepEqual(v.picks, [correctOf(game), correctOf(game)]);
});

test('wrong or no answer scores nothing; time running out reveals', () => {
  const { ctx, game } = setup();
  toQuestion(ctx);
  game.onInput(0, { type: 'answer', choice: wrongOf(game) });
  ctx.advance(TIMING.questionMs);
  assert.equal(game.phase, 'reveal');
  assert.deepEqual(game.scores, [0, 0]);
  assert.deepEqual(game.hostView().picks, [wrongOf(game), null]);
  ctx.advance(TIMING.revealMs);
  assert.equal(game.phase, 'question');
  assert.equal(game.hostView().number, 2);
});

test('answers outside the question phase, or malformed, are ignored', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'answer', choice: 0 }); // countdown
  toQuestion(ctx);
  for (const bad of [4, -1, 1.5, '1', null]) game.onInput(0, { type: 'answer', choice: bad });
  game.onInput(0, { type: 'shout' });
  assert.deepEqual(game.picks, [null, null]);
});

test('after the last question the higher score wins; equal scores are a draw', () => {
  let { ctx, game } = setup();
  toQuestion(ctx);
  for (let i = 0; i < PER_MATCH; i++) {
    game.onInput(1, { type: 'answer', choice: correctOf(game) });
    game.onInput(0, { type: 'answer', choice: wrongOf(game) });
    ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.equal(game.draw, false);
  assert.equal(ctx.pendingTimers(), 0);

  ({ ctx, game } = setup());
  toQuestion(ctx);
  for (let i = 0; i < PER_MATCH; i++) {
    ctx.advance(TIMING.questionMs); // nobody answers
    ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, null);
  assert.equal(game.draw, true);
});

test("rematches don't repeat questions until the bank runs out", () => {
  const { ctx, game } = setup();
  const seen = new Set(game.questions.map((q) => q.text));
  const matches = Math.floor(QUESTIONS.length / PER_MATCH);
  for (let m = 1; m < matches; m++) {
    game.phase = 'over';
    game.onInput(0, { type: 'rematch' });
    for (const q of game.questions) {
      assert.ok(!seen.has(q.text), `repeated in match ${m + 1}: ${q.text}`);
      seen.add(q.text);
    }
  }
  game.phase = 'over';
  game.onInput(0, { type: 'rematch' }); // bank exhausted: starts over, still a full match
  assert.equal(game.questions.length, PER_MATCH);
  assert.equal(game.phase, 'countdown');
  assert.ok(ctx);
});
