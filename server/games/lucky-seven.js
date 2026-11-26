// Lucky Seven: push your luck. One deck between you, face up: numbers 1 to 9 (there are more of the
// low ones: nine 1s, eight 2s … one 9), four Doubles and four Shields. Take turns: flip a card, or
// stop and bank what you have (after your first flip of the round). A number you've already got this round and you're bust (nothing for
// the round), unless you hold a Shield, which takes the hit instead. A Double doubles your round when
// you bank it. Seven different numbers is a Lucky Seven: bank them with 15 more, and the round ends
// for both of you there and then. When you've both stopped or gone bust, the round is over: add up.
// First to the target (200) at the end of a round wins; level at the top, play another round.
//
// The deck carries on from round to round (count the cards!) and is shuffled again when it runs out.

import { settingOf } from './options.js';

export const TARGET = 200;
export const LUCKY_BONUS = 15;
export const TIMING = { turnMs: 20000, flipMs: 700, roundEndMs: 4500 };

/** The deck: '1' … '9' (10 − n of each), 'D' (double), 'S' (shield). */
export function fullDeck() {
  const out = [];
  for (let n = 1; n <= 9; n++) for (let k = 0; k < 10 - n; k++) out.push(String(n));
  for (let k = 0; k < 4; k++) out.push('D', 'S');
  return out;
}

export const isNumber = (c) => /^[1-9]$/.test(c);

/** What a round's cards bank: the numbers added up, doubled with a Double, plus a Lucky Seven's 15. */
export function bank(cards) {
  const nums = cards.filter(isNumber).map(Number);
  let total = nums.reduce((a, b) => a + b, 0);
  if (cards.includes('D')) total *= 2;
  if (new Set(nums).size >= 7) total += LUCKY_BONUS;
  return total;
}

export class LuckySeven {
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
    this.round = 0;
    this.winner = null;
    this.starter = 1;
    this.deck = this.shuffle(fullDeck());
    this.gone = []; // drawn since the last shuffle (every one face up: anyone can count them)
    this.newRound();
  }

  shuffle(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.hands = [[], []]; // this round's cards (a Shield used up leaves the hand)
    this.status = ['in', 'in']; // 'in' | 'stopped' | 'bust' | 'lucky'
    this.gains = [0, 0];
    this.flipped = [false, false]; // you flip at least once a round before you can stop
    this.event = null; // { by, card, what: 'number' | 'bust' | 'shield' | 'double' | 'lucky', n }
    this.n = 0;
    this.result = null;
    this.phase = 'play';
    this.turn = this.starter;
    this.armTurn();
  }

  draw() {
    if (!this.deck.length) {
      // Out of cards: every card not on the table now is shuffled into a new deck.
      const left = fullDeck();
      for (const c of this.hands.flat()) left.splice(left.indexOf(c), 1);
      this.deck = this.shuffle(left);
      this.gone = this.hands.flat();
    }
    const c = this.deck.pop();
    this.gone.push(c);
    return c;
  }

  flip(s) {
    this.flipped[s] = true;
    const c = this.draw();
    const hand = this.hands[s];
    this.n++;
    if (isNumber(c) && hand.includes(c)) {
      const shield = hand.indexOf('S');
      if (shield >= 0) {
        hand.splice(shield, 1); // the Shield takes the hit (and the repeat goes too)
        this.event = { by: s, card: c, what: 'shield', n: this.n };
      } else {
        hand.push(c);
        this.status[s] = 'bust';
        this.event = { by: s, card: c, what: 'bust', n: this.n };
      }
    } else {
      hand.push(c);
      this.event = { by: s, card: c, what: c === 'D' ? 'double' : c === 'S' ? 'shield-in' : 'number', n: this.n };
      if (new Set(hand.filter(isNumber)).size >= 7) {
        this.status[s] = 'lucky';
        this.event.what = 'lucky';
        return this.endRound();
      }
    }
    this.next(s);
  }

  stop(s) {
    this.status[s] = 'stopped';
    this.n++;
    this.event = { by: s, what: 'stop', n: this.n };
    this.next(s);
  }

  /** The other's turn if they're still in, else yours again, else the round is over. */
  next(s) {
    const o = 1 - s;
    if (this.status[o] === 'in') this.turn = o;
    else if (this.status[s] === 'in') this.turn = s;
    else return this.endRound();
    this.armTurn();
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  /** Out of time: you stop (or flip, if you haven't flipped yet this round). */
  turnTimeUp() {
    if (this.flipped[this.turn]) this.stop(this.turn);
    else this.flip(this.turn);
  }

  endRound() {
    this.clearTimer();
    this.turn = null;
    this.deadline = null;
    for (const s of [0, 1]) {
      // A Lucky Seven ends the round: the other banks what they have (unless bust).
      if (this.status[s] === 'in') this.status[s] = 'stopped';
      this.gains[s] = this.status[s] === 'bust' ? 0 : bank(this.hands[s]);
      this.scores[s] += this.gains[s];
    }
    this.result = { gains: this.gains.slice(), status: this.status.slice() };
    const [a, b] = this.scores;
    if ((a >= this.target || b >= this.target) && a !== b) {
      this.winner = a > b ? 0 : 1;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.roundEndMs, 'newRound');
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
    if (this.phase !== 'play' || slot !== this.turn) return;
    if (input.type === 'flip') this.flip(slot);
    else if (input.type === 'stop' && this.flipped[slot]) this.stop(slot);
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      target: this.target,
      scores: this.scores,
      hands: this.hands,
      status: this.status,
      banked: this.hands.map((h) => bank(h)),
      flipped: this.flipped,
      turn: this.turn,
      event: this.event,
      n: this.n,
      deckLeft: this.deck.length,
      gone: this.gone,
      result: this.result,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

export default {
  id: 'lucky-seven',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Lucky Seven',
  tagline: 'Flip a card or bank what you have: a number you already hold and you\'re bust. Seven different numbers is a Lucky Seven. First to 200.',
  create: (ctx) => new LuckySeven(ctx),
};
