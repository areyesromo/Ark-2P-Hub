// Fake Out. A bluffing quiz for two phones. Each round the TV shows a strange-but-true fact with
// a blank; you both secretly write a fake answer that sounds true (stuck? each phone has one
// ready-made fake of its own). Then the TV lists four answers, shuffled: the truth, both fakes
// and one more fake from the bank, so it's never just "the truth or their lie". You each pick
// the one you think is real (your own fake isn't on your phone). Finding the truth scores 1000;
// your rival picking your fake scores you 500. The last round counts double. The reveal goes
// through the answers one by one (whose fake, who fell for it), the truth last.
//
// It needs two phones: a controller player would have to write their fake on the TV. Writing the
// truth by mistake is turned down (only your phone is told), and then finding it won't score
// that round: no checking your guess for free.

import { FAKE_OUT } from './fake-out-questions.js';
import { settingOf, usedIn } from './options.js';

export const ROUNDS = 6;
export const POINTS = { truth: 1000, fooled: 500 };
export const TIMING = { countdownMs: 3000, writeMs: 60000, pickMs: 20000, stepMs: 2000, scoresMs: 4000 };
export const MAX_LEN = 40;

const STOP = new Set(['a', 'an', 'the', 'of']);
const NUMBERS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const TENS = { thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 };

/** An answer's words for comparing: any alphabet, no accents, numbers as digits, plurals as singulars, no a / an / the. */
function words(s) {
  return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !STOP.has(w))
    .map((w) => {
      if (NUMBERS.includes(w)) return String(NUMBERS.indexOf(w));
      if (TENS[w]) return String(TENS[w]);
      if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
      if (w.length > 4 && w.endsWith('oes')) return w.slice(0, -2);
      if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
      return w;
    });
}

/** An answer, normalised (two fakes the same this way are one answer). Spaces don't count: "back rub" is "BackRub". */
export function normal(s) {
  return words(s).join('');
}

export class FakeOut {
  /**
   * Is this "fake" really the truth? The same answer written another way ("3" for "three",
   * "fruit fly" for "fruit flies", "back rub" for "BackRub"), or the truth inside it ("a smelly
   * fart") or it inside the truth ("landlords" for "greedy landlords").
   */
  static isTruth(text, truth) {
    const a = words(text);
    const b = words(truth);
    if (!a.length || !b.length) return false;
    if (a.join('') === b.join('')) return true;
    return b.every((w) => a.includes(w)) || a.every((w) => b.includes(w));
  }

  constructor(ctx, rng = Math.random, bank = FAKE_OUT) {
    this.ctx = ctx;
    this.rng = rng;
    this.bank = bank;
    this.rounds = settingOf(ctx, 'rounds', ROUNDS);
    // Asked in earlier matches in this room, so rematches don't repeat.
    this.used = usedIn(ctx, 'fake-out');
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.shown = [0, 0]; // the scores the screens show (they catch up when the truth is revealed)
    this.round = 0;
    this.winner = null;
    this.draw = false;
    this.question = null;
    this.runPhase('countdown', TIMING.countdownMs, () => this.nextRound());
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** A fact nobody in this room has had lately (starting over when the bank runs dry). */
  pickFact() {
    let pool = this.bank.map((_, i) => i).filter((i) => !this.used.has(i));
    if (!pool.length) {
      this.used.clear();
      pool = this.bank.map((_, i) => i);
    }
    const index = pool[Math.floor(this.rng() * pool.length)];
    this.used.add(index);
    return { index, q: this.bank[index].q, a: this.bank[index].a };
  }

  /** A timed phase, with a fresh view every second (for the clock), then onEnd. */
  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseStart = this.ctx.now();
    this.phaseEnds = this.phaseStart + ms;
    this.onPhaseEnd = onEnd;
    this.ctx.update();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  nextRound() {
    this.round++;
    this.question = this.pickFact();
    // The bank's three fakes: one goes on the list, the others are each player's ready-made one.
    const [house, s0, s1] = this.shuffle(this.bank[this.question.index].f.slice());
    this.house = house;
    this.suggestions = [s0, s1];
    this.fakes = [null, null];
    this.notice = [null, null];
    this.tries = [0, 0]; // turned-down fakes (each shows on the phone, even the same one twice)
    this.peeked = [false, false]; // wrote the truth: told so, but no points for finding it this round
    this.options = null;
    this.picks = [null, null];
    this.runPhase('write', TIMING.writeMs, () => this.toPick());
  }

  /** Both fakes in (a missing one is that player's ready-made fake): the answers to pick from. */
  toPick() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.fakes = this.fakes.map((f, slot) => f || this.suggestions[slot]);
    const options = [{ text: this.question.a, kind: 'truth', authors: [] }];
    this.fakes.forEach((text, slot) => {
      const same = options.find((o) => o.kind === 'fake' && normal(o.text) === normal(text));
      if (same) same.authors.push(slot); // you both wrote the same thing: one answer
      else options.push({ text, kind: 'fake', authors: [slot] });
    });
    // The bank's fake, unless one of you wrote it (no swapping in a spare: one of you would
    // know it, from being offered it as a ready-made fake).
    if (!options.some((o) => normal(o.text) === normal(this.house))) options.push({ text: this.house, kind: 'house', authors: [] });
    this.options = this.shuffle(options);
    this.picks = [null, null];
    this.runPhase('pick', TIMING.pickMs, () => this.toReveal());
  }

  get last() {
    return this.round === this.rounds;
  }

  /** Score the picks (shown when the reveal gets to the truth), then go through the answers. */
  toReveal() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    const times = this.last ? 2 : 1;
    this.gained = [0, 0];
    this.picks.forEach((p, slot) => {
      if (p === null) return;
      const o = this.options[p];
      if (o.kind === 'truth') this.gained[slot] += this.peeked[slot] ? 0 : POINTS.truth * times;
      else o.authors.filter((a) => a !== slot).forEach((a) => { this.gained[a] += POINTS.fooled * times; });
    });
    this.before = this.scores.slice();
    this.scores = this.scores.map((s, slot) => s + this.gained[slot]);
    // Fakes first (the bank's, then yours), the truth last.
    const rank = { house: 0, fake: 1, truth: 2 };
    this.order = this.options.map((_, i) => i).sort((a, b) => rank[this.options[a].kind] - rank[this.options[b].kind]);
    const ms = this.order.length * TIMING.stepMs + TIMING.scoresMs;
    this.runPhase('reveal', ms, () => (this.last ? this.finish() : this.nextRound()));
  }

  /** How many answers the reveal has shown so far. */
  get step() {
    return this.phase === 'reveal' ? Math.min(this.order.length, Math.floor((this.ctx.now() - this.phaseStart) / TIMING.stepMs)) : 0;
  }

  finish() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    const [a, b] = this.scores;
    this.draw = a === b;
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'write' && !this.fakes[slot]) {
      if (input.type === 'suggest') return this.setFake(slot, this.suggestions[slot]);
      if (input.type !== 'fake' || typeof input.text !== 'string' || input.text.length > MAX_LEN * 2) return;
      const text = input.text.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN).trim();
      if (!text) return;
      const refuse = !normal(text) ? 'empty' : FakeOut.isTruth(text, this.question.a) ? 'truth' : null;
      if (refuse) {
        // Only this phone is told. Writing the truth tells you the answer, so finding it won't score this round.
        this.notice[slot] = refuse;
        this.tries[slot]++;
        if (refuse === 'truth') this.peeked[slot] = true;
        return this.ctx.update();
      }
      return this.setFake(slot, text);
    }
    if (this.phase === 'pick' && input.type === 'pick' && this.picks[slot] === null) {
      const i = input.option;
      if (!Number.isInteger(i) || i < 0 || i >= this.options.length || this.options[i].authors.includes(slot)) return;
      this.picks[slot] = i;
      if (this.picks.every((p) => p !== null)) this.toReveal();
      else this.ctx.update();
    }
  }

  setFake(slot, text) {
    this.fakes[slot] = text;
    this.notice[slot] = null;
    if (this.fakes.every(Boolean)) this.toPick();
    else this.ctx.update();
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  /**
   * The reveal so far: the answers where they were for the pick (so their order gives nothing
   * away), each with its turn `at` in the reveal and its secrets only once that turn has come.
   */
  revealView() {
    if (this.phase !== 'reveal') return null;
    const step = this.step;
    return this.options.map((o, i) => {
      const at = this.order.indexOf(i);
      if (at >= step) return { text: o.text, at };
      return { text: o.text, at, kind: o.kind, authors: o.authors, pickedBy: [0, 1].filter((s) => this.picks[s] === i) };
    });
  }

  common() {
    const writing = this.phase === 'write';
    const done = this.phase === 'over' || (this.phase === 'reveal' && this.step >= this.order.length);
    return {
      phase: this.phase,
      round: this.round,
      rounds: this.rounds,
      last: this.last,
      question: this.question && this.phase !== 'countdown' ? this.question.q : null,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      phaseMs: this.phase === 'write' ? TIMING.writeMs : this.phase === 'pick' ? TIMING.pickMs : 0,
      written: writing ? this.fakes.map(Boolean) : [true, true],
      picked: this.phase === 'pick' ? this.picks.map((p) => p !== null) : [false, false],
      reveal: this.revealView(),
      step: this.step,
      gained: done && this.phase === 'reveal' ? this.gained : [0, 0],
      // The scores catch up when the reveal gets to the truth.
      scores: this.phase === 'reveal' && !done ? this.before : this.scores,
      winner: this.winner,
      draw: this.draw,
    };
  }

  hostView() {
    return Object.assign(this.common(), {
      // The answers to pick from, with no names on them.
      options: this.phase === 'pick' ? this.options.map((o) => ({ text: o.text })) : null,
      players: this.ctx.players,
    });
  }

  playerView(slot) {
    return Object.assign(this.common(), {
      you: slot,
      yourFake: this.phase === 'write' || this.phase === 'pick' || this.phase === 'reveal' ? this.fakes && this.fakes[slot] : null,
      suggestion: this.phase === 'write' ? this.suggestions[slot] : null,
      notice: this.phase === 'write' ? this.notice[slot] : null,
      tries: this.tries ? this.tries[slot] : 0,
      peeked: Boolean(this.peeked && this.peeked[slot]),
      // Your own fake is marked (the phone leaves it off); the others are what you pick from.
      options: this.phase === 'pick' ? this.options.map((o, i) => ({ text: o.text, i, mine: o.authors.includes(slot) })) : null,
      yourPick: this.phase === 'pick' || this.phase === 'reveal' ? this.picks[slot] : null,
    });
  }
}

export default {
  id: 'fake-out',
  music: 'thinking',
  name: 'Fake Out',
  phoneOnly: true, // you each write a secret fake answer on your phone
  tagline: 'Bluffing quiz: write a fake answer to a strange-but-true fact, then spot the real one among the fakes. Find the truth for 1000, fool your rival for 500.',
  create: (ctx) => new FakeOut(ctx),
};
