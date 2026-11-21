// Gin Rummy. Ten cards each from a shuffled deck, one card face up to start the discard pile. On
// your turn take the top of the deck or the discard pile, then throw one card away (not the one you
// just took from the pile). Make melds: sets (three or four of a rank) and runs (three or more in a
// row in one suit, ace low). The rest is deadwood, counted by face value (pictures 10, aces 1).
// With 10 or less deadwood you may knock as you throw away: both hands go down, the other lays
// off what fits on your melds, and you score the difference. All melded (gin) scores 25 more and
// the other can't lay off; if the other ends up with as little deadwood as the knocker or less,
// they undercut and score the difference plus 25. Down to the last two cards in the deck: the hand
// is a draw. First to the target wins.

import { settingOf } from './options.js';

export const TARGET = 100;
export const KNOCK = 10;
export const BONUS = 25;
export const TIMING = { turnMs: 30000, showMs: 9000 };

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];

export const rankOf = (c) => RANKS.indexOf(c.slice(0, -1)) + 1; // 1 (ace) .. 13 (king)
export const suitOf = (c) => c.slice(-1);
export const valueOf = (c) => Math.min(10, rankOf(c));

export function deck() {
  const out = [];
  for (const s of SUITS) for (const r of RANKS) out.push(r + s);
  return out;
}

/** Every meld that can be made from these cards (sets of 3 or 4, runs of 3 or more). */
function melds(cards) {
  const out = [];
  const byRank = {};
  for (const c of cards) (byRank[rankOf(c)] = byRank[rankOf(c)] || []).push(c);
  for (const group of Object.values(byRank)) {
    if (group.length >= 3) {
      out.push(group.slice());
      if (group.length === 4) for (let skip = 0; skip < 4; skip++) out.push(group.filter((_, i) => i !== skip));
    }
  }
  for (const s of SUITS) {
    const line = cards.filter((c) => suitOf(c) === s).sort((a, b) => rankOf(a) - rankOf(b));
    for (let i = 0; i < line.length; i++) {
      let run = [line[i]];
      for (let j = i + 1; j < line.length && rankOf(line[j]) === rankOf(run[run.length - 1]) + 1; j++) {
        run = run.concat(line[j]);
        if (run.length >= 3) out.push(run.slice());
      }
    }
  }
  return out;
}

/** The arrangement with the least deadwood: { melds, deadwood (cards), points }. */
export function best(cards) {
  const all = melds(cards);
  let top = { melds: [], deadwood: cards.slice(), points: cards.reduce((n, c) => n + valueOf(c), 0) };
  const walk = (from, used, chosen) => {
    const left = cards.filter((c) => !used.has(c));
    const points = left.reduce((n, c) => n + valueOf(c), 0);
    if (points < top.points) top = { melds: chosen.map((m) => m.slice()), deadwood: left, points };
    for (let i = from; i < all.length; i++) {
      if (all[i].some((c) => used.has(c))) continue;
      for (const c of all[i]) used.add(c);
      chosen.push(all[i]);
      walk(i + 1, used, chosen);
      chosen.pop();
      for (const c of all[i]) used.delete(c);
    }
  };
  walk(0, new Set(), []);
  return top;
}

/** The deadwood left after throwing away each card of an 11-card hand: the least, and with which card. */
export function bestDiscard(hand) {
  let top = null;
  for (const c of hand) {
    const b = best(hand.filter((x) => x !== c));
    if (!top || b.points < top.points) top = { card: c, points: b.points };
  }
  return top;
}

/** Lays the defender's deadwood off on the knocker's melds, as far as it goes. Gives what's left. */
export function layOff(knockerMelds, cards) {
  const melds2 = knockerMelds.map((m) => m.slice());
  let left = cards.slice();
  const laid = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const c of left) {
      const fits = melds2.find((m) => {
        const set = m.every((x) => rankOf(x) === rankOf(m[0]));
        if (set && m.length < 4 && rankOf(c) === rankOf(m[0])) return true;
        if (!set && suitOf(c) === suitOf(m[0])) {
          const rs = m.map(rankOf);
          return rankOf(c) === Math.min(...rs) - 1 || rankOf(c) === Math.max(...rs) + 1;
        }
        return false;
      });
      if (fits) {
        fits.push(c);
        fits.sort((a, b) => rankOf(a) - rankOf(b));
        laid.push(c);
        left = left.filter((x) => x !== c);
        changed = true;
        break;
      }
    }
  }
  return { left, laid, melds: melds2 };
}

export class GinRummy {
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
    this.handNo = 0;
    this.winner = null;
    this.dealer = 1;
    this.newHand();
  }

  newHand() {
    this.clearTimer();
    this.handNo++;
    this.dealer = 1 - this.dealer;
    const d = deck();
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    this.hands = [d.slice(0, 10), d.slice(10, 20)];
    this.pile = [d[20]];
    this.stock = d.slice(21);
    this.turn = 1 - this.dealer; // (the one who didn't deal goes first)
    this.took = null; // the card just taken from the pile (it can't go straight back)
    this.last = null; // what happened last, for the TV: { by, what: 'stock' | 'pile' | 'discard', card? }
    this.result = null;
    this.phase = 'draw';
    this.armTurn();
  }

  // ---- a turn -------------------------------------------------------------------------

  draw(slot, from) {
    if (from === 'pile') {
      const c = this.pile.pop();
      this.hands[slot].push(c);
      this.took = c;
      this.last = { by: slot, what: 'pile', card: c };
    } else {
      this.hands[slot].push(this.stock.pop());
      this.took = null;
      this.last = { by: slot, what: 'stock' };
    }
    this.phase = 'discard';
    this.armTurn();
  }

  discard(slot, card, knock) {
    this.hands[slot] = this.hands[slot].filter((c) => c !== card);
    this.pile.push(card);
    this.last = { by: slot, what: knock ? 'knock' : 'discard', card };
    if (knock) return this.showdown(slot);
    // Two cards left in the deck: nobody can win this hand.
    if (this.stock.length <= 2) return this.endHand({ draw: true });
    this.turn = 1 - slot;
    this.took = null;
    this.phase = 'draw';
    this.armTurn();
  }

  /** Out of time: take the top of the deck and throw it straight back (or, holding 11, the worst card). */
  turnTimeUp() {
    const s = this.turn;
    if (this.phase === 'draw') {
      this.draw(s, 'stock');
      return this.discard(s, this.hands[s][this.hands[s].length - 1], false);
    }
    const worst = this.hands[s].filter((c) => c !== this.took).sort((a, b) => valueOf(b) - valueOf(a))[0];
    this.discard(s, worst, false);
  }

  // ---- the end of a hand ------------------------------------------------------------------

  showdown(knocker) {
    const other = 1 - knocker;
    const k = best(this.hands[knocker]);
    const d = best(this.hands[other]);
    const gin = k.points === 0;
    const laid = gin ? { left: d.deadwood, laid: [], melds: k.melds } : layOff(k.melds, d.deadwood);
    const defender = laid.left.reduce((n, c) => n + valueOf(c), 0);
    let winner;
    let points;
    let kind;
    if (gin) { winner = knocker; points = defender + BONUS; kind = 'gin'; }
    else if (defender <= k.points) { winner = other; points = k.points - defender + BONUS; kind = 'undercut'; }
    else { winner = knocker; points = defender - k.points; kind = 'knock'; }
    this.endHand({
      knocker, winner, points, kind,
      shown: {
        [knocker]: { melds: laid.melds.map((m) => m.filter((c) => !laid.laid.includes(c))), deadwood: k.deadwood, points: k.points },
        [other]: { melds: d.melds, laid: laid.laid, deadwood: laid.left, points: defender },
      },
    });
  }

  endHand(result) {
    this.clearTimer();
    this.result = result;
    this.deadline = null;
    if (!result.draw) this.scores[result.winner] += result.points;
    const top = this.scores[0] >= this.target || this.scores[1] >= this.target;
    if (top) {
      this.winner = this.scores[0] === this.scores[1] ? null : this.scores[0] > this.scores[1] ? 0 : 1;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'show';
    this.ready = [false, false];
    this.after = 'newHand';
    this.due = this.ctx.now() + TIMING.showMs;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newHand(); }, TIMING.showMs);
    this.ctx.update();
  }

  // ---- clock -------------------------------------------------------------------------------

  armTurn() {
    this.clearTimer();
    this.after = 'turnTimeUp';
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.ctx.update();
    if (!this.clock) return;
    this.due = this.deadline;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.turnTimeUp(); }, TIMING.turnMs);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (this.after === 'turnTimeUp' && !this.clock) return;
    if (this.deadline) this.deadline += downMs;
    const then = this.after;
    const ms = Math.max(0, this.due + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  // ---- input -------------------------------------------------------------------------------

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'next' && this.phase === 'show') {
      this.ready[slot] = true;
      if (this.ready[0] && this.ready[1]) return this.newHand();
      return this.ctx.update();
    }
    if (slot !== this.turn) return;
    if (this.phase === 'draw' && input.type === 'draw' && (input.from === 'stock' || input.from === 'pile')) {
      if (input.from === 'pile' && !this.pile.length) return;
      return this.draw(slot, input.from);
    }
    if (this.phase === 'discard' && (input.type === 'discard' || input.type === 'knock')) {
      const card = input.card;
      if (typeof card !== 'string' || !this.hands[slot].includes(card) || card === this.took) return;
      if (input.type === 'knock' && best(this.hands[slot].filter((c) => c !== card)).points > KNOCK) return;
      this.discard(slot, card, input.type === 'knock');
    }
  }

  // ---- views ---------------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      hand: this.handNo,
      turn: this.turn,
      dealer: this.dealer,
      counts: [this.hands[0].length, this.hands[1].length],
      pile: this.pile.slice(-3), // the top few (the top is last)
      stock: this.stock.length,
      last: this.last,
      result: this.result,
      ready: this.phase === 'show' ? this.ready : null,
      scores: this.scores,
      target: this.target,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  /** Your own hand, arranged in its best melds, and what each throw-away would leave. */
  playerView(slot) {
    const hand = this.hands[slot];
    const b = best(hand);
    const v = Object.assign(this.view(), { you: slot, cards: hand.slice(), melds: b.melds, deadwood: b.deadwood, points: b.points, took: this.took });
    if (this.phase === 'discard' && this.turn === slot) {
      // What each card would leave, so the phone can say which throw-aways let you knock.
      v.after = Object.fromEntries(hand.filter((c) => c !== this.took).map((c) => [c, best(hand.filter((x) => x !== c)).points]));
    }
    return v;
  }
}

export default {
  id: 'gin-rummy',
  category: 'board',
  phoneOnly: true, // (your hand is secret)
  handheld: true,
  music: 'thinking',
  name: 'Gin Rummy',
  tagline: 'Draw and throw away to make sets and runs. Knock with 10 or less left over, or go gin. First to 100 points.',
  create: (ctx) => new GinRummy(ctx),
};
