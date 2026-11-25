// Quiz Battle. PER_MATCH multiple-choice questions; both players answer on
// their phone or controller. A correct answer scores BASE points plus up to
// SPEED_BONUS more for answering fast. Answers stay secret (the TV only shows
// "locked in") until the reveal, which comes as soon as both have answered or
// time runs out. Most points after the last question wins.
//
// Answers are labelled A, B, X, Y like controller buttons, so phones and
// controllers use the same letters.
//
// In the 1 player lobby it's Trivia (soloTrivia below): twelve of the same questions, 15 seconds each.
// A right answer scores 100 plus up to 100 more the faster you are; a wrong one, or running out of
// time, scores nothing. Questions don't come round again in the room until you've seen them all.
// Score: points, per topic.

import { QUESTIONS } from './quiz-questions.js';
import { settingOf, usedIn } from './options.js';

export const PER_MATCH = 10;
/** The question bank's categories, in order: the Topic setting picks one (0 is "Mixed"). */
export const TOPICS = [...new Set(QUESTIONS.map((q) => q.cat))];
export const BASE = 500;
export const SPEED_BONUS = 500;
export const TIMING = { countdownMs: 3000, questionMs: 15000, revealMs: 4000 };
export const LABELS = ['A', 'B', 'X', 'Y'];
/** 1 player: the questions in a run, the timings, and the points (a right answer, and the most for speed). */
export const TRIVIA = { round: 12, readyMs: 1500, questionMs: 15000, revealMs: 2200, tickMs: 250, right: 100, speed: 100 };

export class QuizBattle {
  /** solo: the 1 player mode, Trivia (see the top of this file). */
  constructor(ctx, rng = Math.random, bank = QUESTIONS, { solo = false } = {}) {
    this.ctx = ctx;
    this.solo = solo;
    this.topic = TOPICS[settingOf(ctx, 'topic', 0) - 1] || null;
    this.perMatch = settingOf(ctx, 'questions', PER_MATCH);
    const topic = TOPICS[settingOf(ctx, 'topic', 0) - 1];
    this.rng = rng;
    this.bank = topic && bank.some((q) => q.cat === topic) ? bank.filter((q) => q.cat === topic) : bank;
    // Asked in earlier matches in this room, so rematches (and the next visit) don't repeat.
    this.used = usedIn(ctx, 'quiz:' + (topic || 'all'));
    this.timer = null;
  }

  start() {
    if (this.solo) return this.startTrivia();
    this.scores = [0, 0];
    this.winner = null;
    this.draw = false;
    this.index = -1;
    this.questions = this.pickQuestions();
    this.runPhase('countdown', TIMING.countdownMs, () => this.ask());
  }

  /** The match's questions (this.perMatch of them), none asked before (starting over once the bank runs dry), answers shuffled. */
  pickQuestions() {
    let pool = this.bank.map((_, i) => i).filter((i) => !this.used.has(i));
    if (pool.length < this.perMatch) {
      this.used.clear();
      pool = this.bank.map((_, i) => i);
    }
    const picked = [];
    while (picked.length < Math.min(this.perMatch, pool.length)) {
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

  // ---- 1 player: Trivia --------------------------------------------------------------

  /** A run's questions, none asked in this room before until they've all been (the daily challenge ignores that, so everyone gets the same). */
  triviaQuestions() {
    const used = this.ctx.challenge ? new Set() : this.used;
    let pool = this.bank.map((_, i) => i).filter((i) => !used.has(i));
    if (pool.length < TRIVIA.round) {
      used.clear();
      pool = this.bank.map((_, i) => i);
    }
    const out = [];
    while (out.length < Math.min(TRIVIA.round, pool.length)) {
      const i = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      used.add(i);
      const src = this.bank[i];
      const order = [0, 1, 2, 3];
      for (let j = order.length - 1; j > 0; j--) {
        const k = Math.floor(this.rng() * (j + 1));
        [order[j], order[k]] = [order[k], order[j]];
      }
      out.push({ text: src.q, category: src.cat, options: order.map((o) => src.a[o]), answer: order.indexOf(0) });
    }
    return out;
  }

  startTrivia() {
    this.cancelTimer();
    this.questions = this.triviaQuestions();
    this.index = -1;
    this.points = 0;
    this.right = 0;
    this.wrong = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.fastest = null; // the quickest right answer, in ms
    this.last = null;
    this.phase = 'ready';
    this.later(() => this.nextQuestion(), TRIVIA.readyMs);
    this.ctx.update();
  }

  later(fn, ms) {
    this.cancelTimer();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; fn(); }, ms);
  }

  cancelTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  nextQuestion() {
    this.index++;
    if (this.index >= this.questions.length) {
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'ask';
    this.askedAt = this.ctx.now();
    this.triviaTick();
  }

  get triviaLeft() {
    return Math.max(0, this.askedAt + TRIVIA.questionMs - this.ctx.now());
  }

  /** Keep the clock moving on screen; out of time counts as wrong. */
  triviaTick() {
    if (!this.triviaLeft) return this.triviaAnswer(null);
    this.ctx.update();
    this.later(() => this.triviaTick(), Math.min(TRIVIA.tickMs, this.triviaLeft));
  }

  triviaAnswer(choice) {
    const q = this.questions[this.index];
    const ok = choice === q.answer;
    let got = 0;
    if (ok) {
      const took = this.ctx.now() - this.askedAt;
      got = TRIVIA.right + Math.round((TRIVIA.speed * this.triviaLeft) / TRIVIA.questionMs);
      this.right++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.fastest = this.fastest === null ? took : Math.min(this.fastest, took);
    } else {
      this.wrong++;
      this.streak = 0;
    }
    this.points += got;
    this.last = { ok, answer: q.answer, chose: choice, points: got, n: this.index + 1 };
    this.phase = 'reveal';
    this.ctx.update();
    this.later(() => this.nextQuestion(), TRIVIA.revealMs);
  }

  /** The 1 player view: the question (its answer only once given, in `last`), the clock and the run so far. */
  triviaView() {
    const q = this.questions[this.index];
    const showing = (this.phase === 'ask' || this.phase === 'reveal') && q;
    return {
      solo: true,
      phase: this.phase,
      question: showing ? { text: q.text, category: q.category, options: q.options, n: this.index + 1, of: this.questions.length } : null,
      reveal: this.phase === 'reveal' ? this.last : null,
      last: this.last,
      timeLeft: this.phase === 'ask' ? this.triviaLeft : this.phase === 'ready' ? TRIVIA.questionMs : 0,
      seconds: TRIVIA.questionMs / 1000,
      right: this.right,
      wrong: this.wrong,
      streak: this.streak,
      bestStreak: this.bestStreak,
      fastest: this.fastest,
      of: this.questions.length,
      score: this.points,
      variant: this.topic || '',
    };
  }

  onInput(slot, input) {
    if (this.solo) {
      if (slot !== 0 || !input) return;
      if (input.type === 'rematch' && this.phase === 'over') return this.start();
      const c = input.choice;
      if (input.type === 'answer' && this.phase === 'ask' && Number.isInteger(c) && c >= 0 && c <= 3) this.triviaAnswer(c);
      return;
    }
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
    if (this.solo) return { ...this.triviaView(), player: this.ctx.player };
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
    if (this.solo) return { ...this.triviaView(), you: 0 };
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

/** The 1 player mode, Trivia: played as a solo game (see server/solo/). */
export const soloTrivia = {
  id: 'quiz',
  name: 'Trivia',
  tagline: 'Twelve questions, four answers, 15 seconds each. Quick right answers score more.',
  category: 'brain',
  phone: true,
  music: 'thinking',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => {
    const game = new QuizBattle(ctx, ctx.rng, QUESTIONS, { solo: true });
    // (a solo game takes onInput(input) and playerView(): one player)
    return { start: () => game.start(), onInput: (input) => game.onInput(0, input), hostView: () => game.hostView(), playerView: () => game.playerView(0), game };
  },
};

export default {
  id: 'quiz',
  handheld: true, // everything's on your phone: no need to watch the TV
  music: 'thinking',
  name: 'Quiz Battle',
  tagline: '10 trivia questions. Answer on your phone or controller; right and fast scores more. Most points wins.',
  create: (ctx) => new QuizBattle(ctx),
};
