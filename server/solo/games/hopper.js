// Road Hopper. Get the frog from the bottom of the screen to the top: hop
// across a busy road (don't get hit), rest on the verge, then cross the river
// on the logs (the water is deadly, and a log carries you along; don't ride it
// off the edge). Each crossing scores and makes the next one faster. Three
// lives, and 30 seconds for each go. Score: points (10 for each row you get
// further than before, 50 for a crossing plus a bonus for the time left).
//
// Everything on the road and the river moves on a fixed schedule from the
// start of the crossing, so the screens can draw it from the clock.

export const W = 13; // columns
export const H = 13; // rows: 0 is the far bank, 12 the start
const RIVER = [1, 2, 3, 4, 5];
const VERGE = 6;
const ROAD = [7, 8, 9, 10, 11];
export const START = { x: 6, row: 12 };
export const LIVES = 3;
export const TIMING = { tickMs: 50, sendEvery: 4, lifeMs: 30000, deadMs: 1200 };
const WRAP = W + 6; // things drive off one side and come back on the other, out of sight for a moment
const POINTS = { row: 10, cross: 50, perSecond: 2 };

export class Hopper {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.score = 0;
    this.lives = LIVES;
    this.level = 1;
    this.crossings = 0;
    this.deaths = 0;
    this.newLevel();
    this.spawn();
    this.phase = 'play';
    this.loop();
    this.ctx.update();
  }

  /** A fresh set of lanes, faster each crossing. */
  newLevel() {
    const pace = 1 + (this.level - 1) * 0.12;
    this.lanes = [];
    RIVER.forEach((row, i) => {
      const len = 2 + Math.floor(this.rng() * 3); // logs of 2 to 4
      this.lanes.push(this.lane(row, 'river', i % 2 ? 1 : -1, (0.9 + this.rng() * 1.1) * pace, len, len + 2 + Math.floor(this.rng() * 3)));
    });
    ROAD.forEach((row, i) => {
      const len = i === 1 || i === 3 ? 2 : 1; // trucks on two lanes, cars on the rest
      this.lanes.push(this.lane(row, 'road', i % 2 ? 1 : -1, (1 + this.rng() * 1.6) * pace, len, len + 2 + Math.floor(this.rng() * 4)));
    });
    this.levelStart = this.ctx.now();
  }

  /** A lane of things len long, about every `every` cells, starting at a random offset. */
  lane(row, kind, dir, speed, len, every) {
    const objs = [];
    const offset = this.rng() * every;
    for (let x = 0; x + len <= WRAP; x += every) objs.push(Math.round((x + offset) % WRAP * 100) / 100);
    return { row, kind, dir, speed: Math.round(speed * 100) / 100, len, objs };
  }

  /** Where a lane's things are now: their left edges. */
  positions(lane, t) {
    return lane.objs.map((x0) => {
      const x = (((x0 + lane.dir * lane.speed * t) % WRAP) + WRAP) % WRAP;
      return x - 3; // the lane runs from -3 to W + 3: they leave and come back out of sight
    });
  }

  get t() {
    return (this.ctx.now() - this.levelStart) / 1000;
  }

  spawn() {
    this.frog = { x: START.x, row: START.row };
    this.furthest = START.row; // the best row reached on this go (for points)
    this.lifeEnds = this.ctx.now() + TIMING.lifeMs;
    this.lastTick = this.ctx.now();
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, TIMING.tickMs);
  }

  tick() {
    const now = this.ctx.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    if (this.phase === 'play') {
      const lane = this.laneAt(this.frog.row);
      if (lane && lane.kind === 'river') this.frog.x += lane.dir * lane.speed * dt; // carried by the log
      this.check();
      if (this.phase === 'play' && now >= this.lifeEnds) this.die('time');
    }
    if (this.phase === 'over' || this.phase === 'paused') return this.ctx.update();
    this.ticks = (this.ticks || 0) + 1;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  laneAt(row) {
    return this.lanes.find((l) => l.row === row) || null;
  }

  /** What's under the frog: a car hits it, the water drowns it, the edge loses it. */
  check() {
    const f = this.frog;
    const lane = this.laneAt(f.row);
    if (!lane) return;
    if (f.x < -0.4 || f.x > W - 0.6) return this.die('edge');
    const over = this.positions(lane, this.t).some((x) => f.x + 0.8 > x && f.x + 0.2 < x + lane.len);
    if (lane.kind === 'road' && over) this.die('car');
    else if (lane.kind === 'river' && !over) this.die('water');
  }

  die(how) {
    this.lives--;
    this.deaths++;
    this.death = { how, x: this.frog.x, row: this.frog.row, n: this.deaths };
    if (this.lives <= 0) {
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    this.phase = 'dead';
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.spawn();
      this.phase = 'play';
      this.ctx.update();
      this.loop();
    }, TIMING.deadMs);
  }

  hop(dir) {
    const f = this.frog;
    const moves = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const [dx, dy] = moves[dir];
    const row = f.row + dy;
    if (row < 0 || row > START.row) return;
    // Hops land on whole cells, so riding a log and hopping off lines up again.
    const x = dy ? Math.round(f.x) : Math.round(f.x) + dx;
    if (x < 0 || x > W - 1) return;
    f.x = x;
    f.row = row;
    this.hops = (this.hops || 0) + 1;
    if (row < this.furthest) {
      this.furthest = row;
      this.score += POINTS.row;
    }
    if (row === 0) return this.crossed();
    this.check();
  }

  crossed() {
    const left = Math.max(0, Math.ceil((this.lifeEnds - this.ctx.now()) / 1000));
    this.score += POINTS.cross + left * POINTS.perSecond;
    this.crossings++;
    this.lastCross = { bonus: left * POINTS.perSecond, n: this.crossings };
    this.level++;
    this.newLevel();
    this.spawn();
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.pausedAt = this.ctx.now();
      this.phase = 'paused';
    } else if (this.phase === 'paused') {
      // The lanes and the frog's clock carry on from where they were.
      const away = this.ctx.now() - this.pausedAt;
      this.levelStart += away;
      this.lifeEnds += away;
      this.lastTick = this.ctx.now();
      this.phase = 'play';
      this.loop();
    }
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type !== 'hop' || this.phase !== 'play') return;
    if (!['up', 'down', 'left', 'right'].includes(input.dir)) return;
    this.hop(input.dir);
    this.ctx.update();
  }

  view() {
    return {
      phase: this.phase,
      w: W,
      h: H,
      verge: VERGE,
      wrap: WRAP,
      lanes: this.lanes,
      t: this.phase === 'paused' ? (this.pausedAt - this.levelStart) / 1000 : this.t,
      frog: { x: Math.round(this.frog.x * 100) / 100, row: this.frog.row },
      timeLeft: Math.max(0, this.lifeEnds - (this.phase === 'paused' ? this.pausedAt : this.ctx.now())),
      lifeMs: TIMING.lifeMs,
      lives: this.lives,
      level: this.level,
      crossings: this.crossings,
      death: this.death || null,
      lastCross: this.lastCross || null,
      score: this.score,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    const v = this.view();
    return { phase: v.phase, lives: v.lives, level: v.level, score: v.score, timeLeft: v.timeLeft, lifeMs: v.lifeMs, death: v.death };
  }
}

export default {
  id: 'hopper',
  name: 'Road Hopper',
  tagline: 'Hop across the road and the river without getting squashed or soaked.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Hopper(ctx, ctx.rng),
};
