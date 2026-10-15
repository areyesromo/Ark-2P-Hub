// Tron light cycles. Both cycles move one grid cell per tick and leave a wall
// behind. Hit a wall or any trail and you crash; both crashing on the same
// tick is a draw. Cycles speed up as a round goes on. First to 3 rounds.
//
// Trails are sent as their corner points (plus the current head), not the
// whole grid, so every update stays tiny.

export const GRID = { w: 64, h: 36 };
export const WIN_SCORE = 3;
export const TIMING = { countdownMs: 3000, crashMs: 2200 };
export const SPEED = { startCps: 10, maxCps: 18, rampEveryMs: 4000 }; // cells per second, +1 every 4 s
const MAX_QUEUE = 2; // turns buffered per player, so quick double-turns both count

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const START = [
  { x: 8, y: GRID.h / 2, dir: 'right' },
  { x: GRID.w - 9, y: GRID.h / 2, dir: 'left' },
];

export class Tron {
  constructor(ctx) {
    this.ctx = ctx;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.nextRound();
  }

  nextRound() {
    this.round++;
    this.grid = new Uint8Array(GRID.w * GRID.h); // 0 empty, 1 = P1 trail, 2 = P2 trail
    this.cycles = START.map((s, slot) => {
      this.grid[s.y * GRID.w + s.x] = slot + 1;
      return { x: s.x, y: s.y, dir: s.dir, queue: [], corners: [[s.x, s.y]], crashed: false };
    });
    this.result = null;
    this.cps = SPEED.startCps;
    this.enter('countdown', TIMING.countdownMs);
    this.schedule(() => this.countdownStep(), Math.min(1000, TIMING.countdownMs));
  }

  /** Push the 3-2-1 once a second (nothing else is ticking yet), then go. */
  countdownStep() {
    const left = this.phaseEnds - this.ctx.now();
    if (left > 0) {
      this.ctx.update();
      this.schedule(() => this.countdownStep(), Math.min(1000, left));
      return;
    }
    this.playStart = this.ctx.now();
    this.enter('play');
    this.loop();
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  get tickMs() {
    return 1000 / this.cps;
  }

  loop() {
    this.schedule(() => {
      this.tick();
      if (this.phase === 'play') this.loop();
    }, this.tickMs);
  }

  tick() {
    // Apply one queued turn each; a turn leaves a corner in the trail.
    const next = this.cycles.map((c) => {
      if (c.queue.length) {
        c.dir = c.queue.shift();
        const last = c.corners[c.corners.length - 1];
        if (last[0] !== c.x || last[1] !== c.y) c.corners.push([c.x, c.y]);
      }
      const [dx, dy] = DIRS[c.dir];
      return { x: c.x + dx, y: c.y + dy };
    });

    const blocked = (p) => p.x < 0 || p.y < 0 || p.x >= GRID.w || p.y >= GRID.h || this.grid[p.y * GRID.w + p.x] !== 0;
    const crashed = next.map(blocked);
    if (next[0].x === next[1].x && next[0].y === next[1].y) crashed[0] = crashed[1] = true; // head-on

    this.cycles.forEach((c, slot) => {
      if (crashed[slot]) {
        c.crashed = true;
        return;
      }
      c.x = next[slot].x;
      c.y = next[slot].y;
      this.grid[c.y * GRID.w + c.x] = slot + 1;
    });

    if (crashed[0] || crashed[1]) return this.endRound(crashed);

    // Speed up as the round goes on.
    const elapsed = this.ctx.now() - this.playStart;
    this.cps = Math.min(SPEED.maxCps, SPEED.startCps + Math.floor(elapsed / SPEED.rampEveryMs));
    this.ctx.update();
  }

  endRound(crashed) {
    const draw = crashed[0] && crashed[1];
    const roundWinner = draw ? null : crashed[0] ? 1 : 0;
    if (roundWinner !== null) this.scores[roundWinner]++;
    this.result = { crashed, draw, roundWinner };

    const champ = this.scores.findIndex((s) => s >= WIN_SCORE);
    if (champ !== -1) {
      this.winner = champ;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('crash', TIMING.crashMs);
    this.schedule(() => this.nextRound(), TIMING.crashMs);
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'turn' || !DIRS[input.dir]) return;
    if (this.phase !== 'play' && this.phase !== 'countdown') return;
    const c = this.cycles[slot];
    const last = c.queue.length ? c.queue[c.queue.length - 1] : c.dir;
    // No-op and 180° turns (straight into your own trail) are ignored.
    if (input.dir === last || input.dir === OPPOSITE[last] || c.queue.length >= MAX_QUEUE) return;
    c.queue.push(input.dir);
  }

  countdown() {
    return this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  hostView() {
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: WIN_SCORE,
      players: this.ctx.players,
      grid: GRID,
      countdown: this.countdown(),
      tickMs: this.tickMs,
      cycles: this.cycles.map((c) => ({
        path: c.corners.concat([[c.x, c.y]]),
        dir: c.dir,
        crashed: c.crashed,
      })),
      result: this.result,
      winner: this.winner,
    };
  }

  playerView(slot) {
    return {
      phase: this.phase,
      round: this.round,
      you: slot,
      scores: this.scores,
      winScore: WIN_SCORE,
      countdown: this.countdown(),
      dir: this.cycles[slot].dir,
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'tron',
  name: 'Light Cycles',
  tagline: 'Tron-style. Leave a wall behind you and make your rival crash into it. First to 3.',
  create: (ctx) => new Tron(ctx),
};
