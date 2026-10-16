// Tank Duel. Top-down arena with cover. Point the stick where you want to go:
// the tank turns to face it and drives (only at speed once it roughly faces
// that way). The gun points where the tank faces. Shells bounce once off
// walls and cover, so trick shots work, and your own shell can hit you on
// the way back. Shells that meet cancel out. Three hits destroy a tank;
// destroy your rival to take the round. Rounds last at most ROUND_MS, then
// the healthier tank wins. First to WIN_SCORE rounds.
//
// Same loop as Pong/Air Hockey: physics at 60 Hz, ~30 views a second.

export const WIN_SCORE = 3;
export const FIELD = { w: 16, h: 9 };

// Cover, point-symmetric around the centre so neither side has an advantage.
export const OBSTACLES = [
  { x: 7.4, y: 3.6, w: 1.2, h: 1.8 },
  { x: 3.4, y: 1.4, w: 0.6, h: 2.2 },
  { x: 12.0, y: 5.4, w: 0.6, h: 2.2 },
  { x: 5.2, y: 6.6, w: 2.2, h: 0.6 },
  { x: 8.6, y: 1.8, w: 2.2, h: 0.6 },
];

export const TANK = { r: 0.42, speed: 3.6, turnRate: 5, hp: 3 };
export const SHELL = { r: 0.12, speed: 8, bounces: 1, max: 3, reloadMs: 350, safeMs: 150 };
export const PHYSICS = { tickMs: 1000 / 60, sendEvery: 2, substeps: 2 };
export const TIMING = { countdownMs: 3000, roundEndMs: 2500, roundMs: 90000, flashMs: 200 };

const START = [
  { x: 1.5, y: FIELD.h / 2, angle: 0 },
  { x: FIELD.w - 1.5, y: FIELD.h / 2, angle: Math.PI },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Does a circle overlap a rectangle? */
function circleRect(x, y, r, o) {
  const cx = clamp(x, o.x, o.x + o.w);
  const cy = clamp(y, o.y, o.y + o.h);
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

export class TankDuel {
  constructor(ctx) {
    this.ctx = ctx;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.nextRound();
    this.last = this.ctx.now();
    this.frame = 0;
    this.loop();
  }

  nextRound() {
    this.round++;
    this.tanks = START.map((s) => ({ x: s.x, y: s.y, angle: s.angle, hp: TANK.hp, alive: true, reloadUntil: 0, hitAt: -1e9 }));
    this.controls = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    this.shells = [];
    this.result = null;
    this.enter('countdown', TIMING.countdownMs);
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
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
      this.roundEnds = now + TIMING.roundMs;
      this.phase = 'play';
      this.phaseEnds = null;
    } else if (this.phase === 'roundEnd' && now >= this.phaseEnds) {
      this.nextRound();
    }

    if (this.phase === 'play') {
      const steps = Math.max(1, Math.ceil(dt / (PHYSICS.tickMs / 1000))) * PHYSICS.substeps;
      for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps);
      if (this.phase === 'play' && now >= this.roundEnds) this.timeUp();
    }

    this.frame++;
    if (this.phase !== before || this.frame % PHYSICS.sendEvery === 0) this.ctx.update();
  }

  // ---- movement -----------------------------------------------------------

  blocked(x, y, self) {
    const r = TANK.r;
    if (x < r || y < r || x > FIELD.w - r || y > FIELD.h - r) return true;
    if (OBSTACLES.some((o) => circleRect(x, y, r, o))) return true;
    return this.tanks.some((t, i) => i !== self && t.alive && Math.hypot(t.x - x, t.y - y) < 2 * r);
  }

  moveTanks(dt) {
    this.tanks.forEach((t, i) => {
      if (!t.alive) return;
      const c = this.controls[i];
      const mag = Math.min(1, Math.hypot(c.x, c.y));
      if (mag < 0.15) return;
      // Turn towards the stick, then drive; you only get speed once roughly facing that way.
      const diff = wrapAngle(Math.atan2(c.y, c.x) - t.angle);
      const turn = TANK.turnRate * dt;
      t.angle = wrapAngle(t.angle + clamp(diff, -turn, turn));
      const drive = TANK.speed * mag * Math.max(0, Math.cos(diff)) * dt;
      const nx = t.x + Math.cos(t.angle) * drive;
      const ny = t.y + Math.sin(t.angle) * drive;
      // Slide along walls: try each axis separately.
      if (!this.blocked(nx, t.y, i)) t.x = nx;
      if (!this.blocked(t.x, ny, i)) t.y = ny;
    });
  }

  // ---- shells -------------------------------------------------------------

  fire(slot) {
    const t = this.tanks[slot];
    const now = this.ctx.now();
    if (this.phase !== 'play' || !t.alive || now < t.reloadUntil) return;
    if (this.shells.filter((s) => s.owner === slot).length >= SHELL.max) return;
    t.reloadUntil = now + SHELL.reloadMs;
    const x = t.x + Math.cos(t.angle) * (TANK.r + SHELL.r + 0.05);
    const y = t.y + Math.sin(t.angle) * (TANK.r + SHELL.r + 0.05);
    // Muzzle inside a wall: the shot fizzles (no shooting through cover).
    if (x < 0 || y < 0 || x > FIELD.w || y > FIELD.h || OBSTACLES.some((o) => circleRect(x, y, SHELL.r, o))) return;
    this.shells.push({
      x, y,
      vx: Math.cos(t.angle) * SHELL.speed,
      vy: Math.sin(t.angle) * SHELL.speed,
      bounces: SHELL.bounces,
      owner: slot,
      born: now,
    });
  }

  moveShells(dt) {
    const r = SHELL.r;
    const now = this.ctx.now();
    for (const s of this.shells) {
      const px = s.x;
      const py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      let bounced = false;
      if (s.x < r || s.x > FIELD.w - r) {
        s.vx = -s.vx;
        s.x = clamp(s.x, r, FIELD.w - r);
        bounced = true;
      }
      if (s.y < r || s.y > FIELD.h - r) {
        s.vy = -s.vy;
        s.y = clamp(s.y, r, FIELD.h - r);
        bounced = true;
      }
      for (const o of OBSTACLES) {
        if (!circleRect(s.x, s.y, r, o)) continue;
        // Came in from the side -> flip x; from above/below -> flip y.
        if (px + r <= o.x || px - r >= o.x + o.w) {
          s.vx = -s.vx;
          s.x = px;
        } else {
          s.vy = -s.vy;
          s.y = py;
        }
        bounced = true;
        break;
      }
      if (bounced) s.bounces--;
      if (s.bounces < 0) s.dead = true;
    }

    // Shells that meet cancel out.
    for (let i = 0; i < this.shells.length; i++) {
      for (let j = i + 1; j < this.shells.length; j++) {
        const a = this.shells[i];
        const b = this.shells[j];
        if (!a.dead && !b.dead && Math.hypot(a.x - b.x, a.y - b.y) < 2 * r) a.dead = b.dead = true;
      }
    }

    // Hits. Your own fresh shell can't hit you as it leaves the barrel.
    for (const s of this.shells) {
      if (s.dead) continue;
      this.tanks.forEach((t, i) => {
        if (s.dead || !t.alive) return;
        if (i === s.owner && now - s.born < SHELL.safeMs) return;
        if (Math.hypot(t.x - s.x, t.y - s.y) < TANK.r + r) {
          s.dead = true;
          t.hp--;
          t.hitAt = now;
          if (t.hp <= 0) t.alive = false;
        }
      });
    }
    this.shells = this.shells.filter((s) => !s.dead);
  }

  step(dt) {
    this.moveTanks(dt);
    this.moveShells(dt);
    const dead = this.tanks.map((t) => !t.alive);
    if (dead[0] || dead[1]) {
      const draw = dead[0] && dead[1];
      this.endRound({ reason: 'destroyed', draw, roundWinner: draw ? null : dead[0] ? 1 : 0 });
    }
  }

  timeUp() {
    const [a, b] = this.tanks.map((t) => t.hp);
    this.endRound({ reason: 'time', draw: a === b, roundWinner: a === b ? null : a > b ? 0 : 1 });
  }

  endRound(result) {
    this.frozenLeft = this.timeLeft();
    this.shells = []; // nothing left hanging in the air during the pause
    if (result.roundWinner !== null) this.scores[result.roundWinner]++;
    this.result = result;
    const champ = this.scores.findIndex((s) => s >= WIN_SCORE);
    if (champ !== -1) {
      this.winner = champ;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('roundEnd', TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'move' && Number.isFinite(input.x) && Number.isFinite(input.y)) {
      // Stick / joystick direction in TV coordinates (-1..1, down is +y).
      this.controls[slot] = { x: clamp(input.x, -1, 1), y: clamp(input.y, -1, 1) };
    } else if (input.type === 'fire') {
      this.fire(slot);
    }
  }

  countdown() {
    return this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  timeLeft() {
    if (this.phase === 'countdown') return TIMING.roundMs / 1000;
    if (this.phase !== 'play') return this.frozenLeft || 0;
    return Math.max(0, Math.ceil((this.roundEnds - this.ctx.now()) / 1000));
  }

  hostView() {
    const now = this.ctx.now();
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: WIN_SCORE,
      players: this.ctx.players,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      field: FIELD,
      obstacles: OBSTACLES,
      tank: { r: TANK.r, hp: TANK.hp },
      shellR: SHELL.r,
      tanks: this.tanks.map((t) => ({
        x: t.x, y: t.y, angle: t.angle, hp: t.hp, alive: t.alive,
        flash: now - t.hitAt < TIMING.flashMs,
      })),
      shells: this.shells.map((s) => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy, owner: s.owner })),
      result: this.result,
      winner: this.winner,
    };
  }

  playerView(slot) {
    const t = this.tanks[slot];
    return {
      phase: this.phase,
      round: this.round,
      you: slot,
      scores: this.scores,
      winScore: WIN_SCORE,
      countdown: this.countdown(),
      timeLeft: this.timeLeft(),
      hp: this.tanks.map((x) => x.hp),
      maxHp: TANK.hp,
      ready: t.alive && this.ctx.now() >= t.reloadUntil && this.shells.filter((s) => s.owner === slot).length < SHELL.max,
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'tanks',
  name: 'Tank Duel',
  tagline: 'Top-down tank battle. Drive with the joystick, fire bouncing shells around cover. 3 hits and you are out. First to 3.',
  create: (ctx) => new TankDuel(ctx),
};
