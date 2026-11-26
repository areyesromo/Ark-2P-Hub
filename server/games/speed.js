// Speed. A race, both at once: each of you has five cards in hand (secret, on your phone) and a draw
// pile behind them. Two piles in the middle: play a card onto either one if it's one higher or one
// lower than the top card (an ace goes on a king or a two, and the other way round). Your hand fills
// back up to five from your pile as you play. When neither of you can go, a card from each of the two
// spare piles turns over onto the middle ones and it's on again. First to play every card takes the
// round; first to the rounds needed wins. (Nobody plays for a few seconds: they turn over anyway.)
//
// The deal: 20 cards each (5 in hand, 15 to draw), 5 in each spare pile, 1 face up in each middle pile.

import { settingOf } from './options.js';

export const WIN_SCORE = 2;
export const TIMING = { startMs: 2500, stuckMs: 1600, idleMs: 6000, roundEndMs: 5000 };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export const rankOf = (card) => RANKS.indexOf(card.slice(0, -1)) + 1; // 1 … 13
/** Whether `card` can go on `top`: one rank either side, ace and king next to each other. */
export function fits(card, top) {
  const d = Math.abs(rankOf(card) - rankOf(top));
  return d === 1 || d === 12;
}

export class Speed {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.newRound();
  }

  newRound() {
    this.clearTimer();
    this.round++;
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.hands = [cards.slice(0, 5), cards.slice(5, 10)];
    this.stocks = [cards.slice(10, 25), cards.slice(25, 40)];
    this.spares = [cards.slice(40, 45), cards.slice(45, 50)];
    this.piles = [[cards[50]], [cards[51]]];
    this.last = null; // { by, card, pile, n }
    this.n = 0;
    this.flips = 0;
    this.result = null;
    this.phase = 'ready';
    this.arm(TIMING.startMs, 'go');
  }

  go() {
    this.phase = 'play';
    this.checkStuck();
  }

  canPlay(s) {
    return this.hands[s].some((c) => fits(c, this.top(0)) || fits(c, this.top(1)));
  }

  top(p) {
    return this.piles[p][this.piles[p].length - 1];
  }

  /**
   * Neither of you can go: a short pause, then the spare piles turn a card over each. (And if
   * nobody plays a card for a while, they turn anyway: one of you can't go and the other hasn't.)
   */
  checkStuck() {
    this.stuck = !this.canPlay(0) && !this.canPlay(1);
    this.arm(this.stuck ? TIMING.stuckMs : TIMING.idleMs, 'flip');
  }

  flip() {
    // Spare piles used up: the middle piles (all but their top cards) are shuffled into new ones.
    if (!this.spares[0].length || !this.spares[1].length) {
      const under = this.piles[0].slice(0, -1).concat(this.piles[1].slice(0, -1));
      for (let i = under.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [under[i], under[j]] = [under[j], under[i]];
      }
      this.piles = [[this.top(0)], [this.top(1)]];
      const half = Math.ceil(under.length / 2);
      this.spares = [under.slice(0, half), under.slice(half)];
    }
    for (const p of [0, 1]) if (this.spares[p].length) this.piles[p].push(this.spares[p].pop());
    this.flips++;
    this.n++;
    this.checkStuck();
  }

  play(slot, i, p) {
    const card = this.hands[slot][i];
    this.piles[p].push(card);
    this.hands[slot].splice(i, 1);
    if (this.stocks[slot].length) this.hands[slot].push(this.stocks[slot].pop());
    this.n++;
    this.last = { by: slot, card, pile: p, n: this.n };
    if (!this.hands[slot].length) return this.endRound(slot);
    this.checkStuck();
  }

  endRound(winner) {
    this.clearTimer();
    this.scores[winner]++;
    this.result = { winner };
    if (this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound');
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.due = this.ctx.now() + ms;
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'play' || this.phase !== 'play') return;
    const { card: i, pile: p } = input;
    if (!Number.isInteger(i) || i < 0 || i >= this.hands[slot].length || (p !== 0 && p !== 1)) return;
    // (the other may have just covered that pile: a card that no longer fits is simply refused)
    if (!fits(this.hands[slot][i], this.top(p))) return;
    this.play(slot, i, p);
  }

  view(viewer) {
    return {
      phase: this.phase,
      round: this.round,
      tops: this.piles ? [this.top(0), this.top(1)] : [null, null],
      under: this.piles ? this.piles.map((p) => p[p.length - 2] || null) : [null, null],
      spares: this.spares ? this.spares.map((s) => s.length) : [0, 0],
      handCounts: this.hands ? this.hands.map((h) => h.length) : [0, 0],
      stocks: this.stocks ? this.stocks.map((s) => s.length) : [0, 0],
      left: this.hands ? [0, 1].map((s) => this.hands[s].length + this.stocks[s].length) : [0, 0],
      hand: viewer === null || !this.hands ? null : this.hands[viewer],
      stuck: !!this.stuck,
      flips: this.flips,
      last: this.last,
      n: this.n,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

export default {
  id: 'speed',
  category: 'board',
  phoneOnly: true, // (your hand is secret)
  handheld: true,
  music: 'action',
  name: 'Speed',
  tagline: 'Both at once: slap cards one higher or lower onto the two middle piles. First to play every card wins the round.',
  create: (ctx) => new Speed(ctx),
};
