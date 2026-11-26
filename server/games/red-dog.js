// Red Dog, head to head, for play chips only. You each start with 1,000. Each hand you both put in
// the ante (50), and two cards are turned up for you both (aces high, twos low). The gap between
// them is the "spread": the next card must fall strictly between them to win.
//   Cards next to each other (spread 0): no bet; your antes come back.
//   A pair: a third card is turned at once. Three of a kind pays 11 to 1; else your antes come back.
//   Otherwise you each decide in secret: stay, raise one ante more, or raise two. Then the next card
//   is turned for you both. Inside wins at 5 to 1 (spread 1), 4 to 1 (2), 2 to 1 (3) or evens (4 or
//   more); outside, or matching a card, loses the lot.
// You share every card, so it's your raises that make the difference. One deck, all face up, and
// only shuffled when it runs out: count it. Most chips after 12 hands (or 8 or 16) wins. Out of
// time deciding: you fold, and your ante's lost.

import { settingOf } from './options.js';
import { deck, rankOf } from './holdem-hands.js';

export const START_CHIPS = 1000;
export const ANTE = 50;
export const HANDS = 12;
export const TIMING = { raiseMs: 15000, revealMs: 3800, pushMs: 2600 };

/** What a winning hand pays for each chip in, by the spread. */
export const payFor = (spread) => (spread === 1 ? 5 : spread === 2 ? 4 : spread === 3 ? 2 : 1);
export const spreadOf = (posts) => Math.abs(rankOf(posts[0]) - rankOf(posts[1])) - 1;

/** How many cards in `rest` fall strictly between the posts. */
export function between(posts, rest) {
  const lo = Math.min(rankOf(posts[0]), rankOf(posts[1]));
  const hi = Math.max(rankOf(posts[0]), rankOf(posts[1]));
  return rest.filter((c) => rankOf(c) > lo && rankOf(c) < hi).length;
}

export class RedDog {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.hands = settingOf(ctx, 'hands', HANDS);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.chips = [START_CHIPS, START_CHIPS];
    this.pack = this.shuffled(deck());
    this.gone = []; // turned up since the last shuffle (all face up: count them)
    this.handNo = 0;
    this.winner = null;
    this.posts = null;
    this.newHand();
  }

  shuffled(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  draw() {
    if (!this.pack.length) {
      // Out of cards: all but the ones on the table go back in, shuffled.
      const out = new Set(this.posts || []);
      this.pack = this.shuffled(deck().filter((c) => !out.has(c)));
      this.gone = [...out];
    }
    const c = this.pack.pop();
    this.gone.push(c);
    return c;
  }

  newHand() {
    this.clearTimer();
    if (this.handNo >= this.hands || this.chips.some((c) => c <= 0)) return this.finish();
    this.handNo++;
    this.stakes = this.chips.map((c) => Math.min(ANTE, c)); // in for this hand
    this.posts = null;
    this.posts = [this.draw(), this.draw()];
    this.third = null;
    this.raises = [null, null]; // 0, 1 or 2 antes more; 'fold' when out of time
    this.result = null;
    this.spread = spreadOf(this.posts);
    if (this.spread < 0) {
      // A pair: the third card at once.
      this.third = this.draw();
      const trips = rankOf(this.third) === rankOf(this.posts[0]);
      const change = this.stakes.map((st) => (trips ? st * 11 : 0));
      return this.settle(change, trips ? 'trips' : 'pair');
    }
    if (this.spread === 0) return this.settle([0, 0], 'next');
    this.phase = 'raise';
    this.deadline = this.clock ? this.ctx.now() + TIMING.raiseMs : null;
    this.arm(TIMING.raiseMs, 'raiseTimeUp');
  }

  /** Out of time: fold (the ante's lost). */
  raiseTimeUp() {
    for (const s of [0, 1]) if (this.raises[s] === null) this.raises[s] = 'fold';
    this.reveal();
  }

  reveal() {
    this.clearTimer();
    this.deadline = null;
    this.third = this.draw();
    const lo = Math.min(...this.posts.map(rankOf));
    const hi = Math.max(...this.posts.map(rankOf));
    const r = rankOf(this.third);
    const inside = r > lo && r < hi;
    const change = [0, 1].map((s) => {
      if (this.raises[s] === 'fold') return -this.stakes[s];
      const stake = this.stakes[s] + Math.min(this.raises[s] * ANTE, this.chips[s] - this.stakes[s]);
      return inside ? stake * payFor(this.spread) : -stake;
    });
    this.settle(change, inside ? 'inside' : r === lo || r === hi ? 'post' : 'outside');
  }

  settle(change, outcome) {
    for (const s of [0, 1]) this.chips[s] = Math.max(0, this.chips[s] + change[s]);
    this.result = { change, outcome, raises: this.raises.slice(), spread: this.spread };
    this.phase = 'reveal';
    this.deadline = null;
    this.arm(outcome === 'next' || outcome === 'pair' ? TIMING.pushMs : TIMING.revealMs, 'newHand');
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
    if (!this.clock && then === 'raiseTimeUp') return;
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
    if (!this.clock && this.after === 'raiseTimeUp') return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'raise' || this.phase !== 'raise' || this.raises[slot] !== null) return;
    if (![0, 1, 2].includes(input.raise)) return;
    this.raises[slot] = input.raise;
    if (this.raises[0] !== null && this.raises[1] !== null) return this.reveal();
    this.ctx.update();
  }

  view(viewer) {
    const open = this.phase !== 'raise';
    return {
      phase: this.phase,
      hand: this.handNo,
      hands: this.hands,
      chips: this.chips,
      ante: ANTE,
      stakes: this.stakes,
      posts: this.posts,
      spread: this.spread,
      pays: this.spread > 0 ? payFor(this.spread) : null,
      third: this.third,
      locked: this.raises.map((r) => r !== null),
      // Your own raise as you chose it; theirs only once the card is turned.
      raises: this.raises.map((r, s) => (open || s === viewer ? r : null)),
      inside: this.phase === 'raise' ? between(this.posts, this.pack) : null, // (count them: every card is face up)
      packLeft: this.pack.length,
      gone: this.gone,
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
  id: 'red-dog',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Red Dog',
  tagline: 'The same two cards for you both: will the next fall in between? Raise in secret; the best raiser takes the chips.',
  create: (ctx) => new RedDog(ctx),
};
