// Backgammon. Each of you races 15 checkers round the board and off it. Roll two dice and move
// checkers that many points (doubles: four moves); you can't land where the other has two or more,
// and landing on a single one (a blot) hits it to the bar: it must come back in from the start
// before its owner moves anything else. Once all of yours are in your home quarter you bear them
// off. You must use both dice if you can (or the bigger one, if only one fits). First to bear
// everything off wins: double if the other has borne none off (a gammon), triple if they still have
// one on the bar or in your home (a backgammon). The doubling cube: before you roll you can double
// the stakes; the other takes (and owns the cube) or drops (and loses at the old stakes). First to
// the match's points wins.
//
// The board is 24 points, index 0..23: positive counts are player 1's checkers, negative player
// 2's. Player 1 moves down (23 to 0, home 0..5, bearing off below 0); player 2 moves up (home
// 18..23, off above 23).

import { settingOf } from './options.js';

export const MATCH_TO = 3;
export const TIMING = { openingMs: 2200, rollMs: 15000, moveMs: 45000, offerMs: 20000, noMoveMs: 1800, gameEndMs: 6000 };

const dir = (s) => (s === 0 ? -1 : 1);
const mine = (points, i, s) => (s === 0 ? points[i] > 0 : points[i] < 0);
const count = (points, i) => Math.abs(points[i]);

export function startBoard() {
  const p = new Array(24).fill(0);
  // Player 1: 2 on the 24-point, 5 on the 13, 3 on the 8, 5 on the 6 (counting from their home).
  p[23] = 2; p[12] = 5; p[7] = 3; p[5] = 5;
  p[0] = -2; p[11] = -5; p[16] = -3; p[18] = -5;
  return p;
}

const clone = (st) => ({ points: st.points.slice(), bar: st.bar.slice(), off: st.off.slice() });

/** How far `s` still has to go: every checker's distance home, 25 for one on the bar. */
export function pips(st, s) {
  let n = st.bar[s] * 25;
  for (let i = 0; i < 24; i++) if (mine(st.points, i, s)) n += count(st.points, i) * (s === 0 ? i + 1 : 24 - i);
  return n;
}

function allHome(st, s) {
  if (st.bar[s]) return false;
  for (let i = 0; i < 24; i++) {
    const home = s === 0 ? i <= 5 : i >= 18;
    if (!home && mine(st.points, i, s)) return false;
  }
  return true;
}

/** Every single move `s` can make with one die: { from: index | 'bar', to: index | 'off', die }. */
export function singleMoves(st, s, die) {
  const out = [];
  const open = (t) => !(s === 0 ? st.points[t] < -1 : st.points[t] > 1);
  if (st.bar[s]) {
    const t = s === 0 ? 24 - die : die - 1;
    if (open(t)) out.push({ from: 'bar', to: t, die });
    return out;
  }
  const home = allHome(st, s);
  for (let i = 0; i < 24; i++) {
    if (!mine(st.points, i, s)) continue;
    const t = i + dir(s) * die;
    if (t >= 0 && t <= 23) {
      if (open(t)) out.push({ from: i, to: t, die });
    } else if (home) {
      const exact = s === 0 ? t === -1 : t === 24;
      // A bigger die bears off only the checker furthest from home.
      let furthest = true;
      for (let j = i - dir(s); j >= 0 && j <= 23; j -= dir(s)) if (mine(st.points, j, s)) { furthest = false; break; }
      if (exact || furthest) out.push({ from: i, to: 'off', die });
    }
  }
  return out;
}

/** The position after a move (a blot hit goes to the bar). */
export function applyMove(st, s, m) {
  const n = clone(st);
  const one = s === 0 ? 1 : -1;
  if (m.from === 'bar') n.bar[s]--;
  else n.points[m.from] -= one;
  if (m.to === 'off') n.off[s]++;
  else {
    if (n.points[m.to] === -one) { n.points[m.to] = 0; n.bar[1 - s]++; }
    n.points[m.to] += one;
  }
  return n;
}

/** The dice left to play, as distinct values to try. */
const distinct = (dice) => [...new Set(dice)];
const without = (dice, d) => { const i = dice.indexOf(d); return dice.slice(0, i).concat(dice.slice(i + 1)); };

/** The most dice `s` can use from here. */
function most(st, s, dice, memo = new Map()) {
  if (!dice.length) return 0;
  const key = st.points.join() + '|' + st.bar + '|' + st.off + '|' + dice.join();
  if (memo.has(key)) return memo.get(key);
  let best = 0;
  for (const d of distinct(dice)) {
    for (const m of singleMoves(st, s, d)) {
      best = Math.max(best, 1 + most(applyMove(st, s, m), s, without(dice, d), memo));
      if (best === dice.length) break;
    }
    if (best === dice.length) break;
  }
  memo.set(key, best);
  return best;
}

/**
 * The moves `s` may make now: each must start a way of using as many dice as can be used (and
 * when only one of two different dice can be, the bigger one where it fits).
 */
export function legalMoves(st, s, dice) {
  if (!dice.length) return [];
  const memo = new Map();
  const best = most(st, s, dice, memo);
  if (!best) return [];
  const out = [];
  for (const d of distinct(dice)) {
    for (const m of singleMoves(st, s, d)) {
      if (1 + most(applyMove(st, s, m), s, without(dice, d), memo) === best) out.push(m);
    }
  }
  if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(...dice);
    if (out.some((m) => m.die === big)) return out.filter((m) => m.die === big);
  }
  return out;
}

export class Backgammon {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.matchTo = settingOf(ctx, 'points', MATCH_TO);
    this.cubeOn = settingOf(ctx, 'cube', 1) === 1 && this.matchTo > 1;
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.gameNo = 0;
    this.winner = null;
    this.newGame();
  }

  die() {
    return 1 + Math.floor(this.rng() * 6);
  }

  newGame() {
    this.gameNo++;
    this.st = { points: startBoard(), bar: [0, 0], off: [0, 0] };
    this.cube = { value: 1, owner: null };
    this.offer = null;
    this.result = null;
    this.moved = [];
    this.dice = [];
    this.rolled = [];
    this.legal = [];
    // Who starts: one die each (a tie rolls again); the higher plays both.
    let a = this.die();
    let b = this.die();
    while (a === b) { a = this.die(); b = this.die(); }
    this.opening = [a, b];
    this.turn = a > b ? 0 : 1;
    this.phase = 'opening';
    this.arm(TIMING.openingMs, 'afterOpening');
  }

  afterOpening() {
    this.startMoving(this.opening.slice());
  }

  // ---- a turn -----------------------------------------------------------------------

  startRoll() {
    this.phase = 'roll';
    this.dice = [];
    this.rolled = [];
    this.legal = [];
    this.moved = [];
    this.arm(TIMING.rollMs, 'rollTimeUp', true);
  }

  rollTimeUp() {
    this.roll();
  }

  roll() {
    const a = this.die();
    const b = this.die();
    this.startMoving([a, b]);
  }

  startMoving(rolled) {
    this.rolled = rolled;
    this.dice = rolled[0] === rolled[1] ? [rolled[0], rolled[0], rolled[0], rolled[0]] : rolled.slice();
    this.turnStart = { st: clone(this.st), dice: this.dice.slice() };
    this.moved = [];
    this.phase = 'move';
    this.legal = legalMoves(this.st, this.turn, this.dice);
    if (!this.legal.length) {
      this.phase = 'noMove';
      return this.arm(TIMING.noMoveMs, 'endTurn');
    }
    this.arm(TIMING.moveMs, 'moveTimeUp', true);
  }

  /** Out of time: whatever moves are left are played for you, at random. */
  moveTimeUp() {
    while (this.legal.length) this.move(this.legal[Math.floor(this.rng() * this.legal.length)], true);
    this.endTurn();
  }

  move(m, quiet) {
    this.st = applyMove(this.st, this.turn, m);
    this.dice = without(this.dice, m.die);
    this.moved.push({ from: m.from, to: m.to });
    if (this.st.off[this.turn] === 15) return this.endGame(this.turn);
    this.legal = legalMoves(this.st, this.turn, this.dice);
    if (!quiet) this.ctx.update();
  }

  endTurn() {
    if (this.phase === 'gameEnd' || this.phase === 'over') return;
    this.turn = 1 - this.turn;
    this.startRoll();
  }

  // ---- the cube -----------------------------------------------------------------------

  canDouble(s) {
    return this.cubeOn && this.phase === 'roll' && this.turn === s && (this.cube.owner === null || this.cube.owner === s);
  }

  offerTimeUp() {
    this.answer('take');
  }

  answer(type) {
    const by = this.offer.by;
    this.offer = null;
    if (type === 'drop') return this.endGame(by, 'drop');
    this.cube = { value: this.cube.value * 2, owner: 1 - by };
    this.startRoll();
  }

  // ---- the end -------------------------------------------------------------------------

  endGame(w, how) {
    this.clearTimer();
    const l = 1 - w;
    let kind = 'single';
    if (how === 'drop') kind = 'drop';
    else if (this.st.off[l] === 0) {
      let inHome = this.st.bar[l] > 0;
      for (let i = 0; i < 24; i++) if (mine(this.st.points, i, l) && (w === 0 ? i <= 5 : i >= 18)) inHome = true;
      kind = inHome ? 'backgammon' : 'gammon';
    }
    const points = this.cube.value * (kind === 'gammon' ? 2 : kind === 'backgammon' ? 3 : 1);
    this.scores[w] += points;
    this.result = { winner: w, kind, points };
    this.legal = [];
    this.dice = [];
    this.deadline = null;
    if (this.scores[w] >= this.matchTo) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'gameEnd';
    this.arm(TIMING.gameEndMs, 'newGame');
  }

  // ---- clock ----------------------------------------------------------------------------

  /** One timer at a time, its callback a method name (so a saved game can arm it again). */
  arm(ms, then, playerClock) {
    this.clearTimer();
    this.after = then;
    this.deadline = playerClock && this.clock ? this.ctx.now() + ms : null;
    this.ctx.update();
    if (playerClock && !this.clock) return; // (no timer: it waits for you)
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
    const waits = ['rollTimeUp', 'moveTimeUp', 'offerTimeUp'].includes(this.after);
    if (waits && !this.clock) return;
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
    if (this.phase === 'offer') {
      if (slot === 1 - this.offer.by && (input.type === 'take' || input.type === 'drop')) this.answer(input.type);
      return;
    }
    if (slot !== this.turn) return;
    if (this.phase === 'roll') {
      if (input.type === 'roll') return this.roll();
      if (input.type === 'double' && this.canDouble(slot)) {
        this.offer = { by: slot, value: this.cube.value * 2 };
        this.phase = 'offer';
        return this.arm(TIMING.offerMs, 'offerTimeUp', true);
      }
      return;
    }
    if (this.phase !== 'move') return;
    if (input.type === 'move') {
      const from = input.from === 'bar' ? 'bar' : input.from;
      const to = input.to === 'off' ? 'off' : input.to;
      if (from !== 'bar' && !(Number.isInteger(from) && from >= 0 && from <= 23)) return;
      if (to !== 'off' && !(Number.isInteger(to) && to >= 0 && to <= 23)) return;
      // (bearing off with two dice that both fit: the smaller one is used)
      const fits = this.legal.filter((m) => m.from === from && m.to === to).sort((a, b) => a.die - b.die);
      if (!fits.length) return;
      this.move(fits[0]);
      if (this.phase === 'move') this.arm(TIMING.moveMs, 'moveTimeUp', true);
      return;
    }
    if (input.type === 'undo' && this.moved.length) {
      this.st = clone(this.turnStart.st);
      this.dice = this.turnStart.dice.slice();
      this.moved = [];
      this.legal = legalMoves(this.st, this.turn, this.dice);
      return this.ctx.update();
    }
    if (input.type === 'done' && !this.legal.length) this.endTurn();
  }

  // ---- views --------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      game: this.gameNo,
      points: this.st.points,
      bar: this.st.bar,
      off: this.st.off,
      pips: [pips(this.st, 0), pips(this.st, 1)],
      turn: this.turn,
      opening: this.phase === 'opening' ? this.opening : null,
      rolled: this.rolled,
      dice: this.dice,
      legal: this.phase === 'move' ? this.legal.map((m) => ({ from: m.from, to: m.to })) : [],
      moved: this.moved,
      canUndo: this.phase === 'move' && this.moved.length > 0,
      canDone: this.phase === 'move' && !this.legal.length,
      cube: this.cube,
      cubeOn: this.cubeOn,
      canDouble: this.phase === 'roll' && this.canDouble(this.turn),
      offer: this.offer,
      result: this.result,
      scores: this.scores,
      matchTo: this.matchTo,
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
  id: 'backgammon',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Backgammon',
  tagline: 'Race your 15 checkers round and off the board. Hit a lone checker to send it back; double the stakes with the cube. First to 3 points.',
  create: (ctx) => new Backgammon(ctx),
};
