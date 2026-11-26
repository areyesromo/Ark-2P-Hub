// Bridges' board (Hashi), drawn the same way on the TV and the phone as one SVG: the sea, the
// bridges (one line or two) and the islands with their numbers, green once they have just enough
// bridges and red with too many. Also finds the island under a point, and an island's neighbour
// that way (for a controller).
(function () {
  function svg(v, opts) {
    const w = v.w;
    const h = v.h;
    const at = function (k) { return [(v.islands[k] % w) + 0.5, Math.floor(v.islands[k] / w) + 0.5]; };
    let out = '<svg class="hs-svg" viewBox="0 0 ' + w + ' ' + h + '">';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out += '<circle class="hs-dot" cx="' + (x + 0.5) + '" cy="' + (y + 0.5) + '" r="0.035"/>';
    v.pairs.forEach(function (p, i) {
      const n = v.bridges[i];
      if (!n) return;
      const a = at(p[0]);
      const b = at(p[1]);
      const across = a[1] === b[1];
      const cls = 'hs-bridge' + (v.hint === i && v.phase === 'play' ? ' hint' : '');
      const offs = n === 1 ? [0] : [-0.11, 0.11];
      offs.forEach(function (o) {
        out += '<line class="' + cls + '" x1="' + (a[0] + (across ? 0 : o)) + '" y1="' + (a[1] + (across ? o : 0)) + '" x2="' + (b[0] + (across ? 0 : o)) + '" y2="' + (b[1] + (across ? o : 0)) + '"/>';
      });
    });
    if (opts && opts.drag) {
      const a = at(opts.drag.from);
      out += '<line class="hs-drag" x1="' + a[0] + '" y1="' + a[1] + '" x2="' + opts.drag.x + '" y2="' + opts.drag.y + '"/>';
    }
    v.islands.forEach(function (c, k) {
      const p = at(k);
      const have = v.counts[k];
      const need = v.numbers[k];
      let cls = 'hs-island' + (have === need ? ' done' : have > need ? ' over' : '');
      if (opts && opts.picked === k) cls += ' picked';
      if (opts && opts.cursor === k) cls += ' cursor';
      out += '<g class="' + cls + '" data-k="' + k + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="0.38"/><text x="' + p[0] + '" y="' + (p[1] + 0.02) + '">' + need + '</text></g>';
    });
    return out + '</svg>';
  }

  /** The island at board point (x, y), or null (within its circle and a bit). */
  function islandAt(v, x, y) {
    let best = null;
    let bestD = 0.5;
    v.islands.forEach(function (c, k) {
      const d = Math.hypot((c % v.w) + 0.5 - x, Math.floor(c / v.w) + 0.5 - y);
      if (d < bestD) { bestD = d; best = k; }
    });
    return best;
  }

  /** The island paired with k in a direction (dx, dy), or null. */
  function neighbour(v, k, dx, dy) {
    const kx = v.islands[k] % v.w;
    const ky = Math.floor(v.islands[k] / v.w);
    let out = null;
    v.pairs.forEach(function (p) {
      if (p[0] !== k && p[1] !== k) return;
      const o = p[0] === k ? p[1] : p[0];
      const ox = v.islands[o] % v.w;
      const oy = Math.floor(v.islands[o] / v.w);
      if (Math.sign(ox - kx) === dx && Math.sign(oy - ky) === dy) out = o;
    });
    return out;
  }

  /** The nearest island roughly that way from k (for moving a controller's cursor), or k. */
  function step(v, k, dx, dy) {
    const kx = v.islands[k] % v.w;
    const ky = Math.floor(v.islands[k] / v.w);
    let best = k;
    let bestD = Infinity;
    v.islands.forEach(function (c, j) {
      const x = c % v.w - kx;
      const y = Math.floor(c / v.w) - ky;
      const along = x * dx + y * dy;
      if (along <= 0) return;
      const d = along + 2 * Math.abs(x * dy + y * dx);
      if (d < bestD) { bestD = d; best = j; }
    });
    return best;
  }

  window.ArkHashi = { svg: svg, islandAt: islandAt, neighbour: neighbour, step: step };
})();
