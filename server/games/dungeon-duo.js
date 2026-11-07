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
// distance (the shield blocks those too). At the bottom waits the Stone Warden: it slams the
// ground (get out of the ring before it lands), charges in a straight line (into a wall, or
// into a raised shield, and it's stunned for a moment), and calls up help at half health.
// Beat it and the quest is won. Stars at the end: for finishing, for few retries, and for a good time.

import { settingOf } from './options.js';
import { FLOORS } from './dungeon-duo-floors.js';

/** Hearts by difficulty ([normal, easy]); damage; how often you can attack. */
export const HEROES = {
  fighter: { hp: [6, 9], damage: 2, everyMs: 400, reach: 1.3, arc: 0.6, speed: 3.4, blockSpeed: 1.7 },
  healer: { hp: [5, 8], damage: 1, everyMs: 400, boltSpeed: 9, boltMs: 1200, speed: 3.6, healEveryMs: 12000 },
};
/** The Stone Warden, the boss: health by difficulty ([normal, easy]), size, and its moves. */
export const WARDEN = {
  hp: [40, 28], r: 0.75, speed: 1.1,
  walkMs: 2200, // walks at you this long between moves
  slamRange: 2.6, slamR: 2.3, slamWindupMs: 1100, slamDamage: 2, // slams if you're close...
  chargeWindupMs: 800, chargeSpeed: 7, chargeMs: 2500, chargeDamage: 2, // ...charges if you're not
  stunMs: 1600, restMs: 900,
  detourMs: 1800, // how long it steps sideways round a pillar
  summon: ['slime', 'bat', 'slime'], // at half health, once
};
export const ENEMIES = {
  slime: { hp: 3, speed: 1.3, damage: 1, aggro: 7 },
  bat: { hp: 1, speed: 2.6, damage: 1, aggro: 8 },
  bigslime: { hp: 5, speed: 1, damage: 1, aggro: 7 }, // splits into two slimes when it's beaten
  // Skeletons keep about `keepAway` from you and throw a bone now and then, if they can see you.
  skeleton: { hp: 3, speed: 1.5, damage: 1, aggro: 8, keepAway: 3.5, throwEveryMs: 2000, boneSpeed: 5, boneMs: 2500 },
  warden: { hp: WARDEN.hp[0], speed: WARDEN.speed, damage: 1, aggro: 99 },
};
/** Ice: how quickly your feet grip (a share of the way to where you're steering, a second); you slide. */
export const ICE = { grip: 1.6 };
/** Arrow traps (> and < in a wall): all fire together on a beat, straight along their row. */
export const ARROWS = { everyMs: 2000, speed: 7, damage: 1, flyMs: 5000 };
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
const ENEMY_LETTERS = { s: 'slime', m: 'bigslime', b: 'bat', k: 'skeleton', W: 'warden' };

/** Stars for a quest: finishing, few retries (one at most), and a good time. */
export function starsFor({ won, retries, ms, par }) {
  if (!won) return 0;
  return 1 + (retries <= 1 ? 1 : 0) + (ms <= par ? 1 : 0);
}

export class DungeonDuo {
  constructor(ctx, rng = Math.random, floors = FLOORS) {
    this.ctx = ctx;
    this.rng = rng;
    // A short quest: the first two floors and the Warden.
    this.floors = floors === FLOORS && settingOf(ctx, 'quest', 5) === 3 ? FLOORS.filter((f) => !f.long) : floors;
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
    this.events = { hits: 0, kills: 0, hurt: 0, blocked: 0, heals: 0, downs: 0, revives: 0, keys: 0, doors: 0, thrown: 0, slams: 0, charges: 0, summons: 0, arrows: 0, splits: 0, levers: 0 };
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
    this.leversPulled = false;
    this.arrowBeat = 0;
    this.floorAt = this.ctx.now(); // the spikes' (and arrows') rhythm starts here
    const starts = [];
    this.map.forEach((row, y) => row.forEach((c, x) => {
      if (c === 'S') starts.push([x + 0.5, y + 0.5]);
      if (ENEMY_LETTERS[c]) this.spawnEnemy(ENEMY_LETTERS[c], x + 0.5, y + 0.5);
      if (c === 'S' || ENEMY_LETTERS[c]) row[x] = ' ';
    }));
    this.bossFloor = this.enemies.some((e) => e.kind === 'warden');
    const roles = this.swap ? ['healer', 'fighter'] : ['fighter', 'healer'];
    this.heroes = roles.map((role, slot) => {
      const max = HEROES[role].hp[this.easy ? 1 : 0];
      return { role, x: starts[slot][0], y: starts[slot][1], vx: 0, vy: 0, face: [0, 1], hp: max, max, downed: false, revive: 0, invulnUntil: 0, blockUntil: 0, readyAt: 0, healAt: 0, blocking: false };
    });
  }

  spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const e = { id: this.nextId++, kind, x, y, hp: def.hp, max: def.hp, speed: def.speed, hurtUntil: 0, wobble: this.rng() * Math.PI * 2, throwAt: this.ctx.now() + (def.throwEveryMs || 0) / 2 };
    if (kind === 'warden') {
      const hp = WARDEN.hp[this.easy ? 1 : 0];
      Object.assign(e, { hp, max: hp, r: WARDEN.r, summoned: false, face: [0, 1], tele: null, detourUntil: 0, side: 1 });
      this.wardenMove(e, 'walk');
    }
    this.enemies.push(e);
    return e;
  }

  /** Into play: the Warden's first walk (and the spikes' rhythm) start now, not during the wait before. */
  play() {
    this.floorAt = this.ctx.now();
    this.arrowBeat = 0;
    for (const e of this.enemies) if (e.kind === 'warden') this.wardenMove(e, 'walk');
    this.enter('play', 0);
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
          this.play();
        } else if (this.phase === 'retry') {
          this.load();
          this.play();
        } else if (this.floor + 1 >= this.floors.length) {
          this.won = true;
          return this.finish();
        } else {
          this.floor++;
          this.load();
          this.play();
        }
      } else if (this.frame++ % TIMING.sendEvery === 0) this.ctx.update();
      return;
    }
    if (this.phase !== 'play') return;
    this.updateGate();
    this.levers();
    this.heroes.forEach((h, slot) => this.walkHero(h, this.controls[slot], dt));
    this.moveEnemies(dt, now);
    this.moveShots(dt, now);
    this.fireArrows(now);
    this.moveBones(dt, now);
    this.spikes();
    this.heal(now);
    this.touches(now);
    this.revives(dt);
    this.pickups();
    // The Warden beaten counts first: a killing blow wins even if the last of you falls with it.
    if (this.bossFloor && !this.enemies.some((e) => e.kind === 'warden')) return this.enter('floorClear', TIMING.floorClearMs);
    if (this.heroes.every((h) => h.downed)) return this.bothDown();
    if (this.onStairs()) return this.enter('floorClear', TIMING.floorClearMs);
    if (this.frame++ % TIMING.sendEvery === 0) this.ctx.update();
  }

  solid(x, y) {
    const row = this.map[Math.floor(y)];
    if (!row) return true;
    const c = row[Math.floor(x)];
    return c === '#' || c === 'D' || c === 'I' || c === '>' || c === '<' || (c === 'G' && !this.gateOpen) || c === undefined;
  }

  /** The tiles a body's corners are on. */
  corners(b) {
    const E = 1e-6;
    const r = b.r || R;
    return [[b.x - r, b.y - r], [b.x + r - E, b.y - r], [b.x - r, b.y + r - E], [b.x + r - E, b.y + r - E]].map(([x, y]) => (this.map[Math.floor(y)] || [])[Math.floor(x)]);
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

  /** The iron door (I) opens for good once you're both on the levers (l) at the same time. */
  levers() {
    if (this.leversPulled) return;
    const on = this.heroes.filter((h) => !h.downed && this.map[Math.floor(h.y)][Math.floor(h.x)] === 'l');
    if (on.length < 2 || (Math.floor(on[0].x) === Math.floor(on[1].x) && Math.floor(on[0].y) === Math.floor(on[1].y))) return;
    this.leversPulled = true;
    this.events.levers++;
    this.map.forEach((row) => row.forEach((c, x) => { if (c === 'I') row[x] = ' '; }));
    this.ctx.update();
  }

  /** Every arrow trap fires on the beat, out of the wall along its row. */
  fireArrows(now) {
    const beat = Math.floor((now - this.floorAt) / ARROWS.everyMs);
    if (beat <= this.arrowBeat) return;
    this.arrowBeat = beat;
    this.map.forEach((row, y) => row.forEach((c, x) => {
      if (c !== '>' && c !== '<') return;
      const dir = c === '>' ? 1 : -1;
      this.bones.push({ kind: 'arrow', x: x + 0.5 + dir * 0.6, y: y + 0.5, vx: dir * ARROWS.speed, vy: 0, damage: ARROWS.damage, until: now + ARROWS.flyMs });
      this.events.arrows++;
    }));
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

  blocked(x, y, r = R) {
    const E = 1e-6;
    return this.solid(x - r, y - r) || this.solid(x + r - E, y - r) || this.solid(x - r, y + r - E) || this.solid(x + r - E, y + r - E);
  }

  /** Move a body one axis at a time, stopping flush against walls. Gives the tile it bumped into, if any. */
  slide(b, vx, vy) {
    const E = 1e-6;
    const r = b.r || R;
    let bump = null;
    const nx = b.x + vx;
    if (!this.blocked(nx, b.y, r)) b.x = nx;
    else if (vx) {
      bump = [Math.floor(vx > 0 ? nx + r : nx - r), Math.floor(b.y)];
      b.x = vx > 0 ? Math.max(b.x, Math.floor(nx + r) - r) : Math.min(b.x, Math.floor(nx - r) + 1 + r + E);
    }
    const ny = b.y + vy;
    if (!this.blocked(b.x, ny, r)) b.y = ny;
    else if (vy) {
      bump = bump || [Math.floor(b.x), Math.floor(vy > 0 ? ny + r : ny - r)];
      b.y = vy > 0 ? Math.max(b.y, Math.floor(ny + r) - r) : Math.min(b.y, Math.floor(ny - r) + 1 + r + E);
    }
    return bump;
  }

  walkHero(h, ctl, dt) {
    h.blocking = h.role === 'fighter' && ctl.special && !h.downed;
    if (h.downed) {
      h.vx = h.vy = 0;
      return;
    }
    const len = Math.hypot(ctl.x, ctl.y);
    if (len > 0.2) h.face = [ctl.x / len, ctl.y / len];
    const def = HEROES[h.role];
    const speed = h.blocking ? def.blockSpeed : def.speed;
    // On ice your feet barely grip: you get going slowly and keep sliding once you let go.
    if (this.map[Math.floor(h.y)][Math.floor(h.x)] === '~') {
      const k = Math.min(1, (ICE.grip * dt) / 1000);
      h.vx += (ctl.x * speed - h.vx) * k;
      h.vy += (ctl.y * speed - h.vy) * k;
    } else {
      h.vx = ctl.x * speed;
      h.vy = ctl.y * speed;
    }
    if (!h.vx && !h.vy) return;
    const [sx, sy] = [h.x, h.y];
    const [dx, dy] = [(h.vx * dt) / 1000, (h.vy * dt) / 1000];
    const bump = this.slide(h, dx, dy);
    // (stopped by a wall: that way's speed is gone)
    if (Math.abs(h.x - sx - dx) > 1e-6) h.vx = 0;
    if (Math.abs(h.y - sy - dy) > 1e-6) h.vy = 0;
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
      if (e.kind === 'warden') {
        this.wardenThink(e, dt, now);
        continue;
      }
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
      const hit = this.enemies.find((e) => Math.hypot(e.x - s.x, e.y - s.y) < 0.45 + (e.r || R) - R);
      if (hit) {
        this.damageEnemy(hit, s.damage, now);
        continue;
      }
      keep.push(s);
    }
    this.shots = keep;
  }

  /**
   * Start one of the Warden's moves: 'walk' (at you), 'slam' or 'charge' (the warning first),
   * 'rush' (the charge itself), 'stunned' or 'rest'. `ms` overrides how long it lasts.
   */
  wardenMove(e, state, ms) {
    const now = this.ctx.now();
    const lasts = { walk: WARDEN.walkMs, slam: WARDEN.slamWindupMs, charge: WARDEN.chargeWindupMs, rush: WARDEN.chargeMs, stunned: WARDEN.stunMs, rest: WARDEN.restMs };
    e.state = state;
    e.since = now;
    e.until = now + (ms === undefined ? lasts[state] : ms);
    e.tele = null;
    if (state === 'slam') e.tele = { kind: 'slam', r: WARDEN.slamR };
    if (state === 'charge') {
      // Lock on to the nearest hero; it won't turn once it's lined up.
      const h = this.nearestHero(e.x, e.y, 99) || this.heroes[0];
      const len = Math.hypot(h.x - e.x, h.y - e.y) || 1;
      e.face = [(h.x - e.x) / len, (h.y - e.y) / len];
      e.tele = { kind: 'charge', dx: e.face[0], dy: e.face[1], len: this.laneLength(e, e.face[0], e.face[1]) + e.r };
    }
    if (state === 'rush') e.hitSlots = [];
  }

  /** How far the Warden could rush from where it stands, along (dx, dy), before hitting a wall. */
  laneLength(e, dx, dy) {
    let reach = 0;
    while (reach < 20 && !this.blocked(e.x + dx * (reach + 0.25), e.y + dy * (reach + 0.25), e.r)) reach += 0.25;
    return reach;
  }

  wardenThink(e, dt, now) {
    const done = now >= e.until;
    if (e.state === 'walk') {
      const h = this.nearestHero(e.x, e.y, 99);
      const len = h ? Math.hypot(h.x - e.x, h.y - e.y) || 1 : 0;
      if (h && done) {
        if (len <= WARDEN.slamRange) return this.wardenMove(e, 'slam');
        // Charge only down a clear lane; with a pillar in the way, keep walking (round it).
        if (this.canSee(e.x, e.y, h.x, h.y) && this.laneLength(e, (h.x - e.x) / len, (h.y - e.y) / len) >= len - e.r - R) return this.wardenMove(e, 'charge');
        return this.wardenMove(e, 'walk', 600);
      }
      if (!h || !e.speed) return;
      e.face = [(h.x - e.x) / len, (h.y - e.y) / len];
      if (len < e.r + R - 0.1) return; // close enough to touch you
      const d = (e.speed * dt) / 1000;
      // Going round something: sideways for a while.
      const dir = now < e.detourUntil ? [-e.face[1] * e.side, e.face[0] * e.side] : e.face;
      const was = [e.x, e.y];
      const bump = this.slide(e, dir[0] * d, dir[1] * d);
      const moved = Math.hypot(e.x - was[0], e.y - was[1]);
      if (bump && now >= e.detourUntil) {
        // Head straight at you but bumped into something: step round it, on whichever side is open.
        const open = (side) => !this.blocked(e.x - e.face[1] * side * 0.5, e.y + e.face[0] * side * 0.5, e.r);
        e.side = open(e.side || 1) ? e.side || 1 : -(e.side || 1);
        e.detourUntil = now + WARDEN.detourMs;
      } else if (bump && moved < d * 0.3) {
        e.side = -e.side; // can't get by that way either: try the other
      }
    } else if (e.state === 'slam') {
      if (!done) return;
      // It lands: everyone in the ring is hurt (there's no blocking the ground shaking).
      this.events.slams++;
      this.heroes.forEach((h, slot) => {
        if (!h.downed && Math.hypot(h.x - e.x, h.y - e.y) <= WARDEN.slamR) this.hurt(slot, WARDEN.slamDamage, null);
      });
      this.wardenMove(e, 'rest');
    } else if (e.state === 'charge') {
      if (!done) return;
      this.events.charges++;
      this.wardenMove(e, 'rush');
    } else if (e.state === 'rush') {
      if (done) return this.wardenMove(e, 'rest');
      const d = (WARDEN.chargeSpeed * dt) / 1000;
      if (this.slide(e, e.face[0] * d, e.face[1] * d)) return this.wardenMove(e, 'stunned'); // into a wall
      for (let slot = 0; slot < 2; slot++) {
        const h = this.heroes[slot];
        if (h.downed || e.hitSlots.includes(slot) || Math.hypot(h.x - e.x, h.y - e.y) >= TOUCH + e.r - R) continue;
        e.hitSlots.push(slot);
        if (this.hurt(slot, WARDEN.chargeDamage, [e.x, e.y]) === 'blocked') return this.wardenMove(e, 'stunned'); // into a shield
      }
    } else if (done) {
      this.wardenMove(e, 'walk'); // after a rest or a stun
    }
  }

  /** At half health, the Warden calls up help around it (once). */
  wardenSummon(e) {
    e.summoned = true;
    this.events.summons++;
    // Around it, on open floor, and never right on top of one of you.
    let n = 0;
    for (let i = 0; i < 16 && n < WARDEN.summon.length; i++) {
      const a = ((i % 8) / 8) * Math.PI * 2;
      const dist = i < 8 ? 1.8 : 2.6;
      const x = e.x + Math.cos(a) * dist;
      const y = e.y + Math.sin(a) * dist;
      if (this.blocked(x, y) || this.heroes.some((h) => Math.hypot(h.x - x, h.y - y) < 1.3)) continue;
      this.spawnEnemy(WARDEN.summon[n++], x, y);
    }
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
    if (e.kind === 'warden' && !e.summoned && e.hp > 0 && e.hp <= e.max / 2) this.wardenSummon(e);
    if (e.hp > 0) return;
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.events.kills++;
    if (e.kind === 'bigslime') {
      // It splits in two, either side of where it was (on open floor).
      this.events.splits++;
      const spots = [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45], [0, 0]].map(([dx, dy]) => [e.x + dx, e.y + dy]).filter(([x, y]) => !this.blocked(x, y));
      for (const [x, y] of [spots[0], spots[1] || spots[0]]) this.spawnEnemy('slime', x, y);
    }
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
        if (h.downed || Math.hypot(h.x - e.x, h.y - e.y) >= TOUCH + (e.r || R) - R) return;
        if (e.kind === 'warden' && (e.state === 'stunned' || e.state === 'rush')) return; // the rush hurts on its own; stunned, it's harmless
        if (this.hurt(slot, ENEMIES[e.kind].damage, [e.x, e.y]) !== 'blocked' || e.kind === 'warden') return; // too heavy to shove
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
    if (h.downed) return;
    // The shield first: it holds even in the moment after a hit (and stops a charge then too).
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
    if (now < h.invulnUntil) return;
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
        if (d > def.reach + (e.r || R) - R || (d > 0.01 && (dx * h.face[0] + dy * h.face[1]) / d < def.arc)) continue;
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
      floorTip: this.floors[this.floor].tip || null,
      map: this.map.map((row) => row.join('')),
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - now) / 1000) : 0,
      heroes: this.heroes.map((h) => ({
        role: h.role, x: r2(h.x), y: r2(h.y), vx: r2(h.vx), vy: r2(h.vy), face: [r2(h.face[0]), r2(h.face[1])], hp: h.hp, max: h.max, downed: h.downed,
        revive: h.downed ? r2(h.revive / TIMING.reviveMs) : 0, hurt: now < h.invulnUntil, blocking: h.blocking,
        swing: h.swungAt && now - h.swungAt < 200, readyIn: Math.max(0, h.readyAt - now), healIn: h.role === 'healer' ? Math.max(0, h.healAt - now) : 0,
      })),
      enemies: this.enemies.map((e) => {
        const o = { id: e.id, kind: e.kind, x: r2(e.x), y: r2(e.y), hp: e.hp, max: e.max, hurt: now < e.hurtUntil };
        if (e.kind !== 'warden') return o;
        // The boss: what it's doing, and the warning for the move it's about to make.
        const left = r2(Math.max(0, (e.until - now) / Math.max(1, e.until - e.since)));
        return Object.assign(o, { r: e.r, state: e.state, face: [r2(e.face[0]), r2(e.face[1])], tele: e.tele && Object.assign({ left }, e.tele, e.tele.dx === undefined ? {} : { dx: r2(e.tele.dx), dy: r2(e.tele.dy), len: r2(e.tele.len) }) });
      }),
      shots: this.shots.map((s) => ({ x: r2(s.x), y: r2(s.y) })),
      bones: this.bones.map((b) => (b.kind ? { kind: b.kind, x: r2(b.x), y: r2(b.y), vx: r2(b.vx) } : { x: r2(b.x), y: r2(b.y) })),
      leversPulled: this.leversPulled,
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
