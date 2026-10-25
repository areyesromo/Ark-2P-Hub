// Brick Breaker Duel: a race to break your own wall of bricks. The TV is split in two: each
// of you has a paddle, a ball and the same wall. A missed ball just costs a moment (it comes
// back on your paddle). Some bricks are power bricks: 🔻 shrinks your rival's paddle for a
// while, ⚪ gives you another ball, 🧱 adds a row to your rival's wall. Clear your wall first to
// win; at time up, more bricks broken wins, and level goes to sudden death (next brick wins).
// The server runs the physics at 60 Hz and pushes ~30 views a second (as in Pong).

import { settingOf } from './options.js';

export const ROWS = 5;
export const MAX_ROWS = 10; // a wall never grows past this many rows
export const MAX_BALLS = 3;
export const POWERS = { shrink: 2, multi: 2, rows: 2 }; // power bricks of each kind in a wall

// Each side's field in arbitrary units; y is down. Bricks are 1 wide.
export const FIELD = {
  w: 8, h: 9, cols: 8, brickW: 1, brickH: 0.4, top: 0.8,
  paddleY: 8.3, paddleH: 0.22, paddleW: 1.8, shrunkW: 1.1, ballR: 0.15,
};

export const PHYSICS = {
  tickMs: 1000 / 60,
  sendEvery: 2, // push a view every 2nd tick (~30 Hz)
  paddleSpeed: 11,
  ballSpeed: 6.5,
  ballMax: 9.5,
  speedUp: 1.02, // per paddle hit
  maxBounce: Math.PI / 3, // angle off straight up when the ball hits the very edge of the paddle
  serveAngle: 0.3, // serves go this far off straight up, left and right in turn
};

export const TIMING = { countdownMs: 3000, respawnMs: 1500, shrinkMs: 7000, matchMs: 120000 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const key = (r, c) => r * FIELD.cols + c;

export class BrickDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rows = settingOf(ctx, 'rows', ROWS);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.winner = null;
    this.suddenDeath = false;
    this.power = null; // the latest power brick broken, for the screens: { n, by, kind }
    this.powers = 0;
    this.frame = 0;
    this.last = this.ctx.now();
    this.endsAt = null;
    // One wall, copied to both sides: the same bricks and the same power bricks.
    const wall = new Map();
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < FIELD.cols; c++) wall.set(key(r, c), { r, c, p: null });
    const cells = [...wall.keys()];
    Object.entries(POWERS).forEach(([kind, n]) => {
      for (let i = 0; i < n && cells.length; i++) wall.get(cells.splice(Math.floor(this.rng() * cells.length), 1)[0]).p = kind;
    });
    // The sides are built before the countdown is shown (entering it pushes a view).
    const startAt = this.ctx.now() + TIMING.countdownMs;
    // A stick or finger held through a rematch keeps working (phones and controllers only send changes).
    const held = this.sides ? this.sides.map((s) => s.control) : [];
    this.pending = []; // power effects on the rival, applied once both sides have stepped
    this.sides = [0, 1].map((slot) => {
      const side = {
        bricks: new Map([...wall].map(([k, b]) => [k, { ...b }])),
        paddle: FIELD.w / 2,
        control: held[slot] || { mode: 'axis', v: 0 },
        balls: [],
        newBalls: [], // extra balls from ⚪ bricks, added once this step's balls have moved
        broken: 0,
        serves: 0,
        shrunkUntil: -Infinity,
      };
      side.balls.push(this.heldBall(side, startAt));
      return side;
    });
    this.enter('countdown', TIMING.countdownMs);
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.loop();
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  /** A ball riding the paddle until `until`, then served. */
  heldBall(side, until) {
    return { x: side.paddle, y: FIELD.paddleY - FIELD.ballR, vx: 0, vy: 0, heldUntil: until };
  }

  paddleW(side, now) {
    return now < side.shrunkUntil ? FIELD.shrunkW : FIELD.paddleW;
  }

  loop() {
    this.timer = this.ctx.setTimeout(() => {
      this.tick();
      if (this.phase !== 'over') this.loop();
    }, PHYSICS.tickMs);
  }

  tick() {
    const now = this.ctx.now();
    const dt = clamp((now - this.last) / 1000, 0, 0.1);
    this.last = now;
    const before = this.phase;

    if (this.phase === 'countdown' && now >= this.phaseEnds) {
      this.endsAt = now + TIMING.matchMs;
      this.enter('play');
    }
    if (this.phase === 'play' && !this.suddenDeath && now >= this.endsAt) {
      const [a, b] = this.sides.map((s) => s.broken);
      if (a !== b) return this.finish(a > b ? 0 : 1);
      this.suddenDeath = true;
    }

    const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000)));
    for (let i = 0; i < steps && this.phase !== 'over'; i++) {
      const broke = this.sides.map((s) => s.broken);
      this.sides.forEach((side, slot) => this.step(side, slot, dt / steps, now));
      // Effects on the rival land after both sides have moved, so they hit both sides alike.
      this.pending.splice(0).forEach((fx) => {
        if (fx.kind === 'shrink') this.sides[fx.target].shrunkUntil = now + TIMING.shrinkMs;
        else this.addRow(fx.target);
      });
      if (this.phase !== 'play') continue;
      // Both sides have stepped: a cleared wall or a sudden-death brick decides it (a tie in
      // the same step goes to whoever has broken more, else carries on / is a draw).
      const cleared = this.sides.map((s) => s.bricks.size === 0);
      const [a, b] = this.sides.map((s) => s.broken);
      if (cleared[0] || cleared[1]) {
        if (cleared[0] && cleared[1]) this.finish(a === b ? null : a > b ? 0 : 1);
        else this.finish(cleared[0] ? 0 : 1);
      } else if (this.suddenDeath && (a !== broke[0] || b !== broke[1]) && a !== b) {
        this.finish(a > b ? 0 : 1);
      }
    }

    this.frame++;
    if (this.phase === before && this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  finish(winner) {
    this.winner = winner;
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.enter('over');
  }

  step(side, slot, dt, now) {
    const half = this.paddleW(side, now) / 2;
    const c = side.control;
    let x = side.paddle;
    const maxMove = PHYSICS.paddleSpeed * dt;
    if (c.mode === 'target') x += clamp(c.x - x, -maxMove, maxMove);
    else x += c.v * maxMove;
    side.paddle = clamp(x, half, FIELD.w - half);

    const r = FIELD.ballR;
    side.balls = side.balls.filter((b) => {
      if (b.heldUntil !== null) {
        b.x = side.paddle;
        b.y = FIELD.paddleY - r;
        if (this.phase === 'play' && now >= b.heldUntil) this.serve(side, b);
        return true;
      }
      if (this.phase !== 'play') return true;
      const px = b.x;
      const py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < r) {
        b.x = r;
        b.vx = Math.abs(b.vx);
      } else if (b.x > FIELD.w - r) {
        b.x = FIELD.w - r;
        b.vx = -Math.abs(b.vx);
      }
      if (b.y < r) {
        b.y = r;
        b.vy = Math.abs(b.vy);
      }
      // The paddle: only when the ball comes down onto its top this step.
      if (b.vy > 0 && py + r <= FIELD.paddleY && b.y + r >= FIELD.paddleY && Math.abs(b.x - side.paddle) <= half + r) {
        const rel = clamp((b.x - side.paddle) / half, -1, 1);
        const speed = Math.min(Math.hypot(b.vx, b.vy) * PHYSICS.speedUp, PHYSICS.ballMax);
        b.vx = Math.sin(rel * PHYSICS.maxBounce) * speed;
        b.vy = -Math.cos(rel * PHYSICS.maxBounce) * speed;
        b.y = FIELD.paddleY - r;
      }
      this.hitBrick(side, slot, b, px, py);
      return b.y - r <= FIELD.h; // off the bottom: gone
    });
    side.balls.push(...side.newBalls);
    side.newBalls = [];
    // Missed every ball: one comes back on the paddle after a moment.
    if (!side.balls.length) side.balls.push(this.heldBall(side, now + TIMING.respawnMs));
  }

  serve(side, b) {
    const a = (side.serves++ % 2 ? 1 : -1) * PHYSICS.serveAngle;
    b.heldUntil = null;
    b.vx = Math.sin(a) * PHYSICS.ballSpeed;
    b.vy = -Math.cos(a) * PHYSICS.ballSpeed;
  }

  /**
   * The first brick the ball overlaps breaks; the ball bounces off the face it came in by (judged
   * from where it was before this step) and is put back outside, so it can't dig up through a
   * seam between two bricks.
   */
  hitBrick(side, slot, b, px, py) {
    const r = FIELD.ballR;
    for (const [k, brick] of side.bricks) {
      const x0 = brick.c * FIELD.brickW;
      const y0 = FIELD.top + brick.r * FIELD.brickH;
      const cx = clamp(b.x, x0, x0 + FIELD.brickW);
      const cy = clamp(b.y, y0, y0 + FIELD.brickH);
      if (Math.hypot(b.x - cx, b.y - cy) > r) continue;
      const wasAboveOrBelow = py + r <= y0 || py - r >= y0 + FIELD.brickH;
      const wasBeside = px + r <= x0 || px - r >= x0 + FIELD.brickW;
      let sideways;
      if (wasAboveOrBelow !== wasBeside) sideways = wasBeside;
      else {
        // Came in at a corner (or was already in): the shallower way in.
        const inX = Math.min(b.x + r - x0, x0 + FIELD.brickW - (b.x - r));
        const inY = Math.min(b.y + r - y0, y0 + FIELD.brickH - (b.y - r));
        sideways = inX < inY;
      }
      if (sideways) {
        const left = px < x0 + FIELD.brickW / 2;
        b.vx = left ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x = left ? x0 - r : x0 + FIELD.brickW + r;
      } else {
        const above = py < y0 + FIELD.brickH / 2;
        b.vy = above ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y = above ? y0 - r : y0 + FIELD.brickH + r;
      }
      side.bricks.delete(k);
      side.broken++;
      if (brick.p) this.usePower(slot, brick.p);
      return;
    }
  }

  usePower(slot, kind) {
    const mine = this.sides[slot];
    if (kind === 'shrink' || kind === 'rows') this.pending.push({ kind, target: 1 - slot });
    else if (kind === 'multi' && mine.balls.length + mine.newBalls.length < MAX_BALLS) {
      // Straight up off the paddle, left or right in turn (not a serve: serves stay in step).
      const a = (mine.newBalls.length % 2 ? 1 : -1) * PHYSICS.serveAngle;
      mine.newBalls.push({ x: mine.paddle, y: FIELD.paddleY - FIELD.ballR, vx: Math.sin(a) * PHYSICS.ballSpeed, vy: -Math.cos(a) * PHYSICS.ballSpeed, heldUntil: null });
    }
    this.power = { n: ++this.powers, by: slot, kind };
  }

  /** A row of bricks on top of `slot`'s wall, the rest pushed down; a full-height wall only gets its top gaps filled. */
  addRow(slot) {
    const side = this.sides[slot];
    const bricks = [...side.bricks.values()];
    const deepest = bricks.reduce((m, b) => Math.max(m, b.r), -1);
    if (deepest + 1 < MAX_ROWS) {
      side.bricks = new Map(bricks.map((b) => [key(b.r + 1, b.c), { ...b, r: b.r + 1 }]));
    }
    for (let c = 0; c < FIELD.cols; c++) if (!side.bricks.has(key(0, c))) side.bricks.set(key(0, c), { r: 0, c, p: null });
    // A brick moved onto a ball doesn't break: the ball is put just under it, heading down.
    const r = FIELD.ballR;
    side.balls.forEach((b) => {
      if (b.heldUntil !== null) return;
      for (const brick of side.bricks.values()) {
        const x0 = brick.c * FIELD.brickW;
        const y0 = FIELD.top + brick.r * FIELD.brickH;
        if (Math.hypot(b.x - clamp(b.x, x0, x0 + FIELD.brickW), b.y - clamp(b.y, y0, y0 + FIELD.brickH)) > r) continue;
        b.y = Math.max(b.y, y0 + FIELD.brickH + r);
        b.vy = Math.abs(b.vy);
      }
    });
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'over') return;
    const side = this.sides[slot];
    if (input.type === 'move' && typeof input.x === 'number' && Number.isFinite(input.x)) {
      // Phone strip: 0 = left, 1 = right.
      side.control = { mode: 'target', x: clamp(input.x, 0, 1) * FIELD.w };
    } else if (input.type === 'axis' && typeof input.v === 'number' && Number.isFinite(input.v)) {
      side.control = { mode: 'axis', v: clamp(input.v, -1, 1) };
    }
  }

  countdown() {
    return this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  timeLeft() {
    return this.endsAt === null || this.suddenDeath ? null : Math.max(0, Math.ceil((this.endsAt - this.ctx.now()) / 1000));
  }

  hostView() {
    const now = this.ctx.now();
    return {
      phase: this.phase,
      players: this.ctx.players,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      suddenDeath: this.suddenDeath,
      field: FIELD,
      sides: this.sides.map((s) => ({
        paddle: s.paddle,
        paddleW: this.paddleW(s, now),
        balls: s.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, held: b.heldUntil !== null })),
        bricks: [...s.bricks.values()].map((b) => [b.r, b.c, b.p]),
        broken: s.broken,
      })),
      power: this.power,
      scores: this.sides.map((s) => s.broken), // the room records the result with these
      winner: this.winner,
    };
  }

  playerView(slot) {
    const now = this.ctx.now();
    return {
      phase: this.phase,
      you: slot,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      suddenDeath: this.suddenDeath,
      paddle: this.sides[slot].paddle / FIELD.w, // where your paddle is, 0..1 (the phone's knob)
      broken: this.sides.map((s) => s.broken),
      left: this.sides.map((s) => s.bricks.size),
      shrunk: now < this.sides[slot].shrunkUntil,
      power: this.power,
      winner: this.winner,
    };
  }
}

export default {
  id: 'brick-duel',
  name: 'Brick Breaker Duel',
  tagline: 'Race to break your wall first. Power bricks shrink their paddle, give you an extra ball or add a row to their wall.',
  create: (ctx) => new BrickDuel(ctx),
};
