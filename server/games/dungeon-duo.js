// Dungeon Duo. Co-op: a Fighter and a Healer fight their way down through the floors of a
// dungeon (dungeon-duo-floors.js) together, seen in 3D on the TV. Walk with the phone's pad (or
// a controller's stick); ATTACK swings the Fighter's sword at whatever is in front of them or
// fires one of the Healer's bolts; SPECIAL is the Fighter's shield (hold it: hits from the front
// are blocked, and you walk slower) or the Healer's healing circle (it patches up anyone standing
// in it for a few seconds, then needs time to come back). Enemies hurt on touch. At no hearts
// you're downed: your partner revives you by standing beside you for a moment. If you're both
// down, it's back to the start of the floor, and that costs a continue; out of continues, the
// quest is over. Keys open locked doors; both of you on the stairs (on your feet) and it's down
// to the next floor. Further down: spikes that go up and down in turn, gates that only stay
// open while one of you stands on a pressure plate, and skeletons that throw bones from a
// distance (the shield blocks those too). Stars at the end: for finishing, for few retries, and for a good time.

import { settingOf } from './options.js';
import { FLOORS } from './dungeon-duo-floors.js';

/** Hearts by difficulty ([normal, easy]); damage; how often you can attack. */
export const HEROES = {
  fighter: { hp: [6, 9], damage: 2, everyMs: 400, reach: 1.3, arc: 0.6, speed: 3.4, blockSpeed: 1.7 },
  healer: { hp: [5, 8], damage: 1, everyMs: 400, boltSpeed: 9, boltMs: 1200, speed: 3.6, healEveryMs: 12000 },
};
export const ENEMIES = {
  slime: { hp: 3, speed: 1.3, damage: 1, aggro: 7 },
  bat: { hp: 1, speed: 2.6, damage: 1, aggro: 8 },
  // Skeletons keep about `keepAway` from you and throw a bone now and then, if they can see you.
  skeleton: { hp: 3, speed: 1.5, damage: 1, aggro: 8, keepAway: 3.5, throwEveryMs: 2000, boneSpeed: 5, boneMs: 2500 },
};
/** Spikes: down for a while, then up (and hurting) for a moment, all together. */
export const SPIKES = { downMs: 2000, upMs: 1000, damage: 1 };
export const CONTINUES = [3, 5];
export const TIMING = {
  tickMs: 1000 / 30,
  sendEvery: 2,
  countdownMs: 3000,
  invulnMs: 900,
  blockMs: 400, // after a block, the shield holds against the next hit from the front for free
  reviveMs: 2000,
  circleMs: 4000,
  retryMs: 2500,
  floorClearMs: 2500,
  parMsPerFloor: 3 * 60000, // a good time: this long a floor
};
const R = 0.3; // half a hero's (or enemy's) width
const TOUCH = 0.65; // an enemy this close hurts
const KNOCKBACK = 0.6; // how far the shield shoves an enemy
const REVIVE_RANGE = 1.4; // from a safe tile beside spikes, too
const ENEMY_LETTERS = { s: 'slime', b: 'bat', k: 'skeleton' };

/** Stars for a quest: finishing, few retries (one at most), and a good time. */
export function starsFor({ won, retries, ms, par }) {
  if (!won) return 0;
  return 1 + (retries <= 1 ? 1 : 0) + (ms <= par ? 1 : 0);
}

export class DungeonDuo {
  constructor(ctx, rng = Math.random, floors = FLOORS) {
    this.ctx = ctx;
    this.rng = rng;
    this.floors = floors;
    this.easy = settingOf(ctx, 'difficulty', 0) === 1;
    this.swap = settingOf(ctx, 'heroes', 0) === 1; // player 1 is the Healer
    this.timer = null;
    this.controls = [{ x: 0, y: 0, special: false }, { x: 0, y: 0, special: false }];
  }

  start() {
    this.continues = CONTINUES[this.easy ? 1 : 0];
    this.retries = 0;
    this.floor = 0;
    this.won = false;
    this.events = { hits: 0, kills: 0, hurt: 0, blocked: 0, heals: 0, downs: 0, revives: 0, keys: 0, doors: 0, thrown: 0 };
    this.startedAt = null;
    this.finishedMs = 0;
    this.controls = [{ x: 0, y: 0, special: false }, { x: 0, y: 0, special: false }];
    this.nextId = 1; // never restarted mid-quest: the TV knows enemies by id
    this.load();
    this.enter('countdown', TIMING.countdownMs);
    this.loop();
  }

  /** The current floor, fresh: its map, enemies and the heroes at the start. */
  load() {
    const f = this.floors[this.floor];
    this.map = f.map.map((row) => row.split(''));
    this.enemies = [];
    this.shots = [];
    this.bones = [];
    this.circles = [];
    this.keys = 0;
    this.gateOpen = false;
    this.floorAt = this.ctx.now(); // the spikes' rhythm starts here
    const starts = [];
    this.map.forEach((row, y) => row.forEach((c, x) => {
      if (c === 'S') starts.push([x + 0.5, y + 0.5]);
      if (ENEMY_LETTERS[c]) this.spawnEnemy(ENEMY_LETTERS[c], x + 0.5, y + 0.5);
      if (c === 'S' || ENEMY_LETTERS[c]) row[x] = ' ';
    }));
    const roles = this.swap ? ['healer', 'fighter'] : ['fighter', 'healer'];
    this.heroes = roles.map((role, slot) => {
      const max = HEROES[role].hp[this.easy ? 1 : 0];
      return { role, x: starts[slot][0], y: starts[slot][1], face: [0, 1], hp: max, max, downed: false, revive: 0, invulnUntil: 0, blockUntil: 0, readyAt: 0, healAt: 0, blocking: false };
    });
  }

  spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const e = { id: this.nextId++, kind, x, y, hp: def.hp, max: def.hp, speed: def.speed, hurtUntil: 0, wobble: this.rng() * Math.PI * 2, throwAt: this.ctx.now() + (def.throwEveryMs || 0) / 2 };
    this.enemies.push(e);
    return e;
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
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

  tick() {
    const now = this.ctx.now();
    const dt = Math.min(100, now - this.last);
    this.last = now;
    if (this.phase === 'countdown' || this.phase === 'retry' || this.phase === 'floorClear') {
      if (now >= this.phaseEnds) {
        if (this.phase === 'countdown') {
          this.startedAt = now;
          this.enter('play', 0);
        } else if (this.phase === 'retry') {
          this.load();
          this.enter('play', 0);
        } else if (this.floor + 1 >= this.floors.length) {
          this.won = true;
          return this.finish();
        } else {
          this.floor++;
          this.load();
          this.enter('play', 0);
        }
      } else if (this.frame++ % TIMING.sendEvery === 0) this.ctx.update();
      return;
    }
    if (this.phase !== 'play') return;
    this.updateGate();
    this.heroes.forEach((h, slot) => this.walkHero(h, this.controls[slot], dt));
    this.moveEnemies(dt, now);
    this.moveShots(dt, now);
    this.moveBones(dt, now);
    this.spikes();
    this.heal(now);
    this.touches(now);
    this.revives(dt);
    this.pickups();
    if (this.heroes.every((h) => h.downed)) return this.bothDown();
    if (this.onStairs()) return this.enter('floorClear', TIMING.floorClearMs);
    if (this.frame++ % TIMING.sendEvery === 0) this.ctx.update();
  }

  solid(x, y) {
    const row = this.map[Math.floor(y)];
    if (!row) return true;
    const c = row[Math.floor(x)];
    return c === '#' || c === 'D' || (c === 'G' && !this.gateOpen) || c === undefined;
  }

  /** The tiles a body's corners are on. */
  corners(b) {
    const E = 1e-6;
    return [[b.x - R, b.y - R], [b.x + R - E, b.y - R], [b.x - R, b.y + R - E], [b.x + R - E, b.y + R - E]].map(([x, y]) => (this.map[Math.floor(y)] || [])[Math.floor(x)]);
  }

  /**
   * Gates stand open while a hero is on a plate, and don't shut on anyone still in the gateway.
   * They also open while either of you is down, so the gate never keeps you from a revive.
   */
  updateGate() {
    const onPlate = this.heroes.some((h) => h.downed || this.map[Math.floor(h.y)][Math.floor(h.x)] === 'P');
    const inGate = this.gateOpen && [...this.heroes, ...this.enemies].some((b) => this.corners(b).includes('G'));
    this.gateOpen = onPlate || inGate;
  }

  spikesUp() {
    return (this.ctx.now() - this.floorAt) % (SPIKES.downMs + SPIKES.upMs) >= SPIKES.downMs;
  }

  /** Raised spikes hurt whoever is standing on them, once a rise; a shield is no use against the floor. */
  spikes() {
    if (!this.spikesUp()) return;
    const rise = Math.floor((this.ctx.now() - this.floorAt) / (SPIKES.downMs + SPIKES.upMs));
    this.heroes.forEach((h, slot) => {
      if (h.downed || h.spikedRise === rise || this.map[Math.floor(h.y)][Math.floor(h.x)] !== '^') return;
      if (this.hurt(slot, SPIKES.damage, null)) h.spikedRise = rise;
    });
  }

  /** Nothing solid on the straight line between two points. */
  canSee(ax, ay, bx, by) {
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.25);
    for (let i = 1; i < steps; i++) if (this.solid(ax + ((bx - ax) * i) / steps, ay + ((by - ay) * i) / steps)) return false;
    return true;
  }

  blocked(x, y) {
    const E = 1e-6;
    return this.solid(x - R, y - R) || this.solid(x + R - E, y - R) || this.solid(x - R, y + R - E) || this.solid(x + R - E, y + R - E);
  }

  /** Move a body one axis at a time, stopping flush against walls. Gives the tile it bumped into, if any. */
  slide(b, vx, vy) {
    const E = 1e-6;
    let bump = null;
    const nx = b.x + vx;
    if (!this.blocked(nx, b.y)) b.x = nx;
    else if (vx) {
      bump = [Math.floor(vx > 0 ? nx + R : nx - R), Math.floor(b.y)];
      b.x = vx > 0 ? Math.max(b.x, Math.floor(nx + R) - R) : Math.min(b.x, Math.floor(nx - R) + 1 + R + E);
    }
    const ny = b.y + vy;
    if (!this.blocked(b.x, ny)) b.y = ny;
    else if (vy) {
      bump = bump || [Math.floor(b.x), Math.floor(vy > 0 ? ny + R : ny - R)];
      b.y = vy > 0 ? Math.max(b.y, Math.floor(ny + R) - R) : Math.min(b.y, Math.floor(ny - R) + 1 + R + E);
    }
    return bump;
  }

  walkHero(h, ctl, dt) {
    h.blocking = h.role === 'fighter' && ctl.special && !h.downed;
    if (h.downed || (!ctl.x && !ctl.y)) return;
    const len = Math.hypot(ctl.x, ctl.y);
    if (len > 0.2) h.face = [ctl.x / len, ctl.y / len];
    const def = HEROES[h.role];
    const d = ((h.blocking ? def.blockSpeed : def.speed) * dt) / 1000;
    const bump = this.slide(h, ctl.x * d, ctl.y * d);
    // Walking into a locked door with a key opens it.
    if (bump && this.map[bump[1]][bump[0]] === 'D' && this.keys > 0) {
      this.keys--;
      this.map[bump[1]][bump[0]] = ' ';
      this.events.doors++;
    }
  }

  /** The alive hero closest to (x, y), within `range`. */
  nearestHero(x, y, range) {
    let best = null;
    let bestD = range;
    for (const h of this.heroes) {
      if (h.downed) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD) {
        best = h;
        bestD = d;
      }
    }
    return best;
  }

  moveEnemies(dt, now) {
    for (const e of this.enemies) {
      const def = ENEMIES[e.kind];
      const h = this.nearestHero(e.x, e.y, def.aggro);
      if (!h) continue;
      let dx = h.x - e.x;
      let dy = h.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      if (e.kind === 'skeleton') {
        if (now >= e.throwAt && this.canSee(e.x, e.y, h.x, h.y)) {
          e.throwAt = now + def.throwEveryMs;
          this.bones.push({ x: e.x + dx * 0.4, y: e.y + dy * 0.4, vx: dx * def.boneSpeed, vy: dy * def.boneSpeed, damage: def.damage, until: now + def.boneMs });
          this.events.thrown++;
        }
        // Back off when you get close, come closer when you're far, otherwise hold still.
        const way = len < def.keepAway ? -1 : len > def.keepAway + 1.5 ? 1 : 0;
        const d = (e.speed * dt) / 1000;
        if (way && d) this.slide(e, dx * d * way, dy * d * way);
        continue;
      }
      if (!e.speed) continue;
      if (e.kind === 'bat') {
        // Bats flutter: a wobble across the way they fly.
        e.wobble += dt / 180;
        const w = Math.sin(e.wobble) * 0.8;
        [dx, dy] = [dx - dy * w, dy + dx * w];
        const l2 = Math.hypot(dx, dy) || 1;
        dx /= l2;
        dy /= l2;
      }
      if (len < TOUCH * 0.8) continue; // close enough: no need to push into you
      const d = (e.speed * dt) / 1000;
      this.slide(e, dx * d, dy * d);
    }
  }

  moveShots(dt, now) {
    const keep = [];
    for (const s of this.shots) {
      s.x += (s.vx * dt) / 1000;
      s.y += (s.vy * dt) / 1000;
      if (now >= s.until || this.solid(s.x, s.y)) continue;
      const hit = this.enemies.find((e) => Math.hypot(e.x - s.x, e.y - s.y) < 0.45);
      if (hit) {
        this.damageEnemy(hit, s.damage, now);
        continue;
      }
      keep.push(s);
    }
    this.shots = keep;
  }

  /** Bones fly until they hit a hero (who might block it), a wall, or run out. */
  moveBones(dt, now) {
    const keep = [];
    for (const b of this.bones) {
      b.x += (b.vx * dt) / 1000;
      b.y += (b.vy * dt) / 1000;
      if (now >= b.until || this.solid(b.x, b.y)) continue;
      const slot = this.heroes.findIndex((h) => !h.downed && Math.hypot(h.x - b.x, h.y - b.y) < 0.45);
      if (slot >= 0) {
        this.hurt(slot, b.damage, [b.x - b.vx, b.y - b.vy]); // from where it was thrown
        continue;
      }
      keep.push(b);
    }
    this.bones = keep;
  }

  damageEnemy(e, damage, now) {
    e.hp -= damage;
    e.hurtUntil = now + 200;
    this.events.hits++;
    if (e.hp > 0) return;
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.events.kills++;
  }

  /** Healing circles: a heart a second to anyone on their feet standing in one. */
  heal(now) {
    this.circles = this.circles.filter((c) => now < c.until);
    for (const c of this.circles) {
      if (now < c.nextAt) continue;
      c.nextAt += 1000;
      for (const h of this.heroes) {
        if (h.downed || h.hp >= h.max || Math.hypot(h.x - c.x, h.y - c.y) > c.r) continue;
        h.hp++;
        this.events.heals++;
      }
    }
  }

  /** Enemies hurt on touch. */
  touches() {
    for (const e of this.enemies) {
      this.heroes.forEach((h, slot) => {
        if (h.downed || Math.hypot(h.x - e.x, h.y - e.y) >= TOUCH) return;
        if (this.hurt(slot, ENEMIES[e.kind].damage, [e.x, e.y]) !== 'blocked') return;
        // Shoved back off the shield.
        const dx = e.x - h.x;
        const dy = e.y - h.y;
        const len = Math.hypot(dx, dy) || 1;
        this.slide(e, (dx / len) * KNOCKBACK, (dy / len) * KNOCKBACK);
      });
    }
  }

  /**
   * Hero `slot` takes `damage` from point `from` (null: from nowhere in particular). A Fighter
   * holding the shield blocks anything from in front; after a hit, a moment before the next.
   * Gives 'hurt', 'blocked', or nothing (it didn't count).
   */
  hurt(slot, damage, from) {
    const h = this.heroes[slot];
    const now = this.ctx.now();
    if (h.downed || now < h.invulnUntil) return;
    if (h.blocking && from) {
      const dx = from[0] - h.x;
      const dy = from[1] - h.y;
      const len = Math.hypot(dx, dy) || 1;
      if ((dx * h.face[0] + dy * h.face[1]) / len > 0.35) {
        if (now < h.blockUntil) return 'blocked'; // still braced from the last one: no fuss
        h.blockUntil = now + TIMING.blockMs;
        this.events.blocked++;
        return 'blocked';
      }
    }
    h.hp = Math.max(0, h.hp - damage);
    h.invulnUntil = now + TIMING.invulnMs;
    this.events.hurt++;
    if (h.hp === 0) {
      h.downed = true;
      h.revive = 0;
      h.blocking = false;
      this.events.downs++;
    }
    return 'hurt';
  }

  /** A downed hero comes back once their partner has stood beside them long enough. */
  revives(dt) {
    this.heroes.forEach((h, slot) => {
      if (!h.downed) return;
      const p = this.heroes[1 - slot];
      if (p.downed || Math.hypot(p.x - h.x, p.y - h.y) > REVIVE_RANGE) {
        h.revive = 0;
        return;
      }
      h.revive += dt;
      if (h.revive < TIMING.reviveMs) return;
      h.downed = false;
      h.hp = Math.ceil(h.max / 2);
      h.invulnUntil = this.ctx.now() + TIMING.invulnMs;
      this.events.revives++;
    });
  }

  /** Keys: walk over one to pick it up. */
  pickups() {
    for (const h of this.heroes) {
      if (h.downed) continue;
      const x = Math.floor(h.x);
      const y = Math.floor(h.y);
      if (this.map[y][x] !== 'K') continue;
      this.map[y][x] = ' ';
      this.keys++;
      this.events.keys++;
    }
  }

  onStairs() {
    return this.heroes.every((h) => !h.downed && this.map[Math.floor(h.y)][Math.floor(h.x)] === 'E');
  }

  /** Both down: back to the start of the floor (a continue), or the end of the quest. */
  bothDown() {
    if (this.continues <= 0) return this.finish();
    this.continues--;
    this.retries++;
    this.enter('retry', TIMING.retryMs);
  }

  finish() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.finishedMs = this.startedAt === null ? 0 : this.ctx.now() - this.startedAt;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  attack(slot) {
    const h = this.heroes[slot];
    const now = this.ctx.now();
    if (h.downed || now < h.readyAt) return;
    const def = HEROES[h.role];
    h.readyAt = now + def.everyMs;
    h.swungAt = now;
    if (h.role === 'fighter') {
      // A sweep in front: everything within reach and inside the arc.
      for (const e of this.enemies.slice()) {
        const dx = e.x - h.x;
        const dy = e.y - h.y;
        const d = Math.hypot(dx, dy);
        if (d > def.reach || (d > 0.01 && (dx * h.face[0] + dy * h.face[1]) / d < def.arc)) continue;
        this.damageEnemy(e, def.damage, now);
      }
    } else {
      this.shots.push({ x: h.x + h.face[0] * 0.4, y: h.y + h.face[1] * 0.4, vx: h.face[0] * def.boltSpeed, vy: h.face[1] * def.boltSpeed, damage: def.damage, until: now + def.boltMs });
    }
    this.ctx.update();
  }

  special(slot, on) {
    const h = this.heroes[slot];
    const was = this.controls[slot].special;
    this.controls[slot].special = on;
    if (h.role === 'fighter') {
      if (on === was) return;
      h.blocking = on && !h.downed;
      return this.ctx.update();
    }
    const now = this.ctx.now();
    if (!on || h.downed || now < h.healAt) return;
    h.healAt = now + HEROES.healer.healEveryMs;
    this.circles.push({ x: h.x, y: h.y, r: 1.6, until: now + TIMING.circleMs, nextAt: now + 1000 });
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    const ctl = this.controls[slot];
    if (input.type === 'move') {
      let x = input.x;
      let y = input.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      ctl.x = x;
      ctl.y = y;
      // A controller sends SPECIAL with its stick: act on it when it changes.
      if (typeof input.special === 'boolean' && input.special !== ctl.special) return this.onInput(slot, { type: 'special', on: input.special });
      return;
    }
    if (input.type === 'special' && typeof input.on === 'boolean') {
      if (this.phase === 'play') return this.special(slot, input.on);
      ctl.special = input.on;
      return;
    }
    if (input.type === 'attack' && this.phase === 'play') this.attack(slot);
  }

  view() {
    const now = this.ctx.now();
    const r2 = (n) => Math.round(n * 100) / 100;
    const par = TIMING.parMsPerFloor * this.floors.length;
    const ms = this.phase === 'over' ? this.finishedMs : this.startedAt === null ? 0 : now - this.startedAt;
    return {
      phase: this.phase,
      floor: this.floor,
      floors: this.floors.length,
      floorName: this.floors[this.floor].name,
      map: this.map.map((row) => row.join('')),
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
      heroes: this.heroes.map((h) => ({
        role: h.role, x: r2(h.x), y: r2(h.y), face: [r2(h.face[0]), r2(h.face[1])], hp: h.hp, max: h.max, downed: h.downed,
        revive: h.downed ? r2(h.revive / TIMING.reviveMs) : 0, hurt: now < h.invulnUntil, blocking: h.blocking,
        swing: h.swungAt && now - h.swungAt < 200, readyIn: Math.max(0, h.readyAt - now), healIn: h.role === 'healer' ? Math.max(0, h.healAt - now) : 0,
      })),
      enemies: this.enemies.map((e) => ({ id: e.id, kind: e.kind, x: r2(e.x), y: r2(e.y), hp: e.hp, max: e.max, hurt: now < e.hurtUntil })),
      shots: this.shots.map((s) => ({ x: r2(s.x), y: r2(s.y) })),
      bones: this.bones.map((b) => ({ x: r2(b.x), y: r2(b.y) })),
      spikesUp: this.spikesUp(),
      gateOpen: this.gateOpen,
      circles: this.circles.map((c) => ({ x: r2(c.x), y: r2(c.y), r: c.r, left: r2((c.until - now) / TIMING.circleMs) })),
      keys: this.keys,
      continues: this.continues,
      retries: this.retries,
      timeMs: ms,
      parMs: par,
      healEveryMs: HEROES.healer.healEveryMs,
      events: this.events,
      won: this.won,
      // For the room's history (a co-op game: the team's stars).
      stars: this.phase === 'over' ? starsFor({ won: this.won, retries: this.retries, ms, par }) : 0,
      maxStars: 3,
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
  id: 'dungeon-duo',
  name: 'Dungeon Duo',
  category: 'casual',
  motion: true, // phones can tilt or move to play (with buttons or a joystick as well)
  tagline: 'Co-op dungeon crawl in 3D: a Fighter and a Healer fight their way down through the floors together. Revive each other, find the keys, beat the boss.',
  create: (ctx) => new DungeonDuo(ctx),
};
