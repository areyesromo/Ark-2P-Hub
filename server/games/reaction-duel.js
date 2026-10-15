// Wait for GO, then tap. Tapping early is a false start and hands the point
// to your opponent. First to WIN_SCORE takes the duel.

export const WIN_SCORE = 3;
export const TIMING = {
  readyMs: 1500, // "get ready" before the waiting starts
  minWaitMs: 1500, // shortest possible wait before GO
  maxWaitMs: 4500, // longest possible wait before GO
  noTapMs: 3000, // round is void if nobody taps after GO
  resultMs: 2500, // how long the round result stays up
};

export class ReactionDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
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
    this.schedule(() => this.resolve({ kind: 'no-tap', winner: null }), TIMING.noTapMs);
  }

  onInput(slot, input) {
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

    const champ = this.scores.findIndex((s) => s >= WIN_SCORE);
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
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: WIN_SCORE,
      players: this.ctx.players,
      result: this.result,
      winner: this.winner,
      bestMs: this.bestMs,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      round: this.round,
      you: slot,
      scores: this.scores,
      winScore: WIN_SCORE,
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'reaction-duel',
  name: 'Reaction Duel',
  tagline: 'Wait for GO… then tap faster than your rival. Jump early and you lose the point.',
  create: (ctx) => new ReactionDuel(ctx),
};
