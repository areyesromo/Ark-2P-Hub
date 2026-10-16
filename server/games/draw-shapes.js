// Scoring for Draw Duel: how closely a drawing matches a shape from
// shape-library.js.
//
// A shape is one or more polylines ("paths") of [x, y, x, y, ...] in a 0..1
// box. Scoring ignores where and how big you drew: both drawings are centred
// and scaled to the same size first, so it's only about the shape itself.

import { SHAPES } from './shape-library.js';

export { SHAPES };

// ---- scoring ----------------------------------------------------------------

const STEP = 0.02; // resample spacing, in normalised units
const MIN_SIZE = 0.05; // drawings smaller than this (in canvas units) score 0
const ZERO_AT = 0.15; // RMS error that scores 0%
const INK_SLACK = 1.4; // drawing up to this much more (or 1/this less) line than the shape costs nothing

/** Bounding box of a set of paths. */
function bounds(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of paths) {
    for (let i = 0; i < p.length; i += 2) {
      minX = Math.min(minX, p[i]);
      maxX = Math.max(maxX, p[i]);
      minY = Math.min(minY, p[i + 1]);
      maxY = Math.max(maxY, p[i + 1]);
    }
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}

/** Centre on the origin and scale so the longer side is 1, then resample evenly. */
function normalise(paths) {
  const b = bounds(paths);
  const size = Math.max(b.w, b.h);
  const cx = b.minX + b.w / 2;
  const cy = b.minY + b.h / 2;
  const out = [];
  for (const p of paths) {
    let px = (p[0] - cx) / size;
    let py = (p[1] - cy) / size;
    out.push([px, py]);
    for (let i = 2; i < p.length; i += 2) {
      const x = (p[i] - cx) / size;
      const y = (p[i + 1] - cy) / size;
      const d = Math.hypot(x - px, y - py);
      const n = Math.floor(d / STEP);
      for (let k = 1; k <= n; k++) out.push([px + ((x - px) * k * STEP) / d, py + ((y - py) * k * STEP) / d]);
      out.push([x, y]);
      px = x;
      py = y;
    }
  }
  return out;
}

function rmsNearest(from, to) {
  let sum = 0;
  for (const [x, y] of from) {
    let best = Infinity;
    for (const [u, v] of to) {
      const d = (x - u) * (x - u) + (y - v) * (y - v);
      if (d < best) best = d;
    }
    sum += best;
  }
  return Math.sqrt(sum / from.length);
}

/**
 * How closely a drawing matches a shape, 0..100. Averages two distances: how
 * well the drawing covers the shape, and how much of the drawing is on it.
 * Way too much or too little ink (scribbling the box full, a single line) is
 * scaled down on top of that.
 */
export function accuracy(shapePaths, strokes) {
  const drawn = strokes.filter((s) => s.length >= 2);
  if (!drawn.length) return 0;
  const b = bounds(drawn);
  if (Math.max(b.w, b.h) < MIN_SIZE) return 0;
  const target = normalise(shapePaths);
  const mine = normalise(drawn);
  const err = (rmsNearest(target, mine) + rmsNearest(mine, target)) / 2;
  const ink = mine.length / target.length; // resampled evenly, so point counts compare line lengths
  const inkFactor = Math.min(1, INK_SLACK / ink, ink * INK_SLACK);
  return Math.round(100 * Math.max(0, 1 - err / ZERO_AT) * inkFactor);
}

/** The shape's paths scaled to fit (aspect kept) and centred in the 0..1 box, for drawing. */
export function fitted(paths, margin = 0.1) {
  const b = bounds(paths);
  const s = (1 - 2 * margin) / Math.max(b.w, b.h);
  const ox = (1 - b.w * s) / 2 - b.minX * s;
  const oy = (1 - b.h * s) / 2 - b.minY * s;
  return paths.map((p) => p.map((v, i) => Math.round((i % 2 ? oy + v * s : ox + v * s) * 1000) / 1000));
}
