// The shapes Draw Duel picks from. A shape is a name plus one or more
// polylines ("paths") of [x, y, x, y, ...] in a 0..1 box (y points down).
// Scoring ignores position and size, so only the proportions matter.
//
// Angles below are in degrees, measured the canvas way: 0° points right and
// 90° points DOWN (y grows downwards).

const TAU = Math.PI * 2;
const RAD = Math.PI / 180;

/** Sample fn(t) for t from `from` to `to` (radians) into a flat point list. */
function curve(fn, n, from = 0, to = TAU) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = fn(from + ((to - from) * i) / n);
    pts.push(x, y);
  }
  return pts;
}

/** Arc of a circle from a0 to a1 degrees (either direction). */
function arc(cx, cy, r, a0, a1, n) {
  const steps = n || Math.max(6, Math.round(Math.abs(a1 - a0) / 10));
  return curve((t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)], steps, a0 * RAD, a1 * RAD);
}

/** Arc of an ellipse from a0 to a1 degrees. */
function earc(cx, cy, rx, ry, a0, a1, n) {
  const steps = n || Math.max(6, Math.round(Math.abs(a1 - a0) / 10));
  return curve((t) => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)], steps, a0 * RAD, a1 * RAD);
}

const circle = (cx, cy, r) => arc(cx, cy, r, 0, 360, Math.max(16, Math.round(r * 100)));
const ellipse = (cx, cy, rx, ry) => earc(cx, cy, rx, ry, 0, 360, 40);
const rect = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h, x, y];
/** Join pieces (flat point lists) into one continuous path. */
const join = (...parts) => [].concat(...parts);

/** Regular polygon, first corner at startDeg. */
function polygon(sides, startDeg = -90) {
  return arc(0.5, 0.5, 0.5, startDeg, startDeg + 360, sides);
}

/** Star with `points` tips; inner is the inner radius as a fraction of the outer. */
function star(points, inner = 0.4) {
  const pts = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 ? 0.5 * inner : 0.5;
    pts.push(0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a));
  }
  return pts;
}

// Crescent: the part of a unit circle outside a second circle (centre 0.45
// to the right, radius 0.8); the two meet at (0.625, ±0.78).
function crescent() {
  const outer = curve((t) => [Math.cos(t), Math.sin(t)], 32, 51.3 * RAD, 308.7 * RAD);
  const inner = curve((t) => [0.45 + 0.8 * Math.cos(t), 0.8 * Math.sin(t)], 24, 282.6 * RAD, 77.4 * RAD);
  return outer.concat(inner);
}

const heart = () => curve((t) => [16 * Math.sin(t) ** 3, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))], 64);

// ---- basic shapes ------------------------------------------------------------

const BASICS = [
  { name: 'Circle', paths: [circle(0.5, 0.5, 0.5)] },
  { name: 'Square', paths: [rect(0, 0, 1, 1)] },
  { name: 'Triangle', paths: [[0.5, 0, 1, 0.87, 0, 0.87, 0.5, 0]] },
  { name: 'Star', paths: [star(5)] },
  { name: 'Heart', paths: [heart()] },
  { name: 'Spiral', paths: [curve((t) => [0.5 + (0.03 + t * 0.025) * Math.cos(t), 0.5 + (0.03 + t * 0.025) * Math.sin(t)], 96, 0, 3 * TAU)] },
  { name: 'Lightning bolt', paths: [[0.6, 0, 0.15, 0.55, 0.45, 0.55, 0.3, 1, 0.85, 0.4, 0.55, 0.4, 0.75, 0, 0.6, 0]] },
  { name: 'Arrow', paths: [[0, 0.5, 0.95, 0.5], [0.65, 0.2, 0.95, 0.5, 0.65, 0.8]] },
  { name: 'Moon', paths: [crescent()] },
  { name: 'Diamond', paths: [[0.5, 0, 0.8, 0.5, 0.5, 1, 0.2, 0.5, 0.5, 0]] },
  { name: 'Infinity', paths: [curve((t) => [Math.cos(t) / (1 + Math.sin(t) ** 2), (Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) ** 2)], 64)] },
  { name: 'Plus', paths: [[0.35, 0, 0.65, 0, 0.65, 0.35, 1, 0.35, 1, 0.65, 0.65, 0.65, 0.65, 1, 0.35, 1, 0.35, 0.65, 0, 0.65, 0, 0.35, 0.35, 0.35, 0.35, 0]] },
  { name: 'Hexagon', paths: [polygon(6, 0)] },
  { name: 'Pentagon', paths: [polygon(5)] },
  { name: 'Octagon', paths: [polygon(8, 22.5)] },
  { name: 'Four-point star', paths: [star(4, 0.35)] },
  { name: 'Six-point star', paths: [star(6, 0.55)] },
  { name: 'Eight-point star', paths: [star(8, 0.6)] },
  { name: 'Oval', paths: [ellipse(0.5, 0.5, 0.5, 0.3)] },
  { name: 'Ring', paths: [circle(0.5, 0.5, 0.5), circle(0.5, 0.5, 0.28)] },
  { name: 'Semicircle', paths: [join(arc(0.5, 0.75, 0.5, 180, 360), [0, 0.75])] },
  { name: 'Parallelogram', paths: [[0.3, 0.2, 1, 0.2, 0.7, 0.8, 0, 0.8, 0.3, 0.2]] },
  { name: 'Trapezoid', paths: [[0.25, 0.2, 0.75, 0.2, 1, 0.8, 0, 0.8, 0.25, 0.2]] },
  { name: 'Right triangle', paths: [[0, 0, 0, 1, 0.8, 1, 0, 0]] },
  { name: 'Zigzag', paths: [[0, 0.7, 0.2, 0.3, 0.4, 0.7, 0.6, 0.3, 0.8, 0.7, 1, 0.3]] },
  { name: 'Wave', paths: [curve((t) => [t / (4 * Math.PI), 0.5 + 0.2 * Math.sin(t)], 64, 0, 4 * Math.PI)] },
  { name: 'Pac-Man', paths: [join([0.5, 0.5], arc(0.5, 0.5, 0.5, 35, 325), [0.5, 0.5])] },
  { name: 'Raindrop', paths: [join([0.5, 0], arc(0.5, 0.65, 0.33, -40, 220), [0.5, 0])] },
  { name: 'Mountain', paths: [[0, 1, 0.35, 0.2, 0.55, 0.6, 0.75, 0.35, 1, 1]] },
  { name: 'Hourglass', paths: [[0.2, 0.05, 0.8, 0.05, 0.2, 0.95, 0.8, 0.95, 0.2, 0.05]] },
];

// ---- pictures ----------------------------------------------------------------

const PICTURES = [
  { name: 'House', paths: [[0.15, 0.45, 0.15, 1, 0.85, 1, 0.85, 0.45], [0, 0.5, 0.5, 0, 1, 0.5], [0.42, 1, 0.42, 0.7, 0.58, 0.7, 0.58, 1]] },
  { name: 'Envelope', paths: [[0, 0.15, 1, 0.15, 1, 0.85, 0, 0.85, 0, 0.15], [0, 0.15, 0.5, 0.55, 1, 0.15]] },
  { name: 'Smiley face', paths: [circle(0.5, 0.5, 0.5), circle(0.33, 0.37, 0.06), circle(0.67, 0.37, 0.06), arc(0.5, 0.55, 0.28, 27, 153)] },
  { name: 'Fish', paths: [ellipse(0.6, 0.5, 0.4, 0.25), [0.22, 0.5, 0, 0.25, 0, 0.75, 0.22, 0.5]] },
  { name: 'Tree', paths: [[0.5, 0, 0.9, 0.7, 0.1, 0.7, 0.5, 0], [0.42, 0.7, 0.42, 1, 0.58, 1, 0.58, 0.7]] },
  { name: 'Pine tree', paths: [[0.5, 0, 0.75, 0.3, 0.62, 0.3, 0.85, 0.58, 0.7, 0.58, 0.95, 0.85, 0.05, 0.85, 0.3, 0.58, 0.15, 0.58, 0.38, 0.3, 0.25, 0.3, 0.5, 0], [0.45, 0.85, 0.45, 1, 0.55, 1, 0.55, 0.85]] },
  { name: 'Umbrella', paths: [join(arc(0.5, 0.45, 0.45, 180, 360), [0.05, 0.45]), join([0.5, 0.45, 0.5, 0.88], arc(0.42, 0.88, 0.08, 0, 180))] },
  { name: 'Mug', paths: [[0.15, 0.25, 0.15, 0.9, 0.65, 0.9, 0.65, 0.25], arc(0.65, 0.57, 0.17, -90, 90)] },
  { name: 'Ice cream cone', paths: [[0.28, 0.5, 0.5, 1, 0.72, 0.5], join(arc(0.5, 0.5, 0.25, 180, 360), [0.25, 0.5])] },
  { name: 'Sailboat', paths: [[0.05, 0.75, 0.95, 0.75, 0.8, 0.92, 0.2, 0.92, 0.05, 0.75], [0.5, 0.75, 0.5, 0.05], [0.5, 0.1, 0.88, 0.65, 0.5, 0.65]] },
  { name: 'Rocket', paths: [[0.5, 0, 0.65, 0.25, 0.65, 0.75, 0.35, 0.75, 0.35, 0.25, 0.5, 0], [0.35, 0.55, 0.18, 0.88, 0.35, 0.75], [0.65, 0.55, 0.82, 0.88, 0.65, 0.75], circle(0.5, 0.36, 0.07)] },
  { name: 'Cat face', paths: [circle(0.5, 0.58, 0.4), [0.18, 0.4, 0.2, 0.02, 0.42, 0.2], [0.58, 0.2, 0.8, 0.02, 0.82, 0.4], circle(0.36, 0.52, 0.05), circle(0.64, 0.52, 0.05), [0.45, 0.68, 0.5, 0.73, 0.55, 0.68]] },
  {
    name: 'Flower',
    paths: [circle(0.5, 0.32, 0.1)].concat([0, 60, 120, 180, 240, 300].map((a) => circle(0.5 + 0.21 * Math.cos(a * RAD), 0.32 + 0.21 * Math.sin(a * RAD), 0.1)), [[0.5, 0.63, 0.5, 1]]),
  },
  { name: 'Sun', paths: [circle(0.5, 0.5, 0.22)].concat([0, 45, 90, 135, 180, 225, 270, 315].map((a) => [0.5 + 0.3 * Math.cos(a * RAD), 0.5 + 0.3 * Math.sin(a * RAD), 0.5 + 0.48 * Math.cos(a * RAD), 0.5 + 0.48 * Math.sin(a * RAD)])) },
  { name: 'Apple', paths: [join(arc(0.5, 0.6, 0.38, -80, 260)), [0.5, 0.25, 0.55, 0.05], join(earc(0.66, 0.15, 0.12, 0.06, 0, 360, 20))] },
  { name: 'Leaf', paths: [join(arc(0.5, 1.1, 0.75, -132, -48), arc(0.5, -0.1, 0.75, 48, 132)), [0.0, 0.5, 1.0, 0.5]] },
  { name: 'Music note', paths: [ellipse(0.3, 0.82, 0.15, 0.1), [0.45, 0.82, 0.45, 0.08, 0.78, 0.25, 0.75, 0.42, 0.45, 0.3]] },
  { name: 'Crown', paths: [[0.05, 0.85, 0.05, 0.3, 0.28, 0.55, 0.5, 0.15, 0.72, 0.55, 0.95, 0.3, 0.95, 0.85, 0.05, 0.85]] },
  { name: 'Key', paths: [circle(0.22, 0.5, 0.18), [0.4, 0.5, 0.97, 0.5], [0.8, 0.5, 0.8, 0.67], [0.92, 0.5, 0.92, 0.67]] },
  { name: 'Light bulb', paths: [join(arc(0.5, 0.36, 0.3, 120, 420), [0.62, 0.8, 0.62, 0.96, 0.38, 0.96, 0.38, 0.8, 0.35, 0.62]), [0.38, 0.8, 0.62, 0.8]] },
  { name: 'Ghost', paths: [join(arc(0.5, 0.4, 0.3, 180, 360), [0.8, 0.92, 0.7, 0.82, 0.6, 0.92, 0.5, 0.82, 0.4, 0.92, 0.3, 0.82, 0.2, 0.92, 0.2, 0.4]), circle(0.4, 0.4, 0.05), circle(0.6, 0.4, 0.05)] },
  { name: 'Bone', paths: [[0.25, 0.42, 0.75, 0.42], [0.25, 0.58, 0.75, 0.58], circle(0.17, 0.37, 0.1), circle(0.17, 0.63, 0.1), circle(0.83, 0.37, 0.1), circle(0.83, 0.63, 0.1)] },
  { name: 'Kite', paths: [[0.5, 0, 0.82, 0.32, 0.5, 0.75, 0.18, 0.32, 0.5, 0], [0.5, 0, 0.5, 0.75], [0.18, 0.32, 0.82, 0.32], curve((t) => [0.5 + 0.06 * Math.sin(t * 3), 0.75 + t * 0.04], 24, 0, 6)] },
  { name: 'Mushroom', paths: [join(arc(0.5, 0.5, 0.45, 180, 360), [0.05, 0.5]), [0.38, 0.5, 0.38, 0.92, 0.62, 0.92, 0.62, 0.5]] },
  { name: 'Anchor', paths: [circle(0.5, 0.1, 0.07), [0.5, 0.17, 0.5, 0.92], [0.3, 0.3, 0.7, 0.3], arc(0.5, 0.6, 0.35, 10, 170)] },
  { name: 'Cactus', paths: [[0.42, 1, 0.42, 0.1, 0.58, 0.1, 0.58, 1], [0.42, 0.6, 0.2, 0.6, 0.2, 0.3], [0.58, 0.48, 0.8, 0.48, 0.8, 0.2]] },
  { name: 'Sword', paths: [[0.5, 0, 0.56, 0.1, 0.56, 0.65, 0.44, 0.65, 0.44, 0.1, 0.5, 0], [0.3, 0.65, 0.7, 0.65], [0.5, 0.65, 0.5, 0.9], circle(0.5, 0.94, 0.04)] },
  { name: 'Shield', paths: [[0.1, 0.1, 0.9, 0.1, 0.9, 0.5, 0.5, 0.95, 0.1, 0.5, 0.1, 0.1]] },
  { name: 'Trophy', paths: [[0.25, 0.08, 0.75, 0.08, 0.7, 0.45, 0.5, 0.55, 0.3, 0.45, 0.25, 0.08], arc(0.25, 0.25, 0.12, 270, 90), arc(0.75, 0.25, 0.12, -90, 90), [0.5, 0.55, 0.5, 0.78], [0.3, 0.9, 0.7, 0.9, 0.65, 0.78, 0.35, 0.78, 0.3, 0.9]] },
  { name: 'Glasses', paths: [circle(0.27, 0.5, 0.18), circle(0.73, 0.5, 0.18), arc(0.5, 0.5, 0.06, 200, 340), [0.09, 0.5, 0, 0.4], [0.91, 0.5, 1, 0.4]] },
  { name: 'Bow tie', paths: [[0.5, 0.5, 0.08, 0.22, 0.08, 0.78, 0.5, 0.5, 0.92, 0.22, 0.92, 0.78, 0.5, 0.5]] },
  { name: 'Bell', paths: [join([0.12, 0.8], arc(0.5, 0.45, 0.3, 180, 360), [0.88, 0.8, 0.12, 0.8]), circle(0.5, 0.88, 0.07), [0.5, 0.15, 0.5, 0.05]] },
  { name: 'Snowman', paths: [circle(0.5, 0.72, 0.27), circle(0.5, 0.3, 0.18), [0.36, 0.13, 0.64, 0.13], rect(0.41, 0, 0.18, 0.13)] },
  { name: 'Pizza slice', paths: [[0.1, 0.15, 0.5, 0.95, 0.9, 0.15], arc(0.5, 0.75, 0.72, 236, 304), circle(0.45, 0.35, 0.06), circle(0.6, 0.55, 0.06)] },
  { name: 'Car', paths: [[0.03, 0.72, 0.03, 0.5, 0.25, 0.5, 0.35, 0.3, 0.7, 0.3, 0.8, 0.5, 0.97, 0.5, 0.97, 0.72, 0.03, 0.72], circle(0.25, 0.75, 0.1), circle(0.75, 0.75, 0.1)] },
  { name: 'Castle', paths: [[0.05, 1, 0.05, 0.2, 0.2, 0.2, 0.2, 0.35, 0.35, 0.35, 0.35, 0.2, 0.65, 0.2, 0.65, 0.35, 0.8, 0.35, 0.8, 0.2, 0.95, 0.2, 0.95, 1, 0.05, 1], join([0.4, 1], arc(0.5, 0.72, 0.1, 180, 360), [0.6, 1])] },
  { name: 'Tent', paths: [[0.03, 0.9, 0.5, 0.08, 0.97, 0.9, 0.03, 0.9], [0.38, 0.9, 0.5, 0.55, 0.62, 0.9]] },
  { name: 'Butterfly', paths: [ellipse(0.28, 0.32, 0.22, 0.17), ellipse(0.72, 0.32, 0.22, 0.17), ellipse(0.32, 0.68, 0.16, 0.14), ellipse(0.68, 0.68, 0.16, 0.14), [0.5, 0.15, 0.5, 0.85]] },
  { name: 'Snail', paths: [curve((t) => [0.55 + (0.02 + t * 0.03) * Math.cos(t), 0.5 + (0.02 + t * 0.03) * Math.sin(t)], 60, 0, 2.2 * TAU), [0.1, 0.92, 0.95, 0.92], [0.18, 0.92, 0.12, 0.6, 0.06, 0.45], [0.12, 0.6, 0.2, 0.45]] },
  { name: 'Balloon', paths: [ellipse(0.5, 0.35, 0.3, 0.35), [0.5, 0.7, 0.45, 0.76, 0.55, 0.76, 0.5, 0.7], curve((t) => [0.5 + 0.05 * Math.sin(t * 4), 0.76 + t * 0.04], 24, 0, 6)] },
  { name: 'Candle', paths: [rect(0.38, 0.35, 0.24, 0.62), join([0.5, 0.05], arc(0.5, 0.22, 0.08, -60, 240), [0.5, 0.05]), [0.5, 0.35, 0.5, 0.3]] },
  { name: 'Clock', paths: [circle(0.5, 0.5, 0.5), [0.5, 0.5, 0.5, 0.15], [0.5, 0.5, 0.75, 0.62]] },
  { name: 'Gem', paths: [[0.15, 0.3, 0.32, 0.08, 0.68, 0.08, 0.85, 0.3, 0.5, 0.95, 0.15, 0.3], [0.15, 0.3, 0.85, 0.3], [0.32, 0.08, 0.5, 0.95, 0.68, 0.08]] },
  { name: 'Pencil', paths: [[0.05, 0.95, 0.15, 0.7, 0.75, 0.1, 0.9, 0.25, 0.3, 0.85, 0.05, 0.95], [0.15, 0.7, 0.3, 0.85], [0.68, 0.17, 0.83, 0.32]] },
  { name: 'Flag', paths: [[0.15, 1, 0.15, 0.05], [0.15, 0.08, 0.88, 0.28, 0.15, 0.48]] },
  { name: 'Bird', paths: [join(arc(0.27, 0.6, 0.25, 200, 340), arc(0.73, 0.6, 0.25, 200, 340))] },
  { name: 'Planet', paths: [circle(0.5, 0.5, 0.28), ellipse(0.5, 0.5, 0.5, 0.12)] },
  { name: 'Cherries', paths: [circle(0.28, 0.75, 0.16), circle(0.72, 0.75, 0.16), [0.28, 0.59, 0.55, 0.05, 0.72, 0.59], [0.55, 0.05, 0.7, 0.08]] },
  { name: 'Lollipop', paths: [curve((t) => [0.5 + (0.02 + t * 0.045) * Math.cos(t), 0.33 + (0.02 + t * 0.045) * Math.sin(t)], 60, 0, 2.5 * TAU), [0.5, 0.62, 0.5, 1]] },
  { name: 'Paper plane', paths: [[0.03, 0.5, 0.97, 0.12, 0.62, 0.9, 0.45, 0.6, 0.03, 0.5], [0.45, 0.6, 0.97, 0.12], [0.45, 0.6, 0.45, 0.85, 0.55, 0.7]] },
  { name: 'Padlock', paths: [rect(0.15, 0.45, 0.7, 0.52), join([0.28, 0.45, 0.28, 0.3], arc(0.5, 0.3, 0.22, 180, 360), [0.72, 0.45]), circle(0.5, 0.68, 0.06)] },
  { name: 'Teacup', paths: [join([0.1, 0.3], arc(0.4, 0.3, 0.3, 180, 0, 18), [0.1, 0.3]), arc(0.72, 0.42, 0.12, -80, 100), [0.0, 0.75, 0.8, 0.75]] },
  { name: 'Wine glass', paths: [join([0.25, 0.05], arc(0.5, 0.15, 0.25, 180, 0, 18), [0.75, 0.05]), [0.5, 0.4, 0.5, 0.88], [0.3, 0.92, 0.7, 0.92]] },
  { name: 'Spider web', paths: [polygon(6), arc(0.5, 0.5, 0.25, -90, 270, 6)].concat([-90, -30, 30, 90, 150, 210].map((a) => [0.5, 0.5, 0.5 + 0.5 * Math.cos(a * RAD), 0.5 + 0.5 * Math.sin(a * RAD)])) },
  { name: 'Target', paths: [circle(0.5, 0.5, 0.5), circle(0.5, 0.5, 0.32), circle(0.5, 0.5, 0.13)] },
  { name: 'Battery', paths: [rect(0.05, 0.25, 0.82, 0.5), rect(0.87, 0.4, 0.08, 0.2), [0.25, 0.3, 0.25, 0.7], [0.45, 0.3, 0.45, 0.7]] },
  { name: 'Dumbbell', paths: [[0.25, 0.5, 0.75, 0.5], rect(0.05, 0.25, 0.2, 0.5), rect(0.75, 0.25, 0.2, 0.5)] },
  { name: 'Ladder', paths: [[0.25, 0, 0.25, 1], [0.75, 0, 0.75, 1], [0.25, 0.15, 0.75, 0.15], [0.25, 0.38, 0.75, 0.38], [0.25, 0.61, 0.75, 0.61], [0.25, 0.84, 0.75, 0.84]] },
  { name: 'Window', paths: [rect(0.1, 0.1, 0.8, 0.8), [0.5, 0.1, 0.5, 0.9], [0.1, 0.5, 0.9, 0.5]] },
  { name: 'Igloo', paths: [join(arc(0.5, 0.85, 0.45, 180, 360), [0.05, 0.85]), join([0.38, 0.85], arc(0.5, 0.85, 0.12, 180, 360))] },
  { name: 'Lightning cloud', paths: [join([0.15, 0.55], arc(0.25, 0.42, 0.13, 100, 270), arc(0.5, 0.32, 0.2, 200, 340), arc(0.75, 0.42, 0.13, 270, 440), [0.15, 0.55]), [0.5, 0.55, 0.4, 0.78, 0.55, 0.78, 0.45, 1]] },
];

// ---- letters and numbers -----------------------------------------------------

// One stroke-font glyph per character, in a 0..1 box.
const GLYPHS = {
  A: [[0, 1, 0.5, 0, 1, 1], [0.22, 0.6, 0.78, 0.6]],
  B: [[0, 0, 0, 1], join([0, 0, 0.55, 0], arc(0.55, 0.25, 0.25, -90, 90), [0, 0.5]), join([0, 0.5, 0.6, 0.5], arc(0.6, 0.75, 0.25, -90, 90), [0, 1])],
  C: [arc(0.5, 0.5, 0.5, 45, 315)],
  D: [join([0, 0, 0, 1, 0.45, 1], arc(0.45, 0.5, 0.5, 90, -90), [0, 0])],
  E: [[1, 0, 0, 0, 0, 1, 1, 1], [0, 0.5, 0.75, 0.5]],
  F: [[1, 0, 0, 0, 0, 1], [0, 0.5, 0.75, 0.5]],
  G: [join(arc(0.5, 0.5, 0.5, -45, -315), [0.85, 0.55, 0.55, 0.55])],
  H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5]],
  I: [[0.5, 0, 0.5, 1], [0.2, 0, 0.8, 0], [0.2, 1, 0.8, 1]],
  J: [[0.25, 0, 0.9, 0], join([0.7, 0, 0.7, 0.7], arc(0.45, 0.7, 0.25, 0, 180))],
  K: [[0, 0, 0, 1], [0.9, 0, 0, 0.6], [0.3, 0.4, 1, 1]],
  L: [[0, 0, 0, 1, 0.8, 1]],
  M: [[0, 1, 0, 0, 0.5, 0.6, 1, 0, 1, 1]],
  N: [[0, 1, 0, 0, 1, 1, 1, 0]],
  P: [join([0, 1, 0, 0, 0.55, 0], arc(0.55, 0.27, 0.27, -90, 90), [0, 0.54])],
  Q: [circle(0.5, 0.5, 0.5), [0.6, 0.7, 1, 1.05]],
  R: [join([0, 1, 0, 0, 0.55, 0], arc(0.55, 0.27, 0.27, -90, 90), [0, 0.54]), [0.35, 0.54, 0.9, 1]],
  S: [join(arc(0.5, 0.27, 0.27, -30, -270), arc(0.5, 0.73, 0.27, -90, 150))],
  T: [[0, 0, 1, 0], [0.5, 0, 0.5, 1]],
  U: [join([0, 0, 0, 0.55], arc(0.5, 0.55, 0.5, 180, 0), [1, 0])],
  V: [[0, 0, 0.5, 1, 1, 0]],
  W: [[0, 0, 0.25, 1, 0.5, 0.4, 0.75, 1, 1, 0]],
  X: [[0, 0, 1, 1], [1, 0, 0, 1]],
  Y: [[0, 0, 0.5, 0.5, 1, 0], [0.5, 0.5, 0.5, 1]],
  Z: [[0, 0, 1, 0, 0, 1, 1, 1]],
  1: [[0.25, 0.22, 0.55, 0, 0.55, 1], [0.25, 1, 0.85, 1]],
  2: [join(arc(0.5, 0.3, 0.3, 200, 380), [0.1, 1, 0.9, 1])],
  3: [join(arc(0.45, 0.27, 0.25, 200, 450), arc(0.45, 0.75, 0.25, 270, 520))],
  4: [[0.7, 1, 0.7, 0, 0, 0.7, 1, 0.7]],
  5: [join([0.85, 0, 0.22, 0, 0.18, 0.45], arc(0.45, 0.7, 0.3, 225, 495))],
  6: [[0.72, 0, 0.25, 0.55], circle(0.5, 0.7, 0.28)],
  7: [[0, 0, 1, 0, 0.4, 1]],
  8: [circle(0.5, 0.27, 0.23), circle(0.5, 0.73, 0.27)],
  9: [circle(0.5, 0.3, 0.28), [0.78, 0.3, 0.72, 1]],
};

const CHARACTERS = Object.keys(GLYPHS)
  .sort((a, b) => (/\d/.test(a) === /\d/.test(b) ? a.localeCompare(b) : /\d/.test(a) ? 1 : -1))
  .map((c) => ({ name: (/\d/.test(c) ? 'Number ' : 'Letter ') + c, paths: GLYPHS[c] }));

export const SHAPES = [...BASICS, ...PICTURES, ...CHARACTERS];
