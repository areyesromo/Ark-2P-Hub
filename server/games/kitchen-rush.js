// Kitchen Rush. Co-op cooking: two chefs in one kitchen (seen from above on the TV) serve the
// orders before they run out. Walk with the stick or your phone's pad; ACTION picks up, puts
// down and serves whatever you're facing; hold CHOP at a chopping board. Tomatoes and lettuce
// need chopping, meat cooks on a stove (and burns if you leave it), buns are ready as they are.
// Put them on a plate and hand it in at the hatch. A dish served earns coins (and a tip for
// speed); an order that runs out costs some. Stars at the end by the coins earned, against
// targets set by how many orders the shift brings (see starTargets).
//
// The kitchen is a grid of tiles (KITCHENS): ' ' floor, '#' worktop (holds one thing),
// B / M / T / L crates of buns, meat, tomatoes and lettuce, C chopping board, S stove,
// P plates, X bin, H the serving hatch. In Split the two of you work separate halves and pass
// things over the counter between them.

import { settingOf } from './options.js';

export const SIZE = { w: 14, h: 8 };
export const KITCHENS = [
  {
    name: 'Diner',
    layout: [
      '#BMTLP#CC#SS##',
      '#            H',
      '#            #',
      '#    ####    #',
      '#    ####    X',
      '#            #',
      '#            #',
      '##############',
    ],
    spawn: [[3.5, 5.5], [10.5, 5.5]],
  },
  {
    name: 'Split',
    // Buns, meat and stoves on the left; vegetables, boards, plates and the hatch on the right.
    layout: [
      '#BM#SS#CC#TLP#',
      '#     #      H',
      '#     #      #',
      '#     #      #',
      '#     #      X',
      '#     #      #',
      'X     #      #',
      '##############',
    ],
    spawn: [[3.5, 3.5], [9.5, 3.5]],
  },
];
// Rush Hour: the split kitchen, with orders coming faster and running out sooner.
KITCHENS.push({ ...KITCHENS[1], name: 'Rush Hour' });

/** What each order needs on the plate. */
export const RECIPES = {
  plain: ['bun', 'meat'],
  lettuce: ['bun', 'meat', 'lettuce'],
  works: ['bun', 'meat', 'lettuce', 'tomato'],
  salad: ['lettuce', 'tomato'],
};
const CRATES = { B: 'bun', M: 'meat', T: 'tomato', L: 'lettuce' };

export const TIMING = {
  tickMs: 1000 / 30,
  countdownMs: 3000,
  chopMs: 2000,
  cookMs: 5000,
  burnMs: 8000, // after it's cooked
  orderMs: [60000, 60000, 45000], // how long an order waits (by kitchen)
  orderEveryMs: [20000, 20000, 13000], // a new order this often
};
export const COINS = { dish: 20, tip: 10, missed: 10 };
export const MAX_ORDERS = 4;
const SPEED = 4; // tiles a second
const HALF = 0.3; // half a chef's width
const REACH = 0.8; // how far in front of you counts as what you're facing

/** How many orders a shift brings: two to start, then one every orderEveryMs. */
export function ordersIn(k, minutes) {
  return 2 + Math.floor((minutes * 60000) / TIMING.orderEveryMs[k]);
}

/**
 * The coins for one, two and three stars: 40%, 65% and 90% of what every order would pay
 * without tips (tips make three stars easier, not possible), to the nearest 5.
 */
export function starTargets(k, minutes) {
  const all = ordersIn(k, minutes) * COINS.dish;
  return [0.4, 0.65, 0.9].map((f) => Math.round((all * f) / 5) * 5);
}

/** Stars for `coins` against the shift's targets. */
export function starsFor(coins, targets) {
  return targets.filter((t) => coins >= t).length;
}

/** Is this ingredient ready for the plate? */
function ready(item) {
  if (item.kind === 'bun') return true;
  if (item.kind === 'meat') return item.state === 'cooked';
  return item.kind !== 'plate' && item.state === 'chopped';
}

/**
 * Something picked up off a station: what it is, and for meat how long it has cooked (it goes
 * on from there if you put it back on a stove: no dodging the burn).
 */
function carried(item) {
  if (item.kind === 'plate') return { kind: 'plate', contents: item.contents.slice() };
  const out = { kind: item.kind, state: item.state };
  if (item.kind === 'meat' && item.cook) out.cook = item.cook;
  return out;
}

export class KitchenRush {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.k = settingOf(ctx, 'kitchen', 0);
    this.minutes = settingOf(ctx, 'minutes', 3);
    this.kitchen = KITCHENS[this.k] || KITCHENS[0];
    this.layout = this.kitchen.layout;
    this.targets = starTargets(this.k, this.minutes);
    this.timer = null;
    // Held controls carry over (phones and controllers only send changes).
    this.controls = [{ x: 0, y: 0, chop: false }, { x: 0, y: 0, chop: false }];
  }

  start() {
    // A fresh shift: nobody still walking or chopping from the last one.
    this.controls = [{ x: 0, y: 0, chop: false }, { x: 0, y: 0, chop: false }];
    this.chefs = this.kitchen.spawn.map(([x, y]) => ({ x, y, face: [0, -1], held: null, chopping: false }));
    this.items = {}; // 'x,y' -> what's on that station
    this.orders = [];
    this.nextId = 1;
    this.coins = 0;
    this.served = 0;
    this.missed = 0;
    this.events = { served: 0, missed: 0, picked: 0, chopped: 0, cooked: 0, burnt: 0, binned: 0 };
    this.phase = 'countdown';
    this.phaseEnds = this.ctx.now() + TIMING.countdownMs;
    this.loop();
    this.ctx.update();
  }

  key([x, y]) {
    return x + ',' + y;
  }

  tile(x, y) {
    return (this.layout[y] || '')[x];
  }

  solid(x, y) {
    return this.tile(Math.floor(x), Math.floor(y)) !== ' ';
  }

  loop() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.last = this.ctx.now();
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
    if (this.phase === 'countdown') {
      if (now >= this.phaseEnds) {
        this.phase = 'play';
        this.phaseEnds = now + this.minutes * 60000;
        this.nextOrderAt = now + TIMING.orderEveryMs[this.k];
        this.addOrder(now);
        this.addOrder(now);
      }
      return this.ctx.update();
    }
    if (this.phase !== 'play') return;
    this.chefs.forEach((c, slot) => this.walk(c, this.controls[slot], dt));
    this.chopped = new Set(); // one chef's worth of chopping per board per tick
    this.chefs.forEach((c, slot) => this.chop(c, this.controls[slot], dt));
    this.cook(dt);
    // Orders: the ones that ran out go (and cost), new ones come in.
    for (const o of this.orders.slice()) {
      if (now < o.until) continue;
      this.orders.splice(this.orders.indexOf(o), 1);
      this.missed++;
      this.events.missed++;
      this.coins = Math.max(0, this.coins - COINS.missed);
    }
    if (now >= this.nextOrderAt) {
      this.nextOrderAt = now + TIMING.orderEveryMs[this.k];
      if (this.orders.length < MAX_ORDERS) this.addOrder(now);
    }
    if (now >= this.phaseEnds) return this.finish();
    this.ctx.update();
  }

  addOrder(now) {
    const names = Object.keys(RECIPES);
    const recipe = names[Math.floor(this.rng() * names.length)];
    this.orders.push({ id: this.nextId++, recipe, born: now, until: now + TIMING.orderMs[this.k] });
  }

  /** Move a chef, sliding along counters (one axis at a time). */
  walk(c, ctl, dt) {
    if (!ctl.x && !ctl.y) return;
    this.turn(c, ctl);
    const d = (SPEED * dt) / 1000;
    const EPS = 1e-6;
    const blocked = (x, y) => this.solid(x - HALF, y - HALF) || this.solid(x + HALF - EPS, y - HALF) || this.solid(x - HALF, y + HALF - EPS) || this.solid(x + HALF - EPS, y + HALF - EPS);
    // One axis at a time; into a counter, stop flush against it.
    const nx = c.x + ctl.x * d;
    if (!blocked(nx, c.y)) c.x = nx;
    else if (ctl.x > 0) c.x = Math.max(c.x, Math.floor(nx + HALF) - HALF);
    else if (ctl.x < 0) c.x = Math.min(c.x, Math.floor(nx - HALF) + 1 + HALF + EPS);
    const ny = c.y + ctl.y * d;
    if (!blocked(c.x, ny)) c.y = ny;
    else if (ctl.y > 0) c.y = Math.max(c.y, Math.floor(ny + HALF) - HALF);
    else if (ctl.y < 0) c.y = Math.min(c.y, Math.floor(ny - HALF) + 1 + HALF + EPS);
  }

  /** Face the way the stick points (the stronger direction), if it points anywhere. */
  turn(c, ctl) {
    if (Math.abs(ctl.x) > 0.2 || Math.abs(ctl.y) > 0.2) c.face = Math.abs(ctl.x) >= Math.abs(ctl.y) ? [Math.sign(ctl.x), 0] : [0, Math.sign(ctl.y)];
  }

  /** The tile a chef is facing: [x, y]. */
  facing(c) {
    return [Math.floor(c.x + c.face[0] * REACH), Math.floor(c.y + c.face[1] * REACH)];
  }

  /** Hold CHOP, hands free, at a board with a raw tomato or lettuce: it gets chopped. */
  chop(c, ctl, dt) {
    c.chopping = false;
    if (!ctl.chop || c.held) return;
    const at = this.facing(c);
    const item = this.items[this.key(at)];
    if (this.tile(...at) !== 'C' || !item || item.state !== 'raw') return;
    c.chopping = true;
    if (this.chopped.has(item)) return; // the other chef is already at it
    this.chopped.add(item);
    item.progress = (item.progress || 0) + dt / TIMING.chopMs;
    if (item.progress >= 1) {
      item.state = 'chopped';
      delete item.progress;
      this.events.chopped++;
    }
  }

  /** Meat on the stoves cooks by itself, then burns. */
  cook(dt) {
    for (const [k, item] of Object.entries(this.items)) {
      const [x, y] = k.split(',').map(Number);
      if (this.tile(x, y) !== 'S' || item.kind !== 'meat' || item.state === 'burnt') continue;
      item.cook = (item.cook || 0) + dt;
      if (item.state === 'raw' && item.cook >= TIMING.cookMs) {
        item.state = 'cooked';
        this.events.cooked++;
      } else if (item.state === 'cooked' && item.cook >= TIMING.cookMs + TIMING.burnMs) {
        item.state = 'burnt';
        this.events.burnt++;
      }
    }
  }

  /** ACTION: pick up, put down, plate up or serve, by what you're facing and holding. */
  act(slot) {
    const c = this.chefs[slot];
    this.turn(c, this.controls[slot]); // the newest stick direction, even if no tick has walked it yet
    const at = this.facing(c);
    const ch = this.tile(...at);
    const k = this.key(at);
    const item = this.items[k];
    const h = c.held;
    if (CRATES[ch]) {
      if (!h) c.held = { kind: CRATES[ch], state: 'raw' };
      else if (h.kind === 'plate' && ch === 'B' && !h.contents.includes('bun')) h.contents.push('bun');
      else return;
      this.events.picked++;
    } else if (ch === 'P') {
      if (h) return;
      c.held = { kind: 'plate', contents: [] };
      this.events.picked++;
    } else if (ch === 'X') {
      if (!h) return;
      if (h.kind === 'plate') h.contents = [];
      else c.held = null;
      this.events.binned++;
    } else if (ch === 'H') {
      if (!h || h.kind !== 'plate' || !h.contents.length) return;
      this.serve(c);
    } else if (ch === '#' || ch === 'C' || ch === 'S') {
      if (h && !item) {
        // Put it down: boards take raw vegetables, stoves take meat, worktops anything.
        if (ch === 'C' && !((h.kind === 'tomato' || h.kind === 'lettuce') && h.state === 'raw')) return;
        if (ch === 'S' && h.kind !== 'meat') return;
        const put = h.kind === 'plate' ? { kind: 'plate', contents: h.contents.slice() } : { ...h };
        if (ch === 'S' && put.state === 'cooked' && !put.cook) put.cook = TIMING.cookMs; // cooked already: it can still burn
        this.items[k] = put;
        c.held = null;
      } else if (!h && item) {
        c.held = carried(item);
        delete this.items[k];
      } else if (h && item && h.kind === 'plate' && item.kind !== 'plate') {
        if (!ready(item) || h.contents.includes(item.kind)) return;
        h.contents.push(item.kind); // off the station, onto your plate
        delete this.items[k];
      } else if (h && item && item.kind === 'plate' && h.kind !== 'plate') {
        if (!ready(h) || item.contents.includes(h.kind)) return;
        item.contents.push(h.kind); // onto the plate on the counter
        c.held = null;
      } else return;
    } else return;
    this.ctx.update();
  }

  /** The plate at the hatch: the order it matches (the one closest to running out) is served. */
  serve(c) {
    const now = this.ctx.now();
    const dish = c.held.contents.slice().sort().join();
    const fits = this.orders.filter((o) => RECIPES[o.recipe].slice().sort().join() === dish).sort((a, b) => a.until - b.until);
    if (!fits.length) return; // nobody ordered that
    const o = fits[0];
    this.orders.splice(this.orders.indexOf(o), 1);
    const left = Math.max(0, o.until - now) / (o.until - o.born);
    this.coins += COINS.dish + Math.round(COINS.tip * left);
    this.served++;
    this.events.served++;
    c.held = null;
  }

  finish() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    const ctl = this.controls[slot];
    if (input.type === 'move') {
      let x = Number(input.x);
      let y = Number(input.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      ctl.x = x;
      ctl.y = y;
      if (typeof input.chop === 'boolean') ctl.chop = input.chop; // a controller sends both at once
      return;
    }
    if (input.type === 'chop' && typeof input.on === 'boolean') {
      ctl.chop = input.on;
      return;
    }
    if (input.type === 'act' && this.phase === 'play') this.act(slot);
  }

  timeLeftMs() {
    return this.phase === 'over' ? 0 : Math.max(0, this.phaseEnds - this.ctx.now());
  }

  view() {
    const now = this.ctx.now();
    const r2 = (n) => Math.round(n * 100) / 100;
    return {
      phase: this.phase,
      kitchen: this.kitchen.name,
      layout: this.layout,
      minutes: this.minutes,
      countdown: this.phase === 'countdown' ? Math.ceil(this.timeLeftMs() / 1000) : 0,
      timeLeftMs: this.timeLeftMs(),
      chefs: this.chefs.map((c) => ({ x: r2(c.x), y: r2(c.y), face: c.face, held: c.held, chopping: Boolean(c.chopping), at: this.facing(c) })),
      items: Object.entries(this.items).map(([k, item]) => {
        const [x, y] = k.split(',').map(Number);
        const out = { x, y, ...carried(item) };
        if (item.progress) out.progress = r2(item.progress);
        if (item.cook !== undefined) out.cook = r2(Math.min(1, item.cook / TIMING.cookMs)); // 1: cooked
        if (item.kind === 'meat' && item.state === 'cooked' && item.cook) out.burn = r2(Math.min(1, (item.cook - TIMING.cookMs) / TIMING.burnMs));
        return out;
      }),
      orders: this.orders.map((o) => ({ id: o.id, recipe: o.recipe, needs: RECIPES[o.recipe], left: r2(Math.max(0, o.until - now) / (o.until - o.born)) })),
      coins: this.coins,
      served: this.served,
      missed: this.missed,
      events: this.events,
      // For the room's history (a co-op game: the team's stars).
      stars: starsFor(this.coins, this.targets),
      maxStars: 3,
      targets: this.targets,
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
  id: 'kitchen-rush',
  name: 'Kitchen Rush',
  category: 'casual',
  music: 'casual',
  tagline: 'Co-op cooking: chop, cook, plate up and serve the orders before they run out. Three kitchens, one of them split down the middle.',
  create: (ctx) => new KitchenRush(ctx),
};
