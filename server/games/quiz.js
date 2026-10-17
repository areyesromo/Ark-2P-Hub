// Quiz Battle. PER_MATCH multiple-choice questions; both players answer on
// their phone or controller. A correct answer scores BASE points plus up to
// SPEED_BONUS more for answering fast. Answers stay secret (the TV only shows
// "locked in") until the reveal, which comes as soon as both have answered or
// time runs out. Most points after the last question wins.
//
// Answers are labelled A, B, X, Y like controller buttons, so phones and
// controllers use the same letters.

import { QUESTIONS } from './quiz-questions.js';

export const PER_MATCH = 10;
export const BASE = 500;
export const SPEED_BONUS = 500;
export const TIMING = { countdownMs: 3000, questionMs: 15000, revealMs: 4000 };
export const LABELS = ['A', 'B', 'X', 'Y'];

export class QuizBattle {
  constructor(ctx, rng = Math.random, bank = QUESTIONS) {
    this.ctx = ctx;
    this.rng = rng;
    this.bank = bank;
    this.used = new Set(); // asked in earlier matches with this pair: rematches don't repeat
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.winner = null;
    this.draw = false;
    this.index = -1;
    this.questions = this.pickQuestions();
    this.runPhase('countdown', TIMING.countdownMs, () => this.ask());
  }

  /** PER_MATCH questions not asked before (starting over once the bank runs dry), answers shuffled. */
  pickQuestions() {
    let pool = this.bank.map((_, i) => i).filter((i) => !this.used.has(i));
    if (pool.length < PER_MATCH) {
      this.used.clear();
      pool = this.bank.map((_, i) => i);
    }
    const picked = [];
    while (picked.length < Math.min(PER_MATCH, pool.length)) {
      const i = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      this.used.add(i);
      const src = this.bank[i];
      const order = [0, 1, 2, 3];
      for (let j = order.length - 1; j > 0; j--) {
        const k = Math.floor(this.rng() * (j + 1));
        [order[j], order[k]] = [order[k], order[j]];
      }
      picked.push({
        cat: src.cat,
        text: src.q,
        options: order.map((o) => src.a[o]),
        correct: order.indexOf(0),
      });
    }
    return picked;
  }

  /** Enter a timed phase, pushing a fresh view every second, then call onEnd. */
  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
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

  ask() {
    this.index++;
    this.picks = [null, null];
    this.answeredAt = [null, null];
    this.gained = [0, 0];
    this.runPhase('question', TIMING.questionMs, () => this.reveal());
  }

  reveal() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const q = this.questions[this.index];
    this.picks.forEach((p, slot) => {
      if (p !== q.correct) return;
      const left = Math.max(0, this.phaseEnds - this.answeredAt[slot]) / TIMING.questionMs;
      this.gained[slot] = BASE + Math.round(SPEED_BONUS * left);
      this.scores[slot] += this.gained[slot];
    });
    const last = this.index >= this.questions.length - 1;
    this.runPhase('reveal', TIMING.revealMs, () => (last ? this.finish() : this.ask()));
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
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'answer' || this.phase !== 'question') return;
    const choice = input.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3 || this.picks[slot] !== null) return;
    this.picks[slot] = choice;
    this.answeredAt[slot] = this.ctx.now();
    if (this.picks.every((p) => p !== null)) this.reveal(); // no need to wait for the clock
    else this.ctx.update();
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  current() {
    const q = this.questions[this.index];
    return q ? { cat: q.cat, text: q.text, options: q.options } : null;
  }

  hostView() {
    const revealing = this.phase === 'reveal';
    return {
      phase: this.phase,
      number: this.index + 1,
      total: this.questions.length,
      question: this.phase === 'countdown' ? null : this.current(),
      labels: LABELS,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      questionMs: TIMING.questionMs,
      answered: this.picks ? this.picks.map((p) => p !== null) : [false, false],
      // Secret until the reveal.
      picks: revealing ? this.picks : [null, null],
      correct: revealing ? this.questions[this.index].correct : null,
      gained: revealing ? this.gained : [0, 0],
      scores: this.scores,
      players: this.ctx.players,
      winner: this.winner,
      draw: this.draw,
    };
  }

  playerView(slot) {
    const revealing = this.phase === 'reveal';
    return {
      phase: this.phase,
      you: slot,
      number: this.index + 1,
      total: this.questions.length,
      question: this.phase === 'countdown' ? null : this.current(),
      labels: LABELS,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      questionMs: TIMING.questionMs,
      yourPick: this.picks ? this.picks[slot] : null,
      opponentAnswered: this.picks ? this.picks[1 - slot] !== null : false,
      opponentPick: revealing ? this.picks[1 - slot] : null,
      correct: revealing ? this.questions[this.index].correct : null,
      gained: revealing ? this.gained : [0, 0],
      scores: this.scores,
      winner: this.winner,
      draw: this.draw,
    };
  }
}

export default {
  id: 'quiz',
  music: 'thinking',
  name: 'Quiz Battle',
  tagline: '10 trivia questions. Answer on your phone or controller; right and fast scores more. Most points wins.',
  create: (ctx) => new QuizBattle(ctx),
};
