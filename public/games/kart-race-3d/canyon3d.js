// Sunset Canyon Rally's scenery for Kart Race 3D: red rock cliffs round the field, a mesa and boulders
// in the infield, two rock arches over the road (the Arch Sweep and the Mining Cut), a dam in the
// distance and the festival paddock by the start. Scenery only: nothing stands on the road or its
// barriers, and the karts never touch any of it.
// Two halves: layout(view) decides what goes where (the same on every TV, kept clear of the road),
// and build(THREE, view) makes it from the PIECES factories. A piece can later be swapped for a
// ComfyUI model by replacing its factory; the layout stays.
// KRCanyon.layout(view) -> { rocks, arches, dam, paddock } | null; KRCanyon.build(THREE, view) -> { group, dispose() } | null.
(function () {
  const SEED = 20261108;
  const ROCK_GAP = 3; // rocks keep this far outside the barriers
  const ARCH = { clear: 7, legR: 2.5, legGap: 1, legClear: 0.5, grow: 6, slide: 0.03, slideStep: 0.002 }; // clear: the underside's height, above the chase camera
  const CLIFF = { out: 1, step: 7, r: [5, 8], h: [9, 16] };
  const BOULDERS = { max: 36, grid: 4, r: [1, 3], h: [1, 4] };
  const MESA = { maxR: 14, h: 8 };
  const DAM = { y: -30, w: 56, h: 22 };
  // The paddock along the first stretch after the line, outside the loop: [kind, distance along the road, offset].
  const PADDOCK = [['tent', 8, 10], ['canopy', 14, 10.5], ['tent', 20, 9.5], ['tent', 26, 10]];
  const FLAGS = { from: 4, to: 30, every: 3, offset: 6.5 };

  /** A small seeded random generator (mulberry32): every TV draws the same canyon. */
  function random(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** The distance from (x, y) to the nearest point of the road's centre line (every stretch of it). */
  function clearance(road, x, y) {
    let best = Infinity;
    const l = road.line;
    for (let i = 0; i < l.length; i++) {
      const d = (l[i][0] - x) * (l[i][0] - x) + (l[i][1] - y) * (l[i][1] - y);
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /** Is (x, y) inside the loop the centre line draws? */
  function inside(road, x, y) {
    let hit = false;
    const l = road.line;
    for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
      if ((l[i][1] > y) !== (l[j][1] > y) && x < ((l[j][0] - l[i][0]) * (y - l[i][1])) / (l[j][1] - l[i][1]) + l[i][0]) hit = !hit;
    }
    return hit;
  }

  const between = function (rnd, range) { return range[0] + rnd() * (range[1] - range[0]); };

  /** Cliffs in a ring just outside the field's edge, each wholly outside it. */
  function cliffs(f, rnd) {
    const out = [];
    const edge = function (x0, y0, x1, y1, nx, ny) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d <= len; d += CLIFF.step) {
        const r = between(rnd, CLIFF.r);
        const t = d / len;
        const push = r + CLIFF.out;
        out.push({ kind: 'cliff', x: x0 + (x1 - x0) * t + nx * push, y: y0 + (y1 - y0) * t + ny * push, r: r, h: between(rnd, CLIFF.h) });
      }
    };
    edge(0, 0, f.w, 0, 0, -1);
    edge(f.w, 0, f.w, f.h, 1, 0);
    edge(f.w, f.h, 0, f.h, 0, 1);
    edge(0, f.h, 0, 0, -1, 0);
    return out;
  }

  /** The festival paddock: tents, a canopy and flags beside the first stretch after the line, outside the loop. */
  function paddock(road) {
    const Road = window.ArkKartTrack;
    const at = function (d, off) { return Road.pointAt(road, d / road.length, off); };
    const mid = at(PADDOCK[1][1], PADDOCK[1][2]);
    const side = inside(road, mid.x, mid.y) ? -1 : 1;
    const out = PADDOCK.map(function (p) {
      const q = at(p[1], p[2] * side);
      return { kind: p[0], x: q.x, y: q.y, angle: q.angle };
    });
    for (let d = FLAGS.from; d <= FLAGS.to; d += FLAGS.every) {
      const q = at(d, FLAGS.offset * side);
      out.push({ kind: 'flag', x: q.x, y: q.y, angle: q.angle });
    }
    return out;
  }

  /**
   * An arch over the road near lap fraction p: its legs as close to the barriers as every stretch
   * allows. Where another stretch runs close (a hairpin), the arch slides along the lap (at most
   * `slide` either way) to the nearest spot where both legs fit.
   */
  function arch(road, p, keep) {
    const fits = function (q, inner) {
      const o = inner / 2 + ARCH.legR;
      return [-1, 1].every(function (s) {
        const x = q.x - Math.sin(q.angle) * o * s;
        const y = q.y + Math.cos(q.angle) * o * s;
        return clearance(road, x, y) >= keep + ARCH.legClear + ARCH.legR;
      });
    };
    const least = 2 * (keep + ARCH.legGap);
    for (let k = 0; k <= ARCH.slide / ARCH.slideStep; k++) {
      for (const dir of k ? [1, -1] : [1]) {
        const q = window.ArkKartTrack.pointAt(road, p + dir * k * ARCH.slideStep, 0);
        for (let inner = least; inner <= least + 2 * ARCH.grow; inner += 0.5) {
          if (fits(q, inner)) return { x: q.x, y: q.y, angle: q.angle, inner: inner, clear: ARCH.clear, legR: ARCH.legR };
        }
      }
    }
    return null; // nowhere fits: no arch rather than one standing on the road
  }

  function layout(view) {
    const scenery = view.track && view.track.scenery;
    if (!scenery || scenery.kind !== 'canyon') return null;
    const Road = window.ArkKartTrack;
    const road = Road.build(view.track.points);
    const f = view.field;
    const keep = view.trackWidth / 2 + view.wallOut; // the road and its barriers
    const rnd = random(SEED);
    const rocks = cliffs(f, rnd);
    const pad = paddock(road);

    // The mesa: the most open spot inside the loop.
    let best = null;
    for (let x = 2; x < f.w; x += 2) {
      for (let y = 2; y < f.h; y += 2) {
        if (!inside(road, x, y)) continue;
        const c = clearance(road, x, y);
        if (!best || c > best.c) best = { x: x, y: y, c: c };
      }
    }
    const placed = [];
    if (best && best.c - keep - ROCK_GAP > 1) {
      const mesa = { kind: 'mesa', x: best.x, y: best.y, r: Math.min(MESA.maxR, best.c - keep - ROCK_GAP), h: MESA.h };
      rocks.push(mesa);
      placed.push(mesa);
    }

    // Boulders on a jittered grid, in a seeded order, clear of the road, the paddock and each other.
    const spots = [];
    for (let x = BOULDERS.grid / 2; x < f.w; x += BOULDERS.grid) {
      for (let y = BOULDERS.grid / 2; y < f.h; y += BOULDERS.grid) spots.push([x + (rnd() - 0.5) * 3, y + (rnd() - 0.5) * 3]);
    }
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = spots[i];
      spots[i] = spots[j];
      spots[j] = t;
    }
    let boulders = 0;
    for (let i = 0; i < spots.length && boulders < BOULDERS.max; i++) {
      const x = spots[i][0];
      const y = spots[i][1];
      const r = between(rnd, BOULDERS.r);
      const h = between(rnd, BOULDERS.h);
      if (x - r < 0.5 || y - r < 0.5 || x + r > f.w - 0.5 || y + r > f.h - 0.5) continue;
      if (clearance(road, x, y) < keep + ROCK_GAP + r) continue;
      if (pad.some(function (p) { return Math.hypot(p.x - x, p.y - y) < ROCK_GAP + r; })) continue;
      if (placed.some(function (o) { return Math.hypot(o.x - x, o.y - y) < o.r + r + 1; })) continue;
      const b = { kind: 'boulder', x: x, y: y, r: r, h: h };
      rocks.push(b);
      placed.push(b);
      boulders++;
    }

    return {
      rocks: rocks,
      arches: (scenery.arches || []).map(function (p) { return arch(road, p, keep); }).filter(Boolean),
      dam: { x: f.w / 2, y: DAM.y, w: DAM.w, h: DAM.h },
      paddock: pad,
    };
  }

  window.KRCanyon = { layout: layout };
})();
