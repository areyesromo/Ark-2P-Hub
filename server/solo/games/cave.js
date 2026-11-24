// Helicopter Cave. Hold to rise, let go to fall, and fly as far as you can
// down a winding cave without touching its walls. The cave gets narrower and
// faster as you go, and rocks start sticking out of the floor and ceiling.
// Four maps, each harder than the last and each with its own bests; flying
// far enough unlocks the next one, and new vehicles to fly (just for looks).
// Score: metres flown.

import { settingOf } from './options.js';

export const FIELD = { w: 100, h: 60 };
export const COPTER = { x: 24, r: 1.8 };
// Units per second (squared). Lift only just beats gravity, so a tap is a small hop.
export const PHYS = { gravity: 62, lift: -72, maxRise: -34, maxFall: 38 };
// What every map shares: column width, how fast the gap closes, how sharply bends turn.
export const CAVE = { col: 2, narrowEvery: 50, bend: 0.06, margin: 3 };
export const ROCKS = { from: 120, w: 4 }; // the first comes 120 units after the opening screen

// The maps. slope is the steepest the cave goes (per unit along), kept below what
// the copter can climb at the map's top speed. rocks: 'both' sides, or 'top' (icicles).
// unlock: the achievement (see server/achievements.js) that opens it.
export const MAPS = {
  crystal: { name: 'Crystal Cave', gap: 40, minGap: 20, slope: 0.45, speed: 28, maxSpeed: 46, rockEvery: 70, rockH: 9, rocks: 'both' },
  mine: { name: 'Old Mine', gap: 36, minGap: 20, slope: 0.4, speed: 28, maxSpeed: 46, rockEvery: 45, rockH: 10, rocks: 'both', unlock: 'cave-100' },
  ice: { name: 'Ice Tunnel', gap: 38, minGap: 18, slope: 0.55, speed: 30, maxSpeed: 48, rockEvery: 40, rockH: 11, rocks: 'top', unlock: 'cave-mine' },
  volcano: { name: 'Volcano', gap: 36, minGap: 19, slope: 0.45, speed: 34, maxSpeed: 54, rockEvery: 55, rockH: 10, rocks: 'both', unlock: 'cave-ice' },
};
// The vehicles: all fly the same, they just look different.
export const VEHICLES = {
  copter: { name: 'Helicopter' },
  jet: { name: 'Jet', unlock: 'cave-500' },
  ufo: { name: 'UFO', unlock: 'cave-volcano' },
  dragon: { name: 'Dragon', unlock: 'cave-1000' },
};
export const TIMING = { tickMs: 1000 / 60, sendEvery: 2 };
export const UNITS_PER_METRE = 4;

const UNLOCKS = {};
for (const m of Object.values(MAPS)) if (m.unlock) UNLOCKS[m.unlock] = '🗺️ New map: ' + m.name;
for (const v of Object.values(VEHICLES)) if (v.unlock) UNLOCKS[v.unlock] = '🔓 New vehicle: ' + v.name;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export class Cave {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
    const map = settingOf(ctx, 'map', 'crystal');
    this.mapId = own(MAPS, map) ? map : 'crystal';
    this.map = MAPS[this.mapId];
    const vehicle = settingOf(ctx, 'vehicle', 'copter');
    this.vehicle = own(VEHICLES, vehicle) ? vehicle : 'copter';
    this.timer = null;
  }

  start() {
    this.copter = { y: FIELD.h / 2, vy: 0 };
    this.holding = false;
    this.distance = 0;
    this.ticks = 0;
    this.crashed = false;
    this.mid = FIELD.h / 2; // the cave's middle as it's dug
    this.target = this.mid; // where the middle is heading
    this.slope = 0; // how steeply it's going there, per unit along
    this.cols = []; // { x, top, bottom }: the ceiling's lowest point and the floor's highest, per column
    this.rocks = []; // { x, y0, y1 }
    this.nextRock = FIELD.w + ROCKS.from;
    this.dug = 0; // how far along the cave has been made
    while (this.cols.length * CAVE.col < FIELD.w + CAVE.col * 2) this.dig(true);
    // Waits for the first hold, hovering.
    this.phase = 'ready';
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.ctx.update();
  }

  get speed() {
    return Math.min(this.map.maxSpeed, this.map.speed + this.distance / 60);
  }

  get gap() {
    return Math.max(this.map.minGap, this.map.gap - this.dug / CAVE.narrowEvery);
  }

  /** One more column of cave on the right. The opening stretch is straight, so the start is fair. */
  dig(straight = false) {
    const gap = this.gap;
    const lo = CAVE.margin + gap / 2;
    const hi = FIELD.h - CAVE.margin - gap / 2;
    // The middle winds towards a new height each time it gets near, easing in and out of the
    // bends and never steeper than the copter can climb or drop at full speed.
    if (!straight && Math.abs(this.target - this.mid) < 0.5) this.target = lo + this.rng() * (hi - lo);
    const want = clamp((this.target - this.mid) / 8, -this.map.slope, this.map.slope);
    this.slope += clamp(want - this.slope, -CAVE.bend, CAVE.bend);
    this.mid = clamp(this.mid + this.slope * CAVE.col, lo, hi);
    this.target = clamp(this.target, lo, hi);
    const last = this.cols[this.cols.length - 1];
    const x = last ? last.x + CAVE.col : 0;
    const col = { x, top: this.mid - gap / 2, bottom: this.mid + gap / 2 };
    this.cols.push(col);
    this.dug += CAVE.col;
    if (this.dug >= this.nextRock) {
      this.nextRock += this.map.rockEvery;
      // A rock off the ceiling or the floor, never more than half the gap.
      const h = Math.min(this.map.rockH, gap / 2);
      const top = this.map.rocks === 'top' || this.rng() < 0.5;
      this.rocks.push(top ? { x, y0: col.top, y1: col.top + h } : { x, y0: col.bottom - h, y1: col.bottom });
    }
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.lastTick = this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.tick();
    }, TIMING.tickMs);
  }

  tick() {
    const dt = Math.min(0.1, (this.ctx.now() - this.lastTick) / 1000);
    // Small fixed steps, so a late tick can't carry the copter through a wall.
    const steps = Math.max(1, Math.ceil(dt / (TIMING.tickMs / 1000)));
    for (let i = 0; i < steps && this.phase === 'play'; i++) this.step(dt / steps);
    if (this.phase !== 'play') return this.ctx.update();
    this.ticks++;
    if (this.ticks % TIMING.sendEvery === 0) this.ctx.update();
    this.loop();
  }

  step(dt) {
    const c = this.copter;
    c.vy = clamp(c.vy + (this.holding ? PHYS.lift : PHYS.gravity) * dt, PHYS.maxRise, PHYS.maxFall);
    c.y += c.vy * dt;
    const dx = this.speed * dt;
    this.distance += dx;
    for (const col of this.cols) col.x -= dx;
    for (const r of this.rocks) r.x -= dx;
    this.cols = this.cols.filter((col) => col.x + CAVE.col > -2);
    this.rocks = this.rocks.filter((r) => r.x + ROCKS.w > -2);
    while (this.cols[this.cols.length - 1].x < FIELD.w + CAVE.col) this.dig();
    if (this.hits()) this.crash();
  }

  /** The copter (a circle) against the walls next to it and any rock. */
  hits() {
    const { x, r } = COPTER;
    const y = this.copter.y;
    const touches = (x0, y0, x1, y1) => (x - clamp(x, x0, x1)) ** 2 + (y - clamp(y, y0, y1)) ** 2 < r ** 2;
    for (const col of this.cols) {
      if (col.x > x + r || col.x + CAVE.col < x - r) continue;
      if (touches(col.x, -10, col.x + CAVE.col, col.top) || touches(col.x, col.bottom, col.x + CAVE.col, FIELD.h + 10)) return true;
    }
    return this.rocks.some((rk) => touches(rk.x, rk.y0, rk.x + ROCKS.w, rk.y1));
  }

  crash() {
    this.crashed = true;
    this.phase = 'over';
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  hold(on) {
    this.holding = on;
    if (on && this.phase === 'ready') {
      this.phase = 'play';
      this.loop();
      this.ctx.update();
    }
  }

  togglePause() {
    if (this.phase === 'play') {
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.phase = 'paused';
      this.ctx.update();
    } else if (this.phase === 'paused') {
      // Carries on level, so a held button let go while paused doesn't drop you into the floor.
      this.phase = 'play';
      this.copter.vy = 0;
      this.ctx.update();
      this.loop();
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'pause') return this.togglePause();
    if (input.type === 'hold' && typeof input.on === 'boolean') this.hold(input.on);
  }

  get metres() {
    return Math.floor(this.distance / UNITS_PER_METRE);
  }

  hostView() {
    return {
      phase: this.phase,
      player: this.ctx.player,
      map: this.mapId,
      vehicle: this.vehicle,
      field: FIELD,
      copter: { x: COPTER.x, y: this.copter.y, vy: this.copter.vy, r: COPTER.r },
      // The walls as [x, top, bottom], rounded: they're sent 30 times a second.
      cols: this.cols.map((c) => [Math.round(c.x * 100) / 100, Math.round(c.top * 100) / 100, Math.round(c.bottom * 100) / 100]),
      col: CAVE.col,
      rocks: this.rocks.map((r) => ({ x: r.x, y0: r.y0, y1: r.y1 })),
      rockW: ROCKS.w,
      speed: this.phase === 'play' ? this.speed : 0,
      distance: this.distance,
      holding: this.holding,
      crashed: this.crashed,
      score: this.metres,
      variant: this.map.name,
      // What each achievement opens, so the end screen can say "New map: Old Mine".
      unlocks: this.phase === 'over' ? UNLOCKS : null,
    };
  }

  playerView() {
    return { phase: this.phase, score: this.metres, holding: this.holding, map: this.map.name, vehicle: VEHICLES[this.vehicle].name, unlocks: this.phase === 'over' ? UNLOCKS : null };
  }
}

export default {
  id: 'cave',
  name: 'Helicopter Cave',
  tagline: 'Hold to climb, let go to drop. Fly down the winding cave as far as you can.',
  category: 'arcade',
  phone: 'split',
  score: { better: 'higher', unit: 'm' },
  create: (ctx) => new Cave(ctx, ctx.rng),
};
