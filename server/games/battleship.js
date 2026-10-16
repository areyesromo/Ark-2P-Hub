// Battleship. Each player hides a fleet on a 10x10 grid (on their phone, so the
// other player can't see it), then they take turns firing at each other's grid.
// First to sink the whole enemy fleet wins.
//
// Controller players have no private screen, so they get a random fleet that
// nobody sees until it's hit; they just aim and fire on the TV.

export const SIZE = 10;
export const FLEET = [
  { name: 'Carrier', len: 5 },
  { name: 'Battleship', len: 4 },
  { name: 'Cruiser', len: 3 },
  { name: 'Submarine', len: 3 },
  { name: 'Destroyer', len: 2 },
];
export const TIMING = { placeMs: 90000, turnMs: 30000, shotMs: 1500 };

const EMPTY = 0;
const MISS = 1;
const HIT = 2;

/** Cells covered by a ship placed at {x, y, dir} ('h' runs right, 'v' runs down). */
export function shipCells(ship, len) {
  const cells = [];
  for (let i = 0; i < len; i++) cells.push(ship.dir === 'h' ? [ship.x + i, ship.y] : [ship.x, ship.y + i]);
  return cells;
}

/** Ships (the first ships.length of FLEET) fit on the grid without overlapping. */
function fits(ships) {
  const taken = new Set();
  return ships.every((s, i) => {
    if (!s || (s.dir !== 'h' && s.dir !== 'v') || !Number.isInteger(s.x) || !Number.isInteger(s.y)) return false;
    return shipCells(s, FLEET[i].len).every(([x, y]) => {
      const key = y * SIZE + x;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || taken.has(key)) return false;
      taken.add(key);
      return true;
    });
  });
}

/** True if a fleet (one {x, y, dir} per FLEET entry) fits on the grid without overlaps. */
export function validFleet(ships) {
  return Array.isArray(ships) && ships.length === FLEET.length && fits(ships);
}

export function randomFleet(rng = Math.random) {
  const ships = [];
  while (ships.length < FLEET.length) {
    const len = FLEET[ships.length].len;
    const dir = rng() < 0.5 ? 'h' : 'v';
    const x = Math.floor(rng() * (dir === 'h' ? SIZE - len + 1 : SIZE));
    const y = Math.floor(rng() * (dir === 'v' ? SIZE - len + 1 : SIZE));
    if (fits([...ships, { x, y, dir }])) ships.push({ x, y, dir }); // 5 ships on 100 cells: retries are cheap
  }
  return ships;
}

export class Battleship {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.matches = 0;
  }

  start() {
    this.fleets = [randomFleet(this.rng), randomFleet(this.rng)];
    this.ready = [false, false];
    this.shots = [new Array(SIZE * SIZE).fill(EMPTY), new Array(SIZE * SIZE).fill(EMPTY)]; // shots landed on each player's grid
    this.sunk = [FLEET.map(() => false), FLEET.map(() => false)];
    this.fired = [0, 0];
    this.hits = [0, 0];
    this.lastShot = null;
    this.winner = null;
    this.turn = this.matches++ % 2; // who fires first alternates between matches
    this.phase = 'place';
    // Controller players can't place ships in secret: their random fleet is ready to go.
    this.ctx.players.forEach((p, slot) => {
      if (p.local) this.ready[slot] = true;
    });
    if (this.ready.every(Boolean)) return this.aim();
    this.runPhase('place', TIMING.placeMs, () => this.aim());
  }

  /** Enter a timed phase, pushing a fresh view every second, then call onEnd. */
  runPhase(phase, ms, onEnd) {
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.onPhaseEnd = onEnd;
    this.ctx.update();
    this.scheduleStep();
  }

  scheduleStep() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    const left = this.phaseEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phaseEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleStep();
      } else {
        this.onPhaseEnd();
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  stopTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  aim() {
    this.stopTimer();
    this.ready = [true, true]; // whatever was placed when the placing clock ran out is final
    this.runPhase('aim', TIMING.turnMs, () => this.fire(this.turn, this.randomTarget(1 - this.turn)));
  }

  randomTarget(target) {
    const open = [];
    this.shots[target].forEach((v, i) => v === EMPTY && open.push(i));
    const i = open[Math.floor(this.rng() * open.length)];
    return { x: i % SIZE, y: Math.floor(i / SIZE) };
  }

  fire(slot, { x, y }) {
    this.stopTimer();
    const target = 1 - slot;
    const grid = this.shots[target];
    const fleet = this.fleets[target];
    let result = 'miss';
    let ship = null;
    this.fired[slot]++;
    const hitShip = fleet.findIndex((s, i) => shipCells(s, FLEET[i].len).some(([cx, cy]) => cx === x && cy === y));
    if (hitShip === -1) {
      grid[y * SIZE + x] = MISS;
    } else {
      grid[y * SIZE + x] = HIT;
      this.hits[slot]++;
      result = 'hit';
      const sunk = shipCells(fleet[hitShip], FLEET[hitShip].len).every(([cx, cy]) => grid[cy * SIZE + cx] === HIT);
      if (sunk) {
        this.sunk[target][hitShip] = true;
        result = 'sunk';
        ship = FLEET[hitShip].name;
      }
    }
    this.lastShot = { by: slot, x, y, result, ship };
    if (this.sunk[target].every(Boolean)) return this.finish(slot);
    this.runPhase('shot', TIMING.shotMs, () => {
      this.turn = target;
      this.aim();
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
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase === 'place') {
      if (input.type === 'ready' && !this.ready[slot] && validFleet(input.ships)) {
        this.fleets[slot] = input.ships.map((s) => ({ x: s.x, y: s.y, dir: s.dir }));
        this.ready[slot] = true;
        if (this.ready.every(Boolean)) return this.aim();
        this.ctx.update();
      } else if (input.type === 'unready' && this.ready[slot] && !this.ctx.players[slot].local) {
        this.ready[slot] = false;
        this.ctx.update();
      }
      return;
    }
    if (input.type === 'fire' && this.phase === 'aim' && slot === this.turn) {
      const { x, y } = input;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
      if (this.shots[1 - slot][y * SIZE + x] !== EMPTY) return;
      this.fire(slot, { x, y });
    }
  }

  timeLeftMs() {
    return this.phaseEnds ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0;
  }

  /** Ships of a player that everyone may see: sunk ones, or all of them once the game is over. */
  visibleShips(slot) {
    return this.fleets[slot]
      .map((s, i) => ({ name: FLEET[i].name, len: FLEET[i].len, x: s.x, y: s.y, dir: s.dir, sunk: this.sunk[slot][i] }))
      .filter((s) => s.sunk || this.phase === 'over');
  }

  board(slot) {
    return {
      shots: this.shots[slot],
      ships: this.visibleShips(slot),
      afloat: this.sunk[slot].filter((s) => !s).length,
    };
  }

  common() {
    return {
      phase: this.phase,
      size: SIZE,
      fleet: FLEET,
      turn: this.turn,
      ready: this.ready,
      timeLeftMs: this.timeLeftMs(),
      phaseMs: TIMING[this.phase + 'Ms'] || 0,
      lastShot: this.lastShot,
      fired: this.fired,
      hits: this.hits,
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
    const mine = this.board(slot);
    mine.ships = this.fleets[slot].map((s, i) => ({ name: FLEET[i].name, len: FLEET[i].len, x: s.x, y: s.y, dir: s.dir, sunk: this.sunk[slot][i] }));
    return Object.assign(this.common(), {
      you: slot,
      mine: mine,
      theirs: this.board(1 - slot),
    });
  }
}

export default {
  id: 'battleship',
  name: 'Battleship',
  tagline: 'Hide your fleet on your phone, then take turns firing at the enemy grid. Sink all 5 ships to win.',
  create: (ctx) => new Battleship(ctx),
};
