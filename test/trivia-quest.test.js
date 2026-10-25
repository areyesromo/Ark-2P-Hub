// Trivia Quest: two players against three monsters, answering quiz questions together.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { TriviaQuest, MONSTERS, DAMAGE, TIMING, starsFor } from '../server/games/trivia-quest.js';
import { getGame } from '../server/games/index.js';

// A small bank: the right answer is always a[0] (the game shuffles it).
const BANK = Array.from({ length: 60 }, (_, i) => ({ cat: i % 2 ? 'Science' : 'History', q: 'Question ' + i + '?', a: ['right ' + i, 'wrong a' + i, 'wrong b' + i, 'wrong c' + i] }));

/** A quest with `hearts`, every update building every view (as the room does). */
function quest({ hearts = 5, rng = () => 0.5 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { hearts, topic: 0 };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new TriviaQuest(ctx, rng, BANK);
  g.start();
  return { ctx, g };
}

/** On to the next question (past a beaten monster and the next one's entrance). */
function toQuestion(h) {
  for (let i = 0; i < 3 && h.g.phase !== 'question'; i++) h.ctx.advance((h.g.phase === 'defeated' ? TIMING.defeatedMs : TIMING.introMs) + 10);
  assert.equal(h.g.phase, 'question');
}

/** Run the clock to `ms` before the question's time is up. */
function toLast(h, ms) {
  h.ctx.advance(h.g.phaseEnds - h.ctx.now() - ms);
}

const right = (g) => g.questions[g.index].correct;
const wrong = (g) => (right(g) + 1) % 4;

/** Both answer at once: true = right, false = wrong, null = no answer (the clock runs out). */
function answer(h, a, b) {
  toQuestion(h);
  [a, b].forEach((ok, slot) => {
    if (ok !== null) h.g.onInput(slot, { type: 'answer', choice: ok ? right(h.g) : wrong(h.g) });
  });
  if (h.g.phase === 'question') h.ctx.advance(h.g.questionMs + 10);
  assert.equal(h.g.phase, 'reveal');
  const v = h.g.hostView();
  h.ctx.advance(TIMING.revealMs + 10);
  return v;
}

test('three monsters, each tougher; the Dragon gives you less time', () => {
  assert.deepEqual(MONSTERS.map((m) => m.name), ['Goo Blob', 'Stone Golem', 'Dragon']);
  assert.ok(MONSTERS[0].hp < MONSTERS[1].hp && MONSTERS[1].hp < MONSTERS[2].hp);
  assert.ok(MONSTERS[2].questionMs < MONSTERS[0].questionMs);
  assert.equal(MONSTERS[0].questionMs, 15000);
  assert.equal(MONSTERS[2].questionMs, 12000);
});

test('a quest opens on the first monster, full health and hearts, then asks a question', () => {
  const h = quest({ hearts: 5 });
  const v = h.g.hostView();
  assert.equal(v.phase, 'intro');
  assert.equal(v.monster.name, 'Goo Blob');
  assert.equal(v.monster.hp, MONSTERS[0].hp);
  assert.deepEqual([v.hearts, v.maxHearts], [5, 5]);
  assert.deepEqual([v.stars, v.maxStars], [0, 9]);
  assert.equal(v.question, null, 'no question during the entrance');
  toQuestion(h);
  const q = h.g.hostView().question;
  assert.equal(q.options.length, 4);
  assert.equal(h.g.hostView().correct, null, 'the answer stays secret');
});

test('answers stay secret until the reveal (from the TV and from each other)', () => {
  const h = quest();
  toQuestion(h);
  h.g.onInput(0, { type: 'answer', choice: 2 });
  const tv = h.g.hostView();
  assert.deepEqual(tv.answered, [true, false]);
  assert.deepEqual(tv.picks, [null, null]);
  const them = h.g.playerView(1);
  assert.equal(them.theirPick, null);
  assert.equal(them.theyAnswered, true);
  assert.equal(h.g.playerView(0).yourPick, 2);
  h.g.onInput(1, { type: 'answer', choice: 1 });
  assert.equal(h.g.phase, 'reveal', 'both in: no waiting for the clock');
  assert.deepEqual(h.g.hostView().picks, [2, 1]);
  assert.equal(h.g.playerView(1).theirPick, 2);
  assert.equal(h.g.hostView().correct, right(h.g));
});

test('a right answer hits the monster, harder the faster it came; both right is a team strike', () => {
  const h = quest();
  toQuestion(h);
  // Both right straight away: full damage each, times the team bonus.
  const v = answer(h, true, true);
  const full = DAMAGE.base + DAMAGE.speed;
  assert.deepEqual(v.hits, [full, full]);
  assert.equal(v.teamStrike, true);
  assert.equal(v.damage, Math.round(full * 2 * DAMAGE.team));
  assert.equal(v.monster.hp, MONSTERS[0].hp - v.damage);
  assert.equal(v.heartsLost, 0);

  // One right at the very last moment, one wrong: a small hit and a lost heart.
  toQuestion(h);
  h.g.onInput(1, { type: 'answer', choice: wrong(h.g) });
  toLast(h, 5);
  h.g.onInput(0, { type: 'answer', choice: right(h.g) });
  const w = h.g.hostView();
  assert.equal(w.phase, 'reveal');
  assert.equal(w.teamStrike, false);
  assert.ok(w.hits[0] >= DAMAGE.base && w.hits[0] <= DAMAGE.base + 1, String(w.hits[0]));
  assert.equal(w.hits[1], 0);
  assert.equal(w.damage, w.hits[0]);
  assert.equal(w.heartsLost, 1);
  assert.equal(w.hearts, 4);
});

test('every wrong or missing answer costs the team a heart', () => {
  const h = quest({ hearts: 5 });
  assert.equal(answer(h, false, false).hearts, 3);
  assert.equal(answer(h, null, true).hearts, 2);
  const v = answer(h, null, null);
  assert.equal(v.hearts, 0);
  assert.equal(v.heartsLost, 2);
});

test('out of hearts: the quest is over, with the stars earned so far', () => {
  const h = quest({ hearts: 3 });
  answer(h, false, false);
  answer(h, false, true);
  assert.equal(h.g.phase, 'over');
  const v = h.g.hostView();
  assert.equal(v.won, false);
  assert.equal(v.stars, 0);
  assert.equal(v.maxStars, 9);
  assert.equal(v.hearts, 0);
});

test('beat a monster: stars by the hearts lost against it, then the next one comes on', () => {
  assert.deepEqual([0, 1, 2, 5].map(starsFor), [3, 2, 1, 1]);
  const h = quest({ hearts: 7 });
  answer(h, true, false); // one heart lost against the Blob
  while (h.g.monsterIndex === 0 && h.g.phase !== 'defeated') answer(h, true, true);
  assert.equal(h.g.phase, 'defeated');
  const v = h.g.hostView();
  assert.equal(v.monster.hp, 0);
  assert.equal(v.stars, 2);
  assert.deepEqual(v.beaten, [2]);
  h.ctx.advance(TIMING.defeatedMs + 10);
  assert.equal(h.g.phase, 'intro');
  assert.equal(h.g.hostView().monster.name, 'Stone Golem');
  assert.equal(h.g.hostView().monster.hp, MONSTERS[1].hp);
});

test('beat all three without losing a heart: the quest is won with 9 stars', () => {
  const h = quest();
  let guard = 0;
  while (h.g.phase !== 'over' && guard++ < 100) {
    if (h.g.phase === 'defeated') h.ctx.advance(TIMING.defeatedMs + 10);
    else answer(h, true, true);
  }
  const v = h.g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.won, true);
  assert.deepEqual(v.beaten, [3, 3, 3]);
  assert.deepEqual([v.stars, v.maxStars], [9, 9]);
  assert.equal(h.ctx.pendingTimers(), 0, 'nothing left running');
});

test('the Dragon\'s questions run on its shorter clock', () => {
  const h = quest();
  let guard = 0;
  while (h.g.monsterIndex < 2 && guard++ < 100) {
    if (h.g.phase === 'defeated') h.ctx.advance(TIMING.defeatedMs + 10);
    else answer(h, true, true);
  }
  toQuestion(h);
  assert.equal(h.g.hostView().questionMs, 12000);
  assert.equal(h.g.phaseEnds - h.g.questionStart, 12000);
  toLast(h, 10);
  assert.equal(h.g.phase, 'question');
  h.ctx.advance(20);
  assert.equal(h.g.phase, 'reveal');
});

test('💡 50/50: two wrong answers gone from your own phone, once per quest', () => {
  const h = quest();
  toQuestion(h);
  h.g.onInput(0, { type: 'fifty' });
  const mine = h.g.playerView(0);
  assert.equal(mine.removed.length, 2);
  assert.ok(!mine.removed.includes(right(h.g)), 'never the right answer');
  assert.equal(mine.fiftyLeft, false);
  assert.deepEqual(h.g.playerView(1).removed, [], 'the other phone keeps all four');
  assert.equal(h.g.playerView(1).fiftyLeft, true);
  assert.deepEqual(h.g.hostView().fiftyUsed, [true, false]);
  assert.deepEqual(h.g.hostView().removedOnTv, [[], []], 'the TV does not show which');
  // A removed answer can't be picked.
  h.g.onInput(0, { type: 'answer', choice: mine.removed[0] });
  assert.equal(h.g.playerView(0).yourPick, null);
  // Used up for the quest: the next question, no second go.
  h.g.onInput(0, { type: 'answer', choice: right(h.g) });
  h.g.onInput(1, { type: 'answer', choice: right(h.g) });
  h.ctx.advance(TIMING.revealMs + 10);
  toQuestion(h);
  assert.deepEqual(h.g.playerView(0).removed, []);
  h.g.onInput(0, { type: 'fifty' });
  assert.deepEqual(h.g.playerView(0).removed, []);
  // Not after answering either.
  h.g.onInput(1, { type: 'answer', choice: wrong(h.g) });
  h.g.onInput(1, { type: 'fifty' });
  assert.deepEqual(h.g.playerView(1).removed, []);
  assert.equal(h.g.playerView(1).fiftyLeft, true);
});

test('💡 50/50 for a controller player (no phone): the TV strikes out their two answers', () => {
  const h = quest();
  h.ctx.players[1].local = true;
  toQuestion(h);
  h.g.onInput(1, { type: 'fifty' });
  h.g.onInput(0, { type: 'fifty' });
  const tv = h.g.hostView();
  assert.deepEqual(tv.removedOnTv[1], h.g.playerView(1).removed);
  assert.equal(tv.removedOnTv[1].length, 2);
  assert.deepEqual(tv.removedOnTv[0], [], 'a phone player\'s stay on their phone');
});

test('bad input is ignored: out-of-range or non-number answers, a second answer, answers outside a question', () => {
  const h = quest();
  h.g.onInput(0, { type: 'answer', choice: 1 }); // during the entrance
  assert.equal(h.g.phase, 'intro');
  toQuestion(h);
  for (const choice of [-1, 4, 1.5, '1', null, undefined]) h.g.onInput(0, { type: 'answer', choice });
  assert.equal(h.g.playerView(0).yourPick, null);
  h.g.onInput(0, { type: 'answer', choice: 1 });
  h.g.onInput(0, { type: 'answer', choice: 2 });
  assert.equal(h.g.playerView(0).yourPick, 1);
  h.g.onInput(0, { type: 'rematch' }); // not over yet
  assert.equal(h.g.phase, 'question');
  // Only slots 0 and 1: a stray slot neither answers nor ends the wait.
  h.g.onInput(5, { type: 'answer', choice: 1 });
  h.g.onInput(-1, { type: 'answer', choice: 1 });
  assert.equal(h.g.phase, 'question');
  assert.deepEqual(h.g.hostView().answered, [true, false]);
});

test('the monster falls on the same reveal as your last heart: it counts, and the quest ends lost', () => {
  const h = quest({ hearts: 3 });
  answer(h, true, false);
  answer(h, true, false); // 1 heart left
  toQuestion(h);
  h.g.hp = 5; // one more hit will do it
  h.g.onInput(0, { type: 'answer', choice: right(h.g) });
  h.g.onInput(1, { type: 'answer', choice: wrong(h.g) });
  const v = h.g.hostView();
  assert.deepEqual([v.monster.hp, v.hearts], [0, 0]);
  h.ctx.advance(TIMING.revealMs + 10);
  assert.equal(h.g.phase, 'defeated');
  h.ctx.advance(TIMING.defeatedMs + 10);
  const end = h.g.hostView();
  assert.equal(end.phase, 'over');
  assert.equal(end.won, false);
  assert.deepEqual(end.beaten, [1], 'three hearts lost against it: one star');
  assert.equal(end.stars, 1);
  assert.equal(h.ctx.pendingTimers(), 0);
});

test('the Dragon falls on the same reveal as your last heart: the quest is still won', () => {
  const h = quest({ hearts: 3 });
  h.g.monsterIndex = 2;
  h.g.meet();
  answer(h, true, false);
  answer(h, true, false);
  toQuestion(h);
  h.g.hp = 5;
  h.g.onInput(0, { type: 'answer', choice: right(h.g) });
  h.g.onInput(1, { type: 'answer', choice: wrong(h.g) });
  h.ctx.advance(TIMING.revealMs + 10);
  h.ctx.advance(TIMING.defeatedMs + 10);
  const end = h.g.hostView();
  assert.equal(end.phase, 'over');
  assert.equal(end.won, true);
  assert.equal(end.hearts, 0);
});

test('a quest ends once: the room sees "over" a single time, with nothing left running', () => {
  const h = quest({ hearts: 3 });
  const overs = [];
  const update = h.ctx.update;
  h.ctx.update = () => {
    update();
    const v = h.g.hostView();
    if (v.phase === 'over') overs.push([v.won, v.stars]);
  };
  answer(h, false, false);
  answer(h, false, false);
  h.ctx.advance(60000);
  assert.deepEqual(overs, [[false, 0]]);
  assert.equal(h.ctx.pendingTimers(), 0);
});

test('a rematch starts a fresh quest without repeating the last one\'s questions', () => {
  const h = quest({ hearts: 3 });
  const asked = new Set();
  const note = () => asked.add(h.g.hostView().question.text);
  // A beaten Blob (stars), a 50/50 used, the Golem hurt; then out of hearts.
  toQuestion(h);
  note();
  h.g.onInput(0, { type: 'fifty' });
  answer(h, true, true);
  toQuestion(h);
  note();
  answer(h, true, true);
  toQuestion(h);
  note();
  answer(h, true, false);
  toQuestion(h);
  note();
  answer(h, false, false);
  assert.equal(h.g.phase, 'over');
  assert.ok(h.g.hostView().stars > 0 && h.g.monsterIndex === 1);
  h.g.onInput(1, { type: 'rematch' });
  const v = h.g.hostView();
  assert.equal(v.phase, 'intro');
  assert.deepEqual([v.hearts, v.stars, v.monster.hp], [3, 0, MONSTERS[0].hp]);
  assert.deepEqual(h.g.playerView(0).fiftyLeft, true);
  for (let i = 0; i < 3; i++) {
    toQuestion(h);
    assert.ok(!asked.has(h.g.hostView().question.text), 'a new question');
    answer(h, true, true);
  }
});

test('in the lobby: a co-op game with a topic and difficulty to pick', () => {
  const def = getGame('trivia-quest');
  assert.equal(def.category, 'casual');
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"hearts"') && setup.includes('"topic"'));
  assert.ok(setup.includes('Normal') && setup.includes('Easy') && setup.includes('Hard'));
});
