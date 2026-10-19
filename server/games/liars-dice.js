// Liar's Dice. Each player's dice are hidden under a cup (on their phone).
// Take turns bidding on how many dice of one face there are across BOTH
// players' dice ("four 5s"): each bid must go higher (more dice, or the same
// number of a higher face). Or call "Liar!": the cups lift, and if there are
// fewer than bid, the bidder loses a die; otherwise the caller does. With
// wild ones, 1s count as every face (and you can't bid on 1s). Lose all your
// dice and you lose the game. Dice are secret, so both players need phones.

import { settingOf } from './options.js';

export const DICE = 5;
export const TIMING = { revealMs: 5500 };

const roll = (rng, n) => Array.from({ length: n }, () => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b);

/** Is `bid` a legal raise on `prev` (or a legal opening bid)? */
export function isRaise(prev, bid, total, wild) {
  const { qty, face } = bid;
  if (!Number.isInteger(qty) || !Number.isInteger(face) || qty < 1 || qty > total || face < 1 || face > 6) return false;
  if (wild && face === 1) return false;
  if (!prev) return true;
  return qty > prev.qty || (qty === prev.qty && face > prev.face);
}

/** How many dice show `face` (counting 1s too when they're wild). */
export function countFace(hands, face, wild) {
  return hands.flat().filter((d) => d === face || (wild && d === 1)).length;
}

export class LiarsDice {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.startDice = settingOf(ctx, 'dice', DICE);
    this.wild = settingOf(ctx, 'wild', 1) === 1;
    this.timer = null;
    this.firstStarter = 0;
  }

  start() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.counts = [this.startDice, this.startDice];
    this.winner = null;
    this.result = null;
    this.roundNo = 0;
    if (this.ctx.players.some((p) => p.local)) {
      this.phase = 'needPhones';
      return this.ctx.update();
    }
    this.turn = this.firstStarter;
    this.firstStarter = 1 - this.firstStarter;
    this.newRound();
  }

  newRound() {
    this.roundNo++;
    this.hands = this.counts.map((n) => roll(this.rng, n));
    this.bid = null; // { qty, face, by }
    this.bids = [];
    this.result = null;
    this.phase = 'bidding';
    this.ctx.update();
  }

  get total() {
    return this.counts[0] + this.counts[1];
  }

  onInput(slot, input) {
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    if (this.phase !== 'bidding' || slot !== this.turn) return;
    if (input.type === 'bid') {
      const bid = { qty: input.qty, face: input.face };
      if (!isRaise(this.bid, bid, this.total, this.wild)) return;
      this.bid = { ...bid, by: slot };
      this.bids.push(this.bid);
      this.turn = 1 - slot;
      return this.ctx.update();
    }
    if (input.type === 'liar' && this.bid && this.bid.by !== slot) this.challenge(slot);
  }

  challenge(caller) {
    const actual = countFace(this.hands, this.bid.face, this.wild);
    const bidder = this.bid.by;
    const loser = actual >= this.bid.qty ? caller : bidder;
    this.counts[loser]--;
    this.result = { caller, bidder, bid: this.bid, actual, loser, hands: this.hands };
    this.phase = 'reveal';
    this.turn = loser; // whoever lost a die opens the next round
    if (this.counts[loser] === 0) {
      this.winner = 1 - loser;
      this.phase = 'over';
      this.firstStarter = loser;
      return this.ctx.update();
    }
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.revealMs);
    this.ctx.update();
  }

  view() {
    const revealed = this.phase === 'reveal' || this.phase === 'over';
    return {
      phase: this.phase,
      wild: this.wild,
      counts: this.counts,
      startDice: this.startDice,
      total: this.counts ? this.total : 0,
      turn: this.turn,
      bid: this.bid || null,
      bids: this.bids || [],
      round: this.roundNo,
      result: this.result,
      hands: revealed && this.result ? this.result.hands : null,
      winner: this.winner,
      draw: false,
      scores: this.counts,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    const v = Object.assign(this.view(), { you: slot });
    if (this.hands && this.phase !== 'needPhones') v.mine = this.hands[slot];
    return v;
  }
}

export default {
  id: 'liars-dice',
  name: "Liar's Dice",
  category: 'board',
  phoneOnly: true, // your dice are secret
  music: 'thinking',
  tagline: 'Your dice are hidden on your phone. Bid how many of a face there are between you both, or call "Liar!". Lose a die each time you\'re wrong; last one with dice wins.',
  create: (ctx) => new LiarsDice(ctx),
};
