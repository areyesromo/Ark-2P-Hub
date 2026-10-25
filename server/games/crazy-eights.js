// Crazy Eights. A card game for two phones: your hand is secret on your phone, the TV shows the
// pile. On your turn play a card that matches the top card's suit or rank, or an 8 at any time
// (then call the suit). Can't (or won't) play? Draw one: play it if it fits, or pass. With action
// cards on, a 2 makes the other player draw two (unless they answer with a 2: they stack), a Jack
// gives you another turn, and the Queen of spades makes them draw five. First to empty their hand
// wins the hand and scores what's left in the other's: 8s 50, picture cards 10, aces 1, the rest
// face value. One hand, or first to 100 or 200.

import { settingOf } from './options.js';

export const HAND_SIZE = 7;
export const TARGET = 100;
export const TIMING = { turnMs: 30000, handEndMs: 6000 };
export const SUITS = ['S', 'H', 'D', 'C'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

/** A card's rank and suit ('10H' -> ['10', 'H']). */
export const rankOf = (c) => c.slice(0, -1);
export const suitOf = (c) => c.slice(-1);

/** A fresh 52-card deck. */
export function deck() {
  return SUITS.flatMap((s) => RANKS.map((r) => r + s));
}

/** What a card left in your hand costs you. */
export function value(c) {
  const r = rankOf(c);
  return r === '8' ? 50 : r === 'A' ? 1 : 'JQK'.includes(r) || r === '10' ? 10 : Number(r);
}

const isCard = (c) => typeof c === 'string' && SUITS.includes(suitOf(c)) && RANKS.includes(rankOf(c));
/** Hands are shown grouped by suit, low to high. */
const order = (c) => SUITS.indexOf(suitOf(c)) * 20 + RANKS.indexOf(rankOf(c));

export class CrazyEights {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.actions = Boolean(settingOf(ctx, 'actions', 1));
    this.target = settingOf(ctx, 'target', TARGET); // 0: one hand
    this.timer = null;
    this.opener = 1; // who opens the match: player 1 the first time, then the other each rematch
  }

  start() {
    this.opener = 1 - this.opener;
    this.turns = 0;
    this.scores = [0, 0];
    this.hand = 0;
    this.winner = null;
    this.events = { plays: 0, draws: 0, eights: 0, penalties: 0 };
    this.deal();
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  /** A new hand: seven each, a plain top card, and the players take turns to start. */
  deal() {
    this.hand++;
    this.deck = this.shuffle(deck());
    this.hands = [this.deck.splice(0, HAND_SIZE), this.deck.splice(0, HAND_SIZE)];
    // No 8 or action card to start on: those go back in the pile.
    let i = this.deck.findIndex((c) => !this.special(c) && rankOf(c) !== '8');
    this.discard = this.deck.splice(i, 1);
    this.suit = suitOf(this.discard[0]);
    this.pending = 0;
    this.pendingKind = null;
    this.result = null;
    this.last = null;
    this.turn = (this.opener + this.hand - 1) % 2; // the players take turns to open a hand
    this.phase = 'play';
    this.turnStart();
  }

  /** An action card (with action cards on): 2, Jack, Queen of spades. */
  special(c) {
    return this.actions && (rankOf(c) === '2' || rankOf(c) === 'J' || c === 'QS');
  }

  get top() {
    return this.discard[this.discard.length - 1];
  }

  /** A fresh turn (or a fresh clock for calling the suit). */
  turnStart() {
    this.drew = null;
    this.turns++;
    this.clock(TIMING.turnMs, () => this.timeUp());
    this.ctx.update();
  }

  clock(ms, onEnd) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.turnEnds = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      onEnd();
    }, ms);
  }

  /** Can `slot` play card c now? */
  canPlay(slot, c) {
    if (this.phase !== 'play' || this.turn !== slot || !this.hands[slot].includes(c)) return false;
    if (this.drew && c !== this.drew) return false; // after drawing, only the card you drew
    if (this.pending) return this.pendingKind === '2' && rankOf(c) === '2'; // answer a 2 with a 2
    return rankOf(c) === '8' || suitOf(c) === this.suit || rankOf(c) === rankOf(this.top);
  }

  play(slot, c) {
    this.hands[slot].splice(this.hands[slot].indexOf(c), 1);
    this.discard.push(c);
    this.suit = rankOf(c) === '8' ? null : suitOf(c); // an 8's suit is whatever gets called
    this.last = { slot, card: c, kind: 'play' };
    this.events.plays++;
    if (!this.hands[slot].length) return this.handOver(slot);
    if (rankOf(c) === '8') {
      this.events.eights++;
      this.phase = 'suit';
      this.clock(TIMING.turnMs, () => this.callSuit(this.mostHeld(slot)));
      return this.ctx.update();
    }
    if (this.actions && rankOf(c) === '2') {
      this.pending += 2;
      this.pendingKind = '2';
    } else if (this.actions && c === 'QS') {
      this.pending = 5;
      this.pendingKind = 'Q';
    }
    if (this.actions && rankOf(c) === 'J') return this.turnStart(); // a Jack: go again
    this.next();
  }

  /** The suit this player holds most of (for a suit call that ran out of time). */
  mostHeld(slot) {
    const count = (s) => this.hands[slot].filter((c) => suitOf(c) === s && rankOf(c) !== '8').length;
    return SUITS.reduce((best, s) => (count(s) > count(best) ? s : best), SUITS[0]);
  }

  callSuit(suit) {
    this.suit = suit;
    this.phase = 'play';
    this.next();
  }

  next() {
    this.turn = 1 - this.turn;
    this.turnStart();
  }

  /** One card off the draw pile, the discards shuffled back in when it's empty (null if there's none at all). */
  takeCard() {
    if (!this.deck.length && this.discard.length > 1) this.deck = this.shuffle(this.discard.splice(0, this.discard.length - 1));
    return this.deck.length ? this.deck.shift() : null;
  }

  draw(slot) {
    if (this.pending) {
      // Take what you're owed (as many as there are), and that's your turn.
      let taken = 0;
      for (let n = this.pending; n > 0; n--) {
        const c = this.takeCard();
        if (c) {
          this.hands[slot].push(c);
          taken++;
        }
      }
      this.events.penalties++;
      this.last = { slot, kind: 'penalty', count: taken };
      this.pending = 0;
      this.pendingKind = null;
      return this.next();
    }
    const c = this.takeCard();
    this.events.draws++;
    this.last = { slot, kind: 'draw' };
    if (!c) return this.next(); // nothing left anywhere: the turn passes
    this.hands[slot].push(c);
    this.drew = c;
    this.ctx.update();
  }

  /** The clock ran out: take what's owed, or draw and pass. */
  timeUp() {
    const slot = this.turn;
    if (this.pending) return this.draw(slot);
    if (!this.drew) {
      this.draw(slot);
      if (this.turn !== slot) return; // (nothing to draw: already passed)
    }
    this.next();
  }

  handOver(slot) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    const points = this.hands[1 - slot].reduce((sum, c) => sum + value(c), 0);
    this.scores[slot] += points;
    this.result = { winner: slot, points, left: this.hands.map((h) => h.slice()) };
    if (!this.target || this.scores[slot] >= this.target) {
      this.winner = slot;
      this.phase = 'over';
      this.turnEnds = null;
      return this.ctx.update();
    }
    this.phase = 'handEnd';
    this.clock(TIMING.handEndMs, () => this.deal());
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.turn !== slot) return;
    if (this.phase === 'suit') {
      if (input.type === 'suit' && SUITS.includes(input.suit)) this.callSuit(input.suit);
      return;
    }
    if (this.phase !== 'play') return;
    if (input.type === 'play' && isCard(input.card) && this.canPlay(slot, input.card)) return this.play(slot, input.card);
    if (input.type === 'draw' && !this.drew) return this.draw(slot);
    if (input.type === 'pass' && this.drew) return this.next();
  }

  common() {
    return {
      phase: this.phase,
      hand: this.hand,
      top: this.top,
      suit: this.suit,
      deckCount: this.deck.length,
      counts: this.hands.map((h) => h.length),
      turn: this.turn,
      pending: this.pending,
      pendingKind: this.pendingKind,
      drawn: Boolean(this.drew), // the player on turn has drawn (not what)
      turns: this.turns, // a new number each turn
      last: this.last,
      actions: this.actions,
      target: this.target,
      timeLeftMs: this.turnEnds ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      turnMs: TIMING.turnMs,
      // At the end of a hand both hands are shown.
      result: this.result,
      events: this.events,
      scores: this.scores,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.common(), { players: this.ctx.players });
  }

  playerView(slot) {
    const cards = this.hands[slot].slice().sort((a, b) => order(a) - order(b));
    return Object.assign(this.common(), {
      you: slot,
      cards, // your hand (`hand` is the hand number)
      playable: cards.filter((c) => this.canPlay(slot, c)),
      drew: this.turn === slot ? this.drew : null,
      canPass: this.phase === 'play' && this.turn === slot && Boolean(this.drew),
    });
  }
}

export default {
  id: 'crazy-eights',
  name: 'Crazy Eights',
  phoneOnly: true, // your hand is secret, on your phone
  tagline: 'Card game: match the top card\'s suit or rank, eights are wild (call the suit), 2s make them draw. First to empty their hand wins the hand.',
  create: (ctx) => new CrazyEights(ctx),
};
