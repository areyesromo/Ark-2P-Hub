// Fake Out: write a fake answer that sounds true, then find the real one among the fakes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { FakeOut, TIMING, POINTS, normal } from '../server/games/fake-out.js';
import { FAKE_OUT } from '../server/games/fake-out-questions.js';
import { getGame } from '../server/games/index.js';

const BANK = Array.from({ length: 20 }, (_, i) => ({ q: 'Fact ' + i + ' is ___.', a: 'truth ' + i, f: ['bank a' + i, 'bank b' + i, 'bank c' + i] }));

/** A match of `rounds`, every update building every view (as the room does). */
function match({ rounds = 4, rng = () => 0.5 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { rounds };
  let g = null;
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (g) [g.hostView(), g.playerView(0), g.playerView(1)];
    update();
  };
  g = new FakeOut(ctx, rng, BANK);
  g.start();
  ctx.advance(TIMING.countdownMs + 10);
  assert.equal(g.phase, 'write');
  return { ctx, g };
}

const truthIndex = (g) => g.options.findIndex((o) => o.kind === 'truth');
const optionOf = (g, slot) => g.options.findIndex((o) => o.authors.includes(slot));

/** Both write fakes (to the pick). */
function write(h, a = 'my lie', b = 'their lie') {
  h.g.onInput(0, { type: 'fake', text: a });
  h.g.onInput(1, { type: 'fake', text: b });
  assert.equal(h.g.phase, 'pick');
}

/** Play out the reveal to the next round (or the end). */
function finishReveal(h) {
  h.ctx.advance(h.g.phaseEnds - h.ctx.now() + 10);
}

test('the bank: every fact has a blank, a true answer and three different fakes, none the truth', () => {
  assert.ok(FAKE_OUT.length >= 60, String(FAKE_OUT.length));
  const seen = new Set();
  for (const e of FAKE_OUT) {
    assert.ok(e.q.includes('___'), e.q);
    assert.ok(!seen.has(e.q), 'no repeats: ' + e.q);
    seen.add(e.q);
    assert.equal(e.f.length, 3, e.q);
    const all = [e.a, ...e.f].map(normal);
    assert.equal(new Set(all).size, 4, 'answers all differ: ' + e.q);
    for (const s of [e.a, ...e.f]) assert.ok(s.length > 0 && s.length <= 40, s);
    // No fake that would count as the truth, nor two fakes that would count as each other.
    for (const f of e.f) assert.ok(!FakeOut.isTruth(f, e.a), f + ' vs ' + e.a);
    for (const f of e.f) for (const g of e.f) if (f !== g) assert.ok(!FakeOut.isTruth(f, g), f + ' vs ' + g);
    // "a ___" / "an ___": every answer has to read right after it, or the article gives it away.
    const vowel = (s) => /^[aeiou]/i.test(s);
    if (/\ban ___/.test(e.q)) for (const s of [e.a, ...e.f]) assert.ok(vowel(s), e.q + ': an ' + s);
    if (/\ba ___/.test(e.q)) for (const s of [e.a, ...e.f]) assert.ok(!vowel(s), e.q + ': a ' + s);
  }
});

test('write: the TV only shows who has written; each phone keeps its own fake and its own ready-made one', () => {
  const h = match();
  const v = h.g.hostView();
  assert.equal(v.question, BANK[h.g.question.index].q);
  h.g.onInput(0, { type: 'fake', text: '  a sneaky   lie ' });
  const tv = h.g.hostView();
  assert.deepEqual(tv.written, [true, false]);
  assert.ok(!JSON.stringify(tv).includes('sneaky'), 'not on the TV');
  assert.ok(!JSON.stringify(h.g.playerView(1)).includes('sneaky'), 'not on their phone');
  assert.equal(h.g.playerView(0).yourFake, 'a sneaky lie');
  // Ready-made fakes: one each, different, never the bank's own one, not shown to the other.
  const s0 = h.g.playerView(0).suggestion;
  const s1 = h.g.playerView(1).suggestion;
  assert.ok(s0 && s1 && s0 !== s1);
  assert.ok(!JSON.stringify(h.g.playerView(0)).includes(s1));
  assert.ok(!JSON.stringify(tv).includes(s0) && !JSON.stringify(tv).includes(s1));
  assert.notEqual(normal(h.g.house), normal(s0));
  assert.notEqual(normal(h.g.house), normal(s1));
});

test('telling a fake from the truth: digits, plurals, spacing and the truth inside a longer answer all count as the truth', () => {
  for (const [a, b] of [['three', '3'], ['five', 'Five!'], ['13 seconds', 'thirteen seconds'], ['fruit flies', 'fruit fly'], ['mosquitoes', 'mosquito'], ['bellies', 'belly'],
    ['BackRub', 'back rub'], ['coffee pot', 'coffeepot'], ['greedy landlords', 'landlords'], ['International Orange', 'orange'], ['a fart', 'a smelly fart'], ['pig', 'The PIGS'], ['Émeu', 'emeu']]) {
    assert.ok(FakeOut.isTruth(b, a), b + ' ~ ' + a);
  }
  for (const [a, b] of [['pig', 'pigeon'], ['moth', 'mammoth'], ['eye', 'eyelid'], ['three', 'thirty'], ['Émeu', 'meu'], ['sweetness', 'sugar']]) {
    assert.ok(!FakeOut.isTruth(b, a), b + ' is a fake for ' + a);
  }
});

test('a fake in other letters or emoji is fine; one with nothing in it is turned down with a word to that phone', () => {
  const h = match();
  h.g.onInput(0, { type: 'fake', text: '🐷🐷' });
  assert.equal(h.g.playerView(0).notice, 'empty');
  h.g.onInput(0, { type: 'fake', text: '日本の豚' });
  assert.equal(h.g.playerView(0).yourFake, '日本の豚');
  h.g.onInput(1, { type: 'fake', text: 'cerdo español' });
  assert.equal(h.g.phase, 'pick');
});

test('write: the real answer is turned down (that phone only is told), and you can try again', () => {
  const h = match();
  const truth = BANK[h.g.question.index].a;
  h.g.onInput(0, { type: 'fake', text: 'The ' + truth.toUpperCase() + '!' });
  assert.equal(h.g.playerView(0).yourFake, null);
  assert.equal(h.g.playerView(0).notice, 'truth');
  assert.equal(h.g.playerView(1).notice, null);
  assert.ok(!JSON.stringify(h.g.hostView()).includes('"truth"'), 'the TV is not told');
  const tries = h.g.playerView(0).tries;
  h.g.onInput(0, { type: 'fake', text: truth });
  assert.equal(h.g.playerView(0).tries, tries + 1, 'every refusal shows on the phone, even the same one twice');
  h.g.onInput(0, { type: 'fake', text: 'something else' });
  assert.equal(h.g.playerView(0).yourFake, 'something else');
  assert.equal(h.g.playerView(0).notice, null);
});

test('no free peeks: write the truth and you can\'t score for finding it that round', () => {
  const h = match({ rounds: 4 });
  h.g.onInput(0, { type: 'fake', text: BANK[h.g.question.index].a });
  write(h, 'my lie', 'their lie');
  assert.equal(h.g.playerView(0).peeked, true);
  h.g.onInput(0, { type: 'pick', option: truthIndex(h.g) });
  h.g.onInput(1, { type: 'pick', option: truthIndex(h.g) });
  assert.deepEqual(h.g.scores, [0, POINTS.truth]);
  finishReveal(h);
  write(h);
  assert.equal(h.g.playerView(0).peeked, false, 'next round, a clean slate');
});

test('write: stuck? use your ready-made fake; and if time runs out, it is used for you', () => {
  const h = match();
  const s0 = h.g.playerView(0).suggestion;
  h.g.onInput(0, { type: 'suggest' });
  assert.equal(h.g.playerView(0).yourFake, s0);
  h.ctx.advance(TIMING.writeMs);
  assert.equal(h.g.phase, 'pick');
  assert.equal(h.g.options.length, 4, 'truth, two fakes and the bank\'s');
  assert.equal(h.g.options[optionOf(h.g, 1)].text, h.g.suggestions[1]);
});

test('pick: four answers on the TV with no names; each phone hides its own fake', () => {
  const h = match();
  write(h);
  const tv = h.g.hostView();
  assert.equal(tv.options.length, 4);
  assert.deepEqual(tv.options.map((o) => Object.keys(o)), [['text'], ['text'], ['text'], ['text']]);
  assert.deepEqual(tv.options.map((o) => o.text).sort(), ['bank ' + h.g.house.slice(5), 'my lie', 'their lie', BANK[h.g.question.index].a].sort());
  const mine = h.g.playerView(0).options;
  assert.equal(mine.filter((o) => o.mine).length, 1);
  assert.equal(mine.find((o) => o.mine).text, 'my lie');
  assert.ok(!h.g.playerView(1).options.find((o) => o.mine && o.text === 'my lie'));
  // You can't pick your own.
  h.g.onInput(0, { type: 'pick', option: optionOf(h.g, 0) });
  assert.deepEqual(h.g.hostView().picked, [false, false]);
});

test('scoring: +1000 for the truth, +500 to the writer of a fake the other picks; the bank\'s fake scores nobody', () => {
  const h = match({ rounds: 4 });
  write(h);
  h.g.onInput(0, { type: 'pick', option: truthIndex(h.g) });
  h.g.onInput(1, { type: 'pick', option: optionOf(h.g, 0) }); // fooled by player 1's lie
  assert.equal(h.g.phase, 'reveal');
  assert.deepEqual(h.g.scores, [POINTS.truth + POINTS.fooled, 0]);
  finishReveal(h);
  write(h);
  const house = h.g.options.findIndex((o) => o.kind === 'house');
  h.g.onInput(0, { type: 'pick', option: house });
  h.g.onInput(1, { type: 'pick', option: house });
  assert.deepEqual(h.g.scores, [1500, 0], 'nobody scores for the bank\'s fake');
});

test('the scores move only when the reveal reaches the truth; the reveal shows each answer\'s writer and pickers in turn', () => {
  const h = match();
  write(h);
  h.g.onInput(0, { type: 'pick', option: optionOf(h.g, 1) });
  h.g.onInput(1, { type: 'pick', option: truthIndex(h.g) });
  const first = h.g.hostView();
  assert.deepEqual(first.scores, [0, 0], 'not yet');
  assert.equal(first.reveal.length, 4);
  assert.equal(h.g.options[h.g.order.at(-1)].kind, 'truth', 'the truth comes last');
  assert.equal(first.step, 0);
  // The cards stay where they were for the pick: their order gives nothing away.
  assert.deepEqual(first.reveal.map((r) => r.text), h.g.options.map((o) => o.text));
  assert.deepEqual(first.reveal.map((r) => r.at).sort(), [0, 1, 2, 3]);
  assert.equal(first.reveal.find((r) => r.at === 3).text, BANK[h.g.question.index].a, '(the truth is shown last)');
  assert.ok(first.reveal.every((r) => (r.at < first.step ? r.kind : r.kind === undefined)), 'unrevealed answers keep their secret');
  h.ctx.advance(TIMING.stepMs * 4);
  const all = h.g.hostView();
  assert.deepEqual(all.scores, [0, POINTS.truth + POINTS.fooled]);
  const lie = all.reveal.find((r) => r.text === 'their lie');
  assert.deepEqual([lie.kind, lie.authors, lie.pickedBy], ['fake', [1], [0]]);
});

test('the last round counts double', () => {
  const h = match({ rounds: 2 });
  write(h);
  h.g.onInput(0, { type: 'pick', option: truthIndex(h.g) });
  h.g.onInput(1, { type: 'pick', option: truthIndex(h.g) });
  finishReveal(h);
  assert.equal(h.g.hostView().last, true);
  write(h);
  h.g.onInput(0, { type: 'pick', option: truthIndex(h.g) });
  h.g.onInput(1, { type: 'pick', option: optionOf(h.g, 0) });
  assert.deepEqual(h.g.scores, [1000 + 2 * (POINTS.truth + POINTS.fooled), 1000]);
});

test('the same fake from both of you shows once, and neither phone shows it', () => {
  const h = match();
  write(h, 'Same Lie', 'same lie.');
  assert.equal(h.g.options.length, 3, 'truth, the shared fake, the bank\'s');
  const both = h.g.options.find((o) => o.kind === 'fake');
  assert.deepEqual(both.authors, [0, 1]);
  assert.equal(h.g.playerView(0).options.filter((o) => o.mine).length, 1);
  assert.equal(h.g.playerView(1).options.filter((o) => o.mine).length, 1);
});

test('a fake that matches the bank\'s own: the bank\'s drops out (no swap that one of you would recognise)', () => {
  const h = match();
  const house = h.g.house;
  const [s0, s1] = h.g.suggestions;
  write(h, house, 'their lie');
  assert.equal(h.g.options.length, 3, 'truth and your two fakes');
  assert.ok(!h.g.options.some((o) => o.kind === 'house'));
  assert.ok(!h.g.options.some((o) => o.text === s0 || o.text === s1), 'nobody\'s ready-made fake turns up');
});

test('no pick before the time runs out scores nothing; the match ends with a winner (or a draw)', () => {
  const h = match({ rounds: 1 });
  write(h);
  h.g.onInput(1, { type: 'pick', option: truthIndex(h.g) });
  h.ctx.advance(TIMING.pickMs + 10);
  assert.equal(h.g.phase, 'reveal');
  finishReveal(h);
  const v = h.g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.winner, 1);
  assert.deepEqual(v.scores, [0, 2 * POINTS.truth]);
  assert.equal(h.ctx.pendingTimers(), 0);

  const d = match({ rounds: 1 });
  write(d);
  d.ctx.advance(TIMING.pickMs + 10);
  finishReveal(d);
  assert.equal(d.g.hostView().winner, null);
  assert.equal(d.g.hostView().draw, true);
});

test('bad input is ignored', () => {
  const h = match();
  for (const text of ['', '   ', 42, null, undefined, 'x'.repeat(200)]) h.g.onInput(0, { type: 'fake', text });
  assert.equal(h.g.playerView(0).yourFake, null);
  h.g.onInput(0, { type: 'fake', text: 'first' });
  h.g.onInput(0, { type: 'fake', text: 'second' });
  assert.equal(h.g.playerView(0).yourFake, 'first', 'one fake a round');
  h.g.onInput(0, { type: 'pick', option: 0 }); // not the pick yet
  h.g.onInput(7, { type: 'fake', text: 'stray' });
  assert.equal(h.g.phase, 'write');
  h.g.onInput(1, { type: 'fake', text: 'theirs' });
  for (const option of [-1, 4, 1.5, '0', null]) h.g.onInput(1, { type: 'pick', option });
  assert.deepEqual(h.g.hostView().picked, [false, false]);
  h.g.onInput(1, { type: 'pick', option: truthIndex(h.g) });
  h.g.onInput(1, { type: 'pick', option: optionOf(h.g, 0) });
  assert.deepEqual(h.g.picks, [null, truthIndex(h.g)], 'one pick');
  h.g.onInput(0, { type: 'rematch' });
  assert.equal(h.g.phase, 'pick');
});

test('a long fake is cut to 40 characters, spaces tidied', () => {
  const h = match();
  h.g.onInput(0, { type: 'fake', text: '  a   very long fake answer that just keeps going on and on ' });
  const f = h.g.playerView(0).yourFake;
  assert.ok(f.length <= 40 && f.startsWith('a very long fake answer'), f);
});

test('a rematch starts over, without repeating the last match\'s facts', () => {
  const h = match({ rounds: 2 });
  const asked = [h.g.question.index];
  for (let r = 0; r < 2; r++) {
    write(h);
    h.ctx.advance(TIMING.pickMs + 10);
    finishReveal(h);
    if (r === 0) asked.push(h.g.question.index);
  }
  assert.equal(h.g.phase, 'over');
  h.g.onInput(0, { type: 'rematch' });
  assert.equal(h.g.phase, 'countdown');
  assert.deepEqual(h.g.scores, [0, 0]);
  h.ctx.advance(TIMING.countdownMs + 10);
  assert.ok(!asked.includes(h.g.question.index));
});

test('in the lobby: two phones only (typing your fake is secret), with 4, 6 or 8 rounds', () => {
  const def = getGame('fake-out');
  assert.equal(def.phoneOnly, true, 'greyed out with a controller seated');
  const setup = JSON.stringify(def.create(fakeCtx()).hostView());
  assert.ok(setup.includes('"rounds"'));
  assert.ok(setup.includes('6 rounds') && setup.includes('4 rounds') && setup.includes('8 rounds'));
});
