// Colour Clash: a card game for two phones with its own deck. Match the top card by colour or by
// what's on it (a number or a symbol), or play a Wild any time and pick the colour. Can't (or won't)?
// Draw one, and play it if it fits. Skip and Reverse give you another turn (there are only two of
// you), Draw Two makes the other draw two and lose their turn, Wild Draw Four the same with four.
// Down to one card? Press CLASH! before the other catches you, or you draw two. First to empty
// their hand scores what's left in the other's (numbers face value, symbols 20, wilds 50). If every
// card is in your hands and neither of you can play, the one holding fewer points wins the hand.
//
// The deck: in each of red, green, blue and yellow one 0, two each of 1 to 9, Skip, Reverse and
// Draw Two; four Wilds and four Wild Draw Fours (108). A card is 'R5#1' (colour, face, copy);
// faces are 0-9, S skip, R reverse, D draw two; wilds are 'W#n' and 'W4#n'.

import { settingOf } from './options.js';

export const COLOURS = ['R', 'G', 'B', 'Y'];
export const HAND_SIZE = 7;
export const TARGET = 200;
export const CATCH_DRAW = 2;
export const TIMING = { turnMs: 30000, handEndMs: 6000 };

export const isWild = (c) => c[0] === 'W';
export const colourOf = (c) => (isWild(c) ? null : c[0]);
/** What's on it: '0'-'9', 'S', 'R', 'D', 'W' or 'W4'. */
export const faceOf = (c) => c.split('#')[0].slice(isWild(c) ? 0 : 1);

export function deck() {
  const out = [];
  for (const col of COLOURS) {
    out.push(col + '0#1');
    for (const f of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D']) for (const n of [1, 2]) out.push(col + f + '#' + n);
  }
  for (let n = 1; n <= 4; n++) out.push('W#' + n, 'W4#' + n);
  return out;
}

export function points(c) {
  const f = faceOf(c);
  return isWild(c) ? 50 : /^\d$/.test(f) ? Number(f) : 20;
}

/** Whether `c` may go on `top` with `colour` the colour to follow. */
export function fits(c, top, colour) {
  return isWild(c) || colourOf(c) === colour || faceOf(c) === faceOf(top);
}

export class ColourClash {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.target = settingOf(ctx, 'target', TARGET); // 0: one hand
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.handNo = 0;
    this.winner = null;
    this.starter = 1;
    this.newHand();
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  newHand() {
    this.clearTimer();
    this.handNo++;
    this.starter = 1 - this.starter;
    this.stock = this.shuffle(deck());
    this.hands = [this.stock.splice(0, HAND_SIZE), this.stock.splice(0, HAND_SIZE)];
    // The first card face up is a number (anything else goes back in the deck).
    const i = this.stock.findIndex((c) => /^\d$/.test(faceOf(c)));
    this.pile = this.stock.splice(i, 1);
    this.colour = colourOf(this.pile[0]);
    this.turn = this.starter;
    this.drawn = null; // a card just drawn that fits: play it or keep it
    this.uncalled = null; // who's down to one card without calling (the other can catch them)
    this.stuck = 0; // turns in a row with nothing to draw and nothing played
    this.last = null; // { by, what: 'play' | 'draw' | 'keep' | 'catch' | 'call', card?, n? }
    this.result = null;
    this.phase = 'play';
    this.armTurn();
  }

  // ---- the deck ---------------------------------------------------------------------

  draw(slot, n) {
    const got = [];
    for (let k = 0; k < n; k++) {
      if (!this.stock.length) {
        if (this.pile.length <= 1) break; // (every card is in a hand)
        const top = this.pile.pop();
        this.stock = this.shuffle(this.pile);
        this.pile = [top];
      }
      got.push(this.stock.pop());
    }
    this.hands[slot].push(...got);
    if (this.uncalled === slot && this.hands[slot].length > 1) this.uncalled = null;
    return got;
  }

  playable(slot) {
    const top = this.pile[this.pile.length - 1];
    if (this.phase === 'drawn') return this.drawn && fits(this.drawn, top, this.colour) ? [this.drawn] : [];
    return this.hands[slot].filter((c) => fits(c, top, this.colour));
  }

  // ---- a turn -----------------------------------------------------------------------

  play(slot, card, colour, call) {
    this.hands[slot] = this.hands[slot].filter((c) => c !== card);
    this.pile.push(card);
    this.drawn = null;
    this.stuck = 0;
    this.last = { by: slot, what: 'play', card };
    // One card left: called or not (the other can catch it till your next go).
    if (this.hands[slot].length === 1) {
      this.uncalled = call ? null : slot;
      if (call) this.last.called = true;
    } else if (this.uncalled === slot) {
      this.uncalled = null;
    }
    if (!this.hands[slot].length) return this.endHand(slot);
    const face = faceOf(card);
    const other = 1 - slot;
    if (isWild(card)) {
      if (COLOURS.includes(colour)) this.colour = colour;
      else { this.phase = 'colour'; return this.armTurn(); } // (it waits for the colour)
    } else {
      this.colour = colourOf(card);
    }
    this.afterPlay(slot, face, other);
  }

  /** What a card does once its colour is settled: another turn, or the other's. */
  afterPlay(slot, face, other) {
    if (face === 'D') this.draw(other, 2);
    if (face === 'W4') this.draw(other, 4);
    const again = face === 'S' || face === 'R' || face === 'D' || face === 'W4';
    this.turn = again ? slot : other;
    this.phase = 'play';
    this.armTurn();
  }

  endHand(w, blocked) {
    this.clearTimer();
    const l = 1 - w;
    const held = (s) => this.hands[s].reduce((n, c) => n + points(c), 0);
    const pts = blocked ? held(l) - held(w) : held(l);
    this.scores[w] += pts;
    this.result = { winner: w, points: pts, left: this.hands[l].slice(), blocked: Boolean(blocked) };
    this.uncalled = null;
    this.deadline = null;
    if (!this.target || this.scores[w] >= this.target) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'handEnd';
    this.arm(TIMING.handEndMs, 'newHand');
  }

  // ---- the clock -----------------------------------------------------------------------

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    if (this.clock) this.arm(TIMING.turnMs, 'turnTimeUp');
    else { this.clearTimer(); this.after = null; this.ctx.update(); }
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.due = this.ctx.now() + ms;
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Out of time: a colour is picked for you, a drawn card kept, or you draw one and pass. */
  turnTimeUp() {
    const s = this.turn;
    if (this.phase === 'colour') return this.chooseColour(s, this.bestColour(s));
    if (this.phase === 'drawn') return this.keep(s);
    const got = this.draw(s, 1);
    this.last = { by: s, what: 'draw', n: got.length };
    if (this.blocked(got)) return;
    this.turn = 1 - s;
    this.armTurn();
  }

  /** A draw that found nothing, twice running (the other couldn't play either): the hand is blocked. */
  blocked(got) {
    this.stuck = got.length ? 0 : this.stuck + 1;
    if (this.stuck < 2) return false;
    const held = (s) => this.hands[s].reduce((n, c) => n + points(c), 0);
    this.endHand(held(0) <= held(1) ? 0 : 1, true);
    return true;
  }

  bestColour(s) {
    const count = Object.fromEntries(COLOURS.map((c) => [c, 0]));
    for (const c of this.hands[s]) if (colourOf(c)) count[colourOf(c)]++;
    return COLOURS.reduce((a, b) => (count[b] > count[a] ? b : a));
  }

  chooseColour(s, colour) {
    this.colour = colour;
    this.afterPlay(s, faceOf(this.pile[this.pile.length - 1]), 1 - s);
  }

  keep(s) {
    this.drawn = null;
    this.last = { by: s, what: 'keep' };
    this.turn = 1 - s;
    this.phase = 'play';
    this.armTurn();
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

  // ---- input ------------------------------------------------------------------------

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'handEnd' || this.phase === 'over') return;
    // Catching the other out, or calling late (both any time).
    if (input.type === 'catch' && this.uncalled === 1 - slot) {
      const got = this.draw(1 - slot, CATCH_DRAW);
      this.uncalled = null;
      this.last = { by: slot, what: 'catch', n: got.length };
      return this.ctx.update();
    }
    if (input.type === 'call' && this.uncalled === slot) {
      this.uncalled = null;
      this.last = { by: slot, what: 'call' };
      return this.ctx.update();
    }
    if (slot !== this.turn) return;
    if (this.phase === 'colour') {
      if (input.type === 'colour' && COLOURS.includes(input.colour)) this.chooseColour(slot, input.colour);
      return;
    }
    if (input.type === 'play') {
      const card = input.card;
      if (typeof card !== 'string' || !this.playable(slot).includes(card)) return;
      if (input.colour !== undefined && !COLOURS.includes(input.colour)) return;
      return this.play(slot, card, input.colour, input.call === true);
    }
    if (input.type === 'draw' && this.phase === 'play') {
      const got = this.draw(slot, 1);
      const c = got[0];
      this.last = { by: slot, what: 'draw', n: got.length };
      if (this.blocked(got)) return;
      const top = this.pile[this.pile.length - 1];
      if (c && fits(c, top, this.colour)) {
        this.drawn = c;
        this.phase = 'drawn';
        return this.armTurn();
      }
      this.turn = 1 - slot;
      return this.armTurn();
    }
    if (input.type === 'keep' && this.phase === 'drawn') this.keep(slot);
  }

  // ---- views ------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      hand: this.handNo,
      turn: this.turn,
      top: this.pile[this.pile.length - 1],
      colour: this.colour,
      counts: [this.hands[0].length, this.hands[1].length],
      stock: this.stock.length,
      uncalled: this.uncalled,
      last: this.last,
      result: this.result,
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

  playerView(slot) {
    return Object.assign(this.view(), {
      you: slot,
      cards: this.hands[slot].slice(),
      playable: this.turn === slot && (this.phase === 'play' || this.phase === 'drawn') ? this.playable(slot) : [],
      drawn: this.turn === slot ? this.drawn : null,
    });
  }
}

export default {
  id: 'colour-clash',
  category: 'board',
  handheld: true,
  phoneOnly: true, // (your hand is secret)
  music: 'thinking',
  name: 'Colour Clash',
  tagline: 'Match the colour or the number; Skips, Reverses, Draw Twos and Wilds. Down to one card? Shout CLASH! before you get caught. First to 200.',
  create: (ctx) => new ColourClash(ctx),
};
