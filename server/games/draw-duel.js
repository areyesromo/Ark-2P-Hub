// Draw Duel. Each round a shape is shown for a few seconds, then hidden; both
// players redraw it from memory on their phone (or with a controller's stick).
// Each drawing is scored 0-100% for how closely it matches the shape (size and
// position don't matter). Most total points after ROUNDS rounds wins.
//
// Drawing input arrives in small batches of points; views carry every stroke,
// so they're pushed at most every DRAW_PUSH_MS while people draw.

import { SHAPES, accuracy, fitted } from './draw-shapes.js';
import { settingOf, usedIn } from './options.js';

export const ROUNDS = 5;
export const TIMING = { countdownMs: 3000, showMs: 4000, drawMs: 20000, revealMs: 6000 };
export const DRAW_PUSH_MS = 100;
export const LIMITS = { strokes: 60, points: 1500, batch: 200 }; // points per player per round; numbers per batch

const round3 = (v) => Math.round(v * 1000) / 1000;

export class DrawDuel {
  constructor(ctx, rng = Math.random, shapes = SHAPES) {
    this.ctx = ctx;
    this.roundCount = settingOf(ctx, 'rounds', ROUNDS);
    this.rng = rng;
    this.shapes = shapes;
    this.used = usedIn(ctx, 'shapes'); // shown in earlier matches in this room
    this.timer = null;
    this.pushTimer = null;
  }

  start() {
    this.scores = [0, 0];
    this.history = []; // per round: { name, accuracy: [a, b] }
    this.winner = null;
    this.draw = false;
    this.index = -1;
    this.rounds = this.pickShapes();
    this.resetDrawings();
    this.runPhase('countdown', TIMING.countdownMs, () => this.show());
  }

  pickShapes() {
    let pool = this.shapes.map((_, i) => i).filter((i) => !this.used.has(i));
    if (pool.length < this.roundCount) {
      this.used.clear();
      pool = this.shapes.map((_, i) => i);
    }
    const picked = [];
    while (picked.length < Math.min(this.roundCount, pool.length)) {
      const i = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      this.used.add(i);
      picked.push({ name: this.shapes[i].name, paths: this.shapes[i].paths, display: fitted(this.shapes[i].paths) });
    }
    return picked;
  }

  resetDrawings() {
    this.strokes = [[], []];
    this.points = [0, 0];
    this.done = [false, false];
    this.accuracy = [null, null];
  }

  /** Enter a timed phase, pushing a fresh view every second, then call onEnd. */
  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.onPhaseEnd = onEnd;
    this.push();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.push();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  /** Push views now (dropping any queued drawing push). */
  push() {
    if (this.pushTimer) this.ctx.clearTimeout(this.pushTimer);
    this.pushTimer = null;
    this.ctx.update();
  }

  /** Push soon: batches the many small drawing inputs into a few views a second. */
  pushSoon() {
    if (this.pushTimer) return;
    this.pushTimer = this.ctx.setTimeout(() => {
      this.pushTimer = null;
      this.ctx.update();
    }, DRAW_PUSH_MS);
  }

  show() {
    this.index++;
    this.resetDrawings();
    this.runPhase('show', TIMING.showMs, () => this.runPhase('draw', TIMING.drawMs, () => this.reveal()));
  }

  reveal() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const shape = this.rounds[this.index];
    this.accuracy = this.strokes.map((s) => accuracy(shape.paths, s));
    this.accuracy.forEach((a, slot) => (this.scores[slot] += a));
    this.history.push({ name: shape.name, accuracy: this.accuracy.slice() });
    const last = this.index >= this.rounds.length - 1;
    this.runPhase('reveal', TIMING.revealMs, () => (last ? this.finish() : this.show()));
  }

  finish() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    const [a, b] = this.scores;
    this.draw = a === b;
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.phase = 'over';
    this.phaseEnds = null;
    this.push();
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'draw' || this.done[slot]) return;
    const strokes = this.strokes[slot];
    if (input.type === 'draw') return this.addPoints(slot, input);
    if (input.type === 'undo') {
      const gone = strokes.pop();
      if (gone) this.points[slot] -= gone.length / 2;
    } else if (input.type === 'clear') {
      this.strokes[slot] = [];
      this.points[slot] = 0;
    } else if (input.type === 'done') {
      this.done[slot] = true;
      if (this.done.every(Boolean)) return this.reveal(); // no need to wait for the clock
    } else {
      return;
    }
    this.push();
  }

  /** { type: 'draw', newStroke: bool, pts: [x, y, ...] } with 0..1 canvas coordinates. */
  addPoints(slot, { newStroke, pts }) {
    if (!Array.isArray(pts) || pts.length < 2 || pts.length % 2 || pts.length > LIMITS.batch) return;
    if (!pts.every((v) => typeof v === 'number' && Number.isFinite(v))) return;
    const strokes = this.strokes[slot];
    if (newStroke || !strokes.length) {
      if (strokes.length >= LIMITS.strokes) return;
      strokes.push([]);
    }
    const stroke = strokes[strokes.length - 1];
    for (let i = 0; i < pts.length && this.points[slot] < LIMITS.points; i += 2) {
      stroke.push(round3(Math.min(1, Math.max(0, pts[i]))), round3(Math.min(1, Math.max(0, pts[i + 1]))));
      this.points[slot]++;
    }
    this.pushSoon();
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  /** The shape's name once it's been shown; its outline only while it's on screen or being judged. */
  shapeView() {
    const s = this.rounds[this.index];
    if (!s || this.phase === 'countdown') return { name: null, outline: null };
    const visible = this.phase === 'show' || this.phase === 'reveal';
    return { name: s.name, outline: visible ? s.display : null };
  }

  hostView() {
    const shape = this.shapeView();
    return {
      phase: this.phase,
      round: this.index + 1,
      rounds: this.rounds.length,
      shapeName: shape.name,
      outline: shape.outline,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      phaseMs: TIMING[this.phase + 'Ms'] || 0,
      strokes: this.strokes,
      done: this.done,
      accuracy: this.accuracy,
      history: this.history,
      scores: this.scores,
      players: this.ctx.players,
      winner: this.winner,
      draw: this.draw,
    };
  }

  playerView(slot) {
    const shape = this.shapeView();
    const revealing = this.phase === 'reveal';
    return {
      phase: this.phase,
      you: slot,
      round: this.index + 1,
      rounds: this.rounds.length,
      shapeName: shape.name,
      outline: shape.outline,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      phaseMs: TIMING[this.phase + 'Ms'] || 0,
      // The phone keeps its own drawing while you draw; it gets the server's copy back for the reveal.
      strokes: revealing ? this.strokes[slot] : null,
      done: this.done[slot],
      opponentDone: this.done[1 - slot],
      accuracy: this.accuracy,
      scores: this.scores,
      winner: this.winner,
      draw: this.draw,
    };
  }
}

export default {
  id: 'draw-duel',
  music: 'casual',
  name: 'Draw Duel',
  tagline: 'A shape flashes up, then vanishes. Redraw it from memory on your phone; the closest match scores the most. 5 rounds.',
  create: (ctx) => new DrawDuel(ctx),
};
