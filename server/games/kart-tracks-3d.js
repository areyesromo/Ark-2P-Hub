// Kart Race 3D's big tracks: a road 12 wide (room for the whole pack side by side) on a 288 x 162
// field (Kart Race's are 3.4 on 32 x 18), laps of 45-60 s at top speed. Laid out like Kart Race's: a
// closed loop of control points (see public/games/kart-race/track.js), the start line at the first
// point. Each also sets its coins and boost pads ([fraction of the lap, offset]); its ? box rows come
// every 60 units of lap (rowEvery), five boxes across, the middle one a double.

// A grid for a pack of eight (rows 5 apart, 2.5 either side of the middle), computer racers in lanes
// a third of the road either side, and records of their own (the tracks were smaller before 0.1.38).
const BIG = { width: 12, field: { w: 288, h: 162 }, rowEvery: 60, boxOffsets: [-4, -2, 0, 2, 4], grid: { rowGap: 5, side: 2.5 }, lanes: [-4.1, 0, 4.1] };

/** A layout drawn across a 128 x 72 field, shrunk by `k` round its middle (the shapes as they were). */
const around = (points, k) => points.map(([x, y]) => [64 + (x - 64) * k, 36 + (y - 36) * k]);

/** …then grown by `size` round the middle of the 288 x 162 field: a lap of 45-60 s at top speed. */
const scaled = (points, size) => points.map(([x, y]) => [144 + (x - 64) * size, 81 + (y - 36) * size]);

export const TRACKS_3D = [
  {
    ...BIG,
    name: 'Sunset Canyon Rally',
    // From the concept art's top-down map: the start on the bottom straight heading west, the
    // Festival Paddock corner, up to the Arch Sweep, the S-bends past the dam, down through the
    // Mining Cut and back along the bottom.
    // The grid is at the far end of the bottom straight, so a pack spreads out before the paddock corner.
    size: 2.25,
    points: scaled(around([[84.3, 61.3], [61.3, 61.3], [36, 61.3], [17.6, 59.8], [13.4, 46], [15.3, 30.6], [23, 23.7], [33, 23], [42.9, 25.3], [53.6, 24.5], [62.8, 16.9], [72.8, 10], [88, 8.4], [101.9, 10.7], [107.2, 21.4], [103.4, 32.2], [99.6, 39.8], [107.2, 44.4], [110.3, 53.6], [107.2, 60.5]], 0.72), 2.25),
    coins: 137,
    boosts: [[0.3, 0], [0.85, 0], [0.18, 0]], // (the last on its longest straight)
    scenery: 'canyon', // red rock cliffs and mesas, a dam, the festival paddock (public/games/kart-race-3d/canyon3d.js)
    features: { arches: [0.396, 0.85] }, // the Arch Sweep and the Mining Cut, where the road runs under rock
  },
  {
    ...BIG,
    name: 'Speedway Oval',
    // Speedway's oval, with a chicane on the top straight to break up the pack.
    // The grid is on the bottom straight (heading west), not on a bend.
    size: 2.25,
    points: scaled(around([[64, 60], [28, 56], [20, 36], [28, 16], [50, 12], [58, 18], [66, 12], [100, 16], [108, 36], [100, 56]], 0.84), 2.25),
    coins: 151,
    boosts: [[0.24, 0], [0.74, 0], [0.577, 0]], // (the last on its longest straight)
  },
  {
    ...BIG,
    name: 'Grand Prix Circuit',
    // A long back straight, a chicane on the right (gentler than Grand Prix's: a pack takes it
    // side by side) and a wiggle along the bottom.
    // The grid is on the top straight.
    size: 2.25,
    points: scaled(around([[68, 18], [88, 12], [112, 16], [114, 34], [106, 41], [112, 58], [80, 60], [56, 52], [32, 60], [14, 52], [18, 34], [14, 16], [40, 12], [54, 14.8]], 0.62), 2.25),
    coins: 124,
    boosts: [[0.95, 0], [0.48, 0], [0.393, 0]], // (the last on its longest straight)
  },
  {
    ...BIG,
    name: 'Serpent Pass',
    // Serpent's loop, with one more wiggle on the top run.
    // The grid on the gentlest stretch of the top run (it's wiggles all the way round).
    size: 2.15,
    points: scaled(around([[56, 20], [72, 12], [84, 19], [96, 12], [112, 24], [108, 48], [88, 60], [68, 52], [48, 60], [24, 56], [12, 40], [16, 20], [36, 12]], 0.85), 2.15),
    coins: 163,
    boosts: [[0.33, 0], [0.83, 0], [0.96, 0]], // (the last on its longest straight)
  },
  {
    ...BIG,
    name: 'Zigzag Ridge',
    // Saw teeth along the top (shallower than Zigzag's, to take at speed), a fast run back along the bottom.
    // The start is on the long bottom run (heading west), not by a corner.
    size: 2.4,
    points: scaled(around([[64, 60], [14, 58], [14, 36], [14, 14], [34, 12], [48, 22], [62, 12], [76, 12], [90, 22], [104, 12], [114, 16], [114, 58]], 0.56), 2.4),
    coins: 144,
    boosts: [[0.67, 0], [0.95, 0], [0.267, 0]], // (the last on its longest straight)
  },
].map((t) => ({ ...t, recordName: t.name + ' (wide)' }));
