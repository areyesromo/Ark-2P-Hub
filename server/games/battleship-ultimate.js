// Ultimate Battleship: Battleship's Ultimate mode (see battleship.js for the classic game).
//
// Each of you picks a commander, and each commander brings their own fleet, some of it in
// angled shapes (an L, a T, a Z, a 2×2 block) that turn four ways. The sea is picked in setup:
// open water, or one with islands, rocks and shallows, or ice. You place your fleet in secret
// on your phone, then take turns.
//
// On your turn you fire one shot, or use a skill. Every ship carries a skill (an air strike, a
// barrage, sonar, a torpedo, a double shot, a shield) paid for with ⚡ energy: you get 1 at the
// start of each turn and 1 for every hit you land. Lose a ship and its skill is gone. Your
// commander also has a special that charges only as you land hits. Sink every ship to win.

/** The seas: '.' water, '#' land or rock (nothing goes there), '~' shallows (small ships only), '*' ice (no ships; it stops torpedoes). */
export const SEAS = {
  open: {
    name: 'Open Sea',
    rows: Array(10).fill('..........'),
  },
  archipelago: {
    name: 'Archipelago',
    rows: [
      '............',
      '..##........',
      '..##....#...',
      '.......###..',
      '........#...',
      '............',
      '....#.......',
      '...###...##.',
      '....#....##.',
      '............',
      '.##.........',
      '............',
    ],
  },
  reef: {
    name: 'Reef',
    rows: [
      '..........',
      '.~~...#...',
      '.~~.......',
      '.....~~~..',
      '..#..~~~..',
      '..........',
      '...~~...#.',
      '.#.~~.....',
      '.......~~.',
      '..........',
    ],
  },
  strait: {
    name: 'Frozen Strait',
    rows: [
      '............',
      '.**.........',
      '.**......*..',
      '.........*..',
      '....**......',
      '....**......',
      '..........*.',
      '..*.......*.',
      '..*.........',
      '............',
    ],
  },
};
export const SEA_IDS = Object.keys(SEAS);

/** Shapes as cells (x, y) at their first turn. */
const SHAPES = {
  I1: [[0, 0]],
  I2: [[0, 0], [1, 0]],
  I3: [[0, 0], [1, 0], [2, 0]],
  I4: [[0, 0], [1, 0], [2, 0], [3, 0]],
  I5: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  O4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  L4: [[0, 0], [0, 1], [0, 2], [1, 2]],
  L5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3]],
  T5: [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
  Z5: [[0, 0], [1, 0], [1, 1], [1, 2], [2, 2]],
};

/** The skills a ship can carry: what it costs in energy, and what it does. */
export const SKILLS = {
  airstrike: { name: 'Air Strike', icon: '✈️', cost: 3, aim: 'line3', about: 'hits 3 cells in a line' },
  barrage: { name: 'Barrage', icon: '💥', cost: 4, aim: 'plus', about: 'hits a plus of 5 cells' },
  sonar: { name: 'Sonar', icon: '📡', cost: 2, aim: 'box3', about: 'counts the ship cells in a 3×3 (submarines don\'t show)' },
  torpedo: { name: 'Torpedo', icon: '🌊', cost: 4, aim: 'row', about: 'runs along a row until it hits a ship (the water it crosses shows as misses)' },
  double: { name: 'Double Shot', icon: '🎯', cost: 2, aim: 'two', about: 'two shots this turn' },
  shield: { name: 'Shield', icon: '🛡️', cost: 3, aim: 'own2', about: 'protects a 2×2 of your own sea: the next hit on each of its ships is stopped' },
};

/** The commanders: a fleet each (with their skills), and a special charged by hits. */
export const COMMANDERS = {
  vega: {
    name: 'Admiral Vega', icon: '⚓', style: 'The all-rounder',
    special: { name: 'Lock-on', about: 'hits a whole line of 5', aim: 'line5', charge: 5 },
    fleet: [
      { name: 'Carrier', shape: 'I5', skill: 'airstrike' },
      { name: 'Battleship', shape: 'I4', skill: 'barrage' },
      { name: 'Cruiser', shape: 'I3', skill: 'sonar' },
      { name: 'Submarine', shape: 'I3', skill: 'torpedo', stealth: true },
      { name: 'Destroyer', shape: 'I2', skill: 'double' },
      { name: 'Patrol Boat', shape: 'I1' },
    ],
  },
  mako: {
    name: 'Captain Mako', icon: '🦈', style: 'The hunter',
    special: { name: 'Wolf Pack', about: 'three torpedoes down three rows', aim: 'rows3', charge: 6 },
    fleet: [
      { name: 'Stalker', shape: 'L4', skill: 'torpedo', stealth: true },
      { name: 'Submarine', shape: 'I3', skill: 'torpedo', stealth: true },
      { name: 'Hunter', shape: 'I3', skill: 'sonar' },
      { name: 'Raider', shape: 'I3', skill: 'airstrike' },
      { name: 'Destroyer', shape: 'I2', skill: 'double' },
      { name: 'Scout', shape: 'I2', skill: 'sonar' },
    ],
  },
  frost: {
    name: 'Commodore Frost', icon: '🧊', style: 'The fortress',
    special: { name: 'Deep Freeze', about: 'your rival misses their next turn', aim: 'none', charge: 5 },
    fleet: [
      { name: 'Ice Citadel', shape: 'T5', skill: 'barrage' },
      { name: 'Bastion', shape: 'O4', skill: 'shield' },
      { name: 'Cruiser', shape: 'I3', skill: 'sonar' },
      { name: 'Icebreaker', shape: 'I3', skill: 'airstrike' },
      { name: 'Destroyer', shape: 'I2', skill: 'double' },
      { name: 'Patrol Boat', shape: 'I1' },
    ],
  },
  nova: {
    name: 'Engineer Nova', icon: '🛰️', style: 'The scout',
    special: { name: 'Full Scan', about: 'shows every ship cell in a 5×5', aim: 'box5', charge: 4 },
    fleet: [
      { name: 'Relay', shape: 'L5', skill: 'sonar' },
      { name: 'Drone Carrier', shape: 'I4', skill: 'airstrike' },
      { name: 'Radar Ship', shape: 'I3', skill: 'sonar' },
      { name: 'Frigate', shape: 'I3', skill: 'shield' },
      { name: 'Sub', shape: 'I2', skill: 'torpedo', stealth: true },
      { name: 'Patrol Boat', shape: 'I1' },
    ],
  },
  ash: {
    name: 'Raider Ash', icon: '🔥', style: 'The gambler',
    special: { name: 'Broadside', about: 'hits a 3×3 anywhere', aim: 'box3', charge: 6 },
    fleet: [
      { name: 'Ironclad', shape: 'Z5', skill: 'barrage' },
      { name: 'Battleship', shape: 'I4', skill: 'barrage' },
      { name: 'Raider', shape: 'I3', skill: 'airstrike' },
      { name: 'Gunboat', shape: 'I2', skill: 'double' },
      { name: 'Gunboat', shape: 'I2', skill: 'double' },
      { name: 'Fireship', shape: 'I1' },
    ],
  },
};
export const COMMANDER_IDS = Object.keys(COMMANDERS);

export const ENERGY = { perTurn: 1, perHit: 1, max: 10 };
export const UTIMING = { pickMs: 60000, placeMs: 120000, turnMs: 30000, shotMs: 1800 };

const EMPTY = 0;
const MISS = 1;
const HIT = 2;

/** A shape's cells at turn `rot` (0-3, a quarter turn each), shifted so the top-left is (0, 0). */
export function shapeCells(shape, rot) {
  let cells = SHAPES[shape].map(([x, y]) => [x, y]);
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) cells = cells.map(([x, y]) => [-y, x]);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

/** The cells of a placed ship ({ x, y, rot }) of a fleet entry. */
export function placedCells(entry, ship) {
  return shapeCells(entry.shape, ship.rot).map(([x, y]) => [ship.x + x, ship.y + y]);
}

/** The terrain at (x, y) on a sea, or null off the edge. */
export function terrain(sea, x, y) {
  const row = SEAS[sea].rows[y];
  return row && x >= 0 && x < row.length ? row[x] : null;
}

export function seaSize(sea) {
  return { w: SEAS[sea].rows[0].length, h: SEAS[sea].rows.length };
}

/** A fleet ({ x, y, rot } per ship of the commander) sits on the sea: on water, not overlapping; shallows take ships of up to 3 cells. */
export function validFleet(sea, commander, ships) {
  const fleet = COMMANDERS[commander].fleet;
  if (!Array.isArray(ships) || ships.length !== fleet.length) return false;
  const taken = new Set();
  return ships.every((s, i) => {
    if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y) || !Number.isInteger(s.rot) || s.rot < 0 || s.rot > 3) return false;
    const cells = placedCells(fleet[i], s);
    return cells.every(([x, y]) => {
      const t = terrain(sea, x, y);
      const k = x + ',' + y;
      if (t === null || t === '#' || t === '*' || taken.has(k)) return false;
      if (t === '~' && cells.length > 3) return false;
      taken.add(k);
      return true;
    });
  });
}

export function randomFleet(sea, commander, rng = Math.random) {
  const fleet = COMMANDERS[commander].fleet;
  const { w, h } = seaSize(sea);
  for (let attempt = 0; attempt < 50; attempt++) {
    const ships = [];
    for (let tries = 0; ships.length < fleet.length && tries < 500; tries++) {
      const s = { x: Math.floor(rng() * w), y: Math.floor(rng() * h), rot: Math.floor(rng() * 4) };
      if (fitsSoFar(sea, commander, [...ships, s])) ships.push(s);
    }
    if (ships.length === fleet.length) return ships;
  }
  // A dice that won't roll (or bad luck): each ship in the first spot it fits, scanning the sea.
  const ships = [];
  for (let i = 0; i < fleet.length; i++) {
    let placed = null;
    for (let y = 0; y < h && !placed; y++) for (let x = 0; x < w && !placed; x++) for (let rot = 0; rot < 4 && !placed; rot++) {
      if (fitsSoFar(sea, commander, [...ships, { x, y, rot }])) placed = { x, y, rot };
    }
    ships.push(placed);
  }
  return ships;
}

/** The first ships.length ships of a commander's fleet fit (for placing them one at a time). */
function fitsSoFar(sea, commander, ships) {
  const fleet = COMMANDERS[commander].fleet.slice(0, ships.length);
  const taken = new Set();
  return ships.every((s, i) => {
    const cells = placedCells(fleet[i], s);
    return cells.every(([x, y]) => {
      const t = terrain(sea, x, y);
      const k = x + ',' + y;
      if (t === null || t === '#' || t === '*' || taken.has(k) || (t === '~' && cells.length > 3)) return false;
      taken.add(k);
      return true;
    });
  });
}

/** The cells a skill or special covers, aimed at (x, y) facing `dir` ('h' or 'v'); `x2, y2` for a second shot. */
export function footprint(aim, a, size) {
  const { x, y } = a;
  const out = [];
  if (aim === 'line3' || aim === 'line5') {
    const n = aim === 'line3' ? 3 : 5;
    for (let i = 0; i < n; i++) out.push(a.dir === 'v' ? [x, y + i] : [x + i, y]);
  } else if (aim === 'plus') {
    out.push([x, y], [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  } else if (aim === 'box3' || aim === 'box5') {
    const r = aim === 'box3' ? 1 : 2;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) out.push([x + dx, y + dy]);
  } else if (aim === 'own2') {
    out.push([x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]);
  } else if (aim === 'two') {
    out.push([x, y], [a.x2, a.y2]);
  }
  return out.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < size.w && cy < size.h);
}

export class UltimateBattleship {
  constructor(ctx, rng = Math.random, opts = {}) {
    this.ctx = ctx;
    this.rng = rng;
    const sea = opts.sea || 'open';
    this.seaChoice = sea;
    this.turnMs = opts.turnMs === undefined ? UTIMING.turnMs : opts.turnMs; // 0: no timer
    this.timer = null;
    this.matches = 0;
  }

  start() {
    this.stopTimer();
    this.sea = this.seaChoice === 'random' ? SEA_IDS[Math.floor(this.rng() * SEA_IDS.length)] : this.seaChoice;
    this.size = seaSize(this.sea);
    this.commanders = [null, null];
    this.fleets = [null, null];
    this.ready = [false, false];
    this.shots = [0, 1].map(() => new Array(this.size.w * this.size.h).fill(EMPTY)); // shots landed on each player's sea
    this.shields = [new Set(), new Set()]; // shielded cells of each player's own sea (secret)
    this.spotted = [new Set(), new Set()]; // ship cells each player has seen on the rival's sea (Full Scan)
    this.sonar = []; // { by, x, y, count } readings, for everyone
    this.energy = [0, 0];
    this.charge = [0, 0];
    this.frozen = [false, false];
    this.hits = [0, 0];
    this.fired = [0, 0];
    this.last = null; // the last action: { by, kind, name, cells: [{ x, y, result }], ... }
    this.winner = null;
    this.turn = this.matches++ % 2;
    // Timed games pick a commander for anyone who hasn't in time; with no timer it waits.
    this.runPhase('pick', this.turnMs ? UTIMING.pickMs : null, () => {
      this.commanders = this.commanders.map((c) => c || COMMANDER_IDS[Math.floor(this.rng() * COMMANDER_IDS.length)]);
      this.toPlace();
    });
  }

  // ---- phases and the clock --------------------------------------------------------------

  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.onPhaseEnd = onEnd;
    this.stopTimer();
    this.ctx.update();
    if (ms) this.scheduleStep();
  }

  scheduleStep() {
    this.stopTimer();
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleStep();
      } else this.onPhaseEnd();
    }, Math.max(0, Math.min(1000, left)));
  }

  stopTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Both commanders picked: random fleets to start from; controller players are ready with theirs. */
  toPlace() {
    this.fleets = this.commanders.map((c) => randomFleet(this.sea, c, this.rng));
    this.ctx.players.forEach((p, slot) => { if (p && p.local) this.ready[slot] = true; });
    if (this.ready.every(Boolean)) return this.startTurn();
    this.runPhase('place', this.turnMs ? UTIMING.placeMs : null, () => this.startTurn());
  }

  /** A turn: energy first, unless frozen (then it passes straight back). */
  startTurn() {
    this.ready = [true, true];
    if (this.frozen[this.turn]) {
      this.frozen[this.turn] = false;
      this.last = { by: this.turn, kind: 'frozen', cells: [] };
      this.turn = 1 - this.turn;
    }
    this.energy[this.turn] = Math.min(ENERGY.max, this.energy[this.turn] + ENERGY.perTurn);
    this.runPhase('aim', this.turnMs || null, () => this.shoot(this.turn, this.randomTarget(1 - this.turn)));
  }

  // ---- the fleets -------------------------------------------------------------------------

  /** The ship of `slot`'s fleet on cell (x, y), as its index, or -1. */
  shipAt(slot, x, y) {
    const fleet = COMMANDERS[this.commanders[slot]].fleet;
    return this.fleets[slot].findIndex((s, i) => placedCells(fleet[i], s).some(([cx, cy]) => cx === x && cy === y));
  }

  isSunk(slot, i) {
    const entry = COMMANDERS[this.commanders[slot]].fleet[i];
    return placedCells(entry, this.fleets[slot][i]).every(([x, y]) => this.shots[slot][this.idx(x, y)] === HIT);
  }

  idx(x, y) {
    return y * this.size.w + x;
  }

  /** A cell you can still shoot at on your rival's sea: on the sea, not land or ice, not shot. */
  open(target, x, y) {
    const t = terrain(this.sea, x, y);
    return t !== null && t !== '#' && t !== '*' && this.shots[target][this.idx(x, y)] === EMPTY;
  }

  randomTarget(target) {
    const open = [];
    for (let y = 0; y < this.size.h; y++) for (let x = 0; x < this.size.w; x++) if (this.open(target, x, y)) open.push({ x, y });
    return open[Math.floor(this.rng() * open.length)];
  }

  /**
   * Fire on cells of `target`'s sea for `slot`. A shield on a cell stops that hit (and is used up).
   * Gives the cells with what happened: 'miss', 'hit', 'sunk' or 'blocked'.
   */
  strike(slot, target, cells) {
    const out = [];
    for (const [x, y] of cells) {
      if (!this.open(target, x, y)) continue;
      const k = this.idx(x, y);
      const ship = this.shipAt(target, x, y);
      if (ship !== -1 && this.shields[target].has(k)) {
        this.shields[target].delete(k);
        out.push({ x, y, result: 'blocked' });
        continue;
      }
      this.shields[target].delete(k); // (a shield over open water is spent on nothing)
      this.shots[target][k] = ship === -1 ? MISS : HIT;
      if (ship === -1) {
        out.push({ x, y, result: 'miss' });
        continue;
      }
      this.hits[slot]++;
      this.energy[slot] = Math.min(ENERGY.max, this.energy[slot] + ENERGY.perHit);
      const special = COMMANDERS[this.commanders[slot]].special;
      if (!this.firingSpecial) this.charge[slot] = Math.min(special.charge, this.charge[slot] + 1); // a special's own hits don't recharge it
      const sunk = this.isSunk(target, ship);
      out.push({ x, y, result: sunk ? 'sunk' : 'hit', ship: sunk ? COMMANDERS[this.commanders[target]].fleet[ship].name : undefined });
    }
    return out;
  }

  /**
   * A torpedo down row `y` from the `from` side ('w' or 'e'): it stops at land or ice, or hits
   * the first ship cell. The open water it runs through shows as misses (its wake gives it away).
   */
  torpedo(slot, target, y, from) {
    const { w } = this.size;
    const out = [];
    for (let i = 0; i < w; i++) {
      const x = from === 'e' ? w - 1 - i : i;
      const t = terrain(this.sea, x, y);
      if (t === '#' || t === '*') return out.concat([{ x, y, result: 'stopped' }]);
      if (this.shots[target][this.idx(x, y)] !== EMPTY) continue; // already shot: it runs on past
      if (this.shipAt(target, x, y) !== -1) return out.concat(this.strike(slot, target, [[x, y]]));
      out.push(...this.strike(slot, target, [[x, y]])); // open water: a miss
    }
    return out;
  }

  // ---- your turn --------------------------------------------------------------------------

  shoot(slot, at) {
    this.fired[slot]++;
    this.act(slot, { kind: 'shot', name: 'Shot', cells: this.strike(slot, 1 - slot, [[at.x, at.y]]) });
  }

  /** The ship skills `slot` still has: one per kind, from ships afloat. */
  skillsOf(slot) {
    const fleet = COMMANDERS[this.commanders[slot]].fleet;
    const out = {};
    fleet.forEach((e, i) => { if (e.skill && !this.isSunk(slot, i)) out[e.skill] = i; });
    return out;
  }

  useSkill(slot, input) {
    const kind = input.skill;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k); // ('toString' is no skill)
    if (!own(SKILLS, kind) || !own(this.skillsOf(slot), kind)) return;
    const def = SKILLS[kind];
    if (this.energy[slot] < def.cost) return;
    const target = 1 - slot;
    const a = this.aimOf(input);
    if (!a) return;
    let cells;
    let extra = {};
    // An aim that can't do anything is refused (nothing is spent): a strike needs an open cell
    // to land on, a shield some open water of yours to cover.
    if (['line3', 'plus', 'two', 'box3'].includes(def.aim)) {
      const at = footprint(def.aim, Object.assign({}, a, { x2: input.x2, y2: input.y2 }), this.size);
      if (!at.some(([x, y]) => this.open(target, x, y))) return;
    }
    const cover = def.aim === 'own2'
      ? footprint('own2', a, this.size).filter(([x, y]) => this.open(slot, x, y) && !this.shields[slot].has(this.idx(x, y)))
      : null;
    if (cover && !cover.length) return;
    if (def.aim === 'two' && (!Number.isInteger(input.x2) || !Number.isInteger(input.y2) || (input.x2 === a.x && input.y2 === a.y))) return;
    this.energy[slot] -= def.cost; // paid first, so the hits it lands are all counted (up to the cap)
    if (def.aim === 'own2') {
      // A shield on your own sea: secret, so only your phone shows it.
      cover.forEach(([x, y]) => this.shields[slot].add(this.idx(x, y)));
      cells = [];
    } else if (def.aim === 'box3') {
      // Sonar: counts the ship cells not yet hit (stealthy ships don't show).
      const fleet = COMMANDERS[this.commanders[target]].fleet;
      let count = 0;
      footprint('box3', a, this.size).forEach(([x, y]) => {
        const s = this.shipAt(target, x, y);
        if (s !== -1 && !fleet[s].stealth && this.shots[target][this.idx(x, y)] === EMPTY) count++;
      });
      this.sonar.push({ by: slot, x: a.x, y: a.y, count });
      cells = [];
      extra = { count };
    } else if (def.aim === 'row') {
      cells = this.torpedo(slot, target, a.y, a.from);
    } else {
      cells = this.strike(slot, target, footprint(def.aim, Object.assign({}, a, { x2: input.x2, y2: input.y2 }), this.size));
    }
    this.act(slot, Object.assign({ kind: 'skill', skill: kind, name: def.name, at: { x: a.x, y: a.y }, cells }, extra));
  }

  useSpecial(slot, input) {
    const special = COMMANDERS[this.commanders[slot]].special;
    if (this.charge[slot] < special.charge) return;
    const target = 1 - slot;
    let cells = [];
    if (special.aim === 'none') {
      this.frozen[target] = true;
    } else {
      const a = this.aimOf(input);
      if (!a) return;
      if (special.aim === 'rows3') {
        this.firingSpecial = true;
        for (let dy = -1; dy <= 1; dy++) if (a.y + dy >= 0 && a.y + dy < this.size.h) cells = cells.concat(this.torpedo(slot, target, a.y + dy, a.from));
        this.firingSpecial = false;
      } else if (special.aim === 'box5') {
        // Full Scan: the ship cells in a 5×5 show on your view of their sea (until you hit them).
        footprint('box5', a, this.size).forEach(([x, y]) => {
          if (this.shipAt(target, x, y) !== -1 && this.shots[target][this.idx(x, y)] === EMPTY) this.spotted[slot].add(this.idx(x, y));
        });
      } else {
        const at = footprint(special.aim, a, this.size);
        if (!at.some(([x, y]) => this.open(target, x, y))) return; // nothing to hit: not spent
        this.firingSpecial = true;
        cells = this.strike(slot, target, at);
        this.firingSpecial = false;
      }
    }
    this.charge[slot] = 0;
    this.act(slot, { kind: 'special', name: special.name, cells });
  }

  /** The aim of an input: a cell on the sea, and a direction ('h'/'v') or a side for torpedoes ('w'/'e'). */
  aimOf(input) {
    const { x, y } = input;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.size.w || y >= this.size.h) return null;
    return { x, y, dir: input.dir === 'v' ? 'v' : 'h', from: input.from === 'e' ? 'e' : 'w' };
  }

  /** After an action: a pause to show it, then (unless the fleet's gone) the other player's turn. */
  act(slot, what) {
    this.stopTimer();
    this.last = Object.assign({ by: slot }, what);
    const target = 1 - slot;
    if (COMMANDERS[this.commanders[target]].fleet.every((_, i) => this.isSunk(target, i))) return this.finish(slot);
    this.runPhase('shot', UTIMING.shotMs, () => {
      this.turn = target;
      this.startTurn();
    });
  }

  finish(winner) {
    this.stopTimer();
    this.winner = winner;
    this.phase = 'over';
    this.phaseEnds = null;
    this.ctx.update();
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'pick') {
      if (input.type === 'commander' && COMMANDER_IDS.includes(input.id) && !this.commanders[slot]) {
        this.commanders[slot] = input.id;
        if (this.commanders.every(Boolean)) return this.toPlace();
        this.ctx.update();
      }
      return;
    }
    if (this.phase === 'place') {
      if (input.type === 'ready' && !this.ready[slot] && validFleet(this.sea, this.commanders[slot], input.ships)) {
        this.fleets[slot] = input.ships.map((s) => ({ x: s.x, y: s.y, rot: s.rot }));
        this.ready[slot] = true;
        if (this.ready.every(Boolean)) return this.startTurn();
        this.ctx.update();
      } else if (input.type === 'unready' && this.ready[slot] && !this.ctx.players[slot].local) {
        this.ready[slot] = false;
        this.ctx.update();
      }
      return;
    }
    if (this.phase !== 'aim' || slot !== this.turn) return;
    if (input.type === 'fire') {
      if (!Number.isInteger(input.x) || !Number.isInteger(input.y) || !this.open(1 - slot, input.x, input.y)) return;
      return this.shoot(slot, { x: input.x, y: input.y });
    }
    if (input.type === 'skill' && typeof input.skill === 'string') return this.useSkill(slot, input);
    if (input.type === 'special') return this.useSpecial(slot, input);
  }

  // ---- views ------------------------------------------------------------------------------

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  /** A fleet as everyone may see it: the sunk ships (all of them at the end). */
  shipsOf(slot, all) {
    if (!this.commanders[slot] || !this.fleets[slot]) return [];
    const fleet = COMMANDERS[this.commanders[slot]].fleet;
    return this.fleets[slot]
      .map((s, i) => ({ i, name: fleet[i].name, shape: fleet[i].shape, skill: fleet[i].skill || null, x: s.x, y: s.y, rot: s.rot, cells: placedCells(fleet[i], s), sunk: this.phase !== 'pick' && this.phase !== 'place' && this.isSunk(slot, i) }))
      .filter((s) => all || s.sunk || this.phase === 'over');
  }

  board(slot) {
    const placing = this.phase === 'pick' || this.phase === 'place';
    return {
      shots: this.shots[slot],
      ships: placing ? [] : this.shipsOf(slot, false),
      afloat: placing || !this.commanders[slot] ? null : COMMANDERS[this.commanders[slot]].fleet.filter((_, i) => !this.isSunk(slot, i)).length,
    };
  }

  common() {
    return {
      ultimate: true,
      skillDefs: SKILLS,
      // The commanders to pick from (their fleets and specials, nothing secret).
      roster: COMMANDER_IDS.map((id) => {
        const c = COMMANDERS[id];
        return { id, name: c.name, icon: c.icon, style: c.style, special: c.special, fleet: c.fleet.map((e) => ({ name: e.name, cells: shapeCells(e.shape, 0), skill: e.skill || null, stealth: Boolean(e.stealth) })) };
      }),
      phase: this.phase,
      sea: this.sea,
      seaName: SEAS[this.sea].name,
      rows: SEAS[this.sea].rows,
      size: this.size,
      turn: this.turn,
      ready: this.ready,
      // Who picked whom shows once you've both picked.
      commanders: this.commanders.every(Boolean) ? this.commanders : this.commanders.map((c) => (c ? 'picked' : null)),
      energy: this.energy,
      charge: this.charge,
      chargeNeeded: this.commanders.every(Boolean) ? this.commanders.map((c) => COMMANDERS[c].special.charge) : [0, 0],
      frozen: this.frozen,
      sonar: this.sonar,
      // Where a shield went is its owner's secret.
      last: this.last && this.last.skill === 'shield' ? Object.assign({}, this.last, { at: undefined }) : this.last,
      hits: this.hits,
      fired: this.fired,
      timeLeftMs: this.timeLeftMs(),
      timed: this.turnMs > 0,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.common(), {
      boards: [this.board(0), this.board(1)],
      players: this.ctx.players,
    });
  }

  playerView(slot) {
    const common = this.common();
    const mine = this.board(slot);
    mine.ships = this.shipsOf(slot, true);
    mine.shields = [...this.shields[slot]];
    const theirs = this.board(1 - slot);
    theirs.spotted = [...this.spotted[slot]];
    return Object.assign(common, {
      you: slot,
      yourCommander: this.commanders[slot],
      // Your fleet's shapes in each of their four turns, for placing it.
      fleetDefs: this.commanders[slot] ? COMMANDERS[this.commanders[slot]].fleet.map((e) => ({ name: e.name, skill: e.skill || null, rots: [0, 1, 2, 3].map((r) => shapeCells(e.shape, r)) })) : null,
      // Your fleet while you place it (a random one to start from).
      placing: this.phase === 'place' && this.fleets[slot] ? this.fleets[slot] : null,
      // Your own last move in full (where your shield went is for your phone only).
      last: this.last && this.last.by === slot ? this.last : common.last,
      skills: this.phase === 'aim' || this.phase === 'shot' ? Object.keys(this.skillsOf(slot)) : [],
      mine,
      theirs,
    });
  }
}
