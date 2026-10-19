// Kart Race track geometry, shared by the server (imported for its side effect) and the screens
// (a plain <script>): both build the same centre line from a track's control points, so a 2D or
// 3D view draws exactly the road the server drives on. Sets globalThis.ArkKartTrack.
(function () {
  const SAMPLES = 240; // points on each track's centre line
  const MIN_RADIUS = 1.7; // no corner tighter than this (a kart at medium speed turns about 1.5)

  /** A closed centripetal Catmull-Rom curve through the points (no cusps or spikes), `perSeg` points per span. */
  function spline(points, perSeg) {
    const m = points.length;
    const out = [];
    const lerp = function (a, b, ta, tb, u) {
      return [((tb - u) * a[0] + (u - ta) * b[0]) / (tb - ta), ((tb - u) * a[1] + (u - ta) * b[1]) / (tb - ta)];
    };
    for (let k = 0; k < m; k++) {
      const P = [points[(k - 1 + m) % m], points[k], points[(k + 1) % m], points[(k + 2) % m]];
      const t = [0];
      for (let i = 1; i < 4; i++) t.push(t[i - 1] + Math.sqrt(Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])) + 1e-6);
      for (let s = 0; s < perSeg; s++) {
        const u = t[1] + ((t[2] - t[1]) * s) / perSeg;
        const A1 = lerp(P[0], P[1], t[0], t[1], u);
        const A2 = lerp(P[1], P[2], t[1], t[2], u);
        const A3 = lerp(P[2], P[3], t[2], t[3], u);
        out.push(lerp(lerp(A1, A2, t[0], t[2], u), lerp(A2, A3, t[1], t[3], u), t[1], t[2], u));
      }
    }
    return out;
  }

  /** `n` points evenly spaced along a closed line. */
  function resample(line, n) {
    const cum = [0];
    for (let i = 1; i <= line.length; i++) {
      const a = line[i - 1];
      const b = line[i % line.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const total = cum[line.length];
    const out = [];
    let j = 0;
    for (let i = 0; i < n; i++) {
      const s = (i / n) * total;
      while (cum[j + 1] < s) j++;
      const a = line[j];
      const b = line[(j + 1) % line.length];
      const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
    return out;
  }

  /** The radius of the bend at sample i (through its neighbours `w` samples either side). */
  function radiusAt(line, i, w) {
    w = w || 3;
    const n = line.length;
    const a = line[(i - w + n) % n];
    const b = line[i];
    const c = line[(i + w) % n];
    const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
    if (area < 1e-9) return Infinity;
    return (Math.hypot(b[0] - a[0], b[1] - a[1]) * Math.hypot(c[0] - b[0], c[1] - b[1]) * Math.hypot(a[0] - c[0], a[1] - c[1])) / (4 * area);
  }

  /**
   * The centre line: a smooth curve through the control points, evenly spaced, with any bend
   * tighter than MIN_RADIUS eased out (smoothed just there, a little at a time).
   */
  function centreLine(points, n) {
    n = n || SAMPLES;
    let line = resample(spline(points, 24), n);
    for (let pass = 0; pass < 150; pass++) {
      const tight = line.map(function (_, i) { return radiusAt(line, i) < MIN_RADIUS; });
      if (tight.indexOf(true) === -1) break;
      line = resample(line.map(function (p, i) {
        let near = false;
        for (let d = -4; d <= 4; d++) if (tight[(i + d + n) % n]) near = true;
        if (!near) return p;
        const a = line[(i - 1 + n) % n];
        const b = line[(i + 1) % n];
        return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4];
      }), n);
    }
    return line;
  }

  /** The tightest bend of a line: { r, x, y }. */
  function tightest(line) {
    let best = { r: Infinity, x: 0, y: 0 };
    for (let i = 0; i < line.length; i++) {
      const r = radiusAt(line, i);
      if (r < best.r) best = { r: r, x: line[i][0], y: line[i][1] };
    }
    return best;
  }

  /** Everything about a track's road: the centre line and its cumulative length. */
  function build(points) {
    const line = centreLine(points);
    const cum = [0];
    for (let i = 1; i <= line.length; i++) {
      const a = line[i - 1];
      const b = line[i % line.length];
      cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    return { line: line, cum: cum, length: cum[line.length] };
  }

  /**
   * Where a point is relative to the road: progress `s` 0..1 along the lap, distance `d` from
   * the centre line, and the nearest point on it (px, py).
   */
  function locate(road, x, y) {
    const line = road.line;
    let best = { d: Infinity, s: 0, i: 0, px: 0, py: 0 };
    for (let i = 0; i < line.length; i++) {
      const a = line[i];
      const b = line[(i + 1) % line.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2));
      const px = a[0] + t * dx;
      const py = a[1] + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < best.d) best = { d: d, s: (road.cum[i] + t * Math.sqrt(len2)) / road.length, i: i, px: px, py: py };
    }
    return best;
  }

  /** A point on the centre line at progress p (0..1), with the direction of travel, shifted sideways by `offset`. */
  function pointAt(road, p, offset) {
    offset = offset || 0;
    const line = road.line;
    const cum = road.cum;
    const s = (((p % 1) + 1) % 1) * road.length;
    let i = 0;
    while (i < line.length - 1 && cum[i + 1] < s) i++;
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const seg = cum[i + 1] - cum[i] || 1;
    const t = (s - cum[i]) / seg;
    const dx = (b[0] - a[0]) / seg;
    const dy = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t - dy * offset, y: a[1] + (b[1] - a[1]) * t + dx * offset, angle: Math.atan2(dy, dx) };
  }

  /** The centre line shifted sideways by `offset` (+ right of the direction of travel): a road edge or wall. */
  function outline(line, offset) {
    const n = line.length;
    return line.map(function (p, i) {
      const a = line[(i - 1 + n) % n];
      const b = line[(i + 1) % n];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [p[0] - ((b[1] - a[1]) / len) * offset, p[1] + ((b[0] - a[0]) / len) * offset];
    });
  }

  /** An SVG path (closed) through a line's points, for previews. */
  function svgPath(line) {
    return line.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('') + 'Z';
  }

  globalThis.ArkKartTrack = { SAMPLES: SAMPLES, MIN_RADIUS: MIN_RADIUS, centreLine: centreLine, tightest: tightest, build: build, locate: locate, pointAt: pointAt, outline: outline, svgPath: svgPath };
})();
