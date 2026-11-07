// Tower Stack. Co-op: the two of you build one tower, a block at a time. Each new block slides
// back and forth over the top of the tower; DROP it and whatever hangs over the edge is cut off
// and falls, so the tower (and every block after it) gets narrower. Drop it near enough dead on
// and it snaps into place whole: three of those in a row and the blocks start to grow back. You
// take turns: player 1 drops the blocks that slide left and right, player 2 the ones that slide
// front and back. Missing the tower altogether costs one of your shared lives (and you try that
// floor again); out of lives, the tower's done. It speeds up as it grows. Stars for how high.

import { settingOf } from './options.js';

export const STACK = {
  size: 6, // the base block's width and depth
  amp: 7, // how far either side of the middle the sliding block goes
  speed: 3.2, // how fast it slides at first (units a second) ...
  speedUp: 0.15, // ... and this much faster each floor (no limit: every tower ends sometime)
  easySpeed: 0.7, // Easy: this much of the speed
  perfect: [0.2, 0.32], // a drop this close to dead on is perfect ([normal, easy])
  minWidth: 0.15, // a sliver thinner than this doesn't stay on: a miss
  grow: 0.5, // a perfect drop on a streak of three or more grows the block back this much
  lives: [3, 5],
  targets: [[15, 35, 60], [10, 25, 40]], // floors for 1, 2 and 3 stars ([normal, easy])
  lagMs: 80, // where the block was this long before a phone's tap arrived (the time for it to get here) ...
  localLagMs: 20, // ... and a controller's press, made at the TV (here almost at once)
};
export const TIMING = { introMs: 3000, settleMs: 450, missMs: 1100 };

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Where the sliding block is (from the middle) `ms` after it started, at `speed`, out to `amp`. */
export function offsetAt(ms, speed, amp) {
  const d = ((ms / 1000) * speed) % (4 * amp);
  return d <= 2 * amp ? -amp + d : 3 * amp - d;
}

export class TowerStack {
  constructor(ctx) {
    this.ctx = ctx;
    this.easy = settingOf(ctx, 'difficulty', 0) === 1;
    this.maxLives = STACK.lives[this.easy ? 1 : 0];
    this.perfectWindow = STACK.perfect[this.easy ? 1 : 0];
    this.timer = null;
  }

  start() {
    const h = STACK.size / 2;
    this.floors = [{ x0: -h, x1: h, z0: -h, z1: h, kind: 'base' }];
    this.lives = this.maxLives;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfects = 0;
    this.last = null; // { kind: 'perfect' | 'cut' | 'miss', piece, n }
    this.drops = 0;
    this.enter('intro', TIMING.introMs, () => this.nextBlock());
  }

  /** A new phase; `then` after `ms` (the one timer). */
  enter(phase, ms = 0, then = null) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.phase = phase;
    if (ms && then) {
      this.timer = this.ctx.setTimeout(() => {
        this.timer = null;
        then();
      }, ms);
    }
    this.ctx.update();
  }

  top() {
    return this.floors[this.floors.length - 1];
  }

  height() {
    return this.floors.length - 1;
  }

  /** The floor being dropped: x (left-right) for the odd floors, z for the even; its player. */
  get axis() {
    return this.height() % 2 === 0 ? 'x' : 'z';
  }

  get turn() {
    return this.height() % 2;
  }

  speed() {
    return (STACK.speed + this.height() * STACK.speedUp) * (this.easy ? STACK.easySpeed : 1);
  }

  nextBlock() {
    this.moveAt = this.ctx.now();
    this.enter('drop');
  }

  offsetNow(lag = 0) {
    return offsetAt(Math.max(0, this.ctx.now() - lag - this.moveAt), this.speed(), STACK.amp);
  }

  onInput(slot, input) {
    if ((slot !== 0 && slot !== 1) || !input || typeof input !== 'object') return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'drop' && this.phase === 'drop' && slot === this.turn) {
      // (the computer's drop is here the moment it makes it)
      const p = this.ctx.players[slot] || {};
      this.drop(p.bot ? 0 : p.local ? STACK.localLagMs : STACK.lagMs);
    }
  }

  drop(lag = STACK.lagMs) {
    const off = this.offsetNow(lag);
    const a = this.axis;
    const [k0, k1] = a === 'x' ? ['x0', 'x1'] : ['z0', 'z1'];
    const top = this.top();
    const block = { ...top, [k0]: top[k0] + off, [k1]: top[k1] + off };
    this.drops++;
    const lo = Math.max(top[k0], block[k0]);
    const hi = Math.min(top[k1], block[k1]);
    // (a drop inside the perfect window is perfect, however narrow the tower's got)
    const perfect = Math.abs(off) <= Math.min(this.perfectWindow, (top[k1] - top[k0]) / 2);
    if (!perfect && hi - lo < STACK.minWidth) {
      // Off the tower altogether: it falls, a life goes, and the same floor again.
      this.lives--;
      this.combo = 0;
      this.last = { kind: 'miss', piece: rect(block), n: this.drops };
      return this.enter('settle', TIMING.missMs, () => (this.lives > 0 ? this.nextBlock() : this.finish()));
    }
    if (perfect) {
      // Near enough dead on: it snaps into place whole, and a streak grows it back.
      this.combo++;
      this.perfects++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const placed = { ...top, kind: 'perfect' };
      if (this.combo >= 3) {
        const w = Math.min(STACK.size, top[k1] - top[k0] + STACK.grow);
        const mid = (top[k0] + top[k1]) / 2;
        placed[k0] = r3(mid - w / 2);
        placed[k1] = r3(mid + w / 2);
      }
      this.floors.push(placed);
      this.last = { kind: 'perfect', piece: null, n: this.drops };
    } else {
      // Cut down to the overlap; the rest falls off.
      this.combo = 0;
      const kept = { ...block, [k0]: r3(lo), [k1]: r3(hi), kind: 'cut' };
      const piece = off > 0 ? { ...block, [k0]: hi } : { ...block, [k1]: lo };
      this.floors.push(kept);
      this.last = { kind: 'cut', piece: rect(piece), n: this.drops };
    }
    this.enter('settle', TIMING.settleMs, () => this.nextBlock());
  }

  finish() {
    this.enter('over');
  }

  stars() {
    const t = STACK.targets[this.easy ? 1 : 0];
    return t.filter((n) => this.height() >= n).length;
  }

  view() {
    return {
      phase: this.phase,
      easy: this.easy,
      floors: this.floors.map(rect),
      height: this.height(),
      turn: this.turn,
      // The sliding block (the TV moves it on its own clock from here): its axis, speed, how far along.
      move: this.phase === 'drop' ? { axis: this.axis, speed: this.speed(), amp: STACK.amp, elapsed: this.ctx.now() - this.moveAt } : null,
      lives: this.lives,
      maxLives: this.maxLives,
      combo: this.combo,
      bestCombo: this.bestCombo,
      last: this.last,
      targets: STACK.targets[this.easy ? 1 : 0],
      size: STACK.size,
      // For the room's history (a co-op game: the team's stars).
      stars: this.phase === 'over' ? this.stars() : 0,
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

function rect(r) {
  return { x0: r3(r.x0), x1: r3(r.x1), z0: r3(r.z0), z1: r3(r.z1) };
}

export default {
  id: 'tower-stack',
  name: 'Tower Stack',
  category: 'casual',
  tagline: 'Co-op stacking in 3D: take turns dropping sliding blocks onto one tower. What hangs over gets cut off, so line them up and see how high you can go.',
  create: (ctx) => new TowerStack(ctx),
};
