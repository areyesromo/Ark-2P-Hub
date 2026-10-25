// Fake Out. A bluffing quiz for two phones. Each round the TV shows a strange-but-true fact with
// a blank; you both secretly write a fake answer that sounds true (stuck? each phone has one
// ready-made fake of its own). Then the TV lists four answers, shuffled: the truth, both fakes
// and one more fake from the bank, so it's never just "the truth or their lie". You each pick
// the one you think is real (your own fake isn't on your phone). Finding the truth scores 1000;
// your rival picking your fake scores you 500. The last round counts double. The reveal goes
// through the answers one by one (whose fake, who fell for it), the truth last.
//
// It needs two phones: a controller player would have to write their fake on the TV.

import { FAKE_OUT } from './fake-out-questions.js';
import { settingOf, usedIn } from './options.js';

export const ROUNDS = 6;
export const POINTS = { truth: 1000, fooled: 500 };
export const TIMING = { countdownMs: 3000, writeMs: 60000, pickMs: 20000, stepMs: 2000, scoresMs: 4000 };
export const MAX_LEN = 40;

/** An answer for comparing: lower case, letters and digits only, no leading a / an / the, no plural s. */
export function normal(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(a|an|the) /, '').replace(/s$/, '');
}

export class FakeOut {
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
    // The bank's fake, unless one of you wrote it: then another the bank has spare.
    const taken = new Set(options.map((o) => normal(o.text)));
    const house = [this.house, ...this.suggestions].find((t) => !taken.has(normal(t)));
    if (house) options.push({ text: house, kind: 'house', authors: [] });
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
      if (o.kind === 'truth') this.gained[slot] += POINTS.truth * times;
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
      if (!normal(text)) return;
      if (normal(text) === normal(this.question.a)) {
        this.notice[slot] = 'truth'; // that's the real answer: only this phone is told
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

  /** The reveal so far: every answer in order, with its secrets only once it's been shown. */
  revealView() {
    if (this.phase !== 'reveal') return null;
    const step = this.step;
    return this.order.map((i, n) => {
      const o = this.options[i];
      if (n >= step) return { text: o.text };
      return { text: o.text, kind: o.kind, authors: o.authors, pickedBy: [0, 1].filter((s) => this.picks[s] === i) };
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
  needsPhone: true, // you each write a secret fake answer on your phone
  tagline: 'Bluffing quiz: write a fake answer to a strange-but-true fact, then spot the real one among the fakes. Find the truth for 1000, fool your rival for 500.',
  create: (ctx) => new FakeOut(ctx),
};
