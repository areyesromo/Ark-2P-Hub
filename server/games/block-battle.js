// Falling Blocks Battle: a well each, side by side on the TV, and the same pieces in the same
// order for both (shuffled a set of seven at a time). Slide ◀ ▶, rotate, soft drop or hard drop.
// Clear 2 or more lines at once and junk rows (one gap each) rise into your rival's well when
// their next piece lands: 2 lines send 1, 3 send 2, 4 send 4. Clears cancel junk on its way to
// you first. Fill your well to the top and you lose the round (both at once: a draw). Pieces
// fall faster as the round goes on. First to WIN_SCORE rounds.
//
// Holding ◀ ▶ repeats here on the hub (after a short delay), so phones and controllers repeat
// at the same pace. A piece resting on something locks after a moment; moving or rotating it
// buys a little more time (a few times).

import { settingOf } from './options.js';

export const WIN_SCORE = 2;
export const WELL = { w: 10, h: 20 };
export const GARBAGE = { 2: 1, 3: 2, 4: 4 }; // lines cleared at once → junk rows sent
export const TIMING = {
  tickMs: 1000 / 60,
  countdownMs: 3000, roundEndMs: 2500,
  fallMs: 800, minFallMs: 120, speedUpMs: 20000, // a step faster (×0.85) every speedUpMs
  softMs: 40,
  lockMs: 450, lockResets: 15,
  repeatDelayMs: 170, repeatMs: 50,
};
// Each piece in its box (n x n), first way up: [x, y] cells.
const SHAPES = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
export const KINDS = Object.keys(SHAPES);
const KICKS = [0, -1, 1, -2, 2]; // sideways nudges tried when a rotation doesn't fit
const EMPTY = '.';
const JUNK = 'g';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class BlockBattle {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    // Held ◀ ▶ and soft drop carry over (phones and controllers only send changes).
    if (!this.held) this.held = [{ shift: 0, soft: false }, { shift: 0, soft: false }];
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.nextRound();
    this.loop();
  }

  nextRound() {
    this.round++;
    this.sequence = [];
    this.result = null;
    this.wells = [0, 1].map((slot) => ({
      rows: this.emptyRows(), piece: null, used: 0, lines: 0, pending: 0, out: false,
      fallAt: 0, lockAt: null, resets: 0, shiftAt: 0, held: this.held[slot],
    }));
    this.wells.forEach((w) => this.spawn(w));
    this.enter('countdown', TIMING.countdownMs);
  }

  emptyRows() {
    return Array.from({ length: WELL.h }, () => EMPTY.repeat(WELL.w));
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.shownCountdown = this.countdown();
    this.ctx.update();
  }

  loop() {
    this.timer = this.ctx.setTimeout(() => {
      this.tick();
      if (this.phase !== 'over') this.loop();
    }, TIMING.tickMs);
  }

  /** The kind of a well's `i`th piece: everyone's sequence is the same, a shuffled set of seven at a time. */
  kindAt(i) {
    while (this.sequence.length <= i) {
      const bag = KINDS.slice();
      for (let j = bag.length - 1; j > 0; j--) {
        const k = Math.floor(this.rng() * (j + 1));
        [bag[j], bag[k]] = [bag[k], bag[j]];
      }
      this.sequence.push(...bag);
    }
    return this.sequence[i];
  }

  cellsOf(p) {
    return p.cells.map(([x, y]) => [p.x + x, p.y + y]);
  }

  fits(w, p) {
    return this.cellsOf(p).every(([x, y]) => x >= 0 && x < WELL.w && y < WELL.h && (y < 0 || w.rows[y][x] === EMPTY));
  }

  /** The next piece at the top; if it doesn't fit, that well is full. */
  spawn(w) {
    const kind = this.kindAt(w.used++);
    const s = SHAPES[kind];
    w.piece = { kind, x: Math.floor((WELL.w - s.n) / 2), y: kind === 'I' ? -1 : 0, cells: s.cells.map((c) => c.slice()) };
    w.lockAt = null;
    w.resets = 0;
    w.fallAt = this.ctx.now() + this.fallInterval(w);
    if (!this.fits(w, w.piece)) w.out = true;
  }

  fallInterval(w) {
    if (w && w.held.soft) return TIMING.softMs;
    const level = this.phase === 'play' ? Math.floor((this.ctx.now() - this.roundStart) / TIMING.speedUpMs) : 0;
    return Math.max(TIMING.minFallMs, TIMING.fallMs * 0.85 ** level);
  }

  /** Tries a move; true if it happened. A successful move of a resting piece buys it time. */
  tryMove(w, dx, dy, cells) {
    const p = { ...w.piece, x: w.piece.x + dx, y: w.piece.y + dy, cells: cells || w.piece.cells };
    if (!this.fits(w, p)) return false;
    w.piece = p;
    if (w.lockAt !== null && w.resets < TIMING.lockResets) {
      w.lockAt = null;
      w.resets++;
    }
    this.dirty = true;
    return true;
  }

  rotate(w, dir) {
    const n = SHAPES[w.piece.kind].n;
    const cells = w.piece.cells.map(([x, y]) => (dir > 0 ? [n - 1 - y, x] : [y, n - 1 - x]));
    return KICKS.some((dx) => this.tryMove(w, dx, 0, cells));
  }

  /** The piece sets into the well; full lines go, junk is sent and received, the next piece comes. */
  lock(slot) {
    const w = this.wells[slot];
    const rows = w.rows.map((r) => r.split(''));
    let above = false;
    for (const [x, y] of this.cellsOf(w.piece)) {
      if (y < 0) above = true;
      else rows[y][x] = w.piece.kind;
    }
    const kept = rows.filter((r) => r.includes(EMPTY)).map((r) => r.join(''));
    const cleared = WELL.h - kept.length;
    w.rows = [...Array.from({ length: cleared }, () => EMPTY.repeat(WELL.w)), ...kept];
    w.lines += cleared;
    // Junk: first cancel what's coming to you, then the rest goes to your rival.
    let send = GARBAGE[cleared] || 0;
    const cancel = Math.min(send, w.pending);
    w.pending -= cancel;
    send -= cancel;
    if (send) this.wells[1 - slot].pending += send;
    if (!cleared && w.pending) {
      // Junk on its way lands now, one gap in the same column for the batch.
      const gap = Math.floor(this.rng() * WELL.w);
      const junk = [...Array(WELL.w)].map((_, x) => (x === gap ? EMPTY : JUNK)).join('');
      const lost = w.rows.slice(0, w.pending);
      if (lost.some((r) => r !== EMPTY.repeat(WELL.w))) above = true; // pushed out of the top
      w.rows = [...w.rows.slice(w.pending), ...Array.from({ length: w.pending }, () => junk)];
      w.pending = 0;
    }
    this.dirty = true;
    if (above) w.out = true;
    else this.spawn(w);
  }

  tick() {
    const now = this.ctx.now();
    const before = this.phase;
    if (this.phase === 'countdown' && now >= this.phaseEnds) {
      this.roundStart = now;
      this.wells.forEach((w) => { w.fallAt = now + this.fallInterval(w); });
      this.enter('play');
    } else if (this.phase === 'roundEnd' && now >= this.phaseEnds) {
      this.nextRound();
    }

    if (this.phase === 'play') {
      this.wells.forEach((w, slot) => {
        if (w.out) return;
        // Held ◀ ▶ repeats.
        if (w.held.shift && now >= w.shiftAt) {
          this.tryMove(w, w.held.shift, 0);
          w.shiftAt = now + TIMING.repeatMs;
        }
        // Falling, and locking once it has rested for a moment.
        if (now >= w.fallAt) {
          if (this.tryMove(w, 0, 1)) w.lockAt = null;
          else if (w.lockAt === null) w.lockAt = now + TIMING.lockMs;
          w.fallAt = now + this.fallInterval(w);
        }
        if (w.lockAt !== null && now >= w.lockAt) {
          if (this.fits(w, { ...w.piece, y: w.piece.y + 1 })) w.lockAt = null;
          else this.lock(slot);
        }
      });
      this.checkOut();
    }

    if (this.phase === before && (this.dirty || this.countdown() !== this.shownCountdown)) {
      this.dirty = false;
      this.shownCountdown = this.countdown();
      this.ctx.update();
    }
  }

  /** A full well loses the round (both at once: a draw). */
  checkOut() {
    const out = this.wells.map((w) => w.out);
    if (!out[0] && !out[1]) return;
    const draw = out[0] && out[1];
    const roundWinner = draw ? null : out[0] ? 1 : 0;
    if (roundWinner !== null) this.scores[roundWinner]++;
    this.result = { draw, roundWinner };
    if (roundWinner !== null && this.scores[roundWinner] >= this.winScore) {
      this.winner = roundWinner;
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      this.enter('over');
      return;
    }
    this.enter('roundEnd', TIMING.roundEndMs);
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    const held = this.held[slot];
    // A controller sends both held states together (it has one stick input).
    if (input.type === 'hold') {
      if ((input.dir !== -1 && input.dir !== 0 && input.dir !== 1) || typeof input.soft !== 'boolean') return;
      this.onInput(slot, { type: 'soft', on: input.soft });
      this.onInput(slot, { type: 'shift', dir: input.dir });
      return;
    }
    // Held states are kept in any phase (so a button held into the round still counts).
    if (input.type === 'shift') {
      if (input.dir !== -1 && input.dir !== 0 && input.dir !== 1) return;
      const press = input.dir !== 0 && input.dir !== held.shift;
      held.shift = input.dir;
      if (!press || this.phase !== 'play') return;
      const w = this.wells[slot];
      if (w.out) return;
      this.tryMove(w, input.dir, 0);
      w.shiftAt = this.ctx.now() + TIMING.repeatDelayMs;
      this.flush();
      return;
    }
    if (input.type === 'soft') {
      if (typeof input.on !== 'boolean') return;
      held.soft = input.on;
      if (this.phase === 'play') {
        const w = this.wells[slot];
        w.fallAt = Math.min(w.fallAt, this.ctx.now() + this.fallInterval(w));
      }
      return;
    }
    if (this.phase !== 'play') return;
    const w = this.wells[slot];
    if (w.out) return;
    if (input.type === 'rotate' && (input.dir === 1 || input.dir === -1)) {
      this.rotate(w, input.dir);
    } else if (input.type === 'drop') {
      while (this.tryMove(w, 0, 1));
      this.lock(slot);
      this.checkOut();
    } else {
      return;
    }
    this.flush();
  }

  /** Sends a view now if something changed (inputs shouldn't wait for the next tick). */
  flush() {
    if (!this.dirty || this.phase !== 'play') return;
    this.dirty = false;
    this.ctx.update();
  }

  countdown() {
    return this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0;
  }

  /** Where the piece would land, for the TV's outline. */
  ghost(w) {
    let p = w.piece;
    while (this.fits(w, { ...p, y: p.y + 1 })) p = { ...p, y: p.y + 1 };
    return this.cellsOf(p);
  }

  hostView() {
    return {
      phase: this.phase,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      players: this.ctx.players,
      countdown: this.countdown(),
      well: WELL,
      wells: this.wells.map((w) => ({
        rows: w.rows,
        piece: w.piece && !w.out ? { kind: w.piece.kind, cells: this.cellsOf(w.piece) } : null,
        ghost: w.piece && !w.out ? this.ghost(w) : [],
        next: this.kindAt(w.used),
        pending: w.pending,
        lines: w.lines,
        out: w.out,
      })),
      result: this.result,
      winner: this.winner,
    };
  }

  playerView(slot) {
    const w = this.wells[slot];
    return {
      phase: this.phase,
      you: slot,
      round: this.round,
      scores: this.scores,
      winScore: this.winScore,
      countdown: this.countdown(),
      next: this.kindAt(w.used),
      pending: w.pending,
      lines: this.wells.map((x) => x.lines),
      result: this.result,
      winner: this.winner,
    };
  }
}

export default {
  id: 'block-battle',
  name: 'Falling Blocks Battle',
  tagline: 'Side-by-side falling blocks. Clear lines to send junk rows to your rival; fill your well and you lose the round.',
  create: (ctx) => new BlockBattle(ctx),
};
