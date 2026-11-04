/**
 * The computer opponent for Dots and Boxes (see `bot` in index.js).
 *   easy:   takes a box now and then, otherwise any line.
 *   normal: takes every box it can, and won't draw a box's third side while a safe line is left.
 *   hard:   as Normal, and when every line gives something away it gives away the fewest boxes.
 */
export function dotsBoxesBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !['easy', 'normal', 'hard'].includes(level)) return null;
  const n = view.size;
  const state = { n, h: view.h.map((r) => r.slice()), v: view.v.map((r) => r.slice()) };
  const lines = openLines(state);
  if (!lines.length) return null;
  const pace = 600 + rng() * 800;
  const pick = (l) => ({ type: 'line', dir: l[0], r: l[1], c: l[2], botDelayMs: pace });
  const any = (list) => list[Math.floor(rng() * list.length)];
  const taking = lines.filter((l) => closes(state, l) > 0);
  if (level === 'easy') return pick(taking.length && rng() < 0.5 ? any(taking) : any(lines));
  if (taking.length) return pick(any(taking));
  const safe = lines.filter((l) => !givesThird(state, l));
  if (safe.length) return pick(any(safe));
  if (level === 'normal') return pick(any(lines));
  // Every line hands boxes over: hand over the fewest.
  let best = null;
  let fewest = Infinity;
  for (const l of lines) {
    const given = chainAfter(state, l) + rng() * 0.1;
    if (given < fewest) { fewest = given; best = l; }
  }
  return pick(best);
}

function openLines(s) {
  const out = [];
  s.h.forEach((row, r) => row.forEach((x, c) => { if (x === null) out.push(['h', r, c]); }));
  s.v.forEach((row, r) => row.forEach((x, c) => { if (x === null) out.push(['v', r, c]); }));
  return out;
}

/** The boxes either side of a line. */
function boxesOf(s, [dir, r, c]) {
  const sides = dir === 'h' ? [[r - 1, c], [r, c]] : [[r, c - 1], [r, c]];
  return sides.filter(([br, bc]) => br >= 0 && bc >= 0 && br < s.n && bc < s.n);
}

function sidesDrawn(s, br, bc) {
  return (s.h[br][bc] !== null) + (s.h[br + 1][bc] !== null) + (s.v[br][bc] !== null) + (s.v[br][bc + 1] !== null);
}

/** How many boxes this line would close. */
function closes(s, l) {
  return boxesOf(s, l).filter(([br, bc]) => sidesDrawn(s, br, bc) === 3).length;
}

/** Drawing it makes a box's third side (the rival takes that box). */
function givesThird(s, l) {
  return boxesOf(s, l).some(([br, bc]) => sidesDrawn(s, br, bc) === 2);
}

function set(s, [dir, r, c], v) {
  (dir === 'h' ? s.h : s.v)[r][c] = v;
}

/** After this line, how many boxes the rival can take in a row (greedily). */
function chainAfter(s, l) {
  const t = { n: s.n, h: s.h.map((r) => r.slice()), v: s.v.map((r) => r.slice()) };
  set(t, l, 0);
  let taken = 0;
  for (;;) {
    const grab = openLines(t).find((x) => closes(t, x) > 0);
    if (!grab) return taken;
    taken += closes(t, grab);
    set(t, grab, 1);
  }
}
