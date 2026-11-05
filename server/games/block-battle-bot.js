/**
 * The computer opponent for Falling Blocks Battle (see `bot` in index.js). For each new piece it
 * weighs every spot it could go (each way round, each column) by the usual measures for this kind
 * of game: lines cleared, how high the stack gets, holes left under it and how bumpy the top is.
 * Then it taps the piece there key by key at a person's pace: turn it, slide it a column at a
 * time, drop it.
 *   easy:   slow to decide and to tap, and often picks a worse spot.
 *   normal: quicker, and sensible spots.
 *   hard:   quick, looks at the next piece too, and goes for the multi-line clears that send you junk.
 */
import { WELL, GARBAGE, SHAPES } from './block-battle.js';
import { reactionMs } from './bot-human.js';

// Thinking time for a new piece (ms), the gap between key taps, and how much it errs in judging spots.
const LEVEL = {
  easy: { think: 650, tap: [190, 300], slip: 3.5, look: false },
  normal: { think: 380, tap: [120, 190], slip: 0.8, look: false },
  hard: { think: 230, tap: [85, 130], slip: 0, look: true },
};
const EMPTY = '.';

export function blockBattleBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || !view.held) return null;
  // Let go of a held key first (holding one repeats the move).
  if (view.held.shift) return { type: 'shift', dir: 0, botDelayMs: 30 + rng() * 40 };
  if (view.held.soft) return { type: 'soft', on: false, botDelayMs: 30 };
  if (view.phase !== 'play' || !view.piece || !view.rows) return null;
  const p = view.piece;
  // A plan for this piece (worked out once, when it appears).
  let plan = memory.blocks && memory.blocks.no === p.no ? memory.blocks : null;
  if (!plan) {
    plan = memory.blocks = { no: p.no, target: choose(view, level, rng), fresh: true };
  }
  const tap = L.tap[0] + rng() * (L.tap[1] - L.tap[0]);
  const wait = plan.fresh ? L.think + reactionMs(level, rng) * 0.5 : tap; // (a moment to look at a new piece)
  plan.fresh = false;
  const target = plan.target;
  if (!target || retries >= 3) return { type: 'drop', botDelayMs: wait }; // (no spot, or it won't turn or slide there)
  const now = shapeOf(p.cells);
  if (now.key !== target.key) return { type: 'rotate', dir: 1, botDelayMs: wait };
  if (now.minX !== target.x) return { type: 'shift', dir: target.x < now.minX ? -1 : 1, botDelayMs: wait };
  return { type: 'drop', botDelayMs: wait };
}

/** A set of cells as a shape (normalised to its corner) and where its left edge is. */
function shapeOf(cells) {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  const norm = cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return { key: norm.map((c) => c.join(',')).join(' '), norm, minX };
}

/** The four ways round of a piece (as the game turns it, in its n × n box). */
function turnsOf(cells, n) {
  const box = cells.map(([x, y]) => [x - Math.min(...cells.map((c) => c[0])), y - Math.min(...cells.map((c) => c[1]))]);
  const out = [];
  let cur = box;
  for (let i = 0; i < 4; i++) {
    const s = shapeOf(cur);
    if (!out.some((o) => o.key === s.key)) out.push(s);
    cur = cur.map(([x, y]) => [n - 1 - y, x]);
  }
  return out;
}

/** Where it'll put the piece: { key (the way round), x (left edge) }, or null to just drop it. */
function choose(view, level, rng) {
  const L = LEVEL[level];
  const rows = view.rows.map((r) => r.split(''));
  let best = null;
  for (const t of turnsOf(view.piece.cells, view.piece.n)) {
    const w = Math.max(...t.norm.map((c) => c[0])) + 1;
    for (let x = 0; x + w <= WELL.w; x++) {
      const after = place(rows, t.norm, x);
      if (!after) continue;
      let score = judge(after.rows, after.cleared, level);
      if (L.look && view.next) {
        // And the best spot for the next piece after that.
        let next = -Infinity;
        for (const u of turnsOf(SHAPES[view.next].cells, SHAPES[view.next].n)) {
          const uw = Math.max(...u.norm.map((c) => c[0])) + 1;
          for (let ux = 0; ux + uw <= WELL.w; ux++) {
            const then = place(after.rows, u.norm, ux);
            if (then) next = Math.max(next, judge(then.rows, then.cleared, level));
          }
        }
        if (next > -Infinity) score = score * 0.5 + next * 0.5;
      }
      score += (rng() * 2 - 1) * L.slip;
      if (!best || score > best.score) best = { key: t.key, x, score };
    }
  }
  return best;
}

/** Drop a shape in at column x: the rows after (full lines gone) and how many it cleared. */
function place(rows, norm, x) {
  let y = -4;
  const fits = (yy) => norm.every(([cx, cy]) => {
    const ry = yy + cy;
    const rx = x + cx;
    return rx >= 0 && rx < WELL.w && ry < WELL.h && (ry < 0 || rows[ry][rx] === EMPTY);
  });
  if (!fits(y)) return null;
  while (fits(y + 1)) y++;
  if (norm.some(([, cy]) => y + cy < 0)) return null; // (it wouldn't fit in the well)
  const next = rows.map((r) => r.slice());
  for (const [cx, cy] of norm) next[y + cy][x + cx] = 'x';
  const kept = next.filter((r) => r.includes(EMPTY));
  const cleared = WELL.h - kept.length;
  return { rows: [...Array.from({ length: cleared }, () => new Array(WELL.w).fill(EMPTY)), ...kept], cleared };
}

/** How good a well is (the weights commonly used for this game), plus junk sent (Hard). */
function judge(rows, cleared, level) {
  const heights = [];
  let holes = 0;
  for (let x = 0; x < WELL.w; x++) {
    let top = WELL.h;
    for (let y = 0; y < WELL.h; y++) if (rows[y][x] !== EMPTY) { top = y; break; }
    heights.push(WELL.h - top);
    for (let y = top + 1; y < WELL.h; y++) if (rows[y][x] === EMPTY) holes++;
  }
  const total = heights.reduce((a, b) => a + b, 0);
  let bump = 0;
  for (let x = 1; x < WELL.w; x++) bump += Math.abs(heights[x] - heights[x - 1]);
  let score = -0.51 * total + 0.76 * cleared - 0.36 * holes - 0.18 * bump;
  if (level === 'hard') score += (GARBAGE[cleared] || 0) * 1.5; // junk for you
  return score;
}
