// Tower Defence Duel. Each of you has a side of the TV: a winding road down to your base, and
// the free tiles beside it for towers. Creeps walk the road; each one that reaches your base
// costs you lives (a brute costs two), and when your lives are gone you lose. Build towers to
// stop them (Arrow: cheap and quick; Cannon: slow, hits a group; Frost: slows them down), and
// spend gold to send creeps down your rival's road: every one you send raises your income too.
// Kills pay a bounty. Every so often both roads get a house wave, a little stronger each time,
// so a game can't stall. Both roads are the same, and so are the house waves.

import { settingOf } from './options.js';

export const GRID = { w: 12, h: 9 };
/** The road through tile centres: in over the top edge, out at the base under the bottom. */
export const PATH = [[1.5, -0.5], [1.5, 6.5], [4.5, 6.5], [4.5, 1.5], [7.5, 1.5], [7.5, 6.5], [10.5, 6.5], [10.5, 9.5]];

export const TOWERS = {
  arrow: { cost: 15, upgrade: [15, 25], range: [2.5, 2.8, 3.1], damage: [6, 9, 13], every: [500, 450, 400] },
  cannon: { cost: 30, upgrade: [25, 40], range: [2.2, 2.4, 2.6], damage: [14, 22, 32], every: [1500, 1400, 1300], splash: 0.9 },
  frost: { cost: 20, upgrade: [20, 30], range: [2, 2.3, 2.6], damage: [2, 3, 4], every: [1000, 900, 800], slow: 0.5, slowMs: [2000, 2500, 3000] },
};
/** Creeps: speed in tiles a second; what sending one costs and adds to your income; lives they take. */
export const CREEPS = {
  runner: { hp: 30, speed: 2.2, bounty: 2, cost: 8, income: 1, lives: 1 },
  brute: { hp: 120, speed: 0.9, bounty: 6, cost: 25, income: 3, lives: 2 },
  swarm: { hp: 12, speed: 1.6, bounty: 1, cost: 15, income: 2, lives: 1, count: 5 },
};
export const ECONOMY = { startGold: 60, income: 5, incomeEveryMs: 5000, refund: 0.6 };
export const TIMING = { tickMs: 50, sendEvery: 2, countdownMs: 3000, firstWaveMs: 20000, waveEveryMs: 30000, spacingMs: 400, swarmMs: 250, shotMs: 150 };
export const LIVES = 20;

const segs = PATH.slice(1).map((b, i) => {
  const a = PATH[i];
  return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
});

export function pathLength() {
  return segs.reduce((s, g) => s + g.len, 0);
}

/** Where on the road distance d is: { x, y } in tiles. */
export function pointAt(d) {
  for (const s of segs) {
    if (d <= s.len) return { x: s.a[0] + ((s.b[0] - s.a[0]) * d) / s.len, y: s.a[1] + ((s.b[1] - s.a[1]) * d) / s.len };
    d -= s.len;
  }
  const end = PATH[PATH.length - 1];
  return { x: end[0], y: end[1] };
}

/** The road's tiles on the grid ('x,y'): no building there. */
export function pathTiles() {
  const out = new Set();
  for (let d = 0; d <= pathLength(); d += 0.25) {
    const p = pointAt(d);
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x >= 0 && y >= 0 && x < GRID.w && y < GRID.h) out.add(x + ',' + y);
  }
  return out;
}
const ROAD = pathTiles();

export class TowerDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.lives = settingOf(ctx, 'lives', LIVES);
    this.timer = null;
  }

  start() {
    this.sides = [0, 1].map(() => ({ lives: this.lives, gold: ECONOMY.startGold, income: ECONOMY.income, towers: {}, creeps: [], queue: [], shots: [], sent: 0, kills: 0 }));
    this.nextId = 1;
    this.wave = 0;
    this.winner = null;
    this.events = { kills: 0, leaks: 0, builds: 0, sends: 0, waves: 0 };
    this.phase = 'countdown';
    this.phaseEnds = this.ctx.now() + TIMING.countdownMs;
    this.loop();
    this.ctx.update();
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.last = this.ctx.now();
    this.frame = 0;
    const step = () => {
      this.timer = this.ctx.setTimeout(() => {
        this.timer = null;
        this.tick();
        if (this.phase !== 'over') step();
      }, TIMING.tickMs);
    };
    step();
  }

  /** A creep onto side `side`'s road (`hpScale` for the house waves). */
  spawn(side, kind, hpScale = 1, house = false) {
    const def = CREEPS[kind];
    const hp = Math.round(def.hp * hpScale);
    const c = { id: this.nextId++, kind, d: 0, hp, max: hp, speed: def.speed, slowUntil: 0, house };
    this.sides[side].creeps.push(c);
    return c;
  }

  tick() {
    const now = this.ctx.now();
    const dt = Math.min(200, now - this.last);
    this.last = now;
    if (this.phase === 'countdown') {
      if (now >= this.phaseEnds) {
        this.phase = 'play';
        this.started = now;
        this.nextIncome = now + ECONOMY.incomeEveryMs;
        this.nextWave = now + TIMING.firstWaveMs;
        this.ctx.update();
      }
      return;
    }
    if (this.phase !== 'play') return;
    if (now >= this.nextIncome) {
      this.nextIncome += ECONOMY.incomeEveryMs;
      for (const s of this.sides) s.gold += s.income;
    }
    if (now >= this.nextWave) {
      this.nextWave += TIMING.waveEveryMs;
      this.houseWave(now);
    }
    this.sides.forEach((s, side) => {
      // Sent and house creeps come out one at a time.
      while (s.queue.length && s.queue[0].at <= now) {
        const q = s.queue.shift();
        this.spawn(side, q.kind, q.hpScale || 1, Boolean(q.house));
      }
      this.walk(s, dt, now);
      this.shoot(s, side, now);
      s.shots = s.shots.filter((x) => now - x.at < TIMING.shotMs);
    });
    // Both bases judged together: out of lives at the same moment is a draw.
    const out = this.sides.map((s) => s.lives <= 0);
    if (out[0] || out[1]) return this.finish(out[0] && out[1] ? null : out[0] ? 1 : 0);
    if (this.frame++ % TIMING.sendEvery === 0) this.ctx.update();
  }

  /** The same house wave down both roads: 2 + n/2 runners, brutes every third wave, tougher each time. */
  houseWave(now) {
    this.wave++;
    this.events.waves++;
    const n = this.wave;
    const hpScale = 1 + 0.25 * (n - 1);
    const kinds = [];
    for (let i = 0; i < 2 + Math.ceil(n / 2); i++) kinds.push('runner');
    for (let i = 0; i < Math.floor(n / 3); i++) kinds.push('brute');
    for (const s of this.sides) {
      const start = Math.max(now, s.queue.length ? s.queue[s.queue.length - 1].at : now);
      kinds.forEach((kind, i) => s.queue.push({ kind, at: start + i * TIMING.spacingMs, hpScale, house: true }));
    }
  }

  walk(s, dt, now) {
    const end = pathLength();
    for (const c of s.creeps.slice()) {
      const slow = now < c.slowUntil ? TOWERS.frost.slow : 1;
      c.d += (c.speed * slow * dt) / 1000;
      if (c.d < end) continue;
      s.creeps.splice(s.creeps.indexOf(c), 1);
      s.lives = Math.max(0, s.lives - CREEPS[c.kind].lives);
      this.events.leaks++;
    }
  }

  /** Each tower that's ready fires at the creep furthest along its range. */
  shoot(s, side, now) {
    for (const [k, t] of Object.entries(s.towers)) {
      if (now < t.readyAt) continue;
      const def = TOWERS[t.kind];
      const lv = t.level - 1;
      const [x, y] = k.split(',').map(Number);
      const cx = x + 0.5;
      const cy = y + 0.5;
      let target = null;
      for (const c of s.creeps) {
        const p = pointAt(c.d);
        if (Math.hypot(p.x - cx, p.y - cy) > def.range[lv]) continue;
        if (!target || c.d > target.d) target = c;
      }
      if (!target) continue;
      t.readyAt = now + def.every[lv];
      const at = pointAt(target.d);
      s.shots.push({ kind: t.kind, from: [cx, cy], to: [Math.round(at.x * 100) / 100, Math.round(at.y * 100) / 100], at: now });
      const hits = def.splash ? s.creeps.filter((c) => { const p = pointAt(c.d); return Math.hypot(p.x - at.x, p.y - at.y) <= def.splash; }) : [target];
      for (const c of hits) {
        c.hp -= def.damage[lv];
        if (def.slow) c.slowUntil = now + def.slowMs[lv];
        if (c.hp > 0) continue;
        s.creeps.splice(s.creeps.indexOf(c), 1);
        s.gold += CREEPS[c.kind].bounty;
        s.kills++;
        this.events.kills++;
      }
    }
  }

  finish(winner) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.winner = winner;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    const s = this.sides[slot];
    if (input.type === 'send') {
      const def = CREEPS[input.kind];
      if (!Object.hasOwn(CREEPS, input.kind) || s.gold < def.cost) return;
      s.gold -= def.cost;
      s.income += def.income;
      s.sent++;
      this.events.sends++;
      // Down the other road, after whatever is already queued there.
      const q = this.sides[1 - slot].queue;
      const now = this.ctx.now();
      const start = Math.max(now, q.length ? q[q.length - 1].at + TIMING.spacingMs : now);
      for (let i = 0; i < (def.count || 1); i++) q.push({ kind: input.kind, at: start + i * TIMING.swarmMs });
      return this.ctx.update();
    }
    const { x, y } = input;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= GRID.w || y >= GRID.h) return;
    const k = x + ',' + y;
    const t = s.towers[k];
    if (input.type === 'build') {
      if (t || ROAD.has(k) || !Object.hasOwn(TOWERS, input.kind) || s.gold < TOWERS[input.kind].cost) return;
      s.gold -= TOWERS[input.kind].cost;
      s.towers[k] = { kind: input.kind, level: 1, spent: TOWERS[input.kind].cost, readyAt: 0 };
      this.events.builds++;
    } else if (input.type === 'upgrade') {
      if (!t || t.level >= 3) return;
      const cost = TOWERS[t.kind].upgrade[t.level - 1];
      if (s.gold < cost) return;
      s.gold -= cost;
      t.spent += cost;
      t.level++;
      this.events.builds++;
    } else if (input.type === 'sell') {
      if (!t) return;
      s.gold += Math.floor(t.spent * ECONOMY.refund);
      delete s.towers[k];
    } else return;
    this.ctx.update();
  }

  view() {
    const now = this.ctx.now();
    const r2 = (n) => Math.round(n * 100) / 100;
    return {
      phase: this.phase,
      grid: GRID,
      path: PATH,
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
      wave: this.wave,
      nextWaveMs: this.phase === 'play' ? Math.max(0, this.nextWave - now) : 0,
      sides: this.sides.map((s) => ({
        lives: s.lives,
        gold: s.gold,
        income: s.income,
        towers: Object.entries(s.towers).map(([k, t]) => {
          const [x, y] = k.split(',').map(Number);
          return { x, y, kind: t.kind, level: t.level };
        }),
        creeps: s.creeps.map((c) => ({ id: c.id, kind: c.kind, d: r2(c.d), hp: Math.max(0, c.hp), max: c.max, slow: now < c.slowUntil, speed: c.speed })),
        shots: s.shots.map((x) => ({ kind: x.kind, from: x.from, to: x.to })),
        coming: s.queue.length,
      })),
      towers: TOWERS,
      creepTypes: CREEPS,
      refund: ECONOMY.refund,
      maxLives: this.lives,
      events: this.events,
      // For the room: lives left are the score.
      scores: this.sides.map((s) => s.lives),
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
  id: 'tower-duel',
  name: 'Tower Defence Duel',
  tagline: 'Build towers to stop the creeps on your road and spend gold to send creeps down your rival\'s. Run out of lives and you lose.',
  create: (ctx) => new TowerDuel(ctx),
};
