// Traffic Jam's car park, drawn the same way on the TV and the phone: the tarmac, the gap in the
// right-hand wall on the exit row, and each car or truck placed by its squares. Also how far a
// vehicle can slide, worked out from the view (the phone shows a drag before the server hears it).
(function () {
  // The vehicles' paint (the red car keeps red: it's the one to get out).
  const PAINT = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#14b8a6', '#ec4899', '#84cc16', '#f97316', '#06b6d4', '#eab308', '#8b5cf6', '#10b981', '#64748b', '#d946ef', '#0ea5e9', '#facc15', '#4ade80'];

  function paintOf(car, i) {
    return car.id === 'r' ? '#e11d48' : PAINT[(i - 1) % PAINT.length];
  }

  /** The vehicles as HTML. opts: { cursor: square, grabbed: vehicle, ghost: its place while grabbed }. */
  function html(v, opts) {
    const n = v.size;
    let out = '<div class="tj-exit" style="top:' + (v.exitRow / n) * 100 + '%;height:' + 100 / n + '%"></div>';
    v.cars.forEach(function (c, i) {
      let x = c.x;
      let y = c.y;
      if (opts && opts.grabbed === i) { if (c.across) x = opts.ghost; else y = opts.ghost; }
      const w = c.across ? c.len : 1;
      const h = c.across ? 1 : c.len;
      let cls = 'tj-car ' + (c.across ? 'across' : 'down') + (c.len === 3 ? ' truck' : '') + (c.id === 'r' ? ' red' : '');
      if (v.hint === i && v.phase === 'play') cls += ' hinted';
      if (opts && opts.grabbed === i) cls += ' grabbed';
      if (v.won && c.id === 'r') cls += ' out';
      out += '<div class="' + cls + '" data-car="' + i + '" style="--paint:' + paintOf(c, i) + ';left:' + (x / n) * 100 + '%;top:' + (y / n) * 100 + '%;width:' + (w / n) * 100 + '%;height:' + (h / n) * 100 + '%">' +
        '<i class="body"><i class="glass front"></i><i class="glass back"></i></i></div>';
    });
    if (opts && opts.cursor !== null && opts.cursor !== undefined) {
      out += '<div class="tj-cursor" style="left:' + ((opts.cursor % n) / n) * 100 + '%;top:' + (Math.floor(opts.cursor / n) / n) * 100 + '%;width:' + 100 / n + '%;height:' + 100 / n + '%"></div>';
    }
    return out;
  }

  /** The vehicle on each square (its index), -1 for none. */
  function grid(v) {
    const n = v.size;
    const g = new Array(n * n).fill(-1);
    v.cars.forEach(function (c, i) {
      for (let k = 0; k < c.len; k++) g[(c.across ? c.y : c.y + k) * n + (c.across ? c.x + k : c.x)] = i;
    });
    return g;
  }

  /** How far vehicle i can slide: [lowest, highest] place along its lane. */
  function range(v, i) {
    const n = v.size;
    const c = v.cars[i];
    const g = grid(v);
    const at = function (p) { return c.across ? c.y * n + p : p * n + c.x; };
    const pos = c.across ? c.x : c.y;
    let lo = pos;
    while (lo > 0 && g[at(lo - 1)] === -1) lo--;
    let hi = pos;
    while (hi + c.len < n && g[at(hi + c.len)] === -1) hi++;
    return [lo, hi];
  }

  window.ArkTraffic = { html: html, grid: grid, range: range };
})();
