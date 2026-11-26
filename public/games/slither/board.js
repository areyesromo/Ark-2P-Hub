// Slitherlink's board, drawn the same way on the TV and the phone as one SVG: the dots, the numbers
// (red when a square has too many lines, faded once it has just enough), the lines drawn, the ✕
// marks, and a wide clear strip over each line to tap. Lines are counted as the server does: the
// across ones row by row, then the down ones.
(function () {
  /** A line's two ends, [x1, y1, x2, y2] in dots. */
  function ends(v, e) {
    const H = v.w * (v.h + 1);
    if (e < H) {
      const y = Math.floor(e / v.w);
      const x = e % v.w;
      return [x, y, x + 1, y];
    }
    const k = e - H;
    const y = Math.floor(k / (v.w + 1));
    const x = k % (v.w + 1);
    return [x, y, x, y + 1];
  }

  function svg(v, opts) {
    const w = v.w;
    const h = v.h;
    const edges = v.marks.length;
    const bad = {};
    v.badCells.forEach(function (c) { bad[c] = true; });
    const badDot = {};
    v.badDots.forEach(function (d) { badDot[d] = true; });
    const H = w * (h + 1);
    const lineOn = function (e) { return v.marks[e] === 1; };
    let out = '<svg class="sl-svg" viewBox="-0.5 -0.5 ' + (w + 1) + ' ' + (h + 1) + '">';
    v.clues.forEach(function (k, c) {
      if (k < 0) return;
      const x = c % w;
      const y = Math.floor(c / w);
      const es = [y * w + x, (y + 1) * w + x, H + y * (w + 1) + x, H + y * (w + 1) + x + 1];
      const on = es.filter(lineOn).length;
      const cls = 'sl-clue' + (bad[c] ? ' bad' : on === k && k > 0 ? ' done' : ''); // (a 0 stays dark: it's "done" from the start)
      out += '<text class="' + cls + '" x="' + (x + 0.5) + '" y="' + (y + 0.53) + '">' + k + '</text>';
    });
    for (let e = 0; e < edges; e++) {
      const p = ends(v, e);
      const m = v.marks[e];
      let cls = 'sl-line';
      if (v.hint === e && v.phase === 'play') cls += ' hint';
      if (m === 1) out += '<line class="' + cls + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '"/>';
      else if (m === 2) {
        const cx = (p[0] + p[2]) / 2;
        const cy = (p[1] + p[3]) / 2;
        out += '<path class="sl-cross" d="M' + (cx - 0.1) + ' ' + (cy - 0.1) + 'l0.2 0.2m0 -0.2l-0.2 0.2"/>';
      }
      if (opts && opts.cursor === e) out += '<line class="sl-cursor" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '"/>';
      out += '<line class="sl-hit" data-e="' + e + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + p[2] + '" y2="' + p[3] + '"/>';
    }
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x <= w; x++) out += '<circle class="sl-dot' + (badDot[y * (w + 1) + x] ? ' bad' : '') + '" cx="' + x + '" cy="' + y + '" r="0.09"/>';
    }
    return out + '</svg>';
  }

  /** The line nearest that way from line e (for a controller's cursor), or e. */
  function step(v, e, dx, dy) {
    const p = ends(v, e);
    const mx = (p[0] + p[2]) / 2;
    const my = (p[1] + p[3]) / 2;
    let best = e;
    let bestD = Infinity;
    for (let f = 0; f < v.marks.length; f++) {
      const q = ends(v, f);
      const x = (q[0] + q[2]) / 2 - mx;
      const y = (q[1] + q[3]) / 2 - my;
      const along = x * dx + y * dy;
      if (along <= 0.01) continue;
      const d = along + 2 * Math.abs(x * dy + y * dx);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  window.ArkSlither = { svg: svg, step: step };
})();
