// Hashi's boards (Bridges): islands on a grid, each with a number. Join them with bridges, straight
// across or down, one or two between the same pair, never crossing another bridge or passing over an
// island, so each island has as many bridges as its number and every island is joined up.
//
// How a board is made: islands are grown from one, each new one a few squares straight out from an
// island already placed, joined to it by a bridge (one or two) over empty water; now and then two
// islands that see each other get a bridge too. The numbers are the bridges each ends up with.
// Then a solver checks there's exactly one way to bridge it, found by reasoning alone (never by
// trying a bridge both ways); other boards are thrown away.

/** Pairs of islands that could be bridged: each island's nearest neighbour across and down. */
export function pairsOf(w, h, islands) {
  const at = new Map(islands.map((c, k) => [c, k]));
  const pairs = [];
  islands.forEach((c, k) => {
    const x = c % w;
    const y = Math.floor(c / w);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const cells = [];
      for (let s = 1; ; s++) {
        const xx = x + dx * s;
        const yy = y + dy * s;
        if (xx >= w || yy >= h) break;
        const j = yy * w + xx;
        if (at.has(j)) {
          if (cells.length) pairs.push({ a: k, b: at.get(j), cells, across: dx === 1 });
          break;
        }
        cells.push(j);
      }
    }
  });
  // Which pairs cross (their bridges would share a square of water).
  const over = new Map();
  pairs.forEach((p, i) => p.cells.forEach((c) => (over.get(c) || over.set(c, []).get(c)).push(i)));
  pairs.forEach((p, i) => {
    p.crosses = [];
    for (const c of p.cells) for (const j of over.get(c)) if (j !== i && !p.crosses.includes(j)) p.crosses.push(j);
  });
  return pairs;
}

/**
 * The answers to a board, up to `limit` (each a list of bridges per pair, 0 to 2). It keeps, for each
 * pair, the fewest and most bridges still possible, tightens them from the islands' numbers and the
 * crossings, and tries both ways on a pair only when that runs out; every island must be joined up.
 */
export function solveBridges(islands, numbers, pairs, limit = 2, stats = null) {
  const n = islands.length;
  const touching = Array.from({ length: n }, () => []);
  pairs.forEach((p, i) => { touching[p.a].push(i); touching[p.b].push(i); });
  const found = [];
  const joined = (hi) => {
    // Every island reachable from the first along pairs that may still have a bridge.
    const seen = new Uint8Array(n);
    const stack = [0];
    seen[0] = 1;
    let count = 1;
    while (stack.length) {
      const k = stack.pop();
      for (const i of touching[k]) {
        if (!hi[i]) continue;
        const o = pairs[i].a === k ? pairs[i].b : pairs[i].a;
        if (!seen[o]) { seen[o] = 1; count++; stack.push(o); }
      }
    }
    return count === n;
  };
  const tighten = (lo, hi) => {
    for (let changed = true; changed;) {
      changed = false;
      for (let i = 0; i < pairs.length; i++) {
        if (lo[i] > 0) for (const j of pairs[i].crosses) if (hi[j] > 0) { if (lo[j] > 0) return false; hi[j] = 0; changed = true; }
      }
      for (let k = 0; k < n; k++) {
        let sumLo = 0;
        let sumHi = 0;
        for (const i of touching[k]) { sumLo += lo[i]; sumHi += hi[i]; }
        if (sumLo > numbers[k] || sumHi < numbers[k]) return false;
        for (const i of touching[k]) {
          const up = Math.min(hi[i], numbers[k] - (sumLo - lo[i]));
          const down = Math.max(lo[i], numbers[k] - (sumHi - hi[i]));
          if (down > up) return false;
          if (up !== hi[i] || down !== lo[i]) { hi[i] = up; lo[i] = down; changed = true; }
        }
      }
    }
    return true;
  };
  const go = (lo, hi) => {
    if (found.length >= limit) return;
    if (!tighten(lo, hi) || !joined(hi)) return;
    // The pair still open whose ends have the least room, tried each way.
    let pick = -1;
    for (let i = 0; i < pairs.length; i++) if (lo[i] < hi[i]) { pick = i; break; }
    if (pick < 0) {
      found.push(lo.slice());
      return;
    }
    if (stats) stats.guesses++;
    for (let v = hi[pick]; v >= lo[pick]; v--) {
      const l = lo.slice();
      const h = hi.slice();
      l[pick] = h[pick] = v;
      go(l, h);
      if (found.length >= limit) return;
    }
  };
  const lo = pairs.map(() => 0);
  const hi = pairs.map((p) => Math.min(2, numbers[p.a], numbers[p.b]));
  go(lo, hi);
  return found;
}

/**
 * A board with one answer, or null: { w, h, islands (squares), numbers, answer: [{ a, b, n }] }.
 * count: how many islands to try for.
 */
export function makeBoard(w, h, count, rng) {
  const size = w * h;
  const island = new Int16Array(size).fill(-1);
  const water = new Uint8Array(size); // a bridge runs over it
  const islands = [];
  const bridges = []; // [a, b, n, cells]
  const place = (c) => { island[c] = islands.length; islands.push(c); };
  const near = (c) => {
    // No island right next to another (it reads badly and makes ambiguous boards).
    const x = c % w;
    const y = Math.floor(c / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && island[yy * w + xx] >= 0) return true;
    }
    return false;
  };
  place(Math.floor(rng() * h) * w + Math.floor(rng() * w));
  for (let tries = 0; islands.length < count && tries < count * 60; tries++) {
    const from = islands[Math.floor(rng() * islands.length)];
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rng() * 4)];
    const dist = 2 + Math.floor(rng() * 4);
    const x = (from % w) + dx * dist;
    const y = Math.floor(from / w) + dy * dist;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const to = y * w + x;
    if (island[to] >= 0 || water[to] || near(to)) continue;
    const cells = [];
    let clear = true;
    for (let s = 1; s < dist; s++) {
      const c = (Math.floor(from / w) + dy * s) * w + (from % w) + dx * s;
      if (island[c] >= 0 || water[c]) { clear = false; break; }
      cells.push(c);
    }
    if (!clear) continue;
    place(to);
    cells.forEach((c) => (water[c] = 1));
    bridges.push([island[from], island[to], rng() < 0.4 ? 2 : 1, cells]);
  }
  // A few more bridges between islands already in sight of each other (loops make it richer).
  const pairs = pairsOf(w, h, islands);
  for (const p of pairs) {
    if (rng() > 0.25) continue;
    if (bridges.some(([a, b]) => (a === p.a && b === p.b) || (a === p.b && b === p.a))) continue;
    if (p.cells.some((c) => water[c])) continue;
    p.cells.forEach((c) => (water[c] = 1));
    bridges.push([p.a, p.b, rng() < 0.3 ? 2 : 1, p.cells]);
  }
  const numbers = islands.map(() => 0);
  for (const [a, b, k] of bridges) { numbers[a] += k; numbers[b] += k; }
  const stats = { guesses: 0 };
  const answers = solveBridges(islands, numbers, pairs, 2, stats);
  // (one answer, and found by reasoning alone: the solver never had to try a pair both ways)
  if (answers.length !== 1 || stats.guesses) return null;
  const answer = pairs.map((p, i) => ({ a: p.a, b: p.b, n: answers[0][i] })).filter((x) => x.n);
  return { w, h, islands, numbers, answer };
}

/** A fair board, trying again until makeBoard finds one (a few milliseconds even at 13 × 13). */
export function makeFair(w, h, count, rng) {
  for (let tries = 0; tries < 500; tries++) {
    const b = makeBoard(w, h, count, rng);
    if (b) return b;
  }
  return makeFair(w, h, count - 1, rng);
}
