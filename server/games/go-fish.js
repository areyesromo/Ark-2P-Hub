// Go Fish for two. Seven cards each (secret, on your phone), the rest face down in the pond. On your
// go, ask the other for a rank you hold ("any sevens?"): they hand over every one, and you go again.
// None? "Go fish": draw from the pond, and if it's the rank you asked for, go again; else it's their
// go. Four of a rank is a book, laid down at once. Run out of cards and you draw one (if the pond has
// any). When all thirteen books are down, the most books wins. Every ask and answer is out loud, so
// remember who asked for what. Out of time: you go fishing without asking.

import { settingOf } from './options.js';

export const HAND = 7;
export const TIMING = { turnMs: 25000, fishMs: 900, endMs: 5000 };
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
export const rankOf = (c) => c.slice(0, -1);

export class GoFish {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
    this.starter = 1;
  }

  start() {
    this.clearTimer();
    const cards = [];
    for (const s of SUITS) for (const r of RANKS) cards.push(r + s);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.hands = [cards.slice(0, HAND), cards.slice(HAND, 2 * HAND)];
    this.pond = cards.slice(2 * HAND);
    this.books = [[], []];
    this.log = []; // every ask, out loud: { by, rank, got, fished: card drawn? (only its owner learns which), lucky, n }
    this.n = 0;
    this.winner = null;
    this.starter = 1 - this.starter;
    this.turn = this.starter;
    this.phase = 'play';
    for (const s of [0, 1]) this.layBooks(s);
    this.armTurn();
  }

  /** Lays down any four of a rank in `s`'s hand. */
  layBooks(s) {
    const count = {};
    for (const c of this.hands[s]) count[rankOf(c)] = (count[rankOf(c)] || 0) + 1;
    for (const r of Object.keys(count)) {
      if (count[r] < 4) continue;
      this.hands[s] = this.hands[s].filter((c) => rankOf(c) !== r);
      this.books[s].push(r);
    }
  }

  sortHand(s) {
    this.hands[s].sort((a, b) => RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)) || SUITS.indexOf(a.slice(-1)) - SUITS.indexOf(b.slice(-1)));
  }

  draw(s) {
    if (!this.pond.length) return null;
    const c = this.pond.pop();
    this.hands[s].push(c);
    this.sortHand(s);
    return c;
  }

  armTurn() {
    // An empty hand draws one first; with nothing to draw either, the go passes (or the game ends).
    for (let guard = 0; guard < 2; guard++) {
      if (this.done()) return this.finish();
      if (this.hands[this.turn].length) break;
      if (this.draw(this.turn)) { this.layBooks(this.turn); break; }
      this.turn = 1 - this.turn;
    }
    if (this.done()) return this.finish();
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  done() {
    return this.books[0].length + this.books[1].length === 13;
  }

  /** Out of time: no ask; you draw from the pond and the go passes. */
  turnTimeUp() {
    const s = this.turn;
    this.draw(s);
    this.layBooks(s);
    this.log.push({ by: s, rank: null, got: 0, fished: true, lucky: false, n: ++this.n });
    this.turn = 1 - s;
    this.armTurn();
  }

  ask(s, rank) {
    const o = 1 - s;
    const theirs = this.hands[o].filter((c) => rankOf(c) === rank);
    const entry = { by: s, rank, got: theirs.length, fished: false, lucky: false, n: ++this.n };
    this.log.push(entry);
    if (theirs.length) {
      this.hands[o] = this.hands[o].filter((c) => rankOf(c) !== rank);
      this.hands[s].push(...theirs);
      this.sortHand(s);
      this.layBooks(s);
      return this.armTurn(); // you go again
    }
    // Go fish.
    const c = this.draw(s);
    entry.fished = !!c;
    this.layBooks(s);
    if (c && rankOf(c) === rank) {
      entry.lucky = true; // (it shows: the card you asked for)
      return this.armTurn();
    }
    this.turn = o;
    this.armTurn();
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.turn = null;
    this.deadline = null;
    this.winner = this.books[0].length > this.books[1].length ? 0 : 1;
    this.ctx.update();
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
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
    if (input.type !== 'ask' || this.phase !== 'play' || slot !== this.turn) return;
    const r = input.rank;
    // You may only ask for a rank you hold.
    if (!RANKS.includes(r) || !this.hands[slot].some((c) => rankOf(c) === r)) return;
    this.ask(slot, r);
  }

  view(viewer) {
    return {
      phase: this.phase,
      hand: viewer === null ? null : this.hands[viewer],
      handCounts: this.hands.map((h) => h.length),
      pond: this.pond.length,
      books: this.books,
      log: this.log.slice(-60),
      n: this.n,
      turn: this.turn,
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
  id: 'go-fish',
  category: 'board',
  phoneOnly: true, // (your hand is secret)
  handheld: true,
  music: 'casual',
  name: 'Go Fish',
  tagline: 'Ask for a rank you hold: they hand them over, or you go fish. Four of a kind is a book; most books wins.',
  create: (ctx) => new GoFish(ctx),
};
