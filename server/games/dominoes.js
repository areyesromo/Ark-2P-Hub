// Dominoes (the draw game, double-six). Seven tiles each, secret on your phone; the rest face down
// in the boneyard. Take turns adding a tile to either end of the line, matching the number there.
// Can't? Draw from the boneyard till you can (when it's empty, you pass). Play your last tile and
// you score the pips left in the other's hand. If neither of you can play, the lower count wins the
// hand and scores the difference. First to the target wins.

import { settingOf } from './options.js';

export const HAND = 7;
export const TARGET = 100;
export const TIMING = { turnMs: 30000, handEndMs: 6000 };

export function set() {
  const out = [];
  for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) out.push(a + '-' + b);
  return out;
}

export const halves = (t) => t.split('-').map(Number);
export const pips = (t) => halves(t)[0] + halves(t)[1];

/** The ends a tile fits ('L' and/or 'R') on a line with ends [l, r] (an empty line: anywhere). */
export function fitsEnds(t, ends) {
  if (!ends) return ['L'];
  const [a, b] = halves(t);
  const out = [];
  if (a === ends[0] || b === ends[0]) out.push('L');
  if (a === ends[1] || b === ends[1]) out.push('R');
  return out;
}

export class Dominoes {
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
    this.starter = 1;
    this.newHand();
  }

  newHand() {
    this.clearTimer();
    this.handNo++;
    const tiles = set();
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    this.hands = [tiles.slice(0, HAND), tiles.slice(HAND, 2 * HAND)];
    this.yard = tiles.slice(2 * HAND);
    this.line = []; // [a, b] each, as laid left to right
    this.starter = 1 - this.starter;
    this.turn = this.starter;
    this.passes = 0;
    this.last = null; // { by, what: 'play' | 'draw' | 'pass', tile?, end?, n? }
    this.result = null;
    this.phase = 'play';
    this.armTurn();
  }

  ends() {
    return this.line.length ? [this.line[0][0], this.line[this.line.length - 1][1]] : null;
  }

  playable(slot) {
    const e = this.ends();
    return this.hands[slot].filter((t) => fitsEnds(t, e).length);
  }

  // ---- a turn -------------------------------------------------------------------------

  play(slot, tile, end) {
    const [a, b] = halves(tile);
    this.hands[slot] = this.hands[slot].filter((t) => t !== tile);
    if (!this.line.length) this.line.push([a, b]);
    else if (end === 'L') { const l = this.line[0][0]; this.line.unshift(b === l ? [a, b] : [b, a]); }
    else { const r = this.line[this.line.length - 1][1]; this.line.push(a === r ? [a, b] : [b, a]); }
    this.passes = 0;
    this.last = { by: slot, what: 'play', tile, end: this.line.length === 1 ? null : end };
    if (!this.hands[slot].length) return this.endHand(slot, false);
    this.turn = 1 - slot;
    this.armTurn();
  }

  draw(slot) {
    const t = this.yard.pop();
    this.hands[slot].push(t);
    this.last = { by: slot, what: 'draw', n: (this.last && this.last.by === slot && this.last.what === 'draw' ? this.last.n : 0) + 1 };
    return t;
  }

  /** No tile fits and nothing left to draw: the turn passes (both stuck: the hand is blocked). */
  pass(slot) {
    this.passes++;
    this.last = { by: slot, what: 'pass' };
    if (this.passes >= 2) {
      const held = this.hands.map((h) => h.reduce((n, t) => n + pips(t), 0));
      return this.endHand(held[0] === held[1] ? null : held[0] < held[1] ? 0 : 1, true);
    }
    this.turn = 1 - slot;
    this.armTurn();
  }

  endHand(w, blocked) {
    this.clearTimer();
    const held = this.hands.map((h) => h.reduce((n, t) => n + pips(t), 0));
    const points = w === null ? 0 : blocked ? held[1 - w] - held[w] : held[1 - w];
    if (w !== null) this.scores[w] += points;
    this.result = { winner: w, points, blocked, hands: this.hands.map((h) => h.slice()) };
    this.deadline = null;
    if (w !== null && this.scores[w] >= this.target) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'handEnd';
    this.arm(TIMING.handEndMs, 'newHand');
  }

  /** On your turn: whether you must draw or pass (no tile fits). */
  stuckMove(slot) {
    if (this.playable(slot).length) return null;
    return this.yard.length ? 'draw' : 'pass';
  }

  // ---- the clock ---------------------------------------------------------------------

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

  /** Out of time: you draw one (if there's one to draw) and the turn passes, as in Colour Clash. */
  turnTimeUp() {
    const s = this.turn;
    if (this.yard.length) {
      this.draw(s);
      this.passes = 0;
      this.turn = 1 - s;
      return this.armTurn();
    }
    this.pass(s);
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

  // ---- input ----------------------------------------------------------------------------

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || slot !== this.turn) return;
    if (input.type === 'play') {
      const tile = input.tile;
      if (typeof tile !== 'string' || !this.hands[slot].includes(tile)) return;
      const fits = fitsEnds(tile, this.ends());
      const end = input.end === undefined && fits.length ? fits[0] : input.end;
      if (!fits.includes(end)) return;
      return this.play(slot, tile, end);
    }
    const stuck = this.stuckMove(slot);
    if (input.type === 'draw' && stuck === 'draw') { this.draw(slot); return this.armTurn(); }
    if (input.type === 'pass' && stuck === 'pass') return this.pass(slot);
  }

  // ---- views ----------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      hand: this.handNo,
      turn: this.turn,
      line: this.line,
      ends: this.ends(),
      counts: [this.hands[0].length, this.hands[1].length],
      yard: this.yard.length,
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
    const mine = this.phase === 'play' && this.turn === slot;
    const e = this.ends();
    return Object.assign(this.view(), {
      you: slot,
      tiles: this.hands[slot].slice(),
      fits: mine ? Object.fromEntries(this.hands[slot].map((t) => [t, fitsEnds(t, e)]).filter((x) => x[1].length)) : {},
      stuck: mine ? this.stuckMove(slot) : null,
    });
  }
}

export default {
  id: 'dominoes',
  category: 'board',
  handheld: true,
  phoneOnly: true, // (your tiles are secret)
  music: 'casual',
  name: 'Dominoes',
  tagline: 'Match the numbers at either end of the line; can\'t, and you draw from the boneyard. Play your last tile to score what they hold. First to 100.',
  create: (ctx) => new Dominoes(ctx),
};
