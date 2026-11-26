// Baccarat (punto banco), head to head, for play chips only. You each start with 1,000. Each coup
// you both bet in secret on your phones: on the Player hand, the Banker hand, or a Tie, 25 to 500.
// Then the coup is dealt for you both from one six-deck shoe. Two cards to each hand; a hand counts
// its cards (aces 1, tens and pictures 0) and keeps only the last digit, so 7 + 8 is 5. Closest to 9
// wins. An 8 or 9 on two cards is a "natural": both stand. Otherwise the Player hand draws a third
// card on 0 to 5, and the Banker hand follows the house rules (it draws on 0 to 2, and on 3 to 6
// depending on the Player's third card). Player pays evens, Banker evens less 5%, Tie 8 to 1 (a tie
// hands back bets on Player or Banker). Most chips after 10 coups (or 6 or 15) wins. Out of time to
// bet: you sit the coup out and lose the least bet, 25.

import { settingOf } from './options.js';

export const START_CHIPS = 1000;
export const COUPS = 10;
export const MIN_BET = 25;
export const MAX_BET = 500;
export const DECKS = 6;
export const SIDES = ['player', 'banker', 'tie'];
export const TIMING = { betMs: 20000, dealMs: 6500 };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** What a card counts: aces 1, two to nine their number, tens and pictures 0. */
export const valueOf = (c) => {
  const r = c.slice(0, -1);
  return r === 'A' ? 1 : ['10', 'J', 'Q', 'K'].includes(r) ? 0 : Number(r);
};
export const totalOf = (cards) => cards.reduce((t, c) => t + valueOf(c), 0) % 10;

/** Does the Banker draw, on `b`, when the Player's third card counted `p3` (null: the Player stood)? */
export function bankerDraws(b, p3) {
  if (p3 === null) return b <= 5;
  if (b <= 2) return true;
  if (b === 3) return p3 !== 8;
  if (b === 4) return p3 >= 2 && p3 <= 7;
  if (b === 5) return p3 >= 4 && p3 <= 7;
  if (b === 6) return p3 === 6 || p3 === 7;
  return false;
}

/** A coup from the top of `draw()`: { player, banker, winner: 'player' | 'banker' | 'tie' }. */
export function dealCoup(draw) {
  const player = [draw(), draw()];
  const banker = [draw(), draw()];
  const p = totalOf(player);
  const b = totalOf(banker);
  if (p < 8 && b < 8) {
    let p3 = null;
    if (p <= 5) {
      player.push(draw());
      p3 = valueOf(player[2]);
    }
    if (bankerDraws(b, p3)) banker.push(draw());
  }
  const pt = totalOf(player);
  const bt = totalOf(banker);
  return { player, banker, totals: { player: pt, banker: bt }, winner: pt > bt ? 'player' : bt > pt ? 'banker' : 'tie' };
}

/** What a bet wins (or loses) on a coup's result. */
export function payout(bet, winner) {
  if (winner === 'tie') return bet.side === 'tie' ? bet.amount * 8 : 0;
  if (bet.side !== winner) return -bet.amount;
  return bet.side === 'banker' ? Math.floor(bet.amount * 0.95) : bet.amount;
}

export class Baccarat {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.coups = settingOf(ctx, 'coups', COUPS);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.chips = [START_CHIPS, START_CHIPS];
    this.shoe = this.newShoe();
    this.coupNo = 0;
    this.history = []; // each coup so far: { winner, bets } (the "road" on the TV; bets are open once dealt)
    this.winner = null;
    this.newCoup();
  }

  newShoe() {
    const cards = [];
    for (let d = 0; d < DECKS; d++) for (const s of 'SHDC') for (const r of RANKS) cards.push(r + s);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  draw() {
    if (!this.shoe.length) this.shoe = this.newShoe(); // (a six-deck shoe outlasts a match; just in case)
    return this.shoe.pop();
  }

  newCoup() {
    this.clearTimer();
    if (this.coupNo >= this.coups || this.chips.some((c) => c < MIN_BET)) return this.finish();
    this.coupNo++;
    this.bets = [null, null]; // { side, amount }, or 'out' when out of time
    this.coup = null;
    this.result = null;
    this.phase = 'bet';
    this.deadline = this.clock ? this.ctx.now() + TIMING.betMs : null;
    this.arm(TIMING.betMs, 'betTimeUp');
  }

  /** The most `s` may bet. */
  maxFor(s) {
    return Math.min(MAX_BET, this.chips[s]);
  }

  /** Out of time: sit the coup out, and the least bet is lost. */
  betTimeUp() {
    for (const s of [0, 1]) if (!this.bets[s]) this.bets[s] = 'out';
    this.deal();
  }

  deal() {
    this.clearTimer();
    this.deadline = null;
    this.coup = dealCoup(() => this.draw());
    const change = this.bets.map((b, s) => (b === 'out' ? -Math.min(MIN_BET, this.chips[s]) : payout(b, this.coup.winner)));
    for (const s of [0, 1]) this.chips[s] = Math.max(0, this.chips[s] + change[s]);
    this.history.push({ winner: this.coup.winner, bets: this.bets.slice() });
    this.result = { change, bets: this.bets.slice() };
    this.phase = 'deal';
    this.arm(TIMING.dealMs, 'newCoup');
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.deadline = null;
    this.winner = this.chips[0] === this.chips[1] ? null : this.chips[0] > this.chips[1] ? 0 : 1;
    this.ctx.update();
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && then === 'betTimeUp') return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && this.after === 'betTimeUp') return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'bet' || this.phase !== 'bet' || this.bets[slot]) return;
    const a = input.amount;
    if (!SIDES.includes(input.side) || !Number.isInteger(a) || a < MIN_BET || a > this.maxFor(slot) || a % MIN_BET) return;
    this.bets[slot] = { side: input.side, amount: a };
    if (this.bets[0] && this.bets[1]) return this.deal();
    this.ctx.update();
  }

  view(viewer) {
    const open = this.phase !== 'bet';
    return {
      phase: this.phase,
      coup: this.coupNo,
      coups: this.coups,
      chips: this.chips,
      minBet: MIN_BET,
      maxBets: [0, 1].map((s) => this.maxFor(s)),
      locked: (this.bets || [null, null]).map(Boolean),
      // Your own bet as you placed it; theirs only once the coup is dealt.
      bets: (this.bets || [null, null]).map((b, s) => (open || s === viewer ? b : null)),
      deal: this.coup,
      result: this.result,
      history: this.history,
      shoeLeft: this.shoe.length,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
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
  id: 'baccarat',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Baccarat',
  tagline: 'Bet in secret on Player, Banker or a Tie, then one coup is dealt for you both. Closest to 9 wins; most chips after 10 coups.',
  create: (ctx) => new Baccarat(ctx),
};
