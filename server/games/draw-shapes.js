// Shapes for Draw Duel, plus the scoring that compares a drawing with one.
//
// A shape is one or more polylines ("paths") of [x, y, x, y, ...] in a 0..1
// box. Scoring ignores where and how big you drew: both drawings are centred
// and scaled to the same size first, so it's only about the shape itself.

const TAU = Math.PI * 2;

function curve(fn, n, from = 0, to = TAU) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = fn(from + ((to - from) * i) / n);
    pts.push(x, y);
  }
  return pts;
}

const circleAt = (cx, cy, r, n = 48) => curve((t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)], n);

function polygon(sides, startDeg = -90) {
  return curve((t) => [0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t)], sides, (startDeg * Math.PI) / 180, (startDeg * Math.PI) / 180 + TAU);
}

function star() {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.2 : 0.5;
    pts.push(0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a));
  }
  return pts;
}

// Crescent: the part of a unit circle outside a second circle (centre 0.45
// to the right, radius 0.8); the two meet at (0.625, ±0.78).
function crescent() {
  const deg = Math.PI / 180;
  const outer = curve((t) => [Math.cos(t), Math.sin(t)], 32, 51.3 * deg, 308.7 * deg);
  const inner = curve((t) => [0.45 + 0.8 * Math.cos(t), 0.8 * Math.sin(t)], 24, 282.6 * deg, 77.4 * deg);
  return [outer.concat(inner)];
}

export const SHAPES = [
  { name: 'Circle', paths: [circleAt(0.5, 0.5, 0.5)] },
  { name: 'Square', paths: [[0, 0, 1, 0, 1, 1, 0, 1, 0, 0]] },
  { name: 'Triangle', paths: [[0.5, 0, 1, 0.87, 0, 0.87, 0.5, 0]] },
  { name: 'Star', paths: [star()] },
  {
    name: 'Heart',
    paths: [curve((t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))], 64)],
  },
  { name: 'House', paths: [[0.15, 0.45, 0.15, 1, 0.85, 1, 0.85, 0.45], [0, 0.5, 0.5, 0, 1, 0.5], [0.42, 1, 0.42, 0.7, 0.58, 0.7, 0.58, 1]] },
  { name: 'Spiral', paths: [curve((t) => [0.5 + (0.03 + t * 0.025) * Math.cos(t), 0.5 + (0.03 + t * 0.025) * Math.sin(t)], 96, 0, 3 * TAU)] },
  { name: 'Lightning bolt', paths: [[0.6, 0, 0.15, 0.55, 0.45, 0.55, 0.3, 1, 0.85, 0.4, 0.55, 0.4, 0.75, 0, 0.6, 0]] },
  { name: 'Arrow', paths: [[0, 0.5, 0.95, 0.5], [0.65, 0.2, 0.95, 0.5, 0.65, 0.8]] },
  { name: 'Moon', paths: crescent() },
  { name: 'Diamond', paths: [[0.5, 0, 0.8, 0.5, 0.5, 1, 0.2, 0.5, 0.5, 0]] },
  { name: 'Infinity', paths: [curve((t) => [Math.cos(t) / (1 + Math.sin(t) ** 2), (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)], 64)] },
  { name: 'Plus', paths: [[0.35, 0, 0.65, 0, 0.65, 0.35, 1, 0.35, 1, 0.65, 0.65, 0.65, 0.65, 1, 0.35, 1, 0.35, 0.65, 0, 0.65, 0, 0.35, 0.35, 0.35, 0.35, 0]] },
  { name: 'Hexagon', paths: [polygon(6, 0)] },
  { name: 'Envelope', paths: [[0, 0.15, 1, 0.15, 1, 0.85, 0, 0.85, 0, 0.15], [0, 0.15, 0.5, 0.55, 1, 0.15]] },
  { name: 'Smiley face', paths: [circleAt(0.5, 0.5, 0.5), circleAt(0.33, 0.37, 0.06, 12), circleAt(0.67, 0.37, 0.06, 12), curve((t) => [0.5 + 0.28 * Math.cos(t), 0.55 + 0.22 * Math.sin(t)], 16, 0.15 * Math.PI, 0.85 * Math.PI)] },
  { name: 'Fish', paths: [curve((t) => [0.6 + 0.4 * Math.cos(t), 0.5 + 0.25 * Math.sin(t)], 40), [0.22, 0.5, 0, 0.25, 0, 0.75, 0.22, 0.5]] },
  { name: 'Wave', paths: [curve((t) => [t / (4 * Math.PI), 0.5 + 0.2 * Math.sin(t)], 64, 0, 4 * Math.PI)] },
  { name: 'Tree', paths: [[0.5, 0, 0.9, 0.7, 0.1, 0.7, 0.5, 0], [0.42, 0.7, 0.42, 1, 0.58, 1, 0.58, 0.7]] },
  { name: 'Mountain', paths: [[0, 1, 0.35, 0.2, 0.55, 0.6, 0.75, 0.35, 1, 1]] },
];

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
