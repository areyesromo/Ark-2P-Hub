// Snake Battle. Two snakes in one arena. Eat food to grow; hit a wall, your
// own body or your rival and you lose the round (both at once is a draw).
// Rounds last at most ROUND_MS; when time runs out the longer snake wins.
// First to WIN_SCORE rounds. Same turn controls as Light Cycles.

export const GRID = { w: 32, h: 18 };
export const WIN_SCORE = 3;
export const START_LENGTH = 4;
export const FOOD_COUNT = 3;
export const TIMING = { countdownMs: 3000, roundEndMs: 2500, roundMs: 60000 };
export const SPEED = { startCps: 8, maxCps: 13, rampEveryMs: 6000 }; // cells per second
const MAX_QUEUE = 2; // turns buffered per player, so quick double-turns both count

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const START = [
  { x: 5, y: GRID.h / 2, dir: 'right' },
  { x: GRID.w - 6, y: GRID.h / 2, dir: 'left' },
];

const key = (x, y) => y * GRID.w + x;

export class SnakeBattle {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
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
    this.snakes = START.map((s) => {
      const [dx] = DIRS[s.dir];
      // Head first; the body trails away behind the direction of travel.
      const body = Array.from({ length: START_LENGTH }, (_, i) => [s.x - dx * i, s.y]);
      return { body, dir: s.dir, queue: [], crashed: false };
    });
    this.food = [];
    for (let i = 0; i < FOOD_COUNT; i++) this.spawnFood();
    this.result = null;
    this.cps = SPEED.startCps;
    this.enter('countdown', TIMING.countdownMs);
    this.schedule(() => this.countdownStep(), Math.min(1000, TIMING.countdownMs));
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

  /** Push the 3-2-1 once a second (nothing else is ticking yet), then go. */
  countdownStep() {
    const left = this.phaseEnds - this.ctx.now();
    if (left > 0) {
      this.ctx.update();
      this.schedule(() => this.countdownStep(), Math.min(1000, left));
      return;
    }
    this.playStart = this.ctx.now();
    this.roundEnds = this.playStart + TIMING.roundMs;
    this.enter('play');
    this.loop();
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

  occupied() {
    const cells = new Set();
    this.snakes.forEach((s) => s.body.forEach(([x, y]) => cells.add(key(x, y))));
    return cells;
  }

  /** Drop a food pellet on a random empty cell. */
  spawnFood() {
    const taken = this.occupied();
    this.food.forEach(([x, y]) => taken.add(key(x, y)));
    const free = GRID.w * GRID.h - taken.size;
    if (free <= 0) return;
    let n = Math.floor(this.rng() * free);
    for (let i = 0; i < GRID.w * GRID.h; i++) {
      if (taken.has(i)) continue;
      if (n-- === 0) {
        this.food.push([i % GRID.w, Math.floor(i / GRID.w)]);
        return;
      }
    }
  }

  tick() {
    // Apply one queued turn each, then work out where every head goes.
    const moves = this.snakes.map((s) => {
      if (s.queue.length) s.dir = s.queue.shift();
      const [dx, dy] = DIRS[s.dir];
      const head = [s.body[0][0] + dx, s.body[0][1] + dy];
      const eats = this.food.findIndex(([fx, fy]) => fx === head[0] && fy === head[1]);
      return { head, eats };
    });

    // Cells that will still be occupied: tails move on unless that snake is eating.
    const blocked = new Set();
    this.snakes.forEach((s, i) => {
      const keep = moves[i].eats === -1 ? s.body.length - 1 : s.body.length;
      for (let j = 0; j < keep; j++) blocked.add(key(s.body[j][0], s.body[j][1]));
    });

    const crashed = moves.map(({ head: [x, y] }) => x < 0 || y < 0 || x >= GRID.w || y >= GRID.h || blocked.has(key(x, y)));
    const [a, b] = moves.map((m) => m.head);
    if (a[0] === b[0] && a[1] === b[1]) crashed[0] = crashed[1] = true; // head-on

    const eaten = new Set();
    this.snakes.forEach((s, i) => {
      if (crashed[i]) {
        s.crashed = true;
        return;
      }
      s.body.unshift(moves[i].head);
      if (moves[i].eats === -1) s.body.pop();
      else eaten.add(moves[i].eats);
    });
    if (eaten.size) {
      this.food = this.food.filter((_, i) => !eaten.has(i));
      for (let i = 0; i < eaten.size; i++) this.spawnFood();
    }

    if (crashed[0] || crashed[1]) {
      const draw = crashed[0] && crashed[1];
      return this.endRound({ reason: 'crash', crashed, draw, roundWinner: draw ? null : crashed[0] ? 1 : 0 });
    }

    const now = this.ctx.now();
    if (now >= this.roundEnds) {
      // Time's up: the longer snake takes the round.
      const [l0, l1] = this.snakes.map((s) => s.body.length);
      return this.endRound({ reason: 'time', crashed: [false, false], draw: l0 === l1, roundWinner: l0 === l1 ? null : l0 > l1 ? 0 : 1 });
    }

    this.cps = Math.min(SPEED.maxCps, SPEED.startCps + Math.floor((now - this.playStart) / SPEED.rampEveryMs));
    this.ctx.update();
  }

  endRound(result) {
    this.frozenLeft = this.timeLeft(); // the clock stops where the round ended
    if (result.roundWinner !== null) this.scores[result.roundWinner]++;
    this.result = result;
    const champ = this.scores.findIndex((s) => s >= WIN_SCORE);
    if (champ !== -1) {
      this.winner = champ;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('roundEnd', TIMING.roundEndMs);
    this.schedule(() => this.nextRound(), TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'turn' || !DIRS[input.dir]) return;
    if (this.phase !== 'play' && this.phase !== 'countdown') return;
    const s = this.snakes[slot];
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    // No-op and 180° turns (straight back into your own neck) are ignored.
    if (input.dir === last || input.dir === OPPOSITE[last] || s.queue.length >= MAX_QUEUE) return;
    s.queue.push(input.dir);
  }

  countdown() {
    return this.phaseEnds ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  timeLeft() {
    if (this.phase === 'countdown') return TIMING.roundMs / 1000;
    if (this.phase !== 'play') return this.frozenLeft || 0;
    return Math.max(0, Math.ceil((this.roundEnds - this.ctx.now()) / 1000));
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
      timeLeft: this.timeLeft(),
      snakes: this.snakes.map((s) => ({ body: s.body, dir: s.dir, crashed: s.crashed })),
      food: this.food,
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
      timeLeft: this.timeLeft(),
      dir: this.snakes[slot].dir,
      lengths: this.snakes.map((s) => s.body.length),
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'snake',
  name: 'Snake Battle',
  tagline: 'Two snakes, one arena. Eat to grow, make your rival crash. Longest snake wins when time runs out. First to 3.',
  create: (ctx) => new SnakeBattle(ctx),
};
