// Wait for GO, then tap. Tapping early is a false start and hands the point
// to your opponent. First to WIN_SCORE takes the duel.
//
// In the 1 player lobby it's Reaction Rush (soloReaction below): five rounds against the clock. A tap
// before GO is a false start: that round starts again and 100 ms goes on your time. Score: your
// average reaction time plus the penalties (lower is better).

import { settingOf } from './options.js';

export const WIN_SCORE = 3;
export const TIMING = {
  readyMs: 1500, // "get ready" before the waiting starts
  minWaitMs: 1500, // shortest possible wait before GO
  maxWaitMs: 4500, // longest possible wait before GO
  noTapMs: 3000, // round is void if nobody taps after GO
  resultMs: 2500, // how long the round result stays up
};
/** 1 player: the rounds, a round with no tap counts as SLOW_MS, and a false start costs PENALTY_MS. */
export const SOLO = { rounds: 5, slowMs: 2000, betweenMs: 1400, falseStartMs: 1500, penaltyMs: 100 };

export class ReactionDuel {
  /** solo: the 1 player mode, Reaction Rush (see the top of this file). */
  constructor(ctx, rng = Math.random, { solo = false } = {}) {
    this.ctx = ctx;
    this.solo = solo;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    if (this.solo) {
      this.times = [];
      this.falseStarts = 0;
      this.last = null; // { ms } or { early: true }: the round just played
      this.goAt = null;
      this.phase = 'ready';
      this.ctx.update();
      return this.schedule(() => this.arm(), TIMING.readyMs);
    }
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.bestMs = [null, null];
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.phase = 'ready';
    this.result = null;
    this.goAt = null;
    this.ctx.update();
    this.schedule(() => this.arm(), TIMING.readyMs);
  }

  arm() {
    this.phase = 'wait';
    this.ctx.update();
    const wait = TIMING.minWaitMs + this.rng() * (TIMING.maxWaitMs - TIMING.minWaitMs);
    this.schedule(() => this.go(), wait);
  }

  go() {
    this.phase = 'go';
    this.goAt = this.ctx.now();
    this.ctx.update();
    if (this.solo) return this.schedule(() => this.record(SOLO.slowMs), SOLO.slowMs);
    this.schedule(() => this.resolve({ kind: 'no-tap', winner: null }), TIMING.noTapMs);
  }

  /** 1 player: a round's time; after the fifth, the run is over. */
  record(ms) {
    this.times.push(ms);
    this.last = { ms };
    if (this.times.length >= SOLO.rounds) {
      this.cancel();
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'result';
    this.ctx.update();
    this.schedule(() => this.arm(), SOLO.betweenMs);
  }

  soloInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'tap') return;
    if (this.phase === 'wait') {
      // Too soon: that round starts again, and it costs.
      this.falseStarts++;
      this.last = { early: true };
      this.phase = 'early';
      this.ctx.update();
      this.schedule(() => this.arm(), SOLO.falseStartMs);
    } else if (this.phase === 'go') {
      this.record(Math.min(SOLO.slowMs, Math.max(0, this.ctx.now() - this.goAt)));
    }
  }

  /** 1 player: the rounds' times, the false starts, and at the end the score. */
  soloView() {
    const average = this.times.length ? Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length) : 0;
    return {
      solo: true,
      phase: this.phase,
      round: Math.min(SOLO.rounds, this.times.length + (this.phase === 'over' ? 0 : 1)),
      rounds: SOLO.rounds,
      times: this.times,
      last: this.last,
      falseStarts: this.falseStarts,
      penaltyMs: SOLO.penaltyMs,
      average,
      fastest: this.times.length ? Math.min(...this.times) : null,
      score: this.phase === 'over' ? average + this.falseStarts * SOLO.penaltyMs : null,
    };
  }

  onInput(slot, input) {
    if (this.solo) return slot === 0 && input ? this.soloInput(input) : undefined;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'tap') return;

    if (this.phase === 'wait') {
      this.resolve({ kind: 'false-start', winner: 1 - slot, offender: slot });
    } else if (this.phase === 'go') {
      const ms = this.ctx.now() - this.goAt;
      if (this.bestMs[slot] === null || ms < this.bestMs[slot]) this.bestMs[slot] = ms;
      this.resolve({ kind: 'tap', winner: slot, ms });
    }
    // Taps during ready/result/over are ignored.
  }

  resolve(result) {
    this.cancel();
    if (result.winner !== null) this.scores[result.winner]++;
    this.result = result;

    const champ = this.scores.findIndex((s) => s >= this.winScore);
    if (champ !== -1) {
      this.phase = 'over';
      this.winner = champ;
      this.ctx.update();
      return;
    }
    this.phase = 'result';
    this.ctx.update();
    this.schedule(() => this.nextRound(), TIMING.resultMs);
  }

  schedule(fn, ms) {
    this.cancel();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  cancel() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  hostView() {
    if (this.solo) return { ...this.soloView(), player: this.ctx.player };
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      players: this.ctx.players,
      result: this.result,
      winner: this.winner,
      bestMs: this.bestMs,
    };
  }

  playerView(slot) {
    if (this.solo) return { ...this.soloView(), you: 0 };
    return {
      phase: this.phase,
      round: this.round,
      you: slot,
      scores: this.scores,
      winScore: this.winScore,
      result: this.result,
      winner: this.winner,
    };
  }
}

/** The 1 player mode, Reaction Rush: played as a solo game (see server/solo/). */
export const soloReaction = {
  id: 'reaction-duel',
  name: 'Reaction Rush',
  tagline: 'Wait for GO, then tap. Five rounds, your average time is your score.',
  category: 'brain',
  phone: true,
  music: 'off',
  score: { better: 'lower', unit: 'ms' },
  create: (ctx) => {
    const game = new ReactionDuel(ctx, ctx.rng, { solo: true });
    // (a solo game takes onInput(input) and playerView(): one player)
    return { start: () => game.start(), onInput: (input) => game.onInput(0, input), hostView: () => game.hostView(), playerView: () => game.playerView(0), game };
  },
};

export default {
  id: 'reaction-duel',
  handheld: true, // everything's on your phone: no need to watch the TV
  name: 'Reaction Duel',
  tagline: 'Wait for GO… then tap faster than your rival. Jump early and you lose the point.',
  create: (ctx) => new ReactionDuel(ctx),
};
