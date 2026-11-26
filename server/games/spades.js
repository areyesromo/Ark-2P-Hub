// Spades for two (the draw version). There are no partners, so you build your hands as you go:
// in turn, look at the top card of the pack (only you see it). Keep it, and the next card goes on
// the discard pile unseen; or pass it (it's discarded) and take the next one, sight unseen. Until the
// pack's gone and you each have 13. Then bid how many tricks you'll take (0 is "nil": none at all).
// Play 13 tricks: follow suit if you can; spades are trumps; you can't lead a spade until one has
// been played (unless you've nothing else). Make your bid: 10 a trick bid, 1 a trick over (a "bag";
// every 10 bags cost 100). Fall short: lose 10 a trick bid. Nil made: 100; broken: lose 100.
// First to the target (300) at the end of a hand wins, or the higher score after 12 hands; the deal
// swaps every hand.

import { settingOf } from './options.js';

export const TARGET = 300;
export const MAX_HANDS = 12; // then the higher score wins (level: one more hand)
export const TIMING = { drawMs: 20000, bidMs: 30000, turnMs: 25000, trickMs: 1300, handEndMs: 6000 };
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['S', 'H', 'D', 'C'];
export const rankOf = (c) => RANKS.indexOf(c.slice(0, -1)) + 2; // 2 … 14
export const suitOf = (c) => c.slice(-1);
const order = (a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || rankOf(a) - rankOf(b);

/** The cards `hand` may play to a trick that `lead` started (null: leading). */
export function legalPlays(hand, lead, broken) {
  if (lead) {
    const follow = hand.filter((c) => suitOf(c) === suitOf(lead));
    return follow.length ? follow : hand.slice();
  }
  const other = hand.filter((c) => suitOf(c) !== 'S');
  return broken || !other.length ? hand.slice() : other;
}

/** Who takes a trick of two cards (the first led): a spade, else the higher of the led suit. */
export function trickWinner(first, second) {
  if (suitOf(second) === suitOf(first)) return rankOf(second) > rankOf(first) ? 1 : 0;
  return suitOf(second) === 'S' ? 1 : 0;
}

/** A hand's score for a bid and tricks taken: { points, bags }. */
export function handScore(bid, tricks) {
  if (bid === 0) return { points: tricks === 0 ? 100 : -100, bags: tricks };
  if (tricks < bid) return { points: -10 * bid, bags: 0 };
  return { points: 10 * bid + (tricks - bid), bags: tricks - bid };
}

export class Spades {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.target = settingOf(ctx, 'target', TARGET);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.bags = [0, 0];
    this.dealer = 1;
    this.handNo = 0;
    this.winner = null;
    this.newHand();
  }

  newHand() {
    this.clearTimer();
    this.handNo++;
    this.dealer = 1 - this.dealer;
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.pack = cards;
    this.hands = [[], []];
    this.discards = 0;
    this.bids = [null, null];
    this.tricks = [0, 0];
    this.trick = []; // { by, card }
    this.lastTrick = null;
    this.played = []; // every card played this hand (they were all face up)
    this.broken = false;
    this.result = null;
    this.n = 0;
    this.phase = 'draw';
    this.turn = 1 - this.dealer; // the non-dealer draws, bids and leads first
    this.armClock(TIMING.drawMs, 'drawTimeUp');
  }

  /** The card the player drawing is looking at (theirs alone to see). */
  get offer() {
    return this.pack[this.pack.length - 1];
  }

  /** Keep the card you're shown (the next is discarded unseen), or pass it and take the next. */
  draw(s, keep) {
    const a = this.pack.pop();
    const b = this.pack.pop();
    this.hands[s].push(keep ? a : b);
    this.discards++;
    this.hands[s].sort(order);
    this.n++;
    if (!this.pack.length) {
      this.phase = 'bid';
      this.turn = 1 - this.dealer;
      return this.armClock(TIMING.bidMs, 'bidTimeUp');
    }
    this.turn = 1 - s;
    this.armClock(TIMING.drawMs, 'drawTimeUp');
  }

  drawTimeUp() {
    this.draw(this.turn, true);
  }

  /** Out of time to bid: 1. */
  bidTimeUp() {
    this.bid(this.turn, 1);
  }

  bid(s, n) {
    this.bids[s] = n;
    this.n++;
    if (this.bids[1 - s] === null) {
      this.turn = 1 - s;
      return this.armClock(TIMING.bidMs, 'bidTimeUp');
    }
    this.phase = 'play';
    this.turn = 1 - this.dealer;
    this.armClock(TIMING.turnMs, 'turnTimeUp');
  }

  /** Out of time to play: your lowest card that may go. */
  turnTimeUp() {
    const s = this.turn;
    const lead = this.trick.length ? this.trick[0].card : null;
    const ok = legalPlays(this.hands[s], lead, this.broken).sort((a, b) => rankOf(a) - rankOf(b));
    this.play(s, ok[0]);
  }

  play(s, card) {
    this.hands[s] = this.hands[s].filter((c) => c !== card);
    this.trick.push({ by: s, card });
    this.played.push(card);
    if (suitOf(card) === 'S') this.broken = true;
    this.n++;
    if (this.trick.length < 2) {
      this.turn = 1 - s;
      return this.armClock(TIMING.turnMs, 'turnTimeUp');
    }
    const w = this.trick[trickWinner(this.trick[0].card, this.trick[1].card)].by;
    this.tricks[w]++;
    this.lastTrick = { cards: this.trick.slice(), winner: w };
    this.turn = null;
    this.phase = 'trick';
    this.nextLeader = w;
    this.deadline = null;
    this.arm(TIMING.trickMs, 'afterTrick');
  }

  afterTrick() {
    this.trick = [];
    if (!this.hands[0].length) return this.scoreHand();
    this.phase = 'play';
    this.turn = this.nextLeader;
    this.armClock(TIMING.turnMs, 'turnTimeUp');
  }

  scoreHand() {
    const gained = [0, 0];
    for (const s of [0, 1]) {
      const { points, bags } = handScore(this.bids[s], this.tricks[s]);
      gained[s] = points;
      this.bags[s] += bags;
      if (this.bags[s] >= 10) { gained[s] -= 100; this.bags[s] -= 10; }
      this.scores[s] += gained[s];
    }
    this.result = { bids: this.bids.slice(), tricks: this.tricks.slice(), gained };
    const [a, b] = this.scores;
    if ((a >= this.target || b >= this.target || this.handNo >= MAX_HANDS) && a !== b) {
      this.winner = a > b ? 0 : 1;
      this.phase = 'over';
      this.turn = null;
      this.deadline = null;
      this.clearTimer();
      return this.ctx.update();
    }
    this.phase = 'handEnd';
    this.turn = null;
    this.deadline = null;
    this.arm(TIMING.handEndMs, 'newHand');
  }

  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && /TimeUp$/.test(then)) return;
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
    if (!this.clock && /TimeUp$/.test(this.after)) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'draw' && this.phase === 'draw' && typeof input.keep === 'boolean') return this.draw(slot, input.keep);
    if (input.type === 'bid' && this.phase === 'bid' && Number.isInteger(input.bid) && input.bid >= 0 && input.bid <= 13) return this.bid(slot, input.bid);
    if (input.type === 'play' && this.phase === 'play' && typeof input.card === 'string') {
      const lead = this.trick.length ? this.trick[0].card : null;
      if (!legalPlays(this.hands[slot], lead, this.broken).includes(input.card)) return;
      this.play(slot, input.card);
    }
  }

  view(viewer) {
    const lead = this.trick.length ? this.trick[0].card : null;
    const mine = viewer !== null && viewer === this.turn;
    return {
      phase: this.phase,
      hand: viewer === null ? null : this.hands[viewer],
      handCounts: this.hands.map((h) => h.length),
      pack: this.pack.length,
      offer: mine && this.phase === 'draw' ? this.offer : null, // (yours alone to see)
      dealer: this.dealer,
      bids: this.bids, // (bids are said out loud)
      tricks: this.tricks,
      trick: this.trick,
      lastTrick: this.lastTrick,
      playedCards: this.played,
      broken: this.broken,
      legal: mine && this.phase === 'play' ? legalPlays(this.hands[viewer], lead, this.broken) : null,
      turn: this.turn,
      n: this.n,
      scores: this.scores,
      bags: this.bags,
      target: this.target,
      maxHands: MAX_HANDS,
      deal: this.handNo,
      result: this.result,
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
  id: 'spades',
  category: 'board',
  phoneOnly: true, // (your hand is secret)
  handheld: true,
  music: 'thinking',
  name: 'Spades',
  tagline: 'Draw your hand a card at a time, bid your tricks, then play: spades are trumps. Make your bid, mind the bags. First to 300.',
  create: (ctx) => new Spades(ctx),
};
