// Cribbage for two. Six cards each (secret, on your phone); you each lay two face down in the crib,
// which counts for the dealer. A card is cut from the pack: the starter (a jack there is "his heels",
// 2 to the dealer). Then the play: turn about, lay a card and call the running total, never past 31.
// Score as you go: 15 or 31 (2), a pair (2), three of a kind (6), four (12), a run of three or more
// in any order (1 a card). Can't go without passing 31? Say "go": the other plays on, and whoever
// laid the last card under 31 pegs 1; then the count starts again. Last card of all pegs 1.
// Then the show: each hand counts with the starter (non-dealer first, then dealer, then the crib):
// every 15 (2), pair (2), run (1 a card), four of a suit in hand (4, or 5 with the starter; the crib
// only counts five), and the jack of the starter's suit ("his nobs", 1). First to 121 wins, at once,
// whenever it happens. The deal swaps every hand. Out of time laying your two for the crib: your
// lowest two go in and your hand doesn't count that deal.

import { settingOf } from './options.js';

export const TARGET = 121;
export const TIMING = { discardMs: 40000, cutMs: 1400, turnMs: 30000, goMs: 900, showStepMs: 4200, nextMs: 2200 };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export const rankOf = (c) => RANKS.indexOf(c.slice(0, -1)) + 1; // A 1 … K 13
export const valueOf = (c) => Math.min(10, rankOf(c)); // pictures count 10
export const suitOf = (c) => c.slice(-1);
const byRank = (a, b) => rankOf(a) - rankOf(b) || SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));

/**
 * A hand's count with the starter: { total, items: [{ kind, cards, pts }] } (fifteens, pairs, runs,
 * flush, nobs). `crib`: a flush needs all five.
 */
export function scoreHand(hand, starter, crib = false) {
  const all = hand.concat(starter ? [starter] : []);
  const items = [];
  // Fifteens: every set of cards that adds to 15.
  const n = all.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    const set = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { sum += valueOf(all[i]); set.push(all[i]); }
    if (sum === 15) items.push({ kind: 'fifteen', cards: set, pts: 2 });
  }
  // Pairs: every two of a rank.
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rankOf(all[i]) === rankOf(all[j])) items.push({ kind: 'pair', cards: [all[i], all[j]], pts: 2 });
  // Runs: the longest runs, each counted once for every way of making it (a double run counts twice).
  const counts = new Map();
  for (const c of all) counts.set(rankOf(c), (counts.get(rankOf(c)) || 0) + 1);
  for (let lo = 1; lo <= 13; lo++) {
    if (!counts.has(lo) || counts.has(lo - 1)) continue;
    let hi = lo;
    while (counts.has(hi + 1)) hi++;
    const len = hi - lo + 1;
    if (len < 3) continue;
    let ways = 1;
    for (let r = lo; r <= hi; r++) ways *= counts.get(r);
    const cards = all.filter((c) => rankOf(c) >= lo && rankOf(c) <= hi).sort(byRank);
    for (let w = 0; w < ways; w++) items.push({ kind: 'run', cards, pts: len });
  }
  // Flush: four in the hand (five with the starter); the crib only with all five.
  const s = suitOf(hand[0]);
  if (hand.every((c) => suitOf(c) === s)) {
    const five = starter && suitOf(starter) === s;
    if (five) items.push({ kind: 'flush', cards: all, pts: 5 });
    else if (!crib) items.push({ kind: 'flush', cards: hand.slice(), pts: 4 });
  }
  // Nobs: the jack of the starter's suit in the hand.
  if (starter) {
    const jack = hand.find((c) => rankOf(c) === 11 && suitOf(c) === suitOf(starter));
    if (jack) items.push({ kind: 'nobs', cards: [jack], pts: 1 });
  }
  return { total: items.reduce((t, x) => t + x.pts, 0), items };
}

/** What laying the last card of `seq` (the cards since the count began) pegs: { pts, why: [] }. */
export function pegPoints(seq) {
  const why = [];
  let pts = 0;
  const count = seq.reduce((t, c) => t + valueOf(c), 0);
  if (count === 15) { pts += 2; why.push('15'); }
  if (count === 31) { pts += 2; why.push('31'); }
  // Pairs: how many of the last cards are the same rank.
  let same = 1;
  for (let i = seq.length - 2; i >= 0 && rankOf(seq[i]) === rankOf(seq[seq.length - 1]); i--) same++;
  if (same >= 2) { const p = [0, 0, 2, 6, 12][same]; pts += p; why.push(['', '', 'pair', 'three of a kind', 'four of a kind'][same]); }
  // Runs: the longest stretch at the end that's a run of different, touching ranks.
  for (let k = seq.length; k >= 3; k--) {
    const ranks = seq.slice(-k).map(rankOf).sort((a, b) => a - b);
    if (ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1)) { pts += k; why.push('run of ' + k); break; }
  }
  return { pts, why };
}

export class Cribbage {
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
    this.backPegs = [0, 0]; // where each front peg was before its last move (the board's back pegs)
    this.dealer = 1; // (swapped to 0 for the first deal)
    this.dealNo = 0;
    this.winner = null;
    this.newDeal();
  }

  newDeal() {
    this.clearTimer();
    this.dealNo++;
    this.dealer = 1 - this.dealer;
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.hands = [cards.slice(0, 6).sort(byRank), cards.slice(6, 12).sort(byRank)];
    this.packTop = cards[12];
    this.kept = [null, null]; // the four each keeps (for the show)
    this.crib = [];
    this.discarded = [false, false];
    this.forfeit = [false, false]; // out of time laying two: that hand doesn't count
    this.starter = null;
    this.played = [[], []]; // each one's cards laid in the play
    this.seq = []; // cards since the count began: { card, by }
    this.count = 0;
    this.event = null; // the last scoring: { by, pts, why, n }
    this.n = 0;
    this.shows = []; // the show so far: { who: 0 | 1 | 'crib', cards, items, total }
    this.phase = 'discard';
    this.turn = null;
    this.armClock(TIMING.discardMs, 'discardTimeUp');
  }

  /** Points to `s`; the game ends the moment someone gets there. */
  peg(s, pts, why) {
    if (!pts || this.winner !== null) return false;
    this.backPegs[s] = this.scores[s];
    this.scores[s] = Math.min(this.target, this.scores[s] + pts);
    this.event = { by: s, pts, why, n: ++this.n };
    if (this.scores[s] >= this.target) {
      this.winner = s;
      this.phase = 'over';
      this.turn = null;
      this.clearTimer();
      this.deadline = null;
      this.ctx.update();
      return true;
    }
    return false;
  }

  discardTimeUp() {
    // Out of time: your two lowest cards go in (the hand is in order, low to high), and your hand
    // doesn't count in the show this deal.
    for (const s of [0, 1]) if (!this.discarded[s]) { this.forfeit[s] = true; this.discard(s, [0, 1]); }
  }

  discard(s, picks) {
    const out = picks.map((i) => this.hands[s][i]);
    this.crib.push(...out);
    this.hands[s] = this.hands[s].filter((_, i) => !picks.includes(i));
    this.kept[s] = this.hands[s].slice();
    this.discarded[s] = true;
    if (this.discarded[0] && this.discarded[1]) {
      this.phase = 'cut';
      this.deadline = null;
      return this.arm(TIMING.cutMs, 'cut');
    }
    this.ctx.update();
  }

  cut() {
    this.starter = this.packTop;
    // A jack turned up: his heels, 2 to the dealer.
    if (rankOf(this.starter) === 11 && this.peg(this.dealer, 2, ['his heels'])) return;
    this.phase = 'play';
    this.turn = 1 - this.dealer; // the non-dealer leads
    this.armTurn();
  }

  canLay(s) {
    return this.hands[s].some((c) => this.count + valueOf(c) <= 31);
  }

  armTurn() {
    this.armClock(TIMING.turnMs, 'turnTimeUp');
  }

  /** Out of time in the play: your highest card that fits goes down. */
  turnTimeUp() {
    const s = this.turn;
    let i = -1;
    this.hands[s].forEach((c, k) => { if (this.count + valueOf(c) <= 31) i = k; });
    this.lay(s, i);
  }

  lay(s, i) {
    const card = this.hands[s][i];
    this.hands[s].splice(i, 1);
    this.played[s].push(card);
    this.seq.push({ card, by: s });
    this.count += valueOf(card);
    const { pts, why } = pegPoints(this.seq.map((x) => x.card));
    if (this.peg(s, pts, why)) return;
    if (this.count === 31) return this.resetCount(s);
    this.afterLay(s);
  }

  /** Who goes next: the other if they can, else you again ("go"), else the last card pegs 1. */
  afterLay(last) {
    const other = 1 - last;
    if (!this.hands[0].length && !this.hands[1].length) {
      // The last card of all.
      if (this.peg(last, 1, ['last card'])) return;
      return this.endPlay();
    }
    if (this.canLay(other)) {
      this.turn = other;
      this.goBy = null;
      return this.armTurn();
    }
    if (this.canLay(last)) {
      this.turn = last; // the other said go
      this.goBy = other;
      return this.armTurn();
    }
    // Neither can go: 1 for the last card under 31, and the count starts again.
    if (this.peg(last, 1, ['go'])) return;
    this.resetCount(last);
  }

  resetCount(last) {
    this.clearTimer();
    this.phase = 'go';
    this.turn = null;
    this.deadline = null;
    this.lastLaid = last;
    this.arm(TIMING.goMs, 'newCount');
  }

  newCount() {
    this.seq = [];
    this.count = 0;
    this.goBy = null;
    this.phase = 'play';
    const last = this.lastLaid;
    if (!this.hands[0].length && !this.hands[1].length) return this.endPlay();
    // The one who didn't lay the last card starts the next count (if they have cards).
    this.turn = this.hands[1 - last].length ? 1 - last : last;
    this.armTurn();
  }

  endPlay() {
    this.clearTimer();
    this.phase = 'show';
    this.turn = null;
    this.deadline = null;
    this.showStep = 0;
    this.arm(TIMING.goMs, 'showNext');
  }

  /** The show, a step at a time: the non-dealer's hand, the dealer's, then the crib. */
  showNext() {
    const order = [1 - this.dealer, this.dealer, 'crib'];
    if (this.showStep >= order.length) return this.newDeal();
    const who = order[this.showStep++];
    const cards = who === 'crib' ? this.crib.slice().sort(byRank) : this.kept[who];
    const counted = who !== 'crib' && this.forfeit[who] ? { total: 0, items: [{ kind: 'late', cards: [], pts: 0 }] } : scoreHand(cards, this.starter, who === 'crib');
    const { total, items } = counted;
    this.shows.push({ who, cards, items, total });
    if (this.peg(who === 'crib' ? this.dealer : who, total, [who === 'crib' ? 'crib' : 'hand'])) return;
    this.arm(this.showStep >= order.length ? TIMING.showStepMs + TIMING.nextMs : TIMING.showStepMs, 'showNext');
  }

  /** One timer at a time; a player's clock (the Timer setting can turn it off) or the game's own pace. */
  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && (then === 'discardTimeUp' || then === 'turnTimeUp')) return;
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
    if (!this.clock && (this.after === 'discardTimeUp' || this.after === 'turnTimeUp')) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'discard' && this.phase === 'discard' && !this.discarded[slot]) {
      const p = input.cards;
      if (!Array.isArray(p) || p.length !== 2 || p[0] === p[1] || !p.every((i) => Number.isInteger(i) && i >= 0 && i < 6)) return;
      return this.discard(slot, p);
    }
    if (input.type === 'lay' && this.phase === 'play' && slot === this.turn) {
      const i = input.card;
      if (!Number.isInteger(i) || i < 0 || i >= this.hands[slot].length) return;
      if (this.count + valueOf(this.hands[slot][i]) > 31) return;
      this.lay(slot, i);
    }
  }

  view(viewer) {
    const showing = this.phase === 'show' || (this.phase === 'over' && this.shows.length);
    return {
      phase: this.phase,
      deal: this.dealNo,
      dealer: this.dealer,
      target: this.target,
      scores: this.scores,
      backPegs: this.backPegs,
      hand: viewer === null ? null : this.hands[viewer],
      handCounts: this.hands.map((h) => h.length),
      discarded: this.discarded,
      cribCount: this.crib.length,
      starter: this.starter,
      played: this.played,
      seq: this.seq,
      count: this.count,
      turn: this.turn,
      goBy: this.phase === 'play' && this.turn !== null && this.goBy === 1 - this.turn ? this.goBy : null,
      event: this.event,
      n: this.n,
      shows: showing ? this.shows : [],
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    const v = this.view(slot);
    return Object.assign(v, {
      you: slot,
      playable: this.phase === 'play' && this.turn === slot ? this.hands[slot].map((c) => this.count + valueOf(c) <= 31) : null,
    });
  }
}

export default {
  id: 'cribbage',
  category: 'board',
  phoneOnly: true, // (your hand is secret)
  handheld: true,
  music: 'thinking',
  name: 'Cribbage',
  tagline: 'Lay two for the crib, peg fifteens, pairs and runs as you play to 31, then count your hand. First to 121.',
  create: (ctx) => new Cribbage(ctx),
};
