import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WhoIsIt, TIMING, FACES, QUESTIONS, questionById } from '../server/games/who-is-it.js';
import { whoIsItBot, WIN } from '../server/games/who-is-it-bot.js';
import { fakeCtx } from './helpers.js';
import { seeded, play } from './helpers-bots.js';

function setup(settings = {}) {
  const ctx = fakeCtx();
  ctx.settings = settings;
  const g = new WhoIsIt(ctx, seeded(2));
  g.start();
  return { ctx, g };
}

test('the faces are all different, and every question splits them', () => {
  const keys = new Set(FACES.map((f) => QUESTIONS.map((q) => (q.test(f) ? 1 : 0)).join('')));
  assert.equal(keys.size, FACES.length, 'the questions can tell every face apart');
  for (const q of QUESTIONS) {
    const yes = FACES.filter(q.test).length;
    assert.ok(yes > 0 && yes < FACES.length, q.id);
  }
});

test('your face stays secret; answers are true and rule faces out; input is checked', () => {
  const { g } = setup();
  const s = g.turn;
  assert.equal(g.playerView(s).secret[1 - s], null);
  assert.equal(g.hostView().secret[0], null);
  assert.notEqual(g.playerView(s).secret[s], null);
  g.onInput(1 - s, { type: 'ask', q: 'hat' }); // not their turn
  g.onInput(s, { type: 'ask', q: 'tail' });
  assert.equal(g.n, 0);
  g.onInput(s, { type: 'ask', q: 'glasses' });
  const theirs = FACES[g.secret[1 - s]];
  assert.equal(g.log[0].yes, !!theirs.glasses);
  assert.ok(g.left[s].every((i) => !!FACES[i].glasses === !!theirs.glasses));
  assert.ok(g.left[s].includes(g.secret[1 - s]));
  g.onInput(1 - s, { type: 'ask', q: 'hat' });
  g.onInput(s, { type: 'ask', q: 'glasses' }); // asked already
  assert.equal(g.turn, s);
});

test('a right guess wins the round, a wrong one loses it; out of time passes', () => {
  const { ctx, g } = setup({ wins: 2 });
  const s = g.turn;
  ctx.advance(TIMING.turnMs);
  assert.equal(g.turn, 1 - s);
  g.onInput(1 - s, { type: 'guess', face: g.secret[s] });
  assert.equal(g.result.winner, 1 - s);
  ctx.advance(TIMING.roundEndMs);
  const t = g.turn;
  g.onInput(t, { type: 'guess', face: (g.secret[1 - t] + 1) % FACES.length });
  assert.equal(g.phase, t === 1 - s ? 'roundEnd' : 'over');
});

test('the race table, the computer\'s questions, and Easy beats a player who leaves it to the clock', () => {
  assert.equal(WIN[1][5], 1);
  assert.equal(WIN[2][1], 0.5, 'two left and they know yours: guess');
  assert.ok(WIN[24][24] > 0.5, 'going first is an edge');
  const { g } = setup();
  const v = g.playerView(g.turn);
  const move = whoIsItBot(v, 'normal', seeded(1));
  const yes = FACES.filter(questionById(move.q).test).length;
  assert.ok(yes >= 8 && yes <= 16, 'a question that splits the board well');
  for (let seed = 1; seed <= 3; seed++) {
    const cpu = seed % 2;
    assert.equal(play('who-is-it', cpu ? [null, 'easy'] : ['easy', null], { seed, limitMs: 3600 * 1000 }).view.winner, cpu);
  }
});
