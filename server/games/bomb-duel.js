// Bomb Duel (Bomberman-style). A 15 x 11 arena: stone pillars, wooden
// crates and the two players in opposite corners. Drop bombs that blast in
// a cross (they set each other off); blasts smash crates, which can hide
// power-ups: an extra bomb, a longer blast or more speed. Caught in a blast,
// you lose the round. After 90 s, walls close in from the edges. Players
// pick how many round wins it takes and how many crates on the setup screen.
//
// Players move cell to cell (turning at cell centres, reversing any time),
// so it plays like the classic on a D-pad.

import { loadSettings, applySetting } from './options.js';

export const W = 15;
export const H = 11;
export const OPTIONS = {
  wins: [3, 2, 5], // round wins needed
  crates: [65, 40, 85], // % of open cells with a crate
};
export const TIMING = { countdownMs: 3000, roundEndMs: 3500, settleMs: 1200, suddenDeathMs: 90000, wallEveryMs: 280 };
export const RULES = {
  tickMs: 1000 / 30,
  fuseMs: 2500,
  fireMs: 550,
  speed: 3.6, // cells / s
  speedStep: 0.7,
  maxSpeed: 6.4,
  maxBombs: 6,
  maxFire: 8,
  dropChance: 0.3, // a smashed crate hides a power-up
};
export const POWERUPS = ['bomb', 'fire', 'speed'];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const SPAWNS = [
  [1, 1],
  [W - 2, H - 2],
];

const key = (x, y) => y * W + x;

/** Pillars: the border and every other cell inside it. */
export function isPillar(x, y) {
  return x <= 0 || y <= 0 || x >= W - 1 || y >= H - 1 || (x % 2 === 0 && y % 2 === 0);
}

/** A fresh arena: crates on `percent`% of open cells, with each spawn corner kept clear. */
export function makeCrates(percent, rng = Math.random) {
  const crates = new Set();
  const clear = new Set();
  for (const [sx, sy] of SPAWNS) {
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) clear.add(key(sx + dx, sy + dy));
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (!isPillar(x, y) && !clear.has(key(x, y)) && rng() * 100 < percent) crates.add(key(x, y));
    }
  }
  return crates;
}

/** The order walls close in during sudden death: a spiral from the outside in. */
export function spiral() {
  const out = [];
  let x0 = 1;
  let y0 = 1;
  let x1 = W - 2;
  let y1 = H - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  return out.filter(([x, y]) => !isPillar(x, y));
}

export class BombDuel {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.settings = loadSettings(ctx, OPTIONS);
  }

  /** The setup screen. */
  start() {
    this.stopLoop();
    this.phase = 'setup';
    this.phaseEnds = null;
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.result = null;
    this.players = null;
    this.ctx.update();
  }

  begin() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.events = { bombs: 0, booms: 0, pickups: 0, walls: 0 };
    this.newRound();
    this.loop();
  }

  newRound() {
    this.round++;
    this.result = null;
    this.crates = makeCrates(this.settings.crates, this.rng);
    this.walls = new Set(); // sudden-death walls
    this.bombs = []; // { x, y, owner, at (explodes), range }
    this.fire = new Map(); // cell -> until
    this.powerups = new Map(); // cell -> kind
    this.players = SPAWNS.map(([x, y]) => ({
      x,
      y,
      dir: null, // where it's moving now
      want: null, // direction held
      alive: true,
      speed: RULES.speed,
      maxBombs: 1,
      range: 2,
    }));
    this.deadAt = null;
    this.spiral = spiral();
    this.nextWall = 0;
    this.enter('countdown', TIMING.countdownMs);
    this.roundStart = this.phaseEnds;
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  // ---- loop ----

  loop() {
    this.stopLoop();
    this.last = this.ctx.now();
    const step = () => {
      this.timer = this.ctx.setTimeout(() => {
        this.timer = null;
        this.tick();
        if (this.phase !== 'over' && this.phase !== 'setup') step();
      }, RULES.tickMs);
    };
    step();
  }

  stopLoop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  tick() {
    const now = this.ctx.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.phase === 'countdown' && now >= this.phaseEnds) this.enter('play', 0);
    else if (this.phase === 'roundEnd' && now >= this.phaseEnds) {
      if (this.winner !== null) return this.finish();
      this.newRound();
    }
    if (this.phase === 'play') {
      this.players.forEach((p) => p.alive && this.move(p, dt));
      this.pickups();
      // Bombs whose fuse ran out (chains go off inside explode()).
      for (const b of this.bombs.slice()) if (b.at <= now && this.bombs.includes(b)) this.explode(b);
      for (const [cell, until] of this.fire) if (until <= now) this.fire.delete(cell);
      this.suddenDeath(now);
      this.burn();
      this.checkRound(now);
    }
    this.ctx.update();
  }

  // ---- movement ----

  blocked(x, y) {
    const c = key(x, y);
    return isPillar(x, y) || this.crates.has(c) || this.walls.has(c) || this.bombs.some((b) => b.x === x && b.y === y);
  }

  /** Move along the grid: pick a direction at cell centres, reverse any time. */
  move(p, dt) {
    let dist = p.speed * dt;
    for (let guard = 0; dist > 1e-9 && guard < 8; guard++) {
      const atCentre = Math.abs(p.x - Math.round(p.x)) < 1e-6 && Math.abs(p.y - Math.round(p.y)) < 1e-6;
      if (atCentre) {
        p.x = Math.round(p.x);
        p.y = Math.round(p.y);
        p.dir = null;
        if (p.want) {
          const [dx, dy] = DIRS[p.want];
          if (!this.blocked(p.x + dx, p.y + dy)) p.dir = p.want;
        }
        if (!p.dir) return;
      } else if (p.want && p.want === OPPOSITE[p.dir]) {
        p.dir = p.want;
      }
      const [dx, dy] = DIRS[p.dir];
      // The next cell centre along this direction.
      const tx = dx > 0 ? Math.floor(p.x + 1e-9) + 1 : dx < 0 ? Math.ceil(p.x - 1e-9) - 1 : p.x;
      const ty = dy > 0 ? Math.floor(p.y + 1e-9) + 1 : dy < 0 ? Math.ceil(p.y - 1e-9) - 1 : p.y;
      const left = Math.abs(tx - p.x) + Math.abs(ty - p.y);
      const step = Math.min(dist, left);
      p.x += dx * step;
      p.y += dy * step;
      dist -= step;
      if (step === left) {
        p.x = tx;
        p.y = ty;
      }
    }
  }

  cellOf(p) {
    return [Math.round(p.x), Math.round(p.y)];
  }

  pickups() {
    this.players.forEach((p) => {
      if (!p.alive) return;
      const [x, y] = this.cellOf(p);
      const kind = this.powerups.get(key(x, y));
      if (!kind) return;
      this.powerups.delete(key(x, y));
      if (kind === 'bomb') p.maxBombs = Math.min(RULES.maxBombs, p.maxBombs + 1);
      if (kind === 'fire') p.range = Math.min(RULES.maxFire, p.range + 1);
      if (kind === 'speed') p.speed = Math.min(RULES.maxSpeed, p.speed + RULES.speedStep);
      this.events.pickups++;
    });
  }

  // ---- bombs ----

  dropBomb(slot) {
    const p = this.players[slot];
    if (this.phase !== 'play' || !p.alive) return;
    const [x, y] = this.cellOf(p);
    if (this.bombs.filter((b) => b.owner === slot).length >= p.maxBombs) return;
    if (this.bombs.some((b) => b.x === x && b.y === y) || this.walls.has(key(x, y))) return;
    this.bombs.push({ x, y, owner: slot, at: this.ctx.now() + RULES.fuseMs, range: p.range });
    this.events.bombs++;
  }

  /** Blast a bomb in a cross; it smashes the first crate each way and sets off other bombs. */
  explode(bomb) {
    const queue = [bomb];
    const until = this.ctx.now() + RULES.fireMs;
    const drops = [];
    while (queue.length) {
      const b = queue.shift();
      const i = this.bombs.indexOf(b);
      if (i === -1) continue;
      this.bombs.splice(i, 1);
      this.events.booms++;
      this.fire.set(key(b.x, b.y), until);
      for (const [dx, dy] of Object.values(DIRS)) {
        for (let k = 1; k <= b.range; k++) {
          const x = b.x + dx * k;
          const y = b.y + dy * k;
          const c = key(x, y);
          if (isPillar(x, y) || this.walls.has(c)) break;
          this.fire.set(c, until);
          if (this.crates.has(c)) {
            this.crates.delete(c);
            if (this.rng() < RULES.dropChance) drops.push(c);
            break;
          }
          this.powerups.delete(c); // blasts burn power-ups lying in the open
          const other = this.bombs.find((o) => o.x === x && o.y === y);
          if (other) queue.push(other);
        }
      }
    }
    // Power-ups from smashed crates appear once the dust settles (this blast doesn't burn them).
    for (const c of drops) this.powerups.set(c, POWERUPS[Math.floor(this.rng() * POWERUPS.length)]);
  }

  /** Anyone standing in fire is out. */
  burn() {
    this.players.forEach((p) => {
      const [x, y] = this.cellOf(p);
      if (p.alive && this.fire.has(key(x, y))) this.kill(p);
    });
  }

  kill(p) {
    p.alive = false;
    p.dir = null;
    if (this.deadAt === null) this.deadAt = this.ctx.now();
  }

  /** After 90 s, walls drop in a spiral from the edges, crushing what's under them. */
  suddenDeath(now) {
    const since = now - this.roundStart - TIMING.suddenDeathMs;
    if (since < 0) return;
    const due = Math.min(this.spiral.length, Math.floor(since / TIMING.wallEveryMs) + 1);
    while (this.nextWall < due) {
      const [x, y] = this.spiral[this.nextWall++];
      const c = key(x, y);
      this.walls.add(c);
      this.crates.delete(c);
      this.powerups.delete(c);
      this.bombs = this.bombs.filter((b) => !(b.x === x && b.y === y));
      this.events.walls++;
      this.players.forEach((p) => {
        const [px, py] = this.cellOf(p);
        if (p.alive && px === x && py === y) this.kill(p);
      });
    }
  }

  /** Once someone's out, wait a moment (a trade counts as a draw), then score the round. */
  checkRound(now) {
    if (this.deadAt === null || now - this.deadAt < TIMING.settleMs) return;
    const alive = this.players.map((p) => p.alive);
    const winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : null;
    if (winner !== null) this.scores[winner]++;
    this.result = { winner, draw: winner === null };
    if (winner !== null && this.scores[winner] >= this.settings.wins) this.winner = winner;
    this.enter('roundEnd', TIMING.roundEndMs);
  }

  finish() {
    this.stopLoop();
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (this.phase === 'setup') {
      if (input.type === 'setting' && applySetting(this.ctx, OPTIONS, this.settings, input.key, input.value)) this.ctx.update();
      if (input.type === 'go') this.begin();
      return;
    }
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.begin();
      if (input.type === 'setup') this.start();
      return;
    }
    if (!this.players) return;
    if (input.type === 'move') this.players[slot].want = DIRS[input.dir] ? input.dir : null;
    if (input.type === 'bomb') this.dropBomb(slot);
  }

  // ---- views ----

  common() {
    const now = this.ctx.now();
    const cells = (set) => [...set];
    const playing = Boolean(this.players);
    return {
      phase: this.phase,
      settings: this.settings,
      options: OPTIONS,
      w: W,
      h: H,
      round: this.round,
      scores: this.scores,
      winScore: this.settings.wins,
      winner: this.winner,
      result: this.result,
      crates: playing ? cells(this.crates) : [],
      walls: playing ? cells(this.walls) : [],
      powerups: playing ? [...this.powerups].map(([c, kind]) => [c, kind]) : [],
      bombs: playing ? this.bombs.map((b) => ({ x: b.x, y: b.y, owner: b.owner, left: Math.max(0, b.at - now) })) : [],
      fire: playing ? [...this.fire.keys()] : [],
      players: playing
        ? this.players.map((p) => ({
            x: Math.round(p.x * 100) / 100,
            y: Math.round(p.y * 100) / 100,
            dir: p.dir,
            alive: p.alive,
            bombs: p.maxBombs,
            range: p.range,
            speed: Math.round(((p.speed - RULES.speed) / RULES.speedStep) * 10) / 10, // speed-ups taken
            speedCells: p.speed,
          }))
        : null,
      fuseMs: RULES.fuseMs,
      events: this.events || null,
      suddenDeath: playing && this.phase === 'play' && now - this.roundStart >= TIMING.suddenDeathMs,
      timeLeftMs: playing && this.phase === 'play' ? Math.max(0, this.roundStart + TIMING.suddenDeathMs - now) : 0,
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
    };
  }

  hostView() {
    return Object.assign(this.common(), { names: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.common(), { you: slot });
  }
}

export default {
  id: 'bomb-duel',
  name: 'Bomb Duel',
  tagline: 'Bomberman-style: blast crates for power-ups and trap your rival in a cross of fire. Walls close in after 90 s.',
  create: (ctx) => new BombDuel(ctx),
};
