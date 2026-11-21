// Blackjack, head to head (play chips only). You both play the same dealer, and you both get the
// same cards: the same two to start and, if you hit, the same next cards in the same order. So it's
// your choices (and your bets) that decide it, not your luck. While you play, the other's extra
// cards stay face down (the same cards are coming to you); both hands show once you're both done,
// then the dealer plays: hits to 17, stands on every 17. Blackjack pays 3 to 2, a win 1 to 1, a tie
// gets your bet back. Double down on your first two cards; split a pair once (split aces get one
// card each). Most chips after the last hand wins; run out of chips and the match is over.
//
// The shoe is two real decks, shuffled once and dealt from the top; it's shuffled again only when
// it runs low between hands. Each hand: four cards dealt (your two, the dealer's up card and hole
// card), then the next cards are the dealer's, and the ones after those are the players' (each of
// you reads them from the same spot).

import { settingOf } from './options.js';

export const START_CHIPS = 1000;
export const BETS = [25, 50, 100, 200, 500];
export const MIN_BET = BETS[0];
export const HANDS = 8;
const DECKS = 2;
const DEALER_CARDS = 12; // kept for the dealer each hand (it never needs as many)
const LOW = 40; // fewer cards than this left in the shoe at a new hand: shuffle a fresh one
export const TIMING = { betMs: 20000, dealMs: 1600, turnMs: 25000, revealMs: 1400, dealerStepMs: 900, settleMs: 4500 };

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export function shoe() {
  const out = [];
  for (let d = 0; d < DECKS; d++) for (const s of SUITS) for (const r of RANKS) out.push(r + s);
  return out;
}

const rankOf = (card) => card.slice(0, -1);
/** A card's count: aces 1 here (total() makes one 11 when it fits), pictures 10. */
export function valueOf(card) {
  const r = rankOf(card);
  return r === 'A' ? 1 : r === 'J' || r === 'Q' || r === 'K' ? 10 : Number(r);
}

/** A hand's total, and whether it's soft (an ace counting 11). */
export function total(cards) {
  let t = 0;
  let aces = 0;
  for (const c of cards) {
    t += valueOf(c);
    if (rankOf(c) === 'A') aces++;
  }
  const soft = aces > 0 && t + 10 <= 21;
  return { total: soft ? t + 10 : t, soft };
}

export const isBlackjack = (cards) => cards.length === 2 && total(cards).total === 21;

export class Blackjack {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.handsInMatch = settingOf(ctx, 'hands', HANDS);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.chips = [START_CHIPS, START_CHIPS];
    this.lastBet = [50, 50];
    this.handNo = 0;
    this.winner = null;
    this.cards = this.shuffled();
    this.pos = 0;
    this.newHand();
  }

  shuffled() {
    const c = shoe();
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }

  // ---- a hand ---------------------------------------------------------------------

  newHand() {
    // Out of chips: the match is over.
    const broke = [0, 1].filter((s) => this.chips[s] < MIN_BET);
    if (broke.length || this.handNo >= this.handsInMatch) return this.finish();
    this.handNo++;
    if (this.cards.length - this.pos < LOW) {
      this.cards = this.shuffled();
      this.pos = 0;
      this.shuffledNow = true;
    } else {
      this.shuffledNow = false;
    }
    this.phase = 'bet';
    this.bets = [null, null];
    this.seats = [null, null];
    this.dealer = null;
    this.results = null;
    this.deadline = this.clock ? this.ctx.now() + TIMING.betMs : null;
    this.arm(TIMING.betMs, 'betTimeUp');
  }

  /** Out of time to bet: you bet what you bet last time (or what you can, if that's more). */
  betTimeUp() {
    for (const s of [0, 1]) if (this.bets[s] === null) this.bets[s] = Math.min(this.lastBet[s], this.chips[s]);
    this.deal();
  }

  deal() {
    this.clearTimer();
    const base = this.pos;
    const [a, b, up, hole] = this.cards.slice(base, base + 4);
    this.dealer = { cards: [up, hole], next: base + 4, shown: false };
    this.playerStart = base + 4 + DEALER_CARDS;
    for (const s of [0, 1]) {
      this.lastBet[s] = this.bets[s];
      this.seats[s] = { hands: [{ cards: [a, b], bet: this.bets[s], done: false, doubled: false, split: false }], at: 0, next: this.playerStart, done: false };
      if (isBlackjack([a, b])) this.seats[s].hands[0].done = true;
    }
    this.phase = 'deal';
    this.deadline = null;
    this.arm(TIMING.dealMs, 'afterDeal');
  }

  afterDeal() {
    // A dealer blackjack (it peeks under an ace or a ten) ends the hand at once.
    if (isBlackjack(this.dealer.cards)) return this.reveal();
    for (const s of [0, 1]) this.advance(s);
    if (this.seats.every((seat) => seat.done)) return this.reveal();
    this.phase = 'play';
    this.armTurn();
  }

  /** Moves a seat on to its next unfinished hand, or marks it done. */
  advance(s) {
    const seat = this.seats[s];
    while (seat.at < seat.hands.length && seat.hands[seat.at].done) seat.at++;
    seat.done = seat.at >= seat.hands.length;
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  /** Out of time: whoever's still playing stands. */
  turnTimeUp() {
    for (const s of [0, 1]) {
      const seat = this.seats[s];
      while (!seat.done) {
        seat.hands[seat.at].done = true;
        this.advance(s);
      }
    }
    this.reveal();
  }

  draw(s) {
    const seat = this.seats[s];
    return this.cardAt(seat.next++);
  }

  cardAt(i) {
    // (never past the shoe's end: a fresh shoe is shuffled while LOW cards are left)
    return this.cards[Math.min(i, this.cards.length - 1)];
  }

  act(s, type) {
    const seat = this.seats[s];
    if (!seat || seat.done) return;
    const hand = seat.hands[seat.at];
    const free = this.chips[s] - this.staked(s);
    if (type === 'hit') {
      hand.cards.push(this.draw(s));
      if (total(hand.cards).total >= 21) hand.done = true;
    } else if (type === 'stand') {
      hand.done = true;
    } else if (type === 'double') {
      if (hand.cards.length !== 2 || free < hand.bet) return;
      hand.bet *= 2;
      hand.doubled = true;
      hand.cards.push(this.draw(s));
      hand.done = true;
    } else if (type === 'split') {
      if (!this.canSplit(s)) return;
      const [x, y] = hand.cards;
      const aces = rankOf(x) === 'A';
      const first = { cards: [x, this.draw(s)], bet: hand.bet, done: aces, doubled: false, split: true };
      const second = { cards: [y, this.draw(s)], bet: hand.bet, done: aces, doubled: false, split: true };
      seat.hands = [first, second];
      for (const h of seat.hands) if (total(h.cards).total === 21) h.done = true;
    } else {
      return;
    }
    this.advance(s);
    if (this.seats.every((x) => x.done)) return this.reveal();
    this.armTurn(); // (a move gives you both a fresh clock: you play at the same time)
  }

  staked(s) {
    return this.seats[s] ? this.seats[s].hands.reduce((n, h) => n + h.bet, 0) : 0;
  }

  canSplit(s) {
    const seat = this.seats[s];
    if (!seat || seat.done || seat.hands.length !== 1) return false;
    const [x, y] = seat.hands[0].cards;
    return seat.hands[0].cards.length === 2 && valueOf(x) === valueOf(y) && this.chips[s] - this.staked(s) >= seat.hands[0].bet;
  }

  // ---- the dealer -------------------------------------------------------------------

  /** Both done: every hand shows, then the hole card turns over. */
  reveal() {
    this.phase = 'reveal';
    this.deadline = null;
    this.arm(TIMING.revealMs, 'dealerStep');
  }

  /** The dealer turns its hole card, then draws one card at a time to 17 (unless every hand is bust). */
  dealerStep() {
    const d = this.dealer;
    this.phase = 'dealer';
    if (!d.shown) {
      d.shown = true;
      return this.arm(TIMING.dealerStepMs, 'dealerStep');
    }
    // (no need to draw when every hand is bust or a blackjack: nothing left to beat)
    const live = this.seats.some((seat) => seat.hands.some((h) => total(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.split)));
    if (live && total(d.cards).total < 17) {
      d.cards.push(this.cardAt(d.next++));
      return this.arm(TIMING.dealerStepMs, 'dealerStep');
    }
    this.settle();
  }

  settle() {
    const dealer = total(this.dealer.cards).total;
    const dealerBJ = isBlackjack(this.dealer.cards);
    this.results = [0, 1].map((s) => this.seats[s].hands.map((h) => {
      const t = total(h.cards).total;
      const bj = isBlackjack(h.cards) && !h.split;
      let outcome;
      let win;
      if (t > 21) { outcome = 'bust'; win = -h.bet; }
      else if (dealerBJ && bj) { outcome = 'push'; win = 0; }
      else if (dealerBJ) { outcome = 'lose'; win = -h.bet; }
      else if (bj) { outcome = 'blackjack'; win = Math.floor((h.bet * 3) / 2); }
      else if (dealer > 21 || t > dealer) { outcome = 'win'; win = h.bet; }
      else if (t === dealer) { outcome = 'push'; win = 0; }
      else { outcome = 'lose'; win = -h.bet; }
      this.chips[s] += win;
      return { outcome, win };
    }));
    // The used cards are gone: the shoe goes on past the furthest anyone read.
    this.pos = Math.max(this.dealer.next, ...this.seats.map((seat) => seat.next));
    this.phase = 'settle';
    this.arm(TIMING.settleMs, 'newHand');
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.deadline = null;
    this.winner = this.chips[0] === this.chips[1] ? null : this.chips[0] > this.chips[1] ? 0 : 1;
    this.ctx.update();
  }

  // ---- clock -------------------------------------------------------------------

  /** One timer at a time; its callback is a method name (so a saved game can arm it again). */
  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    // With no timer, betting and playing wait for you; the dealing and the dealer still move on.
    if (!this.clock && (then === 'betTimeUp' || then === 'turnTimeUp')) return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this[then]();
    }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Picked up after a restart (RESUMES in index.js): the clock goes on from where it was. */
  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && (this.after === 'betTimeUp' || this.after === 'turnTimeUp')) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  // ---- input -------------------------------------------------------------------

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'bet' && this.phase === 'bet') {
      const amount = input.amount;
      if (this.bets[slot] !== null || !Number.isInteger(amount) || amount < MIN_BET || amount > this.chips[slot]) return;
      if (!BETS.includes(amount) && amount !== this.chips[slot]) return; // a chip, or all in
      this.bets[slot] = amount;
      if (this.bets.every((b) => b !== null)) return this.deal();
      return this.ctx.update();
    }
    if (this.phase === 'play' && ['hit', 'stand', 'double', 'split'].includes(input.type)) this.act(slot, input.type);
  }

  // ---- views -------------------------------------------------------------------

  /** A seat as `viewer` may see it: while you play, the other's cards after the first two are face down. */
  seatView(s, viewer) {
    const seat = this.seats[s];
    if (!seat) return null;
    const open = viewer === s || this.phase === 'reveal' || this.phase === 'dealer' || this.phase === 'settle';
    return {
      hands: seat.hands.map((h) => ({
        cards: open ? h.cards : h.cards.map((c, i) => (i < 2 && !h.split ? c : i < 1 ? c : null)),
        total: open || (h.cards.length === 2 && !h.split) ? total(h.cards).total : null,
        soft: open ? total(h.cards).soft : false,
        bet: open || !h.doubled ? h.bet : h.bet / 2,
        doubled: open && h.doubled,
        done: h.done,
      })),
      at: seat.at,
      done: seat.done,
    };
  }

  view(viewer) {
    const d = this.dealer;
    const bets = this.phase === 'bet'
      ? this.bets.map((b, s) => (b === null ? null : viewer === s || this.bets.every((x) => x !== null) ? b : true))
      : this.bets;
    return {
      phase: this.phase,
      hand: this.handNo,
      hands: this.handsInMatch,
      chips: this.chips,
      bets,
      betChoices: BETS,
      minBet: MIN_BET,
      lastBet: this.lastBet,
      seats: [0, 1].map((s) => this.seatView(s, viewer)),
      dealer: d ? { cards: d.shown ? d.cards : [d.cards[0], null], total: d.shown ? total(d.cards).total : null } : null,
      results: this.results,
      shuffled: this.shuffledNow,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    const seat = this.seats[slot];
    const hand = seat && !seat.done ? seat.hands[seat.at] : null;
    return Object.assign(this.view(slot), {
      you: slot,
      can: this.phase === 'play' && hand
        ? { hit: true, stand: true, double: hand.cards.length === 2 && this.chips[slot] - this.staked(slot) >= hand.bet, split: this.canSplit(slot) }
        : null,
    });
  }
}

export default {
  id: 'blackjack',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Blackjack',
  tagline: 'Beat the dealer for play chips. You both get the same cards, so the better player wins, not the luckier one. Most chips after the last hand.',
  create: (ctx) => new Blackjack(ctx),
};
