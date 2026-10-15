// Classic Rock-Paper-Scissors. Picks are secret on each phone until both are
// locked in, then the TV reveals them. First to WIN_SCORE wins.

export const WIN_SCORE = 3;
export const REVEAL_MS = 3000;
export const CHOICES = ['rock', 'paper', 'scissors'];
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

/** Returns 0 if a wins, 1 if b wins, null on a draw. */
export function judge(a, b) {
  if (a === b) return null;
  return BEATS[a] === b ? 0 : 1;
}

export class RockPaperScissors {
  constructor(ctx) {
    this.ctx = ctx;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.phase = 'choose';
    this.picks = [null, null];
    this.roundWinner = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'pick' || this.phase !== 'choose') return;
    if (!CHOICES.includes(input.choice) || this.picks[slot]) return;

    this.picks[slot] = input.choice;
    if (this.picks.every(Boolean)) this.reveal();
    else this.ctx.update();
  }

  reveal() {
    this.roundWinner = judge(this.picks[0], this.picks[1]);
    if (this.roundWinner !== null) this.scores[this.roundWinner]++;

    const champ = this.scores.findIndex((s) => s >= WIN_SCORE);
    if (champ !== -1) {
      this.phase = 'over';
      this.winner = champ;
      this.ctx.update();
      return;
    }
    this.phase = 'reveal';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => this.nextRound(), REVEAL_MS);
  }

  /** Picks stay hidden from everyone until the reveal. */
  visiblePicks() {
    return this.phase === 'choose' ? [null, null] : this.picks;
  }

  hostView() {
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: WIN_SCORE,
      players: this.ctx.players,
      locked: this.picks.map(Boolean),
      picks: this.visiblePicks(),
      roundWinner: this.roundWinner,
      winner: this.winner,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      round: this.round,
      you: slot,
      scores: this.scores,
      winScore: WIN_SCORE,
      yourPick: this.picks[slot],
      opponentLocked: Boolean(this.picks[1 - slot]),
      opponentPick: this.phase === 'choose' ? null : this.picks[1 - slot],
      roundWinner: this.roundWinner,
      winner: this.winner,
    };
  }
}

export default {
  id: 'rock-paper-scissors',
  name: 'Rock Paper Scissors',
  tagline: 'Pick in secret on your phone. The TV reveals both. First to 3.',
  create: (ctx) => new RockPaperScissors(ctx),
};
