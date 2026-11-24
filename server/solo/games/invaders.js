// Invaders. Rows of aliens march side to side, stepping down each time they
// reach an edge, and drop bombs. Slide your cannon along the bottom and shoot
// them all before they land. Four bunkers give cover (and get chewed away by
// shots from both sides). The fewer aliens left, the faster they go; a saucer
// sometimes flies across the top for a bonus. Clear a wave and the next one
// starts a little lower. 3 lives. Score: points (the top rows are worth more).

import { lookOf } from './looks.js';

export const FIELD = { w: 100, h: 75 };
export const SHIP = { y: 70, w: 6, h: 3, speed: 70 };
export const ALIENS = { cols: 9, rows: 5, w: 5, h: 3.5, gapX: 3, gapY: 2.5, top: 10, dropY: 2.5, points: [30, 20, 20, 10, 10] };
export const SPEED = { start: 6, max: 60 }; // units per second, from a full wave down to the last alien
export const SHOT = { speed: 110, h: 2 };
export const BOMB = { speed: 40, max: 3, everyMs: 900 };
export const SAUCER = { y: 5, w: 8, speed: 22, everyMs: 20000, points: [50, 100, 150, 300] };
export const BUNKER = { count: 4, y: 58, cols: 8, rows: 4, cell: 1.2 };
export const LIVES = 3;
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2, hitMs: 1500, waveMs: 1800 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Invaders {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.look = lookOf(ctx, 'invaders');
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.score = 0;
    this.lives = LIVES;
    this.wave = 0;
    this.shipX = FIELD.w / 2;
    this.target = null; // where the phone wants the cannon (x)
    this.axis = 0;
    this.ticks = 0;
    this.kills = 0;
    this.saucers = 0;
    this.saucer = null;
    this.buildBunkers();
    this.nextWave();
    this.loop();
  }

  buildBunkers() {
    const span = BUNKER.cols * BUNKER.cell;
    this.bunkers = Array.from({ length: BUNKER.count }, (_, i) => {
      const x = ((i + 1) * FIELD.w) / (BUNKER.count + 1) - span / 2;
      // A little arch: the bottom middle cells are open.
      const cells = [];
      for (let r = 0; r < BUNKER.rows; r++) {
        for (let c = 0; c < BUNKER.cols; c++) {
          const arch = r === BUNKER.rows - 1 && c >= 2 && c < BUNKER.cols - 2;
          const corner = r === 0 && (c === 0 || c === BUNKER.cols - 1);
          cells.push(!arch && !corner);
        }
      }
      return { x, cells };
    });
  }

  nextWave() {
    this.wave++;
    const lower = Math.min(4, this.wave - 1) * ALIENS.dropY; // each wave starts a step lower (up to 4)
    this.aliens = [];
    const width = ALIENS.cols * ALIENS.w + (ALIENS.cols - 1) * ALIENS.gapX;
    const left = (FIELD.w - width) / 2;
    for (let r = 0; r < ALIENS.rows; r++) {
      for (let c = 0; c < ALIENS.cols; c++) {
        this.aliens.push({ x: left + c * (ALIENS.w + ALIENS.gapX), y: ALIENS.top + lower + r * (ALIENS.h + ALIENS.gapY), row: r, col: c, alive: true });
      }
    }
    this.dir = 1;
    this.shot = null;
    this.bombs = [];
    this.nextBomb = this.ctx.now() + BOMB.everyMs * 2;
    this.nextSaucer = this.ctx.now() + SAUCER.everyMs;
    this.phase = 'play';
    this.ctx.update();
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.lastTick = this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, TIMING.tickMs);
  }

  get alive() {
    return this.aliens.filter((a) => a.alive);
  }

  get alienSpeed() {
    const total = ALIENS.cols * ALIENS.rows;
    const left = this.alive.length;
    const wave = 1 + (this.wave - 1) * 0.12;
    return Math.min(SPEED.max, (SPEED.start + (SPEED.max - SPEED.start) * (1 - left / total) ** 2) * wave);
  }

  tick() {
    const now = this.ctx.now();
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    if (this.phase === 'play') {
      const steps = Math.max(1, Math.ceil(dt / (TIMING.tickMs / 1000)));
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps, now);
    } else if (this.phase === 'hit' && now >= this.phaseEnds) {
      this.bombs = [];
      this.shot = null;
      this.phase = 'play';
    } else if (this.phase === 'cleared' && now >= this.phaseEnds) {
      this.nextWave();
    }
    if (this.phase === 'over') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  step(dt, now) {
    // The cannon: towards the finger, or along the stick.
    const half = SHIP.w / 2;
    if (this.target !== null) {
      const d = this.target - this.shipX;
      const max = SHIP.speed * 1.5 * dt;
      this.shipX += clamp(d, -max, max);
    } else {
      this.shipX += this.axis * SHIP.speed * dt;
    }
    this.shipX = clamp(this.shipX, half, FIELD.w - half);

    // The march: sideways together; at an edge, all step down and turn round.
    const alive = this.alive;
    const dx = this.dir * this.alienSpeed * dt;
    const minX = Math.min(...alive.map((a) => a.x)) + dx;
    const maxX = Math.max(...alive.map((a) => a.x + ALIENS.w)) + dx;
    if (minX < 1 || maxX > FIELD.w - 1) {
      this.dir = -this.dir;
      for (const a of alive) a.y += ALIENS.dropY;
    } else {
      for (const a of alive) a.x += dx;
    }
    // Landed (or reached the cannon's row): it's over.
    if (alive.some((a) => a.y + ALIENS.h >= SHIP.y)) return this.end();
    // Aliens marching through a bunker eat it.
    for (const a of alive) this.chewBunkers(a.x, a.y, ALIENS.w, ALIENS.h);

    // Bombs: from the lowest alien of a random column.
    if (now >= this.nextBomb && this.bombs.length < BOMB.max) {
      const cols = [...new Set(alive.map((a) => a.col))];
      const col = cols[Math.floor(this.rng() * cols.length)];
      const low = alive.filter((a) => a.col === col).reduce((m, a) => (a.y > m.y ? a : m));
      this.bombs.push({ x: low.x + ALIENS.w / 2, y: low.y + ALIENS.h });
      this.nextBomb = now + BOMB.everyMs * (0.5 + this.rng()) / (1 + (this.wave - 1) * 0.15);
    }
    for (const b of this.bombs) b.y += BOMB.speed * dt;
    this.bombs = this.bombs.filter((b) => b.y < FIELD.h && !this.chewBunkers(b.x - 0.4, b.y - 1, 0.8, 1));
    const hit = this.bombs.find((b) => b.y >= SHIP.y && b.y <= SHIP.y + SHIP.h && Math.abs(b.x - this.shipX) <= half);
    if (hit) return this.loseLife(now);

    // The saucer: now and then, across the top.
    if (!this.saucer && now >= this.nextSaucer) {
      const fromLeft = this.rng() < 0.5;
      this.saucer = { x: fromLeft ? -SAUCER.w : FIELD.w, dir: fromLeft ? 1 : -1 };
    }
    if (this.saucer) {
      this.saucer.x += this.saucer.dir * SAUCER.speed * dt;
      if (this.saucer.x < -SAUCER.w - 1 || this.saucer.x > FIELD.w + 1) {
        this.saucer = null;
        this.nextSaucer = now + SAUCER.everyMs;
      }
    }

    // Your shot.
    const s = this.shot;
    if (s) {
      s.y -= SHOT.speed * dt;
      if (s.y < 0) this.shot = null;
      else if (this.chewBunkers(s.x - 0.3, s.y, 0.6, SHOT.h)) this.shot = null;
      else {
        const a = alive.find((al) => s.x >= al.x && s.x <= al.x + ALIENS.w && s.y <= al.y + ALIENS.h && s.y + SHOT.h >= al.y);
        if (a) {
          a.alive = false;
          this.score += ALIENS.points[a.row];
          this.shot = null;
          this.kills++;
          if (!this.alive.length) {
            this.phase = 'cleared';
            this.phaseEnds = now + TIMING.waveMs;
          }
        } else if (this.saucer && s.y <= SAUCER.y + 3 && s.x >= this.saucer.x && s.x <= this.saucer.x + SAUCER.w) {
          this.score += SAUCER.points[Math.floor(this.rng() * SAUCER.points.length)];
          this.saucers++;
          this.saucer = null;
          this.nextSaucer = now + SAUCER.everyMs;
          this.shot = null;
        }
      }
    }
  }

  /** Knock out bunker cells under a box; true if any was hit. */
  chewBunkers(x, y, w, h) {
    if (y + h < BUNKER.y || y > BUNKER.y + BUNKER.rows * BUNKER.cell) return false;
    let hit = false;
    for (const b of this.bunkers) {
      for (let r = 0; r < BUNKER.rows; r++) {
        for (let c = 0; c < BUNKER.cols; c++) {
          const i = r * BUNKER.cols + c;
          if (!b.cells[i]) continue;
          const cx = b.x + c * BUNKER.cell;
          const cy = BUNKER.y + r * BUNKER.cell;
          if (x < cx + BUNKER.cell && x + w > cx && y < cy + BUNKER.cell && y + h > cy) {
            b.cells[i] = false;
            hit = true;
          }
        }
      }
    }
    return hit;
  }

  loseLife(now) {
    this.lives--;
    if (this.lives <= 0) return this.end();
    this.phase = 'hit';
    this.phaseEnds = now + TIMING.hitMs;
  }

  end() {
    this.phase = 'over';
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  fire() {
    if (this.phase !== 'play' || this.shot) return; // one shot on screen at a time, like the original
    this.shot = { x: this.shipX, y: SHIP.y - SHOT.h };
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (this.phase === 'over' || this.phase === 'paused') return;
    if (input.type === 'aim' && typeof input.x === 'number' && Number.isFinite(input.x)) {
      this.target = clamp(input.x, 0, 1) * FIELD.w;
    } else if (input.type === 'axis' && typeof input.v === 'number' && Number.isFinite(input.v)) {
      this.axis = clamp(input.v, -1, 1);
      this.target = null;
    } else if (input.type === 'fire') {
      this.fire();
    }
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      const gap = this.ctx.now() - this.pausedAt;
      this.nextBomb += gap;
      this.nextSaucer += gap;
      this.phase = 'play';
      this.ctx.update();
      this.loop();
    }
  }

  hostView() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      look: this.look,
      phase: this.phase,
      player: this.ctx.player,
      field: FIELD,
      ship: { x: r(this.shipX), y: SHIP.y, w: SHIP.w, h: SHIP.h },
      aliens: this.aliens.filter((a) => a.alive).map((a) => [r(a.x), r(a.y), a.row]),
      alien: { w: ALIENS.w, h: ALIENS.h },
      march: { dir: this.dir, speed: this.phase === 'play' ? this.alienSpeed : 0 },
      shot: this.shot && { x: r(this.shot.x), y: r(this.shot.y), h: SHOT.h, vy: -SHOT.speed },
      bombs: this.bombs.map((b) => [r(b.x), r(b.y)]),
      bombSpeed: BOMB.speed,
      saucer: this.saucer && { x: r(this.saucer.x), y: SAUCER.y, w: SAUCER.w, vx: this.saucer.dir * SAUCER.speed },
      bunkers: this.bunkers.map((b) => ({ x: b.x, cells: b.cells.map((c) => (c ? 1 : 0)).join('') })),
      bunker: { y: BUNKER.y, cols: BUNKER.cols, rows: BUNKER.rows, cell: BUNKER.cell },
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      kills: this.kills,
      saucers: this.saucers,
    };
  }

  playerView() {
    return { phase: this.phase, score: this.score, lives: this.lives, wave: this.wave, shipX: this.shipX / FIELD.w, canFire: !this.shot };
  }
}

export default {
  id: 'invaders',
  name: 'Invaders',
  tagline: 'Rows of aliens march down on you. Slide, shoot, and hide behind the bunkers.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Invaders(ctx, ctx.rng),
};
