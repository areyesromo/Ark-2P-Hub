// Heads-up Hold'em (play chips only, never money). Texas hold'em for two: you each get two cards,
// secret on your phone, and five shared cards come face up on the TV (three, then one, then one).
// Bet, call, raise or fold in four rounds; make the best five-card hand from your two and the five.
// The dealer button swaps every hand: the button posts the small blind and acts first before the
// flop, last after it. The blinds go up every few hands, so it can't go on for ever. Take every chip
// to win the match.
//
// No limit, kept simple for phones: raise to the least you can, half the pot, the pot, or all in.
// Neither of you can be made to bet more than the other has (the extra just isn't taken).

import { settingOf } from './options.js';
import { deck, evaluate } from './holdem-hands.js';

export const START_CHIPS = 1000;
export const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600], [500, 1000]];
export const TIMING = { turnMs: 30000, dealMs: 900, streetMs: 1100, showMs: 5500, foldMs: 2600 };
const STREETS = ['preflop', 'flop', 'turn', 'river'];

export class Holdem {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.blindEvery = settingOf(ctx, 'blinds', 6); // hands at each blind level
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.stacks = [START_CHIPS, START_CHIPS];
    this.handNo = 0;
    this.button = 1; // (swapped to 0 for the first hand)
    this.winner = null;
    this.newHand();
  }

  get blinds() {
    return BLINDS[Math.min(BLINDS.length - 1, Math.floor((this.handNo - 1) / this.blindEvery))];
  }

  newHand() {
    this.clearTimer();
    if (this.stacks[0] <= 0 || this.stacks[1] <= 0) return this.finish();
    this.handNo++;
    this.button = 1 - this.button;
    const cards = deck();
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.hole = [[cards[0], cards[2]], [cards[1], cards[3]]];
    this.deckBoard = cards.slice(4, 9);
    this.shown = 0; // board cards face up
    this.street = 0;
    this.contrib = [0, 0]; // put in this hand
    this.bets = [0, 0]; // put in this round
    this.folded = null;
    this.result = null;
    this.acts = [null, null]; // each one's last action, for the screens
    this.n = 0; // actions so far this hand (the computer's way of telling one decision from the next)
    const [sb, bb] = this.blinds;
    const small = this.button;
    this.post(small, sb);
    this.post(1 - small, bb);
    this.acts[small] = { act: 'small blind', amount: this.bets[small] };
    this.acts[1 - small] = { act: 'big blind', amount: this.bets[1 - small] };
    this.minRaise = bb;
    this.acted = [false, false];
    this.turn = small; // before the flop the button speaks first
    this.phase = 'deal';
    this.arm(TIMING.dealMs, 'beginBetting');
  }

  post(s, amount) {
    const a = Math.min(amount, this.stacks[s]);
    this.stacks[s] -= a;
    this.bets[s] += a;
    this.contrib[s] += a;
  }

  get pot() {
    return this.contrib[0] + this.contrib[1];
  }

  allIn(s) {
    return this.stacks[s] === 0;
  }

  beginBetting() {
    // Someone is all in from the blinds and the other has matched (or can't act): run it out.
    if (this.roundOver()) return this.endRound();
    this.phase = 'play';
    this.armTurn();
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  /** Out of time: check if you can, else fold. */
  turnTimeUp() {
    const s = this.turn;
    this.act(s, this.bets[s] === this.bets[1 - s] ? { action: 'check' } : { action: 'fold' });
  }

  /** What `s` may do now: { check, call (the amount to put in), minTo, maxTo (raise to, this round) }. */
  options(s) {
    const o = 1 - s;
    const toCall = Math.min(this.bets[o] - this.bets[s], this.stacks[s]);
    // The most is what the other can match (no point betting chips they can't call).
    const maxTo = Math.min(this.bets[s] + this.stacks[s], this.bets[o] + this.stacks[o]);
    const minTo = Math.min(maxTo, this.bets[o] + this.minRaise);
    const canRaise = maxTo > this.bets[o] && this.stacks[s] > toCall && !this.allIn(o);
    return { check: toCall === 0, call: toCall, minTo: canRaise ? minTo : null, maxTo: canRaise ? maxTo : null };
  }

  act(s, input) {
    const o = 1 - s;
    const opts = this.options(s);
    const a = input.action;
    if (a === 'fold') {
      if (opts.check) return this.act(s, { action: 'check' }); // (no folding when it's free: that's a check)
      this.acts[s] = { act: 'fold' };
      this.folded = s;
      this.n++;
      return this.award(o, 'fold');
    }
    if (a === 'check') {
      if (!opts.check) return false;
      this.acts[s] = { act: 'check' };
    } else if (a === 'call') {
      if (opts.check) return this.act(s, { action: 'check' });
      this.post(s, opts.call);
      this.acts[s] = { act: this.allIn(s) ? 'all in' : 'call', amount: this.bets[s] };
      // A short call: what the other put in past it goes back to them.
      if (this.bets[s] < this.bets[o]) this.refund(o, this.bets[o] - this.bets[s]);
    } else if (a === 'raise') {
      if (opts.minTo === null) return false;
      const to = input.to;
      if (!Number.isInteger(to) || to < opts.minTo || to > opts.maxTo) return false;
      const raiseBy = to - this.bets[o];
      if (raiseBy >= this.minRaise) this.minRaise = raiseBy;
      this.post(s, to - this.bets[s]);
      this.acts[s] = { act: this.allIn(s) ? 'all in' : this.bets[o] ? 'raise' : 'bet', amount: this.bets[s] };
      this.acted[o] = false; // they have to answer it
    } else return false;
    this.acted[s] = true;
    this.n++;
    if (this.roundOver()) return this.endRound();
    this.turn = o;
    this.armTurn();
    return true;
  }

  refund(s, amount) {
    this.bets[s] -= amount;
    this.contrib[s] -= amount;
    this.stacks[s] += amount;
  }

  /** The round is over when both have had their say and put in the same (or one can't put in any more). */
  roundOver() {
    const even = this.bets[0] === this.bets[1];
    const stuck = [0, 1].filter((s) => this.allIn(s));
    if (stuck.length === 2) return true;
    if (stuck.length === 1) {
      const other = 1 - stuck[0];
      return this.bets[other] >= this.bets[stuck[0]] && (this.acted[other] || this.bets[other] > this.bets[stuck[0]] || even);
    }
    return even && this.acted[0] && this.acted[1];
  }

  endRound() {
    this.clearTimer();
    // Someone all in for less than the other put in: the rest goes back (nobody can win more of
    // yours than they put in themselves).
    for (const s of [0, 1]) {
      const over = this.contrib[s] - this.contrib[1 - s];
      if (over > 0 && this.allIn(1 - s)) this.refund(s, Math.min(over, this.bets[s]));
    }
    this.bets = [0, 0];
    this.acted = [false, false];
    this.minRaise = this.blinds[1];
    if (this.street === 3) return this.showdown();
    // Next street: the board turns over; after the flop the big blind (not the button) speaks first.
    this.street++;
    this.shown = this.street === 1 ? 3 : this.street + 2;
    this.acts = [null, null]; // (a new round of betting: last round's words come off the table)
    this.turn = 1 - this.button;
    this.phase = 'street';
    this.deadline = null;
    this.arm(TIMING.streetMs, 'beginBetting');
  }

  showdown() {
    this.shown = 5;
    const hands = [0, 1].map((s) => evaluate(this.hole[s].concat(this.deckBoard)));
    const winner = hands[0].score === hands[1].score ? null : hands[0].score > hands[1].score ? 0 : 1;
    this.award(winner, 'showdown', hands.map((h) => h.name));
  }

  /** The pot to the winner (null: split). */
  award(winner, how, names = null) {
    this.clearTimer();
    const pot = this.pot;
    if (winner === null) {
      const half = Math.floor(pot / 2);
      this.stacks[this.button] += half;
      this.stacks[1 - this.button] += pot - half; // (an odd chip to the one out of position)
    } else this.stacks[winner] += pot;
    this.result = { winner, how, pot, names, gain: winner === null ? 0 : pot - this.contrib[winner] };
    this.contrib = [0, 0];
    this.bets = [0, 0];
    this.phase = how === 'fold' ? 'handEnd' : 'showdown';
    this.deadline = null;
    this.arm(how === 'fold' ? TIMING.foldMs : TIMING.showMs, 'newHand');
    return true;
  }

  finish() {
    this.clearTimer();
    this.winner = this.stacks[0] > this.stacks[1] ? 0 : 1;
    this.phase = 'over';
    this.deadline = null;
    this.ctx.update();
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    // With no timer a turn waits for you; the dealing still moves on.
    if (!this.clock && then === 'turnTimeUp') return;
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
    if (!this.clock && this.after === 'turnTimeUp') return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'act' || this.phase !== 'play' || slot !== this.turn) return;
    if (!['fold', 'check', 'call', 'raise'].includes(input.action)) return;
    this.act(slot, input);
  }

  view(viewer) {
    const open = this.phase === 'showdown' && this.folded === null; // (cards a fold mucks stay secret)
    const s = this.turn;
    const playing = this.phase === 'play';
    return {
      phase: this.phase,
      hand: this.handNo,
      blinds: this.blinds,
      blindEvery: this.blindEvery,
      nextBlindsIn: this.blindEvery - ((this.handNo - 1) % this.blindEvery),
      button: this.button,
      stacks: this.stacks,
      bets: this.bets,
      pot: this.pot,
      board: this.deckBoard ? this.deckBoard.slice(0, this.shown) : [],
      street: STREETS[this.street],
      turn: playing ? s : null,
      options: playing ? this.options(s) : null,
      acts: this.acts,
      n: this.n,
      cards: [0, 1].map((p) => (this.hole && (p === viewer || open) ? this.hole[p] : null)),
      result: this.result,
      timeLeftMs: playing && this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
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
  id: 'holdem',
  category: 'board',
  phoneOnly: true, // (your two cards are secret)
  handheld: true,
  music: 'thinking',
  name: "Heads-up Hold'em",
  tagline: "Texas hold'em for two, with play chips: two secret cards each, five shared on the TV. Bet, bluff or fold; take every chip to win.",
  create: (ctx) => new Holdem(ctx),
};
