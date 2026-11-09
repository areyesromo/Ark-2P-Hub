// Kart Race 3D's big tracks: a road 7 wide on a 128 x 72 field (Kart Race's are 3.4 on 32 x 18),
// laps of about 40-60 s, room for a pack of eight. Laid out like Kart Race's: a closed loop of
// control points (see public/games/kart-race/track.js), the start line at the first point. Each also
// sets its ? box rows (about every 60 units of lap, as fractions of the lap), five boxes across
// (the middle one a double), its coins and its boost pads ([fraction of the lap, offset]).

const BIG = { width: 7, field: { w: 128, h: 72 }, boxOffsets: [-2.4, -1.2, 0, 1.2, 2.4] };

/** A layout drawn across the whole field, shrunk by `k` round its middle to bring a lap to 40-60 s. */
const around = (points, k) => points.map(([x, y]) => [64 + (x - 64) * k, 36 + (y - 36) * k]);

export const TRACKS_3D = [
  {
    ...BIG,
    name: 'Sunset Canyon Rally',
    // From the concept art's top-down map: the start on the bottom straight heading west, the
    // Festival Paddock corner, up to the Arch Sweep, the S-bends past the dam, down through the
    // Mining Cut and back along the bottom.
    // The grid is at the far end of the bottom straight, so a pack spreads out before the paddock corner.
    points: around([[84.3, 61.3], [61.3, 61.3], [36, 61.3], [17.6, 59.8], [13.4, 46], [15.3, 30.6], [23, 23.7], [33, 23], [42.9, 25.3], [53.6, 24.5], [62.8, 16.9], [72.8, 10], [88, 8.4], [101.9, 10.7], [107.2, 21.4], [103.4, 32.2], [99.6, 39.8], [107.2, 44.4], [110.3, 53.6], [107.2, 60.5]], 0.72),
    rows: [0.15, 0.42, 0.6, 0.78],
    coins: 61,
    boosts: [[0.3, 0], [0.85, 0]],
    features: { arches: [0.396, 0.85] }, // the Arch Sweep and the Mining Cut, where the road runs under rock (scenery: PR 4)
  },
  {
    ...BIG,
    name: 'Speedway Oval',
    // Speedway's oval, with a chicane on the top straight to break up the pack.
    points: [[20, 36], [28, 16], [50, 12], [58, 18], [66, 12], [100, 16], [108, 36], [100, 56], [64, 60], [28, 56]],
    rows: [0.12, 0.38, 0.6, 0.88],
    coins: 67,
    boosts: [[0.24, 0], [0.74, 0]],
  },
  {
    ...BIG,
    name: 'Grand Prix Circuit',
    // A long back straight, a chicane on the right (gentler than Grand Prix's: a pack takes it
    // side by side) and a wiggle along the bottom.
    points: around([[54, 14.8], [68, 18], [88, 12], [112, 16], [114, 34], [106, 41], [112, 58], [80, 60], [56, 52], [32, 60], [14, 52], [18, 34], [14, 16], [40, 12]], 0.62),
    rows: [0.2, 0.4, 0.7],
    coins: 55,
    boosts: [[0.95, 0], [0.48, 0]],
  },
  {
    ...BIG,
    name: 'Serpent Pass',
    // Serpent's loop, with one more wiggle on the top run.
    points: around([[16, 20], [36, 12], [56, 20], [72, 12], [84, 19], [96, 12], [112, 24], [108, 48], [88, 60], [68, 52], [48, 60], [24, 56], [12, 40]], 0.85),
    rows: [0.15, 0.45, 0.62, 0.92],
    coins: 76,
    boosts: [[0.33, 0], [0.83, 0]],
  },
  {
    ...BIG,
    name: 'Zigzag Ridge',
    // Saw teeth along the top (shallower than Zigzag's, to take at speed), a fast run back along the bottom.
    // The start is on the long bottom run (heading west), not by a corner.
    points: around([[64, 60], [14, 58], [14, 36], [14, 14], [34, 12], [48, 22], [62, 12], [76, 12], [90, 22], [104, 12], [114, 16], [114, 58]], 0.56),
    rows: [0.2, 0.45, 0.8],
    coins: 60,
    boosts: [[0.67, 0], [0.95, 0]],
  },
];
